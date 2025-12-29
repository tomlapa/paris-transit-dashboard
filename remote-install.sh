#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
REPO_URL="https://github.com/tomlapa/paris-transit-dashboard.git"
INSTALL_DIR="$HOME/paris-transit-dashboard"

echo -e "${BLUE}🚇 Paris Transit Dashboard - Quick Install${NC}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo -e "${YELLOW}⚠️  Please log out and back in, then run this script again${NC}"
    exit 0
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
fi

# Clone or update repo
if [ -d "$INSTALL_DIR" ]; then
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Start services
echo ""
echo -e "${BLUE}🚀 Starting Transit Dashboard...${NC}"
docker compose up -d

# Wait for startup
sleep 5

# Get IP
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")

echo ""
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo ""
echo -e "${YELLOW}📍 Access your dashboard:${NC}"
echo "   http://localhost:8080"
echo "   http://${SERVER_IP}:8080"
echo ""
echo -e "${YELLOW}🔧 Next steps:${NC}"
echo "   1. Visit http://localhost:8080/setup"
echo "   2. Enter your IDFM API key"
echo "   3. Add your transit stops"
echo ""
echo -e "${YELLOW}📝 Management:${NC}"
echo "   cd $INSTALL_DIR"
echo "   docker compose logs -f    # View logs"
echo "   docker compose restart    # Restart"
echo "   docker compose down       # Stop"
echo ""
