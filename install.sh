#!/bin/bash
set -e

echo "🚇 =========================================="
echo "   TRANSIT DASHBOARD - INSTALLATION"
echo "   Neubrutalist Edition"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Ce script doit être exécuté en tant que root"
    echo "   Utilisez: sudo bash install.sh"
    exit 1
fi

# Extract if tar.gz provided
if [ -f "transit-dashboard-v3-docker.tar.gz" ]; then
    echo "📦 Extraction de l'archive..."
    tar -xzf transit-dashboard-v3-docker.tar.gz
fi

cd transit-dashboard-v3-docker

# Check for Docker
echo "🔍 Vérification de Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    echo "   Installez Docker: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

echo "✓ Docker trouvé"

# Stop existing container
echo ""
echo "🛑 Arrêt du conteneur existant (si présent)..."
docker stop transit-dashboard 2>/dev/null || true
docker rm transit-dashboard 2>/dev/null || true

# Build image
echo ""
echo "🔨 Construction de l'image Docker..."
echo "   (Cela peut prendre quelques minutes...)"
docker build -t transit-dashboard:latest .

# Create data volume if needed
echo ""
echo "💾 Création du volume de données..."
docker volume create transit-data 2>/dev/null || true

# Run container
echo ""
echo "🚀 Démarrage du conteneur..."
docker run -d \
    --name transit-dashboard \
    --restart unless-stopped \
    -p 8080:8080 \
    -v transit-data:/data \
    transit-dashboard:latest

# Wait for startup
echo ""
echo "⏳ Attente du démarrage..."
sleep 5

# Check if running
if docker ps | grep -q transit-dashboard; then
    echo ""
    echo "✅ =========================================="
    echo "   INSTALLATION RÉUSSIE !"
    echo "=========================================="
    echo ""
    echo "📍 Dashboard: http://$(hostname -I | awk '{print $1}'):8080"
    echo "⚙️  Setup:     http://$(hostname -I | awk '{print $1}'):8080/setup"
    echo ""
    echo "📋 Commandes utiles:"
    echo "   • Logs:      docker logs transit-dashboard -f"
    echo "   • Arrêter:   docker stop transit-dashboard"
    echo "   • Redémarrer: docker restart transit-dashboard"
    echo "   • Supprimer: docker rm -f transit-dashboard"
    echo ""
    echo "🎨 Neubrutalist design avec:"
    echo "   • Police Inter (accents français)"
    echo "   • Doodles flottants animés"
    echo "   • Ombres portées épaisses"
    echo "   • Couleurs vives (cyan, rose, jaune)"
    echo ""
else
    echo ""
    echo "❌ Erreur: Le conteneur n'a pas démarré"
    echo "   Vérifiez les logs: docker logs transit-dashboard"
    exit 1
fi
