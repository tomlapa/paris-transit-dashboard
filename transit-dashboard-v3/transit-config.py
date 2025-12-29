#!/usr/bin/env python3
"""
Transit Dashboard CLI - Configuration tool for headless servers
"""

import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.client import IDFMClient
from api.config import ConfigManager
from api.models import StopConfig


def clear_screen():
    os.system('clear' if os.name != 'nt' else 'cls')


def print_header(title):
    print("\n" + "=" * 50)
    print(f"  🚇 {title}")
    print("=" * 50 + "\n")


def print_menu(options):
    for i, option in enumerate(options, 1):
        print(f"  {i}. {option}")
    print()


async def test_api_key(client):
    """Test if API key works"""
    result = await client.test_connection()
    return result["success"], result["message"]


async def search_stops_interactive(client, config):
    """Interactive stop search"""
    print_header("Recherche d'arrêt")
    
    query = input("Nom de l'arrêt (ex: Ecoles de Gravelle): ").strip()
    if not query:
        return
    
    print("\nType de transport:")
    print("  1. Tous")
    print("  2. Bus")
    print("  3. Métro")
    print("  4. RER")
    print("  5. Train")
    print("  6. Tramway")
    
    transport_choice = input("\nChoix [1]: ").strip() or "1"
    transport_map = {"1": None, "2": "bus", "3": "metro", "4": "rer", "5": "train", "6": "tram"}
    transport = transport_map.get(transport_choice)
    
    print("\nRecherche en cours...")
    results = await client.search_stops(query, transport)
    
    if not results:
        print("❌ Aucun résultat trouvé")
        input("\nAppuyez sur Entrée pour continuer...")
        return
    
    # Deduplicate
    seen = set()
    unique_results = []
    for r in results:
        key = f"{r.stop_id}-{r.line_name}"
        if key not in seen:
            seen.add(key)
            unique_results.append(r)
    
    print(f"\n✓ {len(unique_results)} résultat(s) trouvé(s):\n")
    
    for i, r in enumerate(unique_results[:15], 1):
        icon = get_transport_icon(r.transport_type)
        print(f"  {i}. {icon} {r.line_name} - {r.stop_name}")
    
    choice = input("\nSélectionnez un arrêt (numéro) ou 'q' pour annuler: ").strip()
    
    if choice.lower() == 'q' or not choice.isdigit():
        return
    
    idx = int(choice) - 1
    if idx < 0 or idx >= len(unique_results):
        print("❌ Choix invalide")
        return
    
    selected = unique_results[idx]
    await select_direction(client, config, selected)


async def select_direction(client, config, stop_result):
    """Select direction for a stop"""
    print(f"\nChargement des directions pour {stop_result.stop_name}...")
    
    directions = await client.get_stop_directions(stop_result.stop_id, stop_result.line_id)
    
    if not directions:
        print("⚠️  Aucune direction disponible en temps réel")
        confirm = input("Ajouter quand même sans direction ? (o/n): ").strip().lower()
        
        if confirm == 'o':
            stop = StopConfig(
                id=stop_result.stop_id,
                name=stop_result.stop_name,
                line=stop_result.line_name,
                line_id=stop_result.line_id,
                transport_type=stop_result.transport_type
            )
            if config.add_stop(stop):
                print(f"✓ Arrêt ajouté: {stop_result.line_name} - {stop_result.stop_name}")
            else:
                print("❌ Cet arrêt existe déjà")
        return
    
    print(f"\n✓ {len(directions)} direction(s) disponible(s):\n")
    
    for i, d in enumerate(directions, 1):
        print(f"  {i}. → {d['direction']}")
    
    choice = input("\nSélectionnez une direction (numéro) ou 'q' pour annuler: ").strip()
    
    if choice.lower() == 'q' or not choice.isdigit():
        return
    
    idx = int(choice) - 1
    if idx < 0 or idx >= len(directions):
        print("❌ Choix invalide")
        return
    
    selected_dir = directions[idx]
    
    stop = StopConfig(
        id=stop_result.stop_id,
        name=stop_result.stop_name,
        line=selected_dir.get('line_name', stop_result.line_name),
        line_id=selected_dir.get('line_id', stop_result.line_id),
        direction=selected_dir['direction'],
        direction_id=selected_dir.get('direction_id'),
        transport_type=stop_result.transport_type
    )
    
    if config.add_stop(stop):
        print(f"\n✓ Arrêt ajouté: {stop.line} - {stop.name} → {stop.direction}")
    else:
        print("\n❌ Cet arrêt existe déjà")
    
    input("\nAppuyez sur Entrée pour continuer...")


def list_stops(config):
    """List configured stops"""
    print_header("Arrêts configurés")
    
    stops = config.stops
    
    if not stops:
        print("  Aucun arrêt configuré\n")
        return
    
    for i, stop in enumerate(stops, 1):
        icon = get_transport_icon(stop.transport_type)
        direction = f" → {stop.direction}" if stop.direction else ""
        print(f"  {i}. {icon} {stop.line} - {stop.name}{direction}")
    
    print()


def remove_stop_interactive(config):
    """Remove a stop interactively"""
    print_header("Supprimer un arrêt")
    
    stops = config.stops
    
    if not stops:
        print("  Aucun arrêt à supprimer\n")
        input("Appuyez sur Entrée pour continuer...")
        return
    
    for i, stop in enumerate(stops, 1):
        icon = get_transport_icon(stop.transport_type)
        direction = f" → {stop.direction}" if stop.direction else ""
        print(f"  {i}. {icon} {stop.line} - {stop.name}{direction}")
    
    choice = input("\nNuméro de l'arrêt à supprimer (ou 'q' pour annuler): ").strip()
    
    if choice.lower() == 'q' or not choice.isdigit():
        return
    
    idx = int(choice) - 1
    if idx < 0 or idx >= len(stops):
        print("❌ Choix invalide")
        return
    
    stop = stops[idx]
    confirm = input(f"Supprimer {stop.line} - {stop.name} ? (o/n): ").strip().lower()
    
    if confirm == 'o':
        if config.remove_stop(stop.id, stop.direction):
            print(f"✓ Arrêt supprimé")
        else:
            print("❌ Erreur lors de la suppression")
    
    input("\nAppuyez sur Entrée pour continuer...")


def configure_api_key(config):
    """Configure API key"""
    print_header("Configuration de la clé API")
    
    if config.api_key:
        print(f"  Clé actuelle: {config.api_key[:8]}...")
        print()
    
    print("  Obtenez votre clé API sur:")
    print("  https://prim.iledefrance-mobilites.fr/\n")
    
    key = input("Nouvelle clé API (ou Entrée pour garder l'actuelle): ").strip()
    
    if key:
        config.api_key = key
        print("✓ Clé API enregistrée")
    
    input("\nAppuyez sur Entrée pour continuer...")


def get_transport_icon(transport_type):
    icons = {
        'bus': '🚌',
        'metro': '🚇',
        'rer': '🚆',
        'train': '🚄',
        'tram': '🚊'
    }
    return icons.get(transport_type, '🚏')


async def main_menu():
    """Main menu loop"""
    config = ConfigManager()
    client = None
    
    while True:
        clear_screen()
        print_header("Transit Dashboard - Configuration")
        
        # Status
        if config.api_key:
            print(f"  🔑 Clé API: Configurée ({config.api_key[:8]}...)")
            if client is None:
                client = IDFMClient(config.api_key)
        else:
            print("  🔑 Clé API: Non configurée")
        
        print(f"  🚏 Arrêts: {len(config.stops)} configuré(s)")
        print()
        
        options = [
            "Configurer la clé API",
            "Rechercher et ajouter un arrêt",
            "Voir les arrêts configurés",
            "Supprimer un arrêt",
            "Tester la connexion API",
            "Quitter"
        ]
        print_menu(options)
        
        choice = input("Votre choix: ").strip()
        
        if choice == "1":
            configure_api_key(config)
            client = IDFMClient(config.api_key) if config.api_key else None
        
        elif choice == "2":
            if not client:
                print("\n❌ Configurez d'abord la clé API")
                input("Appuyez sur Entrée pour continuer...")
            else:
                await search_stops_interactive(client, config)
        
        elif choice == "3":
            list_stops(config)
            input("Appuyez sur Entrée pour continuer...")
        
        elif choice == "4":
            remove_stop_interactive(config)
        
        elif choice == "5":
            if not client:
                print("\n❌ Configurez d'abord la clé API")
            else:
                print("\nTest de connexion...")
                success, message = await test_api_key(client)
                if success:
                    print(f"✓ {message}")
                else:
                    print(f"❌ {message}")
            input("\nAppuyez sur Entrée pour continuer...")
        
        elif choice == "6":
            print("\n👋 Au revoir!")
            break


def main():
    """Entry point"""
    try:
        asyncio.run(main_menu())
    except KeyboardInterrupt:
        print("\n\n👋 Au revoir!")
        sys.exit(0)


if __name__ == "__main__":
    main()
