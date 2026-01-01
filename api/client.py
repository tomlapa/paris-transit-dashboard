import httpx
import os
import unicodedata
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from .models import Departure, StopDepartures, StopConfig, SearchResult
import pytz
import json
import asyncio
import re
import math
from cachetools import TTLCache

# Configure logging
logger = logging.getLogger(__name__)

# Paris timezone
PARIS_TZ = pytz.timezone('Europe/Paris')

# API endpoints
PRIM_BASE_URL = "https://prim.iledefrance-mobilites.fr/marketplace"
OPENDATA_URL = "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets"
ADDRESS_API_URL = "https://api-adresse.data.gouv.fr"


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters"""
    R = 6371000  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


class IDFMClient:
    """
    Client for IDFM APIs:
    - PRIM API (with apikey): Real-time departures via stop-monitoring
    - Local search index: Pre-built from real-time data perimeter CSV
    - French Address API (no auth): Geocoding addresses

    Optimized for Raspberry Pi with:
    - Connection pooling (reused HTTP client)
    - TTL-based caching (20 second cache for departures)
    - Exponential backoff for retries
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.prim_headers = {
            "apikey": api_key,
            "Accept": "application/json"
        }
        # Load local search index
        self._search_index = self._load_search_index()

        # HTTP connection pool for reusing connections
        self._http_client = httpx.AsyncClient(
            timeout=15.0,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
        )

        # TTL cache for departures (20 second cache, max 100 entries)
        self._departures_cache = TTLCache(maxsize=100, ttl=20)
    
    def _load_search_index(self) -> Dict:
        """Load pre-built search index from JSON"""
        try:
            index_path = os.path.join(os.path.dirname(__file__), '../data/search_index.json')
            with open(index_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load search index: {e}")
            return {"stops": {}, "search_terms": {}}
    
    def _get_paris_time(self) -> datetime:
        return datetime.now(PARIS_TZ)
    
    def _parse_idfm_time(self, time_str: str) -> datetime:
        if not time_str:
            return self._get_paris_time()
        try:
            if '.' in time_str:
                time_str = time_str.split('.')[0] + 'Z'
            dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
            return dt.astimezone(PARIS_TZ)
        except Exception:
            return self._get_paris_time()
    
    # ==================== ADDRESS SEARCH ====================
    
    async def search_address(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for addresses using French government API
        Returns list of addresses with coordinates
        """
        results = []
        
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                url = f"{ADDRESS_API_URL}/search/"
                params = {
                    "q": query,
                    "limit": 10,
                    "autocomplete": 1
                }
                
                response = await client.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    features = data.get("features", [])
                    
                    for feature in features:
                        props = feature.get("properties", {})
                        geom = feature.get("geometry", {})
                        coords = geom.get("coordinates", [0, 0])
                        
                        # Filter to Île-de-France region
                        context = props.get("context", "")
                        if not any(dept in context for dept in ["75", "77", "78", "91", "92", "93", "94", "95", "Île-de-France"]):
                            continue
                        
                        results.append({
                            "label": props.get("label", ""),
                            "city": props.get("city", ""),
                            "postcode": props.get("postcode", ""),
                            "lon": coords[0],
                            "lat": coords[1],
                            "type": props.get("type", "")
                        })
        except Exception as e:
            logger.error(f"Address search error: {e}")

        return results
    
    async def find_stops_near(self, lat: float, lon: float, radius_m: int = 500) -> List[Dict[str, Any]]:
        """
        Find all stops within radius meters of given coordinates
        Uses multiple strategies with fallbacks for reliability
        """
        stops = []
        
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                url = f"{OPENDATA_URL}/arrets-lignes/records"
                
                # Strategy 1: Try geo distance query (fast when it works)
                try:
                    params = {
                        "where": f"distance(pointgeo, geom'POINT({lon} {lat})', {radius_m}m)",
                        "limit": 100,
                        "select": "stop_id,stop_name,stop_lat,stop_lon,nom_commune"
                    }
                    
                    response = await client.get(url, params=params, timeout=8)
                    
                    if response.status_code == 200:
                        data = response.json()
                        records = data.get("results", [])
                        
                        if len(records) > 0:
                            # Success! Process results
                            all_records = records
                        else:
                            # No results, try fallback
                            raise Exception("No results from geo query")
                    else:
                        raise Exception(f"Geo query failed: {response.status_code}")
                        
                except Exception as e:
                    # Strategy 2: Fallback to wider area search
                    logger.debug(f"Geo query failed, using fallback: {e}")
                    
                    # Get larger dataset and filter in Python
                    params = {
                        "limit": 1000,
                        "select": "stop_id,stop_name,stop_lat,stop_lon,nom_commune"
                    }
                    
                    response = await client.get(url, params=params, timeout=10)
                    
                    if response.status_code == 200:
                        data = response.json()
                        all_records = data.get("results", [])
                    else:
                        return []
                
                # Process records: deduplicate and calculate distances
                seen_stops = {}
                for record in all_records:
                    stop_id = record.get("stop_id", "")
                    if not stop_id or stop_id in seen_stops:
                        continue
                    
                    # Parse coordinates
                    try:
                        stop_lat = float(record.get("stop_lat", 0))
                        stop_lon = float(record.get("stop_lon", 0))
                    except (ValueError, TypeError):
                        continue
                    
                    if not stop_lat or not stop_lon:
                        continue
                    
                    # Calculate distance
                    distance = haversine_distance(lat, lon, stop_lat, stop_lon)
                    
                    # Only include stops within radius
                    if distance <= radius_m:
                        seen_stops[stop_id] = {
                            "stop_id": self._convert_stop_id(stop_id),
                            "stop_id_raw": stop_id,
                            "stop_name": record.get("stop_name", ""),
                            "distance": int(distance),
                            "lat": stop_lat,
                            "lon": stop_lon,
                            "town": record.get("nom_commune", "")
                        }
                
                # Sort by distance
                stops = sorted(seen_stops.values(), key=lambda x: x["distance"])
        
        except Exception as e:
            logger.error(f"Find stops near error: {e}")

        return stops[:20]
    
    async def get_lines_at_stop(self, stop_id_raw: str) -> List[Dict[str, Any]]:
        """
        Get all lines that serve a specific stop
        Uses the raw IDFM stop_id (e.g., IDFM:25805)
        """
        lines = []
        
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                url = f"{OPENDATA_URL}/arrets-lignes/records"
                params = {
                    "where": f"stop_id = '{stop_id_raw}'",
                    "limit": 50,
                    "select": "id,shortname,route_long_name,mode,operatorname"
                }
                
                response = await client.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    records = data.get("results", [])
                    
                    seen = set()
                    for record in records:
                        line_id_raw = record.get("id", "")
                        line_name = record.get("shortname") or record.get("route_long_name", "")
                        
                        if line_name in seen:
                            continue
                        seen.add(line_name)
                        
                        lines.append({
                            "line_id": self._convert_line_id_from_opendata(line_id_raw),
                            "line_name": line_name,
                            "mode": record.get("mode", "Bus"),
                            "transport_type": self._mode_name_to_transport(record.get("mode", "Bus")),
                            "operator": record.get("operatorname", "")
                        })
        except Exception as e:
            logger.error(f"Get lines at stop error: {e}")

        return lines
    
    # ==================== STOP SEARCH (legacy) ====================
    
    def _normalize_text(self, text: str) -> str:
        """Remove accents and normalize text for search"""
        # Normalize to NFD (decompose accents)
        nfd = unicodedata.normalize('NFD', text)
        # Remove accent marks (category Mn = Mark, Nonspacing)
        without_accents = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')
        return without_accents.lower().strip()
    
    async def search_stops(self, query: str, transport_type: str = None) -> List[SearchResult]:
        """Search stops using local index (built from real-time data perimeter)"""
        results = []
        
        try:
            if not query or len(query) < 2:
                return results
            
            # Check if search index is loaded
            if not self._search_index or not self._search_index.get("search_terms"):
                logger.warning("Search index not loaded")
                return results
            
            # Normalize query for accent-insensitive search
            query_normalized = self._normalize_text(query)
            matched_stops = set()
            
            # Search through index terms (normalized comparison)
            for term, stop_ids in self._search_index["search_terms"].items():
                if not isinstance(term, str):
                    continue
                term_normalized = self._normalize_text(term)
                if query_normalized in term_normalized:
                    matched_stops.update(stop_ids)
        
        except Exception as e:
            logger.error(f"Error in search: {e}", exc_info=True)
            return results
        
        # Build results from matched stops
        seen = set()
        for stop_id in matched_stops:
            stop_data = self._search_index["stops"].get(stop_id)
            if not stop_data:
                continue
            
            stop_name = stop_data["name"]
            
            # Create one result per line at this stop
            for line in stop_data["lines"]:
                line_id = line["line_id"]
                line_name = line["line_name"]
                t_type = line["transport_type"]
                
                # Filter by transport type if specified
                if transport_type and t_type != transport_type:
                    continue
                
                # Deduplicate
                key = f"{stop_id}:{line_name}"
                if key in seen:
                    continue
                seen.add(key)
                
                results.append(SearchResult(
                    stop_id=stop_id,
                    stop_name=stop_name,
                    line_id=line_id,
                    line_name=line_name,
                    direction="",
                    transport_type=t_type,
                    town=""  # Town info not in perimeter CSV
                ))
        
        # Sort by relevance (exact matches first, then by stop name)
        try:
            query_normalized = self._normalize_text(query)
            results.sort(key=lambda r: (
                0 if query_normalized == self._normalize_text(r.stop_name) else 1,
                r.stop_name.lower()
            ))
        except:
            # If sorting fails, just return unsorted
            pass
        
        return results[:30]
    
    async def search_lines(self, query: str) -> List[Dict[str, Any]]:
        """Search for stops by line number"""
        results = []
        
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                url = f"{OPENDATA_URL}/arrets-lignes/records"
                params = {
                    "where": f"shortname = '{query}' OR route_long_name = '{query}'",
                    "limit": 50,
                    "select": "stop_id,stop_name,route_long_name,shortname,mode,id,nom_commune"
                }
                
                response = await client.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    records = data.get("results", [])
                    
                    seen = set()
                    for record in records:
                        stop_id_raw = record.get("stop_id", "")
                        stop_name = record.get("stop_name", "")
                        line_name = record.get("shortname") or record.get("route_long_name", "")
                        mode = record.get("mode", "Bus")
                        line_id_raw = record.get("id", "")
                        town = record.get("nom_commune", "")
                        
                        stop_id = self._convert_stop_id(stop_id_raw)
                        line_id = self._convert_line_id_from_opendata(line_id_raw)
                        t_type = self._mode_name_to_transport(mode)
                        
                        key = f"{stop_id}:{line_name}"
                        if key in seen:
                            continue
                        seen.add(key)
                        
                        results.append({
                            "stop_id": stop_id,
                            "stop_name": stop_name,
                            "line_id": line_id,
                            "line_name": line_name,
                            "transport_type": t_type,
                            "town": town
                        })
        except Exception as e:
            logger.error(f"Line search error: {e}")

        return results[:50]
    
    # ==================== REAL-TIME DATA ====================
    
    async def get_departures(self, stop_config: StopConfig) -> StopDepartures:
        """
        Get real-time departures using PRIM stop-monitoring API
        Uses TTL cache to reduce API calls (20s cache)
        Implements exponential backoff for retries
        """
        now = self._get_paris_time()

        # Check cache first
        cache_key = f"{stop_config.id}:{stop_config.direction or ''}:{stop_config.line_id or ''}"
        if cache_key in self._departures_cache:
            logger.debug(f"Cache hit for {stop_config.name}")
            return self._departures_cache[cache_key]

        # Exponential backoff retry logic
        max_retries = 3
        for attempt in range(max_retries):
            try:
                url = f"{PRIM_BASE_URL}/stop-monitoring"
                params = {"MonitoringRef": stop_config.id}

                if stop_config.line_id:
                    params["LineRef"] = stop_config.line_id

                response = await self._http_client.get(url, headers=self.prim_headers, params=params)

                if response.status_code == 429:
                    # Rate limited - wait and retry
                    wait_time = 2 ** attempt  # 1s, 2s, 4s
                    logger.warning(f"Rate limited, waiting {wait_time}s before retry")
                    await asyncio.sleep(wait_time)
                    continue

                if response.status_code == 400:
                    result = StopDepartures(
                        stop_id=stop_config.id, stop_name=stop_config.name,
                        line=stop_config.line, line_id=stop_config.line_id,
                        direction=stop_config.direction, last_updated=now,
                        departures=[], error="Arrêt inconnu"
                    )
                    # Cache error responses too to avoid hammering API
                    self._departures_cache[cache_key] = result
                    return result

                elif response.status_code != 200:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt
                        logger.warning(f"HTTP {response.status_code}, retrying in {wait_time}s")
                        await asyncio.sleep(wait_time)
                        continue
                    result = StopDepartures(
                        stop_id=stop_config.id, stop_name=stop_config.name,
                        line=stop_config.line, line_id=stop_config.line_id,
                        direction=stop_config.direction, last_updated=now,
                        departures=[], error=f"Erreur {response.status_code}"
                    )
                    self._departures_cache[cache_key] = result
                    return result

                data = response.json()
                departures = self._parse_departures(data, stop_config)

                result = StopDepartures(
                    stop_id=stop_config.id, stop_name=stop_config.name,
                    line=stop_config.line, line_id=stop_config.line_id,
                    direction=stop_config.direction, last_updated=now,
                    departures=departures
                )

                # Cache successful result
                self._departures_cache[cache_key] = result
                logger.debug(f"Fetched and cached {len(departures)} departures for {stop_config.name}")
                return result

            except httpx.TimeoutException:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.warning(f"Timeout, retrying in {wait_time}s")
                    await asyncio.sleep(wait_time)
                    continue
                return StopDepartures(
                    stop_id=stop_config.id, stop_name=stop_config.name,
                    line=stop_config.line, direction=stop_config.direction,
                    last_updated=now, departures=[], error="Timeout"
                )
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.error(f"Error fetching departures: {e}, retrying in {wait_time}s")
                    await asyncio.sleep(wait_time)
                    continue
                return StopDepartures(
                    stop_id=stop_config.id, stop_name=stop_config.name,
                    line=stop_config.line, direction=stop_config.direction,
                    last_updated=now, departures=[], error=str(e)
                )
    
    def _parse_departures(self, data: dict, stop_config: StopConfig) -> List[Departure]:
        departures = []
        try:
            delivery = data.get("Siri", {}).get("ServiceDelivery", {}).get("StopMonitoringDelivery", [])
            if not delivery:
                logger.debug("No StopMonitoringDelivery in response")
                return departures

            visits = delivery[0].get("MonitoredStopVisit", [])
            logger.debug(f"Found {len(visits)} monitored visits")
            
            for visit in visits:
                journey = visit.get("MonitoredVehicleJourney", {})
                call = journey.get("MonitoredCall", {})
                
                line_ref = journey.get("LineRef", {}).get("value", "")
                line_name = self._extract_line_name(line_ref, journey)
                
                dest_names = journey.get("DestinationName", [])
                direction = dest_names[0].get("value", "") if dest_names else ""

                logger.debug(f"Visit: line={line_name}, direction={direction}")

                # Filter by direction if specified (skip if "Toutes directions")
                if stop_config.direction and "toutes directions" not in stop_config.direction.lower():
                    if not self._direction_matches(stop_config.direction, direction):
                        logger.debug(f"Filtered out: {direction} doesn't match {stop_config.direction}")
                        continue
                
                aimed_time = call.get("AimedDepartureTime") or call.get("AimedArrivalTime", "")
                expected_time = call.get("ExpectedDepartureTime") or call.get("ExpectedArrivalTime", "")

                if not aimed_time and not expected_time:
                    logger.debug("No time data for this visit")
                    continue
                
                scheduled = self._parse_idfm_time(aimed_time or expected_time)
                expected = self._parse_idfm_time(expected_time or aimed_time)
                delay_minutes = int((expected - scheduled).total_seconds() / 60)
                
                departure_status = call.get("DepartureStatus", "")
                if "cancelled" in departure_status.lower():
                    status = "Supprimé"
                elif delay_minutes > 2:
                    status = "Retardé"
                elif delay_minutes < -1:
                    status = "En avance"
                else:
                    status = "À l'heure"
                
                departures.append(Departure(
                    line=line_name, line_id=line_ref, direction=direction,
                    scheduled=scheduled, expected=expected,
                    delay_minutes=delay_minutes, status=status,
                    is_realtime=bool(expected_time)
                ))


            departures.sort(key=lambda d: d.expected)
            return departures[:6]
        except Exception as e:
            logger.error(f"Parse error: {e}")
            return departures
    
    async def get_stop_directions(self, stop_id: str, line_id: str = None) -> List[Dict[str, Any]]:
        """Get directions from real-time PRIM API"""
        directions = []
        
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                url = f"{PRIM_BASE_URL}/stop-monitoring"
                params = {"MonitoringRef": stop_id}
                if line_id:
                    params["LineRef"] = line_id
                
                response = await client.get(url, headers=self.prim_headers, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    delivery = data.get("Siri", {}).get("ServiceDelivery", {}).get("StopMonitoringDelivery", [])
                    
                    if delivery:
                        visits = delivery[0].get("MonitoredStopVisit", [])
                        seen = set()
                        
                        for visit in visits:
                            journey = visit.get("MonitoredVehicleJourney", {})
                            dest_names = journey.get("DestinationName", [])
                            dest_ref = journey.get("DestinationRef", {}).get("value", "")
                            line_ref = journey.get("LineRef", {}).get("value", "")
                            
                            if dest_names:
                                direction = dest_names[0].get("value", "")
                                key = f"{line_ref}:{direction}"
                                
                                if key not in seen:
                                    seen.add(key)
                                    line_name = self._extract_line_name(line_ref, journey)
                                    directions.append({
                                        "direction": direction,
                                        "direction_id": dest_ref,
                                        "line_id": line_ref,
                                        "line_name": line_name
                                    })
        except Exception as e:
            logger.error(f"Get directions error: {e}")

        return directions
    
    # ==================== HELPERS ====================
    
    def _direction_matches(self, config_dir: str, api_dir: str) -> bool:
        c = config_dir.lower().strip()
        a = api_dir.lower().strip()
        return c in a or a in c
    
    def _extract_line_name(self, line_ref: str, journey: dict) -> str:
        pub_names = journey.get("PublishedLineName", [])
        if pub_names:
            return pub_names[0].get("value", "")
        if line_ref:
            parts = line_ref.split(":")
            if len(parts) >= 4:
                code = parts[3]
                if code.startswith("C0"):
                    code = code[2:].lstrip("0") or "0"
                return code
        return "?"
    
    def _convert_stop_id(self, raw_id: str) -> str:
        """Convert Open Data stop_id to STIF format for PRIM API"""
        if raw_id.startswith("STIF:"):
            return raw_id
        
        if raw_id.startswith("IDFM:"):
            numeric = raw_id.replace("IDFM:", "")
            # Handle monomodalStopPlace format
            if "monomodalStopPlace:" in numeric:
                numeric = numeric.replace("monomodalStopPlace:", "")
            return f"STIF:StopPoint:Q:{numeric}:"
        
        if raw_id.isdigit():
            return f"STIF:StopPoint:Q:{raw_id}:"
        
        numbers = re.findall(r'\d+', raw_id)
        if numbers:
            return f"STIF:StopPoint:Q:{numbers[-1]}:"
        
        return raw_id
    
    def _convert_line_id_from_opendata(self, raw_id: str) -> str:
        """Convert Open Data line id to STIF format"""
        if raw_id.startswith("STIF:"):
            return raw_id
        
        if raw_id.startswith("IDFM:"):
            code = raw_id.replace("IDFM:", "")
            return f"STIF:Line::{code}:"
        
        return f"STIF:Line::{raw_id}:" if raw_id else ""
    
    def _mode_name_to_transport(self, mode: str) -> str:
        """Convert mode name to transport type"""
        mode = mode.lower() if mode else "bus"
        if "metro" in mode or "métro" in mode:
            return "metro"
        elif "rer" in mode or "rapidtransit" in mode:
            return "rer"
        elif "tram" in mode:
            return "tram"
        elif "train" in mode or "localtrain" in mode:
            return "train"
        return "bus"
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test PRIM API connection"""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                url = f"{PRIM_BASE_URL}/stop-monitoring"
                params = {"MonitoringRef": "STIF:StopPoint:Q:473921:"}
                
                response = await client.get(url, headers=self.prim_headers, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Check for rate limit in response body
                    if isinstance(data, dict) and "rate limit" in str(data.get("message", "")).lower():
                        return {"success": False, "message": "API rate limit exceeded"}
                    
                    if "Siri" in data:
                        return {"success": True, "message": "API connectée ✓"}
                    return {"success": False, "message": "Réponse invalide"}
                elif response.status_code in [401, 403]:
                    return {"success": False, "message": "Clé API invalide"}
                elif response.status_code == 429:
                    return {"success": False, "message": "API rate limit exceeded"}
                else:
                    return {"success": False, "message": f"Erreur {response.status_code}"}
        except httpx.TimeoutException:
            return {"success": False, "message": "Timeout"}
        except Exception as e:
            return {"success": False, "message": str(e)}
