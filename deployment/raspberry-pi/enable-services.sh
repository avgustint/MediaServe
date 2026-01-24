#!/bin/bash
# Enable MediaServer services to start on boot
# This script ensures all services are enabled for automatic startup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Enabling MediaServer services for automatic startup...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${YELLOW}Note: This script requires sudo privileges.${NC}"
   echo -e "${YELLOW}Running with sudo...${NC}"
   exec sudo "$0" "$@"
fi

# Enable services
echo -e "${GREEN}Enabling mediaserver.service...${NC}"
systemctl enable mediaserver.service || echo -e "${RED}Failed to enable mediaserver.service${NC}"

echo -e "${GREEN}Enabling client-server.service...${NC}"
systemctl enable client-server.service || echo -e "${RED}Failed to enable client-server.service${NC}"

echo -e "${GREEN}Enabling kiosk.service...${NC}"
systemctl enable kiosk.service || echo -e "${RED}Failed to enable kiosk.service${NC}"

# Check if numlock service exists and enable it
if [ -f /etc/systemd/system/numlock.service ]; then
    echo -e "${GREEN}Enabling numlock.service...${NC}"
    systemctl enable numlock.service || echo -e "${YELLOW}Failed to enable numlock.service (may not be needed)${NC}"
fi

# Reload systemd
echo -e "${GREEN}Reloading systemd daemon...${NC}"
systemctl daemon-reload

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Services enabled successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Enabled services:${NC}"
systemctl list-unit-files | grep -E "(mediaserver|client-server|kiosk|numlock)" | grep enabled || echo "No enabled services found"
echo ""
echo -e "${YELLOW}Services will now start automatically on boot.${NC}"

