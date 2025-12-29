#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="Paris Transit Dashboard"
APP_PORT=8080
INSTALL_DIR="$(pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        ${APP_NAME} - Auto Setup        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to detect public IP
detect_public_ip() {
    echo -e "${CYAN}🔍 Detecting public IP address...${NC}"
    PUBLIC_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || curl -s ipecho.net/plain || echo "")
    
    if [ -z "$PUBLIC_IP" ]; then
        echo -e "${RED}✗ Could not detect public IP${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Public IP detected: ${PUBLIC_IP}${NC}"
    return 0
}

# Function to check if port is accessible
check_port_accessible() {
    echo -e "${CYAN}🔍 Checking if port ${APP_PORT} is accessible...${NC}"
    
    # Check if port is in use locally
    if netstat -tuln 2>/dev/null | grep -q ":${APP_PORT} " || ss -tuln 2>/dev/null | grep -q ":${APP_PORT} "; then
        echo -e "${YELLOW}⚠️  Port ${APP_PORT} is already in use${NC}"
        echo "Please stop the service using this port or choose a different port."
        return 1
    fi
    
    echo -e "${GREEN}✓ Port ${APP_PORT} is available${NC}"
    return 0
}

# Function to check firewall status
check_firewall() {
    echo -e "${CYAN}🔍 Checking firewall configuration...${NC}"
    
    FIREWALL_CONFIGURED=false
    
    # Check UFW
    if command -v ufw &> /dev/null; then
        if sudo ufw status | grep -q "Status: active"; then
            echo -e "${YELLOW}⚠️  UFW firewall is active${NC}"
            if ! sudo ufw status | grep -q "${APP_PORT}"; then
                echo -e "${CYAN}📝 Opening port ${APP_PORT} in UFW...${NC}"
                sudo ufw allow ${APP_PORT}/tcp
                echo -e "${GREEN}✓ Port ${APP_PORT} opened in UFW${NC}"
                FIREWALL_CONFIGURED=true
            else
                echo -e "${GREEN}✓ Port ${APP_PORT} already open in UFW${NC}"
                FIREWALL_CONFIGURED=true
            fi
        fi
    fi
    
    # Check firewalld
    if command -v firewall-cmd &> /dev/null; then
        if sudo firewall-cmd --state 2>/dev/null | grep -q "running"; then
            echo -e "${YELLOW}⚠️  firewalld is active${NC}"
            if ! sudo firewall-cmd --list-ports | grep -q "${APP_PORT}"; then
                echo -e "${CYAN}📝 Opening port ${APP_PORT} in firewalld...${NC}"
                sudo firewall-cmd --permanent --add-port=${APP_PORT}/tcp
                sudo firewall-cmd --reload
                echo -e "${GREEN}✓ Port ${APP_PORT} opened in firewalld${NC}"
                FIREWALL_CONFIGURED=true
            else
                echo -e "${GREEN}✓ Port ${APP_PORT} already open in firewalld${NC}"
                FIREWALL_CONFIGURED=true
            fi
        fi
    fi
    
    # Check iptables
    if command -v iptables &> /dev/null && [ "$FIREWALL_CONFIGURED" = false ]; then
        if sudo iptables -L INPUT -n | grep -q "DROP\|REJECT"; then
            echo -e "${YELLOW}⚠️  iptables firewall detected${NC}"
            echo -e "${CYAN}📝 Adding iptables rule for port ${APP_PORT}...${NC}"
            sudo iptables -I INPUT -p tcp --dport ${APP_PORT} -j ACCEPT
            
            # Try to persist rules
            if command -v netfilter-persistent &> /dev/null; then
                sudo netfilter-persistent save
            elif command -v iptables-save &> /dev/null; then
                sudo iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
            fi
            
            echo -e "${GREEN}✓ Port ${APP_PORT} opened in iptables${NC}"
        fi
    fi
    
    if [ "$FIREWALL_CONFIGURED" = false ]; then
        echo -e "${GREEN}✓ No firewall blocking detected${NC}"
    fi
}

# Function to detect cloud provider
detect_cloud_provider() {
    echo -e "${CYAN}🔍 Detecting cloud provider...${NC}"
    
    CLOUD_PROVIDER="unknown"
    
    # Check AWS
    if curl -s -m 2 http://169.254.169.254/latest/meta-data/ &> /dev/null; then
        CLOUD_PROVIDER="AWS"
    # Check DigitalOcean
    elif curl -s -m 2 http://169.254.169.254/metadata/v1/ &> /dev/null; then
        CLOUD_PROVIDER="DigitalOcean"
    # Check Google Cloud
    elif curl -s -m 2 -H "Metadata-Flavor: Google" http://169.254.169.254/computeMetadata/v1/ &> /dev/null; then
        CLOUD_PROVIDER="Google Cloud"
    # Check Azure
    elif curl -s -m 2 -H "Metadata:true" http://169.254.169.254/metadata/instance?api-version=2021-02-01 &> /dev/null; then
        CLOUD_PROVIDER="Azure"
    fi
    
    if [ "$CLOUD_PROVIDER" != "unknown" ]; then
        echo -e "${GREEN}✓ Cloud provider detected: ${CLOUD_PROVIDER}${NC}"
    else
        echo -e "${YELLOW}⚠️  Cloud provider not detected (generic VPS)${NC}"
    fi
    
    # Check for cloud provider firewall hints
    if [ "$CLOUD_PROVIDER" = "AWS" ]; then
        echo -e "${YELLOW}💡 Note: If you can't access the dashboard, check AWS Security Groups${NC}"
    elif [ "$CLOUD_PROVIDER" = "DigitalOcean" ]; then
        echo -e "${YELLOW}💡 Note: If you can't access the dashboard, check DigitalOcean Cloud Firewall${NC}"
    elif [ "$CLOUD_PROVIDER" = "Google Cloud" ]; then
        echo -e "${YELLOW}💡 Note: If you can't access the dashboard, check GCP Firewall Rules${NC}"
    elif [ "$CLOUD_PROVIDER" = "Azure" ]; then
        echo -e "${YELLOW}💡 Note: If you can't access the dashboard, check Azure Network Security Groups${NC}"
    fi
}

# Function to create status page
create_status_file() {
    cat > "${INSTALL_DIR}/ACCESS-INFO.txt" << EOF
╔════════════════════════════════════════════════════════╗
║     ${APP_NAME} - Access Information     ║
╚════════════════════════════════════════════════════════╝

🌐 PUBLIC ACCESS URLS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Primary URL:      http://${PUBLIC_IP}:${APP_PORT}
Setup Page:       http://${PUBLIC_IP}:${APP_PORT}/setup
Admin Page:       http://${PUBLIC_IP}:${APP_PORT}/admin
Dashboard:        http://${PUBLIC_IP}:${APP_PORT}

📍 LOCAL ACCESS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Localhost:        http://localhost:${APP_PORT}
Local IP:         http://$(hostname -I | awk '{print $1}'):${APP_PORT}

🔧 MANAGEMENT COMMANDS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View logs:        docker compose logs -f
Restart:          docker compose restart
Stop:             docker compose down
Update:           git pull && docker compose up -d --build
Status:           docker compose ps

📊 CONTAINER INFO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Container:        transit-dashboard
Port:             ${APP_PORT}
Data Volume:      transit-data
Installation:     ${INSTALL_DIR}

🔐 NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Visit: http://${PUBLIC_IP}:${APP_PORT}/setup
2. Enter your IDFM API key (get free at: https://prim.iledefrance-mobilites.fr)
3. Add your transit stops using smart search
4. View your dashboard at: http://${PUBLIC_IP}:${APP_PORT}

🛡️ SECURITY NOTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your dashboard is publicly accessible. For production use, consider:
- Adding authentication (nginx reverse proxy with basic auth)
- Using Cloudflare Tunnel for HTTPS
- Restricting access by IP in cloud provider firewall

Generated: $(date)
EOF

    echo -e "${GREEN}✓ Access information saved to: ${INSTALL_DIR}/ACCESS-INFO.txt${NC}"
}

# Main execution
echo -e "${CYAN}Starting automatic setup...${NC}"
echo ""

# Detect public IP
if ! detect_public_ip; then
    echo -e "${RED}✗ Setup failed: Could not detect public IP${NC}"
    exit 1
fi

echo ""

# Detect cloud provider
detect_cloud_provider
echo ""

# Check port availability
if ! check_port_accessible; then
    echo -e "${RED}✗ Setup failed: Port ${APP_PORT} is not available${NC}"
    exit 1
fi

echo ""

# Check and configure firewall
check_firewall
echo ""

# Check if Docker is installed
echo -e "${CYAN}🔍 Checking Docker installation...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker not found. Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓ Docker installed${NC}"
    echo -e "${YELLOW}⚠️  Please log out and back in, then run this script again${NC}"
    exit 0
else
    echo -e "${GREEN}✓ Docker is installed${NC}"
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker Compose not found. Installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✓ Docker Compose is installed${NC}"
fi

echo ""

# Start the application
echo -e "${BLUE}🚀 Starting ${APP_NAME}...${NC}"
docker compose up -d

echo ""
echo -e "${CYAN}⏳ Waiting for application to start...${NC}"
sleep 5

# Verify container is running
if docker compose ps | grep -q "running"; then
    echo -e "${GREEN}✓ Application is running!${NC}"
else
    echo -e "${RED}✗ Application failed to start${NC}"
    echo "Check logs with: docker compose logs"
    exit 1
fi

echo ""

# Create status file
create_status_file

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              🎉 Setup Complete! 🎉                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📍 YOUR DASHBOARD IS NOW ONLINE!${NC}"
echo ""
echo -e "${CYAN}Access it at:${NC}"
echo -e "  ${GREEN}http://${PUBLIC_IP}:${APP_PORT}${NC}"
echo ""
echo -e "${CYAN}Setup page:${NC}"
echo -e "  ${GREEN}http://${PUBLIC_IP}:${APP_PORT}/setup${NC}"
echo ""
echo -e "${YELLOW}📝 Access information saved to: ACCESS-INFO.txt${NC}"
echo ""
echo -e "${CYAN}🔧 Quick commands:${NC}"
echo "  docker compose logs -f    # View logs"
echo "  docker compose restart    # Restart"
echo "  docker compose down       # Stop"
echo ""
