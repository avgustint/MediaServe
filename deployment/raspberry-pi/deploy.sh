#!/bin/bash
# MediaServer Raspberry Pi Deployment Script
# This script automates the deployment of MediaServer to a Raspberry Pi
# 
# Usage:
#   ./deploy.sh [raspberry-pi-hostname-or-ip]
#
# Example:
#   ./deploy.sh avgustin@mediaplayer.local
#   ./deploy.sh avgustin@192.168.1.100

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get target from command line argument or prompt
TARGET="${1:-}"
if [ -z "$TARGET" ]; then
    echo -e "${YELLOW}Enter Raspberry Pi SSH target (e.g., avgustin@mediaplayer.local or avgustin@192.168.1.100):${NC}"
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

# Setup SSH ControlMaster for connection reuse (reduces password prompts)
SSH_CONTROL_PATH="$HOME/.ssh/control-%r@%h:%p"
mkdir -p "$HOME/.ssh"

# Establish control master connection (this will prompt for password ONCE)
# ControlMaster=yes forces this to be the master connection
# ControlPersist=300s keeps connection alive for 5 minutes
echo -e "${YELLOW}Establishing SSH connection (you will be prompted for password once)...${NC}"
ssh -o ControlMaster=yes -o ControlPath="$SSH_CONTROL_PATH" -o ControlPersist=300s -o ConnectTimeout=10 -o ServerAliveInterval=60 -o ServerAliveCountMax=3 "$TARGET" "echo 'SSH connection established'" || {
    echo -e "${RED}Failed to establish SSH connection${NC}"
    echo -e "${YELLOW}Note: To avoid password prompts, set up SSH key authentication:${NC}"
    echo -e "${YELLOW}   ssh-copy-id $TARGET${NC}"
    exit 1
}
echo -e "${GREEN}✓ SSH connection established - subsequent commands will reuse this connection${NC}"
echo ""

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

# Create remote directory structure and make scripts executable in one SSH session
# Use ControlMaster=auto to reuse the existing control connection
ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "mkdir -p /home/avgustin/Desktop/MediaServer/{dist,deployment/raspberry-pi}"

# Copy dist directory
echo "Copying dist directory..."
# Use ControlMaster=auto to reuse the existing control connection
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" -r "$PROJECT_ROOT/dist/" "$TARGET:/home/avgustin/Desktop/MediaServer/"

# Copy deployment files
echo "Copying deployment files..."
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/client-server.js" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/kiosk-start.sh" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/kiosk-launcher.html" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/configure-services.sh" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/"

# Make scripts executable (combined into one command)
ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "chmod +x /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/kiosk-start.sh /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/client-server.js /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/configure-services.sh"

echo -e "${GREEN}Step 2: Installing Node.js dependencies...${NC}"
ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "cd /home/avgustin/Desktop/MediaServer/dist && npm install --omit=dev"

echo -e "${GREEN}Step 3: Installing systemd services...${NC}"

# Copy service files (all in parallel using connection reuse)
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/mediaserver.service" "$TARGET:/tmp/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/client-server.service" "$TARGET:/tmp/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/kiosk.service" "$TARGET:/tmp/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/numlock.service" "$TARGET:/tmp/" 2>/dev/null || true

# Install services (requires sudo)
ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "sudo cp /tmp/mediaserver.service /etc/systemd/system/ && \
               sudo cp /tmp/client-server.service /etc/systemd/system/ && \
               sudo cp /tmp/kiosk.service /etc/systemd/system/ && \
               sudo cp /tmp/numlock.service /etc/systemd/system/ 2>/dev/null || true && \
               sudo systemctl daemon-reload"

echo -e "${GREEN}Step 4: Configuration instructions${NC}"
echo -e "${YELLOW}The following steps need to be completed manually on the Raspberry Pi:${NC}"
echo ""
echo "1. Configure hostname:"
echo "   sudo hostnamectl set-hostname mediaplayer"
echo "   sudo sed -i 's/127.0.1.1.*/127.0.1.1\tmediaplayer/' /etc/hosts"
echo ""
echo "2. Enable MediaServer services:"
echo "   sudo systemctl enable mediaserver"
echo "   sudo systemctl enable client-server"
echo "   sudo systemctl enable kiosk"
echo ""
echo "3. Start services:"
echo "   sudo systemctl start mediaserver"
echo "   sudo systemctl start client-server"
echo "   sudo systemctl start kiosk"
echo ""
echo "4. Check service status:"
echo "   sudo systemctl status mediaserver"
echo "   sudo systemctl status client-server"
echo "   sudo systemctl status kiosk"
echo ""
# Close SSH control connection
ssh -o ControlPath="$SSH_CONTROL_PATH" -O exit "$TARGET" 2>/dev/null || true

echo -e "${GREEN}Deployment files copied successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. SSH into the Raspberry Pi: ssh $TARGET"
echo "  2. Run the configuration script:"
echo "     cd /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi"
echo "     bash configure-services.sh"
echo ""
echo "  Or configure manually - see instructions above."
echo ""
echo -e "${YELLOW}Tip: To avoid password prompts in the future, set up SSH key authentication:${NC}"
echo "   ssh-copy-id $TARGET"

