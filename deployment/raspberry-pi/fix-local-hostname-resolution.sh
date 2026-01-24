#!/bin/bash
# Script to fix local hostname resolution for mediaplayer.local
# This ensures mediaplayer.local works both locally and from network devices

set -e

echo "=== Fixing Local Hostname Resolution for mediaplayer.local ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Get current hostname
CURRENT_HOSTNAME=$(hostname)
echo "Current hostname: $CURRENT_HOSTNAME"

# Backup /etc/hosts
if [ -f /etc/hosts ]; then
    cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d_%H%M%S)
    echo "Backed up /etc/hosts"
fi

# Get the IP address to use (prefer 127.0.1.1, fallback to 127.0.0.1)
if grep -q "^127.0.1.1" /etc/hosts; then
    LOCAL_IP="127.0.1.1"
else
    LOCAL_IP="127.0.0.1"
fi

# Ensure both mediaplayer and mediaplayer.local are in /etc/hosts together
if grep -q "^$LOCAL_IP.*mediaplayer" /etc/hosts; then
    # Update existing entry to include both
    if grep -q "^$LOCAL_IP.*mediaplayer.local" /etc/hosts; then
        echo "Both mediaplayer and mediaplayer.local already found in /etc/hosts"
        grep "^$LOCAL_IP.*mediaplayer" /etc/hosts
    else
        echo "Updating /etc/hosts to include mediaplayer.local..."
        sed -i "s/^$LOCAL_IP\([[:space:]]\+\)[^[:space:]]*\(.*mediaplayer.*\)/$LOCAL_IP\1$CURRENT_HOSTNAME mediaplayer.local/" /etc/hosts || \
        sed -i "s/^$LOCAL_IP\([[:space:]]\+\)\(.*\)/$LOCAL_IP\1$CURRENT_HOSTNAME mediaplayer.local/" /etc/hosts
        echo "Updated: $LOCAL_IP    $CURRENT_HOSTNAME mediaplayer.local"
    fi
else
    # Add new entry with both hostnames
    echo "Adding mediaplayer and mediaplayer.local to /etc/hosts..."
    if grep -q "^$LOCAL_IP" /etc/hosts; then
        # Update existing 127.0.1.1 or 127.0.0.1 line
        sed -i "s/^$LOCAL_IP\([[:space:]]\+\)\(.*\)/$LOCAL_IP\1$CURRENT_HOSTNAME mediaplayer.local/" /etc/hosts
    else
        # Add new line
        echo -e "$LOCAL_IP\t$CURRENT_HOSTNAME mediaplayer.local" >> /etc/hosts
    fi
    echo "Added: $LOCAL_IP    $CURRENT_HOSTNAME mediaplayer.local"
fi

# Test resolution
echo ""
echo "Testing hostname resolution..."
echo "--- /etc/hosts entries for mediaplayer ---"
grep -E "(mediaplayer|127\.0\.1\.1|127\.0\.0\.1)" /etc/hosts | grep -v "^#"

echo ""
echo "Testing ping to mediaplayer.local..."
if ping -c 1 mediaplayer.local > /dev/null 2>&1; then
    echo "✓ mediaplayer.local resolves correctly!"
    ping -c 1 mediaplayer.local | head -2
else
    echo "✗ mediaplayer.local does not resolve"
    echo "This might be normal if network interface is down"
fi

echo ""
echo "Testing hostname command..."
hostname
hostname -f

echo ""
echo "=== Hostname Resolution Fix Complete ==="
echo ""
echo "Summary:"
echo "- Both mediaplayer and mediaplayer.local are configured in /etc/hosts"
echo "- mediaplayer.local works both locally and from network devices (via mDNS/Avahi)"
echo "- Use mediaplayer.local consistently: http://mediaplayer.local:5000"
echo "- Install Avahi for network resolution: sudo apt install -y avahi-daemon"

