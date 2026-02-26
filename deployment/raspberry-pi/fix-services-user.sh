#!/bin/bash
# Fix systemd service files to use the correct username
# This script updates all service files to use the current user instead of hardcoded 'avgustin'

set -e

CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

echo "Updating service files to use user: $CURRENT_USER, group: $CURRENT_GROUP"

SERVICES_DIR="/etc/systemd/system"
SERVICE_FILES=("mediaserver.service" "client-server.service" "kiosk.service" "keyboard-listener.service")

for service in "${SERVICE_FILES[@]}"; do
    SERVICE_PATH="$SERVICES_DIR/$service"
    
    if [ -f "$SERVICE_PATH" ]; then
        echo "Updating $service..."
        # Update username (match any username that's not the current one)
        sudo sed -i "s/^User=.*/User=$CURRENT_USER/g" "$SERVICE_PATH"
        # Update group
        sudo sed -i "s/^Group=.*/Group=$CURRENT_GROUP/g" "$SERVICE_PATH"
        # Update paths
        sudo sed -i "s|/home/avgustin/Desktop/MediaServer|/home/$CURRENT_USER/Desktop/MediaServer|g" "$SERVICE_PATH"
        sudo sed -i "s|/home/.*/Desktop/MediaServer|/home/$CURRENT_USER/Desktop/MediaServer|g" "$SERVICE_PATH"
        # Update placeholder paths like /path/to/MediaServer
        sudo sed -i "s|/path/to/MediaServer|/home/$CURRENT_USER/Desktop/MediaServer/dist|g" "$SERVICE_PATH"
        # Update XAUTHORITY path
        sudo sed -i "s|XAUTHORITY=/home/[^/]*|XAUTHORITY=/home/$CURRENT_USER|g" "$SERVICE_PATH"
        echo "  ✓ Updated $service"
    else
        echo "  ⚠️  $service not found, skipping"
    fi
done

echo ""
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

echo ""
echo "✓ Service files updated successfully!"
echo ""
echo "Next steps:"
echo "  sudo systemctl restart mediaserver"
echo "  sudo systemctl restart client-server"
echo "  sudo systemctl restart kiosk"
echo "  sudo systemctl restart keyboard-listener  # If configured"

