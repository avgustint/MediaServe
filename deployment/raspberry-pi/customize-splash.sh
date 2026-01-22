#!/bin/bash
# Script to customize Raspberry Pi boot splash screen
# Usage: ./customize-splash.sh /path/to/your/splash.png

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root for certain operations
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Error: Do not run this script as root. Run as regular user and it will use sudo when needed.${NC}"
   exit 1
fi

# Check if image file is provided
if [ -z "$1" ]; then
    echo -e "${RED}Usage: $0 /path/to/your/splash.png${NC}"
    echo "Example: $0 ~/Desktop/MediaServer/deployment/raspberry-pi/splash.png"
    exit 1
fi

SPLASH_IMAGE="$1"

# Check if image file exists
if [ ! -f "$SPLASH_IMAGE" ]; then
    echo -e "${RED}Error: Image file not found: $SPLASH_IMAGE${NC}"
    exit 1
fi

# Check if image is PNG
if ! file "$SPLASH_IMAGE" | grep -qi "PNG"; then
    echo -e "${YELLOW}Warning: Image does not appear to be PNG format.${NC}"
    echo "PNG format is recommended for best compatibility."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}Customizing Raspberry Pi boot splash screen...${NC}"
echo ""

# Backup original splash image
SPLASH_PATH="/usr/share/plymouth/themes/pix/splash.png"
if [ -f "$SPLASH_PATH" ]; then
    echo "Backing up original splash image..."
    sudo cp "$SPLASH_PATH" "${SPLASH_PATH}.bak"
    echo -e "${GREEN}✓ Backup created: ${SPLASH_PATH}.bak${NC}"
else
    echo -e "${YELLOW}Warning: Default splash image not found at $SPLASH_PATH${NC}"
    echo "Plymouth may not be installed. Install with: sudo apt install plymouth"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Copy custom image
echo "Installing custom splash image..."
sudo cp "$SPLASH_IMAGE" "$SPLASH_PATH"
sudo chmod 644 "$SPLASH_PATH"
echo -e "${GREEN}✓ Custom splash image installed${NC}"

# Update initramfs
echo "Updating initramfs (this may take a moment)..."
sudo update-initramfs -u
echo -e "${GREEN}✓ Initramfs updated${NC}"

# Configure silent boot (optional)
echo ""
echo -e "${YELLOW}Do you want to enable silent boot (hide boot messages)? (y/n)${NC}"
read -p "This will hide boot logs and make boot cleaner: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Configure /boot/config.txt
    CONFIG_FILE="/boot/config.txt"
    if [ -f "$CONFIG_FILE" ]; then
        if ! grep -q "disable_splash=1" "$CONFIG_FILE"; then
            echo "Adding disable_splash=1 to $CONFIG_FILE..."
            echo "disable_splash=1" | sudo tee -a "$CONFIG_FILE" > /dev/null
            echo -e "${GREEN}✓ Silent boot enabled in config.txt${NC}"
        else
            echo -e "${GREEN}✓ Silent boot already configured in config.txt${NC}"
        fi
    else
        echo -e "${YELLOW}Warning: $CONFIG_FILE not found${NC}"
    fi
    
    # Configure /boot/cmdline.txt
    CMDLINE_FILE="/boot/cmdline.txt"
    if [ -f "$CMDLINE_FILE" ]; then
        # Check if parameters already exist
        if ! grep -q "logo.nologo" "$CMDLINE_FILE"; then
            echo "Adding silent boot parameters to $CMDLINE_FILE..."
            # Read current cmdline, append parameters, write back
            CURRENT_CMDLINE=$(cat "$CMDLINE_FILE")
            NEW_CMDLINE="$CURRENT_CMDLINE logo.nologo quiet loglevel=3 vt.global_cursor_default=0"
            echo "$NEW_CMDLINE" | sudo tee "$CMDLINE_FILE" > /dev/null
            echo -e "${GREEN}✓ Silent boot parameters added to cmdline.txt${NC}"
        else
            echo -e "${GREEN}✓ Silent boot parameters already in cmdline.txt${NC}"
        fi
    else
        echo -e "${YELLOW}Warning: $CMDLINE_FILE not found${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✓ Splash screen customization complete!${NC}"
echo ""
echo "Changes will take effect after reboot."
echo ""
read -p "Reboot now to see changes? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Rebooting in 3 seconds..."
    sleep 3
    sudo reboot
else
    echo "Reboot manually with: sudo reboot"
fi

