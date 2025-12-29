from fastapi import FastAPI, Request, HTTPException, Form
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import asyncio
import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
import pytz

from api.client import IDFMClient, PARIS_TZ
from api.config import ConfigManager
from api.models import StopConfig, StopDepartures

# Initialize app
app = FastAPI(title="Paris Transit Dashboard")

# Mount static files and templates
static_dir = Path(__file__).parent / "static"
templates_dir = Path(__file__).parent / "templates"

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
templates = Jinja2Templates(directory=str(templates_dir))

# Global state
config_path = os.getenv("CONFIG_PATH", "config.yaml")
config_manager = ConfigManager(config_path)
idfm_client: Optional[IDFMClient] = None
current_data: Dict[str, StopDepartures] = {}
background_task = None


def get_client() -> Optional[IDFMClient]:
    """Get or create IDFM client"""
    global idfm_client
    if config_manager.api_key and not idfm_client:
        idfm_client = IDFMClient(config_manager.api_key)
    return idfm_client


def paris_now() -> datetime:
    """Get current Paris time"""
    return datetime.now(PARIS_TZ)


async def fetch_all_stops():
    """Background task to continuously refresh transit data"""
    global current_data
    
    while True:
        client = get_client()
        if client and config_manager.stops:
            print(f"[{paris_now().strftime('%H:%M:%S')}] Fetching transit data...")
            
            for stop_config in config_manager.stops:
                try:
                    departures = await client.get_departures(stop_config)
                    key = f"{stop_config.id}:{stop_config.direction or ''}"
                    current_data[key] = departures
                except Exception as e:
                    print(f"  Error fetching {stop_config.name}: {e}")
            
            print(f"  ✓ Updated {len(config_manager.stops)} stops")
        
        await asyncio.sleep(config_manager.refresh_interval)


@app.on_event("startup")
async def startup():
    """Start background refresh task on app startup"""
    global background_task
    print("🚀 Transit Dashboard starting...")
    
    if config_manager.is_configured():
        print(f"📍 Monitoring {len(config_manager.stops)} stops")
        background_task = asyncio.create_task(fetch_all_stops())
    else:
        print("⚠️  Dashboard not configured - visit /setup or /admin")


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Serve the main dashboard page"""
    if not config_manager.is_configured():
        return RedirectResponse(url="/setup")
    
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "stops": config_manager.stops,
        "paris_time": paris_now().strftime("%H:%M:%S")
    })


@app.get("/setup", response_class=HTMLResponse)
async def setup_page(request: Request):
    """Setup wizard for first-time configuration"""
    return templates.TemplateResponse("setup.html", {
        "request": request,
        "has_api_key": bool(config_manager.api_key),
        "stops": config_manager.stops
    })


@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    """Admin page for managing stops"""
    return templates.TemplateResponse("admin.html", {
        "request": request,
        "config": config_manager.config,
        "stops": config_manager.stops,
        "api_key_set": bool(config_manager.api_key)
    })


@app.get("/api/departures")
async def get_departures():
    """Get current departure data for all configured stops"""
    stops_data = []
    
    for i, stop_config in enumerate(config_manager.stops):
        key = f"{stop_config.id}:{stop_config.direction or ''}"
        
        if key in current_data:
            data = current_data[key]
            stops_data.append({
                "index": i,
                "id": stop_config.id,
                "name": stop_config.name,
                "line": stop_config.line,
                "direction": stop_config.direction,
                "transport_type": stop_config.transport_type,
                "last_updated": data.last_updated.isoformat(),
                "departures": [
                    {
                        "line": dep.line,
                        "direction": dep.direction,
                        "scheduled": dep.scheduled.isoformat(),
                        "expected": dep.expected.isoformat(),
                        "delay_minutes": dep.delay_minutes,
                        "status": dep.status,
                        "is_realtime": dep.is_realtime
                    }
                    for dep in data.departures[:config_manager.max_departures]
                ],
                "is_cached": data.is_cached,
                "error": data.error
            })
        else:
            stops_data.append({
                "index": i,
                "id": stop_config.id,
                "name": stop_config.name,
                "line": stop_config.line,
                "direction": stop_config.direction,
                "transport_type": stop_config.transport_type,
                "departures": [],
                "error": "En attente de données..."
            })
    
    return {
        "timestamp": paris_now().isoformat(),
        "paris_time": paris_now().strftime("%H:%M:%S"),
        "stops": stops_data,
        "num_columns": min(4, max(1, len(stops_data)))
    }


@app.get("/events")
async def events():
    """Server-Sent Events endpoint for real-time updates"""
    async def event_stream():
        while True:
            try:
                data = await get_departures()
                event_data = json.dumps(data, default=str)
                yield f"data: {event_data}\n\n"
            except Exception as e:
                print(f"SSE error: {e}")
            
            await asyncio.sleep(5)
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


# === API Configuration Endpoints ===

@app.post("/api/config/apikey")
async def set_api_key(api_key: str = Form(...)):
    """Set or update API key"""
    global idfm_client, background_task
    
    config_manager.api_key = api_key
    idfm_client = IDFMClient(api_key)
    
    # Test the connection
    result = await idfm_client.test_connection()
    
    if result["success"]:
        # Start background task if not running
        if background_task is None or background_task.done():
            background_task = asyncio.create_task(fetch_all_stops())
    
    return result


@app.get("/api/config/test")
async def test_api():
    """Test API connection"""
    client = get_client()
    if not client:
        return {"success": False, "message": "Clé API non configurée"}
    return await client.test_connection()


@app.get("/api/search/stops")
async def search_stops(q: str, transport_type: str = None):
    """Search for stops by name"""
    client = get_client()
    if not client:
        return {"error": "API non configurée", "results": []}
    
    results = await client.search_stops(q, transport_type)
    return {"results": [r.model_dump() for r in results]}


@app.get("/api/search/lines")
async def search_lines(q: str):
    """Search for lines by name/number"""
    client = get_client()
    if not client:
        return {"error": "API non configurée", "results": []}
    
    results = await client.search_lines(q)
    return {"results": results}


@app.get("/api/search/address")
async def search_address(q: str):
    """Search for addresses using French government API"""
    client = get_client()
    if not client:
        return {"error": "API non configurée", "results": []}
    
    results = await client.search_address(q)
    return {"results": results}


@app.get("/api/stops/nearby")
async def find_nearby_stops(lat: float, lon: float, radius: int = 500):
    """Find stops within radius meters of coordinates"""
    client = get_client()
    if not client:
        return {"error": "API non configurée", "results": []}
    
    results = await client.find_stops_near(lat, lon, radius)
    return {"results": results}


@app.get("/api/stop/lines")
async def get_lines_at_stop(stop_id: str):
    """Get all lines serving a stop (using raw IDFM stop_id)"""
    client = get_client()
    if not client:
        return {"error": "API non configurée", "results": []}
    
    results = await client.get_lines_at_stop(stop_id)
    return {"results": results}


@app.get("/api/stop/directions")
async def get_directions(stop_id: str, line_id: str = None):
    """Get available directions at a stop"""
    client = get_client()
    if not client:
        return {"error": "API non configurée", "directions": []}
    
    directions = await client.get_stop_directions(stop_id, line_id)
    return {"directions": directions}


@app.post("/api/stops/add")
async def add_stop(
    stop_id: str = Form(...),
    stop_name: str = Form(...),
    line: str = Form(...),
    line_id: str = Form(None),
    direction: str = Form(None),
    direction_id: str = Form(None),
    transport_type: str = Form("bus")
):
    """Add a new stop to monitoring"""
    stop = StopConfig(
        id=stop_id,
        name=stop_name,
        line=line,
        line_id=line_id,
        direction=direction,
        direction_id=direction_id,
        transport_type=transport_type
    )
    
    success = config_manager.add_stop(stop)
    
    if success:
        return {"success": True, "message": f"Arrêt {stop_name} ajouté"}
    else:
        return {"success": False, "message": "Cet arrêt existe déjà"}


@app.post("/api/stops/remove")
async def remove_stop(stop_id: str = Form(...), direction: str = Form(None)):
    """Remove a stop from monitoring"""
    success = config_manager.remove_stop(stop_id, direction)
    
    if success:
        # Clean up cached data
        key = f"{stop_id}:{direction or ''}"
        if key in current_data:
            del current_data[key]
        return {"success": True}
    return {"success": False, "message": "Arrêt non trouvé"}


@app.post("/api/stops/reorder")
async def reorder_stops(order: List[int]):
    """Reorder stops"""
    success = config_manager.reorder_stops(order)
    return {"success": success}


@app.get("/api/config")
async def get_config():
    """Get current configuration"""
    return {
        "api_key_set": bool(config_manager.api_key),
        "refresh_interval": config_manager.refresh_interval,
        "max_departures": config_manager.max_departures,
        "stops": [s.model_dump() for s in config_manager.stops],
        "is_configured": config_manager.is_configured()
    }


@app.post("/api/config/refresh_interval")
async def set_refresh_interval(interval: int = Form(...)):
    """Set refresh interval"""
    if 10 <= interval <= 300:
        config_manager.refresh_interval = interval
        return {"success": True}
    return {"success": False, "message": "Intervalle doit être entre 10 et 300 secondes"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "configured": config_manager.is_configured(),
        "stops_count": len(config_manager.stops),
        "paris_time": paris_now().strftime("%H:%M:%S")
    }


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("TRANSIT_PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
