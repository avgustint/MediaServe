#!/bin/bash
# MediaServer Raspberry Pi Deployment Script
# This script automates the deployment of MediaServer to a Raspberry Pi
# 
# Usage:
#   ./deploy.sh [raspberry-pi-hostname-or-ip]
#
# Example:
#   ./deploy.sh pi@projektor.local
#   ./deploy.sh pi@192.168.1.100

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get target from command line argument or prompt
TARGET="${1:-}"
if [ -z "$TARGET" ]; then
    echo -e "${YELLOW}Enter Raspberry Pi SSH target (e.g., pi@projektor.local or pi@192.168.1.100):${NC}"
    read -r TARGET
fi

if [ -z "$TARGET" ]; then
    echo -e "${RED}Error: Target is required${NC}"
    exit 1
fi

echo -e "${GREEN}Deploying MediaServer to $TARGET${NC}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Check if dist directory exists
if [ ! -d "$PROJECT_ROOT/dist" ]; then
    echo -e "${YELLOW}dist directory not found. Building application...${NC}"
    cd "$PROJECT_ROOT"
    npm run build -- --profile raspberry-pi
fi

if [ ! -d "$PROJECT_ROOT/dist" ]; then
    echo -e "${RED}Error: dist directory not found after build${NC}"
    exit 1
fi

echo -e "${GREEN}Step 1: Copying files to Raspberry Pi...${NC}"

# Create remote directory structure
ssh "$TARGET" "mkdir -p /home/pi/mediaserver/{dist,deployment/raspberry-pi}"

# Copy dist directory
echo "Copying dist directory..."
scp -r "$PROJECT_ROOT/dist/" "$TARGET:/home/pi/mediaserver/"

# Copy deployment files
echo "Copying deployment files..."
scp "$SCRIPT_DIR/client-server.js" "$TARGET:/home/pi/mediaserver/deployment/raspberry-pi/"
scp "$SCRIPT_DIR/kiosk-start.sh" "$TARGET:/home/pi/mediaserver/deployment/raspberry-pi/"

# Make scripts executable
ssh "$TARGET" "chmod +x /home/pi/mediaserver/deployment/raspberry-pi/kiosk-start.sh"
ssh "$TARGET" "chmod +x /home/pi/mediaserver/deployment/raspberry-pi/client-server.js"

echo -e "${GREEN}Step 2: Installing Node.js dependencies...${NC}"
ssh "$TARGET" "cd /home/pi/mediaserver/dist && npm install --production"

echo -e "${GREEN}Step 3: Installing systemd services...${NC}"

# Copy service files
scp "$SCRIPT_DIR/mediaserver.service" "$TARGET:/tmp/"
scp "$SCRIPT_DIR/client-server.service" "$TARGET:/tmp/"
scp "$SCRIPT_DIR/kiosk.service" "$TARGET:/tmp/"

# Install services (requires sudo)
ssh "$TARGET" "sudo cp /tmp/mediaserver.service /etc/systemd/system/ && \
               sudo cp /tmp/client-server.service /etc/systemd/system/ && \
               sudo cp /tmp/kiosk.service /etc/systemd/system/ && \
               sudo systemctl daemon-reload"

echo -e "${GREEN}Step 4: Configuration instructions${NC}"
echo -e "${YELLOW}The following steps need to be completed manually on the Raspberry Pi:${NC}"
echo ""
echo "1. Configure hostname:"
echo "   sudo hostnamectl set-hostname projektor"
echo "   sudo sed -i 's/127.0.1.1.*/127.0.1.1\tprojektor/' /etc/hosts"
echo ""
echo "2. Configure static IP (if needed):"
echo "   Edit /etc/dhcpcd.conf or use raspi-config"
echo ""
echo "3. Set up WiFi Access Point (if needed):"
echo "   - Copy hostapd.conf to /etc/hostapd/hostapd.conf"
echo "   - Copy dnsmasq.conf to /etc/dnsmasq.conf (or merge with existing)"
echo "   - Configure wlan0 IP: sudo ip addr add 192.168.4.1/24 dev wlan0"
echo "   - Enable IP forwarding: sudo sysctl net.ipv4.ip_forward=1"
echo "   - Configure NAT (see README.md for details)"
echo "   - Enable services: sudo systemctl enable hostapd dnsmasq"
echo ""
echo "4. Enable MediaServer services:"
echo "   sudo systemctl enable mediaserver"
echo "   sudo systemctl enable client-server"
echo "   sudo systemctl enable kiosk"
echo ""
echo "5. Start services:"
echo "   sudo systemctl start mediaserver"
echo "   sudo systemctl start client-server"
echo "   sudo systemctl start kiosk"
echo ""
echo "6. Check service status:"
echo "   sudo systemctl status mediaserver"
echo "   sudo systemctl status client-server"
echo "   sudo systemctl status kiosk"
echo ""
echo -e "${GREEN}Deployment files copied successfully!${NC}"
echo -e "${YELLOW}See README.md for detailed configuration instructions.${NC}"

