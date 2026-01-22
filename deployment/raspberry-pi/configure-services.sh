#!/bin/bash
# MediaServer Post-Deployment Configuration Script
# This script configures services, permissions, and restarts all MediaServer services
# 
# Usage:
#   ./configure-services.sh
#   Or run on Raspberry Pi: bash configure-services.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current user
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)
MEDIASERVER_DIR="/home/$CURRENT_USER/Desktop/MediaServer"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MediaServer Post-Deployment Configuration${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Error: This script should not be run as root.${NC}"
   echo -e "${YELLOW}Please run as a regular user (sudo will be used when needed).${NC}"
   exit 1
fi

# Check if MediaServer directory exists
if [ ! -d "$MEDIASERVER_DIR" ]; then
    echo -e "${RED}Error: MediaServer directory not found at $MEDIASERVER_DIR${NC}"
    echo -e "${YELLOW}Please ensure MediaServer is deployed before running this script.${NC}"
    exit 1
fi

echo -e "${BLUE}Configuration will be applied for user: $CURRENT_USER${NC}"
echo -e "${BLUE}MediaServer directory: $MEDIASERVER_DIR${NC}"
echo ""

# Step 1: Configure hostname
echo -e "${GREEN}Step 1: Configuring hostname...${NC}"
read -p "Do you want to set hostname to 'mediaplayer'? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Setting hostname to 'mediaplayer'..."
    sudo hostnamectl set-hostname mediaplayer
    sudo sed -i "s/127.0.1.1.*/127.0.1.1\tmediaplayer/" /etc/hosts
    echo -e "${GREEN}✓ Hostname configured${NC}"
else
    echo -e "${YELLOW}Hostname configuration skipped${NC}"
fi
echo ""

# Step 2: Enable MediaServer services
echo -e "${GREEN}Step 2: Enabling MediaServer services...${NC}"
echo "Enabling mediaserver, client-server, and kiosk services..."
sudo systemctl enable mediaserver.service
sudo systemctl enable client-server.service
sudo systemctl enable kiosk.service
echo -e "${GREEN}✓ All services enabled${NC}"
echo ""

# Step 3: Reload systemd
echo -e "${GREEN}Step 3: Reloading systemd daemon...${NC}"
sudo systemctl daemon-reload
echo -e "${GREEN}✓ Systemd reloaded${NC}"
echo ""

# Step 4: Restart services
echo -e "${GREEN}Step 4: Restarting services...${NC}"
echo "Restarting mediaserver..."
sudo systemctl restart mediaserver.service || echo -e "${YELLOW}Warning: mediaserver restart failed (may not be installed yet)${NC}"

echo "Restarting client-server..."
sudo systemctl restart client-server.service || echo -e "${YELLOW}Warning: client-server restart failed (may not be installed yet)${NC}"

echo "Restarting kiosk..."
sudo systemctl restart kiosk.service || echo -e "${YELLOW}Warning: kiosk restart failed (may not be installed yet)${NC}"

echo -e "${GREEN}✓ Services restarted${NC}"
echo ""

# Step 5: Check service status
echo -e "${GREEN}Step 5: Checking service status...${NC}"
echo ""
echo -e "${BLUE}--- mediaserver.service ---${NC}"
sudo systemctl status mediaserver.service --no-pager -l || echo -e "${RED}mediaserver.service not found or failed${NC}"
echo ""
echo -e "${BLUE}--- client-server.service ---${NC}"
sudo systemctl status client-server.service --no-pager -l || echo -e "${RED}client-server.service not found or failed${NC}"
echo ""
echo -e "${BLUE}--- kiosk.service ---${NC}"
sudo systemctl status kiosk.service --no-pager -l || echo -e "${RED}kiosk.service not found or failed${NC}"
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Configuration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  • Hostname: $(hostname)"
echo "  • User: $CURRENT_USER"
echo "  • MediaServer directory: $MEDIASERVER_DIR"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  • Check all service status: sudo systemctl status mediaserver client-server kiosk"
echo "  • View logs: sudo journalctl -u <service-name> -f"
echo "  • Restart a service: sudo systemctl restart <service-name>"
echo ""

