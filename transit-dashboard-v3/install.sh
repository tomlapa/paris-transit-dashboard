#!/bin/bash

# ============================================================
# Paris Transit Dashboard - Universal Installer
# Works on Ubuntu Server, Debian, Raspberry Pi OS
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_PORT=8080
INSTALL_DIR="/opt/transit-dashboard"
SERVICE_NAME="transit-dashboard"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         🚇 Paris Transit Dashboard Installer 🚇          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root for system install
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Note: Running without sudo - will install in user directory${NC}"
    INSTALL_DIR="$HOME/transit-dashboard"
    USER_INSTALL=true
else
    USER_INSTALL=false
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    OS="unknown"
fi

echo -e "${GREEN}Detected OS: $OS $VERSION${NC}"

# Check for Raspberry Pi
IS_RASPI=false
if [ -f /proc/device-tree/model ]; then
    if grep -q "Raspberry Pi" /proc/device-tree/model; then
        IS_RASPI=true
        echo -e "${GREEN}Detected: Raspberry Pi${NC}"
    fi
fi

# ============================================================
# Step 1: Install system dependencies
# ============================================================
echo -e "\n${BLUE}[1/5] Installing system dependencies...${NC}"

if [ "$USER_INSTALL" = false ]; then
    apt-get update -qq
    apt-get install -y -qq python3 python3-pip python3-venv curl
else
    echo "Skipping apt install (no sudo). Ensure python3 and pip are installed."
fi

# ============================================================
# Step 2: Ask for configuration
# ============================================================
echo -e "\n${BLUE}[2/5] Configuration...${NC}"

# Port
read -p "Port for the dashboard [${DEFAULT_PORT}]: " PORT
PORT=${PORT:-$DEFAULT_PORT}

# Validate port
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    echo -e "${RED}Invalid port. Using default: ${DEFAULT_PORT}${NC}"
    PORT=$DEFAULT_PORT
fi

echo -e "${GREEN}Dashboard will run on port: ${PORT}${NC}"

# ============================================================
# Step 3: Create installation directory
# ============================================================
echo -e "\n${BLUE}[3/5] Setting up installation directory...${NC}"

# Create directory
mkdir -p "$INSTALL_DIR"

# Copy files
echo "Copying files to $INSTALL_DIR..."
cp -r "$CURRENT_DIR"/* "$INSTALL_DIR/"

# Create virtual environment
echo "Creating Python virtual environment..."
python3 -m venv "$INSTALL_DIR/venv"

# Install Python dependencies
echo "Installing Python dependencies..."
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip -q
"$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/requirements.txt" -q

echo -e "${GREEN}✓ Dependencies installed${NC}"

# ============================================================
# Step 4: Create systemd service
# ============================================================
echo -e "\n${BLUE}[4/5] Creating systemd service...${NC}"

if [ "$USER_INSTALL" = false ]; then
    # System-wide service
    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Paris Transit Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment="TRANSIT_PORT=${PORT}"
ExecStart=${INSTALL_DIR}/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port ${PORT}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Reload and enable service
    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    systemctl start ${SERVICE_NAME}
    
    echo -e "${GREEN}✓ Service created and started${NC}"
else
    # User service
    mkdir -p "$HOME/.config/systemd/user"
    cat > "$HOME/.config/systemd/user/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Paris Transit Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
Environment="TRANSIT_PORT=${PORT}"
ExecStart=${INSTALL_DIR}/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port ${PORT}
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload
    systemctl --user enable ${SERVICE_NAME}
    systemctl --user start ${SERVICE_NAME}
    
    echo -e "${GREEN}✓ User service created and started${NC}"
fi

# ============================================================
# Step 5: Create helper scripts
# ============================================================
echo -e "\n${BLUE}[5/5] Creating helper scripts...${NC}"

# Create transit-config command
cat > "$INSTALL_DIR/transit-config" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./venv/bin/python transit-config.py "$@"
EOF
chmod +x "$INSTALL_DIR/transit-config"

# Create symlink if system install
if [ "$USER_INSTALL" = false ]; then
    ln -sf "$INSTALL_DIR/transit-config" /usr/local/bin/transit-config
    echo -e "${GREEN}✓ 'transit-config' command available globally${NC}"
else
    echo -e "${YELLOW}Run configuration with: ${INSTALL_DIR}/transit-config${NC}"
fi

# ============================================================
# Raspberry Pi specific: Kiosk mode setup
# ============================================================
if [ "$IS_RASPI" = true ]; then
    echo -e "\n${BLUE}Raspberry Pi detected - Setting up kiosk mode...${NC}"
    
    read -p "Enable kiosk mode (full-screen browser on boot)? [y/N]: " ENABLE_KIOSK
    
    if [[ "$ENABLE_KIOSK" =~ ^[Yy]$ ]]; then
        # Install chromium if not present
        if [ "$USER_INSTALL" = false ]; then
            apt-get install -y -qq chromium-browser unclutter
        fi
        
        # Create autostart directory
        mkdir -p "$HOME/.config/autostart"
        
        # Create kiosk autostart
        cat > "$HOME/.config/autostart/transit-kiosk.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Transit Dashboard Kiosk
Exec=/bin/bash -c 'sleep 10 && unclutter -idle 0.5 -root & chromium-browser --noerrdialogs --disable-infobars --kiosk http://localhost:${PORT}'
X-GNOME-Autostart-enabled=true
EOF
        
        echo -e "${GREEN}✓ Kiosk mode configured - will start on next reboot${NC}"
    fi
fi

# ============================================================
# Get local IP
# ============================================================
LOCAL_IP=$(hostname -I | awk '{print $1}')

# ============================================================
# Done!
# ============================================================
echo -e "\n${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅ Installation Complete!                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "Access your dashboard at:"
echo -e "  ${BLUE}Local:   http://localhost:${PORT}${NC}"
echo -e "  ${BLUE}Network: http://${LOCAL_IP}:${PORT}${NC}"
echo ""
echo -e "First time? The dashboard will guide you through setup."
echo -e "Or use the CLI: ${YELLOW}transit-config${NC}"
echo ""
echo -e "Useful commands:"
echo -e "  ${YELLOW}sudo systemctl status ${SERVICE_NAME}${NC}  - Check status"
echo -e "  ${YELLOW}sudo systemctl restart ${SERVICE_NAME}${NC} - Restart"
echo -e "  ${YELLOW}sudo journalctl -u ${SERVICE_NAME} -f${NC}  - View logs"
echo ""

# Ask if user wants to configure now
read -p "Configure stops now using CLI? [y/N]: " CONFIGURE_NOW

if [[ "$CONFIGURE_NOW" =~ ^[Yy]$ ]]; then
    "$INSTALL_DIR/transit-config"
fi
