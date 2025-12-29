"""
Build search index from IDFM real-time data perimeter CSV
This ensures we only search stops that have real-time data available
"""
import csv
import json
from typing import List, Dict, Set
from collections import defaultdict


def parse_csv_to_search_index(csv_path: str) -> Dict:
    """
    Parse the IDFM real-time perimeter CSV into a searchable index
    
    Returns:
        {
            "stops": {
                "stop_id": {
                    "id": "STIF:StopPoint:Q:473943:",
                    "name": "Joinville-le-Pont",
                    "lines": [
                        {
                            "line_id": "STIF:Line::C01742:",
                            "line_name": "A",
                            "transport_type": "rer"
                        }
                    ],
                    "location": {"lat": 48.xxx, "lon": 2.xxx}
                }
            },
            "search_terms": {
                "joinville": ["stop_id1", "stop_id2"],
                "rer a": ["stop_id3"]
            }
        }
    """
    
    stops = {}
    lines_by_stop = defaultdict(list)
    search_terms = defaultdict(set)
    
    # Line to transport type mapping
    transport_types = {
        "C01742": "rer",  # RER A
        "C01743": "rer",  # RER B
        "C01728": "rer",  # RER D
        "C01727": "rer",  # RER C
        "C01729": "rer",  # RER E
        "C01371": "metro",  # Metro 1
        "C01372": "metro",  # Metro 2
        "C01373": "metro",  # Metro 3
        "C01374": "metro",  # Metro 4
        "C01375": "metro",  # Metro 5
        "C01376": "metro",  # Metro 6
        "C01377": "metro",  # Metro 7
        "C01378": "metro",  # Metro 8
        "C01379": "metro",  # Metro 9
        "C01380": "metro",  # Metro 10
        "C01381": "metro",  # Metro 11
        "C01382": "metro",  # Metro 12
        "C01383": "metro",  # Metro 13
        "C01384": "metro",  # Metro 14
    }
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:  # utf-8-sig handles BOM
        reader = csv.DictReader(f, delimiter=';')
        
        for row in reader:
            line_id = row['line'].strip()
            line_name = row['name_line'].strip()
            stop_id = row['ns2_stoppointref'].strip()
            stop_name = row['ns2_stopname'].strip()
            
            # Determine transport type
            line_code = line_id.replace('STIF:Line::', '').replace(':', '')
            transport_type = transport_types.get(line_code, 'bus')
            
            # Detect tram
            if line_name.startswith('T') and line_name[1:].isdigit():
                transport_type = 'tram'
            
            # Parse location (from EPSG:2154 coordinates)
            # For now, skip location conversion - we'll use it later if needed
            
            # Add to stops
            if stop_id not in stops:
                stops[stop_id] = {
                    "id": stop_id,
                    "name": stop_name,
                    "lines": []
                }
            
            # Add line to stop
            line_info = {
                "line_id": line_id,
                "line_name": line_name,
                "transport_type": transport_type
            }
            
            if line_info not in stops[stop_id]["lines"]:
                stops[stop_id]["lines"].append(line_info)
            
            # Build search terms
            # Stop name
            stop_terms = stop_name.lower().replace('-', ' ').split()
            for term in stop_terms:
                if len(term) > 2:  # Skip very short terms
                    search_terms[term].add(stop_id)
            
            # Full stop name
            search_terms[stop_name.lower()].add(stop_id)
            
            # Line name
            search_terms[line_name.lower()].add(stop_id)
            
            # Combined: "rer a", "metro 1", etc.
            search_terms[f"{transport_type} {line_name}".lower()].add(stop_id)
    
    # Convert sets to lists for JSON serialization
    search_terms_lists = {k: list(v) for k, v in search_terms.items()}
    
    return {
        "stops": stops,
        "search_terms": search_terms_lists
    }


def build_index():
    """Build and save the search index"""
    csv_path = "/mnt/user-data/uploads/perimetre-des-donnees-tr-disponibles-plateforme-idfm.csv"
    output_path = "/home/claude/transit-dashboard-v3-docker/data/search_index.json"
    
    print("Building search index from real-time data CSV...")
    index = parse_csv_to_search_index(csv_path)
    
    print(f"Indexed {len(index['stops'])} stops")
    print(f"Created {len(index['search_terms'])} search terms")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    
    print(f"Search index saved to {output_path}")
    return index


if __name__ == "__main__":
    build_index()
