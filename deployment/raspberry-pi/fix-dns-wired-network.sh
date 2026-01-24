#!/bin/bash
# Script to fix DNS resolution when Raspberry Pi is connected to wired network
# This is needed because dnsmasq (used for AP mode) may interfere with DNS resolution

set -e

echo "=== Fixing DNS Resolution for Wired Network ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# 1. Check if dnsmasq is running and stop it if we're on wired network
if systemctl is-active --quiet dnsmasq; then
    echo "dnsmasq is running. Checking if we should stop it..."
    
    # Check if we have a wired network connection
    if ip link show eth0 | grep -q "state UP"; then
        echo "Wired network (eth0) is active. Stopping dnsmasq..."
        systemctl stop dnsmasq
        systemctl disable dnsmasq
        echo "dnsmasq stopped and disabled."
    else
        echo "No wired network detected. Keeping dnsmasq running (AP mode)."
    fi
fi

# 2. Ensure /etc/resolv.conf is properly configured
echo ""
echo "Checking /etc/resolv.conf..."

# Backup current resolv.conf
if [ -f /etc/resolv.conf ]; then
    cp /etc/resolv.conf /etc/resolv.conf.backup.$(date +%Y%m%d_%H%M%S)
    echo "Backed up /etc/resolv.conf"
fi

# Check if resolv.conf is managed by systemd-resolved
if [ -L /etc/resolv.conf ] && [ -f /run/systemd/resolve/resolv.conf ]; then
    echo "systemd-resolved is managing DNS. Checking configuration..."
    
    # Check if systemd-resolved is running
    if systemctl is-active --quiet systemd-resolved; then
        echo "systemd-resolved is active. DNS should be working."
        echo "Current DNS servers:"
        resolvectl status | grep "DNS Servers" || cat /run/systemd/resolve/resolv.conf | grep nameserver
    else
        echo "Starting systemd-resolved..."
        systemctl start systemd-resolved
        systemctl enable systemd-resolved
    fi
elif [ -L /etc/resolv.conf ] && [ -f /run/systemd/resolve/stub-resolv.conf ]; then
    echo "systemd-resolved stub resolver detected."
    echo "Current DNS servers:"
    cat /run/systemd/resolve/resolv.conf 2>/dev/null | grep nameserver || echo "No nameservers found"
else
    # Not managed by systemd-resolved, check if it's a regular file
    if [ -f /etc/resolv.conf ] && [ ! -L /etc/resolv.conf ]; then
        echo "resolv.conf is a regular file. Checking contents..."
        
        # Check if it has nameservers
        if ! grep -q "^nameserver" /etc/resolv.conf; then
            echo "No nameservers found. Adding default DNS servers..."
            {
                echo "# DNS servers - added by fix-dns-wired-network.sh"
                echo "nameserver 8.8.8.8"
                echo "nameserver 8.8.4.4"
            } >> /etc/resolv.conf
        else
            echo "Nameservers found in resolv.conf:"
            grep "^nameserver" /etc/resolv.conf
        fi
    fi
fi

# 3. Check NetworkManager configuration (if installed)
if command -v nmcli &> /dev/null; then
    echo ""
    echo "NetworkManager detected. Checking DNS configuration..."
    
    # Get DNS servers from NetworkManager
    NM_DNS=$(nmcli dev show | grep "IP4.DNS" | awk '{print $2}' | head -2)
    if [ -n "$NM_DNS" ]; then
        echo "NetworkManager DNS servers:"
        echo "$NM_DNS"
    else
        echo "No DNS servers configured in NetworkManager."
        echo "You may need to configure DNS in NetworkManager settings."
    fi
fi

# 4. Check dhcpcd configuration (if used)
if [ -f /etc/dhcpcd.conf ]; then
    echo ""
    echo "dhcpcd.conf found. Checking DNS configuration..."
    
    if grep -q "static domain_name_servers" /etc/dhcpcd.conf; then
        echo "Static DNS servers configured in dhcpcd.conf:"
        grep "static domain_name_servers" /etc/dhcpcd.conf
    else
        echo "No static DNS servers in dhcpcd.conf (using DHCP-provided DNS)."
    fi
fi

# 5. Test DNS resolution
echo ""
echo "Testing DNS resolution..."
if nslookup google.com > /dev/null 2>&1; then
    echo "✓ DNS resolution is working!"
    echo "Resolved google.com:"
    nslookup google.com | grep -A 2 "Name:" | head -3
else
    echo "✗ DNS resolution failed!"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Check network connectivity: ping 8.8.8.8"
    echo "2. Check if DHCP provided DNS: ip route show"
    echo "3. Manually set DNS in /etc/resolv.conf or NetworkManager"
    echo "4. Restart networking: sudo systemctl restart NetworkManager (or networking)"
    exit 1
fi

# 6. Restart networking services if needed
echo ""
read -p "Restart NetworkManager/systemd-resolved to apply changes? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if systemctl is-active --quiet NetworkManager; then
        echo "Restarting NetworkManager..."
        systemctl restart NetworkManager
    elif systemctl is-active --quiet systemd-resolved; then
        echo "Restarting systemd-resolved..."
        systemctl restart systemd-resolved
    elif systemctl is-active --quiet networking; then
        echo "Restarting networking..."
        systemctl restart networking
    else
        echo "No networking service found to restart."
    fi
fi

echo ""
echo "=== DNS Configuration Complete ==="
echo ""
echo "Current DNS configuration:"
echo "--- /etc/resolv.conf ---"
cat /etc/resolv.conf
echo ""
echo "Active DNS servers:"
resolvectl status 2>/dev/null | grep "DNS Servers" || grep "^nameserver" /etc/resolv.conf

