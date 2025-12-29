#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Paris Transit Dashboard - Docker Installer        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo ""
    echo "Install Docker with:"
    echo "  curl -fsSL https://get.docker.com | sh"
    echo "  sudo usermod -aG docker \$USER"
    echo ""
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not available${NC}"
    echo ""
    echo "Install Docker Compose plugin:"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install docker-compose-plugin"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Docker is installed${NC}"
echo -e "${GREEN}✓ Docker Compose is available${NC}"
echo ""

# Ask for deployment type
echo -e "${YELLOW}Select deployment option:${NC}"
echo "1) Local only (port 8080)"
echo "2) With Cloudflare Tunnel (remote access)"
echo ""
read -p "Enter choice [1-2]: " DEPLOY_CHOICE

# Default to local
if [ -z "$DEPLOY_CHOICE" ]; then
    DEPLOY_CHOICE=1
fi

# Build the image
echo ""
echo -e "${BLUE}📦 Building Docker image...${NC}"
docker compose build

# Start based on choice
if [ "$DEPLOY_CHOICE" == "2" ]; then
    echo ""
    echo -e "${YELLOW}🔐 Cloudflare Tunnel Setup${NC}"
    echo "You'll need a Cloudflare tunnel token."
    echo ""
    echo "Get your token at:"
    echo "  https://one.dash.cloudflare.com/"
    echo "  → Zero Trust → Networks → Tunnels → Create tunnel"
    echo ""
    read -p "Enter your Cloudflare tunnel token: " TUNNEL_TOKEN
    
    if [ -z "$TUNNEL_TOKEN" ]; then
        echo -e "${RED}✗ No token provided, deploying locally only${NC}"
        DEPLOY_CHOICE=1
    else
        # Create docker-compose with Cloudflare
        cat > docker-compose.override.yml << EOF
version: '3.8'

services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: transit-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
EOF
        echo -e "${GREEN}✓ Cloudflare configuration created${NC}"
    fi
fi

# Start services
echo ""
echo -e "${BLUE}🚀 Starting Transit Dashboard...${NC}"
docker compose up -d

# Wait for service to be ready
echo ""
echo -e "${BLUE}⏳ Waiting for dashboard to start...${NC}"
sleep 5

# Check if container is running
if docker compose ps | grep -q "running"; then
    echo -e "${GREEN}✓ Dashboard is running!${NC}"
    echo ""
    
    # Get IP address
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              🎉 Installation Complete! 🎉             ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}📍 Access Your Dashboard:${NC}"
    echo "  • Local:   http://localhost:8080"
    echo "  • Network: http://${SERVER_IP}:8080"
    
    if [ "$DEPLOY_CHOICE" == "2" ]; then
        echo "  • Remote:  Check your Cloudflare dashboard for public URL"
    fi
    
    echo ""
    echo -e "${YELLOW}🔧 Next Steps:${NC}"
    echo "  1. Open http://localhost:8080/setup"
    echo "  2. Enter your IDFM API key"
    echo "  3. Add your transit stops"
    echo ""
    echo -e "${YELLOW}📝 Management Commands:${NC}"
    echo "  View logs:  docker compose logs -f"
    echo "  Restart:    docker compose restart"
    echo "  Stop:       docker compose down"
    echo "  Update:     docker compose pull && docker compose up -d"
    echo ""
    echo -e "${YELLOW}📖 Documentation:${NC}"
    echo "  Docker guide: ./DOCKER.md"
    echo "  Full README:  ./README.md"
    echo ""
else
    echo -e "${RED}✗ Failed to start dashboard${NC}"
    echo ""
    echo "Check logs with:"
    echo "  docker compose logs"
    exit 1
fi
