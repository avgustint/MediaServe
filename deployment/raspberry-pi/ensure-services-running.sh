#!/bin/bash
# Ensure MediaServer services are enabled and running
# This script can be run on boot or manually to ensure services are active

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Ensuring MediaServer services are enabled and running...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${YELLOW}Note: This script requires sudo privileges.${NC}"
   echo -e "${YELLOW}Running with sudo...${NC}"
   exec sudo "$0" "$@"
fi

# Reload systemd first
echo -e "${GREEN}Reloading systemd daemon...${NC}"
systemctl daemon-reload

# Enable and start services
SERVICES=("mediaserver.service" "client-server.service" "kiosk.service")

for service in "${SERVICES[@]}"; do
    if [ -f "/etc/systemd/system/$service" ]; then
        echo -e "${GREEN}Enabling and starting $service...${NC}"
        systemctl enable "$service" 2>/dev/null || echo -e "${YELLOW}Warning: Failed to enable $service${NC}"
        systemctl start "$service" 2>/dev/null || echo -e "${YELLOW}Warning: Failed to start $service (may already be running)${NC}"
        
        # Wait a moment and check status
        sleep 1
        if systemctl is-active --quiet "$service"; then
            echo -e "${GREEN}✓ $service is running${NC}"
        else
            echo -e "${RED}✗ $service is not running${NC}"
            echo -e "${YELLOW}Check status with: sudo systemctl status $service${NC}"
        fi
    else
        echo -e "${YELLOW}Warning: $service not found in /etc/systemd/system/${NC}"
    fi
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Service check complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Service status:${NC}"
for service in "${SERVICES[@]}"; do
    if systemctl is-enabled --quiet "$service" 2>/dev/null; then
        STATUS=$(systemctl is-active "$service" 2>/dev/null || echo "inactive")
        echo "  • $service: enabled, $STATUS"
    else
        echo "  • $service: not enabled"
    fi
done

