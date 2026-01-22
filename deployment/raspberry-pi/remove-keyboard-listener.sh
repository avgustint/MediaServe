#!/bin/bash
# MediaServer Keyboard Listener Service Removal Script
# This script removes the keyboard-listener service from the system
# 
# Usage:
#   ./remove-keyboard-listener.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Remove Keyboard Listener Service${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Error: This script should not be run as root.${NC}"
   echo -e "${YELLOW}Please run as a regular user (sudo will be used when needed).${NC}"
   exit 1
fi

CURRENT_USER=$(whoami)
KEYBOARD_SERVICE_FILE="/etc/systemd/system/keyboard-listener.service"

# Check if service exists
if [ ! -f "$KEYBOARD_SERVICE_FILE" ]; then
    echo -e "${YELLOW}Keyboard listener service not found at $KEYBOARD_SERVICE_FILE${NC}"
    echo -e "${YELLOW}Service may already be removed.${NC}"
    exit 0
fi

echo -e "${BLUE}Current user: $CURRENT_USER${NC}"
echo ""

# Confirm removal
read -p "Do you want to remove the keyboard-listener service? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Removal cancelled.${NC}"
    exit 0
fi

echo ""

# Step 1: Stop the service
echo -e "${GREEN}Step 1: Stopping keyboard-listener service...${NC}"
if sudo systemctl is-active --quiet keyboard-listener.service 2>/dev/null; then
    sudo systemctl stop keyboard-listener.service
    echo -e "${GREEN}✓ Service stopped${NC}"
else
    echo -e "${YELLOW}Service was not running${NC}"
fi
echo ""

# Step 2: Disable the service
echo -e "${GREEN}Step 2: Disabling keyboard-listener service...${NC}"
if sudo systemctl is-enabled --quiet keyboard-listener.service 2>/dev/null; then
    sudo systemctl disable keyboard-listener.service
    echo -e "${GREEN}✓ Service disabled${NC}"
else
    echo -e "${YELLOW}Service was not enabled${NC}"
fi
echo ""

# Step 3: Remove service file
echo -e "${GREEN}Step 3: Removing service file...${NC}"
sudo rm "$KEYBOARD_SERVICE_FILE"
sudo systemctl daemon-reload
echo -e "${GREEN}✓ Service file removed${NC}"
echo ""

# Step 4: Optional - Remove user from input group
echo -e "${GREEN}Step 4: Input group permissions${NC}"
read -p "Do you want to remove user '$CURRENT_USER' from the input group? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if groups "$CURRENT_USER" | grep -q "\binput\b"; then
        sudo gpasswd -d "$CURRENT_USER" input
        echo -e "${GREEN}✓ User removed from input group${NC}"
        echo -e "${YELLOW}Note: You may need to log out and back in for changes to take effect${NC}"
    else
        echo -e "${YELLOW}User is not in the input group${NC}"
    fi
else
    echo -e "${YELLOW}User remains in input group${NC}"
    echo -e "${BLUE}Note: This is fine if you need input group permissions for other applications${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Removal Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  • Keyboard listener service stopped and disabled"
echo "  • Service file removed"
if groups "$CURRENT_USER" | grep -q "\binput\b"; then
    echo "  • User remains in input group"
else
    echo "  • User removed from input group"
fi
echo ""
echo -e "${YELLOW}The keyboard listener service has been completely removed.${NC}"
echo ""

