import yaml
import json
from pathlib import Path
from typing import List, Optional
from .models import StopConfig


class ConfigManager:
    """Manages transit dashboard configuration"""
    
    def __init__(self, config_path: str = "config.yaml"):
        self.config_path = Path(config_path)
        self.config = self._load_config()
    
    def _load_config(self) -> dict:
        """Load configuration from YAML file"""
        if self.config_path.exists():
            with open(self.config_path) as f:
                return yaml.safe_load(f) or self._default_config()
        return self._default_config()
    
    def _default_config(self) -> dict:
        """Return default configuration"""
        return {
            "api": {
                "key": "",
                "refresh_interval_seconds": 30
            },
            "display": {
                "max_departures_per_stop": 3,
                "theme": "classic"
            },
            "stops": []
        }
    
    def save(self):
        """Save configuration to file"""
        with open(self.config_path, 'w') as f:
            yaml.dump(self.config, f, default_flow_style=False, allow_unicode=True)
    
    @property
    def api_key(self) -> str:
        return self.config.get("api", {}).get("key", "")
    
    @api_key.setter
    def api_key(self, value: str):
        if "api" not in self.config:
            self.config["api"] = {}
        self.config["api"]["key"] = value
        self.save()
    
    @property
    def refresh_interval(self) -> int:
        return self.config.get("api", {}).get("refresh_interval_seconds", 30)
    
    @refresh_interval.setter
    def refresh_interval(self, value: int):
        if "api" not in self.config:
            self.config["api"] = {}
        self.config["api"]["refresh_interval_seconds"] = value
        self.save()
    
    @property
    def max_departures(self) -> int:
        return self.config.get("display", {}).get("max_departures_per_stop", 3)
    
    @property
    def stops(self) -> List[StopConfig]:
        """Get list of configured stops"""
        stops_data = self.config.get("stops", [])
        return [StopConfig(**s) for s in stops_data]
    
    def add_stop(self, stop: StopConfig) -> bool:
        """Add a new stop configuration"""
        if "stops" not in self.config:
            self.config["stops"] = []
        
        # Check for duplicates
        for existing in self.config["stops"]:
            if existing["id"] == stop.id and existing.get("direction") == stop.direction:
                return False  # Already exists
        
        self.config["stops"].append(stop.model_dump())
        self.save()
        return True
    
    def remove_stop(self, stop_id: str, direction: str = None) -> bool:
        """Remove a stop configuration"""
        if "stops" not in self.config:
            return False
        
        initial_count = len(self.config["stops"])
        
        if direction:
            self.config["stops"] = [
                s for s in self.config["stops"]
                if not (s["id"] == stop_id and s.get("direction") == direction)
            ]
        else:
            self.config["stops"] = [
                s for s in self.config["stops"]
                if s["id"] != stop_id
            ]
        
        if len(self.config["stops"]) < initial_count:
            self.save()
            return True
        return False
    
    def update_stop(self, stop_id: str, old_direction: str, new_stop: StopConfig) -> bool:
        """Update an existing stop configuration"""
        if "stops" not in self.config:
            return False
        
        for i, s in enumerate(self.config["stops"]):
            if s["id"] == stop_id and s.get("direction") == old_direction:
                self.config["stops"][i] = new_stop.model_dump()
                self.save()
                return True
        return False
    
    def reorder_stops(self, new_order: List[int]) -> bool:
        """Reorder stops by providing new indices"""
        if "stops" not in self.config:
            return False
        
        try:
            old_stops = self.config["stops"]
            self.config["stops"] = [old_stops[i] for i in new_order if i < len(old_stops)]
            self.save()
            return True
        except Exception:
            return False
    
    def get_stop_by_index(self, index: int) -> Optional[StopConfig]:
        """Get a stop by its index"""
        stops = self.stops
        if 0 <= index < len(stops):
            return stops[index]
        return None
    
    def is_configured(self) -> bool:
        """Check if the dashboard has been configured"""
        return bool(self.api_key) and len(self.stops) > 0
    
    def export_config(self) -> str:
        """Export configuration as JSON string"""
        return json.dumps(self.config, indent=2, ensure_ascii=False)
    
    def import_config(self, config_str: str) -> bool:
        """Import configuration from JSON string"""
        try:
            new_config = json.loads(config_str)
            self.config = new_config
            self.save()
            return True
        except Exception:
            return False
