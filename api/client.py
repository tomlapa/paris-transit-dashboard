import httpx
import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from .models import Departure, StopDepartures, StopConfig, SearchResult
import pytz
import json
import asyncio
import re
import math

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
    - Open Data API (no auth): Stop and line search
    - French Address API (no auth): Geocoding addresses
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.prim_headers = {
            "apikey": api_key,
            "Accept": "application/json"
        }
        # Cache for stops data
        self._stops_cache: List[Dict] = []
        self._cache_time: Optional[datetime] = None
    
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
            print(f"Address search error: {e}")
        
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
                    print(f"Geo query failed, using fallback: {e}")
                    
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
            print(f"Find stops near error: {e}")
        
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
            print(f"Get lines at stop error: {e}")
        
        return lines
    
    # ==================== STOP SEARCH (legacy) ====================
    
    async def search_stops(self, query: str, transport_type: str = None) -> List[SearchResult]:
        """Search stops by name using IDFM Open Data API"""
        results = []
        
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                url = f"{OPENDATA_URL}/arrets-lignes/records"
                
                params = {
                    "where": f"search(stop_name, '{query}')",
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
                        
                        if transport_type and t_type != transport_type:
                            continue
                        
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
                            town=town
                        ))
        except Exception as e:
            print(f"Search error: {e}")
        
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
            print(f"Line search error: {e}")
        
        return results[:50]
    
    # ==================== REAL-TIME DATA ====================
    
    async def get_departures(self, stop_config: StopConfig) -> StopDepartures:
        """Get real-time departures using PRIM stop-monitoring API"""
        now = self._get_paris_time()
        
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                url = f"{PRIM_BASE_URL}/stop-monitoring"
                params = {"MonitoringRef": stop_config.id}
                
                if stop_config.line_id:
                    params["LineRef"] = stop_config.line_id
                
                response = await client.get(url, headers=self.prim_headers, params=params)
                
                if response.status_code == 400:
                    return StopDepartures(
                        stop_id=stop_config.id, stop_name=stop_config.name,
                        line=stop_config.line, line_id=stop_config.line_id,
                        direction=stop_config.direction, last_updated=now,
                        departures=[], error="Arrêt inconnu"
                    )
                elif response.status_code != 200:
                    return StopDepartures(
                        stop_id=stop_config.id, stop_name=stop_config.name,
                        line=stop_config.line, line_id=stop_config.line_id,
                        direction=stop_config.direction, last_updated=now,
                        departures=[], error=f"Erreur {response.status_code}"
                    )
                
                data = response.json()
                departures = self._parse_departures(data, stop_config)
                
                return StopDepartures(
                    stop_id=stop_config.id, stop_name=stop_config.name,
                    line=stop_config.line, line_id=stop_config.line_id,
                    direction=stop_config.direction, last_updated=now,
                    departures=departures
                )
                
        except httpx.TimeoutException:
            return StopDepartures(
                stop_id=stop_config.id, stop_name=stop_config.name,
                line=stop_config.line, direction=stop_config.direction,
                last_updated=now, departures=[], error="Timeout"
            )
        except Exception as e:
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
                return departures
            
            visits = delivery[0].get("MonitoredStopVisit", [])
            
            for visit in visits:
                journey = visit.get("MonitoredVehicleJourney", {})
                call = journey.get("MonitoredCall", {})
                
                line_ref = journey.get("LineRef", {}).get("value", "")
                line_name = self._extract_line_name(line_ref, journey)
                
                dest_names = journey.get("DestinationName", [])
                direction = dest_names[0].get("value", "") if dest_names else ""
                
                # Filter by direction if specified
                if stop_config.direction:
                    if not self._direction_matches(stop_config.direction, direction):
                        continue
                
                aimed_time = call.get("AimedDepartureTime") or call.get("AimedArrivalTime", "")
                expected_time = call.get("ExpectedDepartureTime") or call.get("ExpectedArrivalTime", "")
                
                if not aimed_time and not expected_time:
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
            print(f"Parse error: {e}")
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
            print(f"Get directions error: {e}")
        
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
                    if "Siri" in data:
                        return {"success": True, "message": "API connectée ✓"}
                    return {"success": False, "message": "Réponse invalide"}
                elif response.status_code in [401, 403]:
                    return {"success": False, "message": "Clé API invalide"}
                else:
                    return {"success": False, "message": f"Erreur {response.status_code}"}
        except httpx.TimeoutException:
            return {"success": False, "message": "Timeout"}
        except Exception as e:
            return {"success": False, "message": str(e)}
