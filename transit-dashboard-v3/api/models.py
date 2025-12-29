from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class Departure(BaseModel):
    line: str
    line_id: str
    direction: str
    scheduled: datetime
    expected: datetime
    delay_minutes: int
    status: str  # "À l'heure" | "Retardé" | "Supprimé" | "En avance"
    is_realtime: bool = True


class StopDepartures(BaseModel):
    stop_id: str
    stop_name: str
    line: str
    line_id: Optional[str] = None
    direction: Optional[str] = None
    last_updated: datetime
    departures: List[Departure]
    is_cached: bool = False
    error: Optional[str] = None


class StopConfig(BaseModel):
    id: str  # STIF:StopPoint:Q:XXXXX: or STIF:StopArea:SP:XXXXX:
    name: str
    line: str
    line_id: Optional[str] = None
    direction: Optional[str] = None
    direction_id: Optional[str] = None
    transport_type: str = "bus"  # bus, rer, metro, tram, train


class SearchResult(BaseModel):
    stop_id: str
    stop_name: str
    line_id: str
    line_name: str
    direction: str
    direction_id: Optional[str] = None
    transport_type: str
    town: Optional[str] = None
