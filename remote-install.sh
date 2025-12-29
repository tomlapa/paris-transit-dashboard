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

echo -e "${BLUE}🚇 Paris Transit Dashboard - One-Line Installer${NC}"
echo ""

# Check if already installed
if [ -d "$INSTALL_DIR" ]; then
    echo "Existing installation found. Updating..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo ""
echo -e "${GREEN}✓ Files downloaded${NC}"
echo ""
echo -e "${BLUE}🔧 Running automatic setup...${NC}"
echo ""

# Run auto-setup
bash auto-setup.sh
