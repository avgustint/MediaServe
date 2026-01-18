# MediaServer Raspberry Pi Deployment Guide

Complete guide for deploying MediaServer to Raspberry Pi with WiFi access point, custom hostname, auto-start services, and Chromium kiosk mode.

## Architecture Overview

- **Server (port 5000)**: Node.js backend serving API and admin app
- **Client Server (port 5001)**: Simple HTTP server serving client display app
- **Chromium Kiosk**: Fullscreen display in foreground with auto-play enabled
- **WiFi Access Point**: Raspberry Pi broadcasts WiFi network "projektor"
- **Hostname**: `projektor` (accessible via http://projektor:5000 and http://projektor:5001)

## Prerequisites

### Hardware
- Raspberry Pi (3B+ or newer recommended)
- MicroSD card (16GB minimum, Class 10 recommended)
- Power supply (official or compatible)
- Ethernet cable (optional, for initial setup)

### Software
- Raspberry Pi OS (Bullseye or later) or Ubuntu Server for Raspberry Pi
- Node.js v18 or higher
- Chromium browser

## Step 1: Install Raspberry Pi OS and Basic Setup

1. **Flash Raspberry Pi OS** to microSD card using Raspberry Pi Imager
   - Choose "Raspberry Pi OS (64-bit)" or "Raspberry Pi OS Lite" (with desktop recommended for kiosk mode)
   - Enable SSH during imaging (Advanced Options → SSH → Enable)

2. **First Boot Setup**
   ```bash
   # SSH into Raspberry Pi (default: pi@raspberrypi.local)
   ssh pi@raspberrypi.local
   # Default password: raspberry (change it!)
   ```

3. **Update System**
   ```bash
   sudo apt update
   sudo apt upgrade -y
   ```

## Step 2: Install Node.js

```bash
# Install Node.js v18 or newer
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v18.x or higher
npm --version
```

## Step 3: Install Chromium

```bash
sudo apt install -y chromium-browser
```

## Step 4: Configure Hostname

```bash
# Set hostname to "projektor"
sudo hostnamectl set-hostname projektor

# Update /etc/hosts
sudo sed -i 's/127.0.1.1.*/127.0.1.1\tprojektor/' /etc/hosts
```

Reboot to apply hostname changes:
```bash
sudo reboot
```

## Step 5: Configure Static IP (Optional but Recommended)

### Option A: Using dhcpcd (Raspberry Pi OS)

Edit `/etc/dhcpcd.conf`:
```bash
sudo nano /etc/dhcpcd.conf
```

Add at the end (for wired connection on eth0):
```
interface eth0
static ip_address=1.2.3.4/24
static routers=1.2.3.4
static domain_name_servers=8.8.8.8 8.8.4.4
```

For WiFi (if not using AP mode), replace `eth0` with `wlan0`.

Apply changes:
```bash
sudo systemctl restart dhcpcd
```

### Option B: Using raspi-config

```bash
sudo raspi-config
# Navigate to: System Options → Network → IP Address
# Enter: 1.2.3.4/24
```

## Step 6: Build and Deploy Application

### Option A: Automated Deployment (from your development machine)

1. **Build application with Raspberry Pi profile**
   ```bash
   cd /path/to/MediaServer
   npm run build -- --profile raspberry-pi
   ```

2. **Run deployment script**
   ```bash
   cd deployment/raspberry-pi
   chmod +x deploy.sh
   ./deploy.sh pi@projektor.local
   # Or use IP: ./deploy.sh pi@1.2.3.4
   ```

   The script will:
   - Copy `dist/` directory to Raspberry Pi
   - Install Node.js dependencies
   - Copy systemd service files

### Option B: Manual Deployment

1. **Build on Raspberry Pi** (or copy dist folder)
   ```bash
   # On Raspberry Pi
   cd ~
   git clone <your-repo-url> MediaServer  # Or copy files via scp
   cd MediaServer
   npm run build -- --profile raspberry-pi
   ```

2. **Copy files**
   ```bash
   sudo mkdir -p /home/pi/mediaserver
   sudo cp -r dist /home/pi/mediaserver/
   sudo cp -r deployment/raspberry-pi /home/pi/mediaserver/deployment/
   sudo chown -R pi:pi /home/pi/mediaserver
   ```

3. **Install dependencies**
   ```bash
   cd /home/pi/mediaserver/dist
   npm install --production
   ```

4. **Make scripts executable**
   ```bash
   chmod +x /home/pi/mediaserver/deployment/raspberry-pi/kiosk-start.sh
   chmod +x /home/pi/mediaserver/deployment/raspberry-pi/client-server.js
   ```

## Step 7: Configure Systemd Services

1. **Copy service files**
   ```bash
   sudo cp /home/pi/mediaserver/deployment/raspberry-pi/mediaserver.service /etc/systemd/system/
   sudo cp /home/pi/mediaserver/deployment/raspberry-pi/client-server.service /etc/systemd/system/
   sudo cp /home/pi/mediaserver/deployment/raspberry-pi/kiosk.service /etc/systemd/system/
   ```

2. **Reload systemd**
   ```bash
   sudo systemctl daemon-reload
   ```

3. **Enable services** (they will start on boot)
   ```bash
   sudo systemctl enable mediaserver
   sudo systemctl enable client-server
   sudo systemctl enable kiosk
   ```

4. **Start services manually** (test before reboot)
   ```bash
   sudo systemctl start mediaserver
   sudo systemctl start client-server
   sudo systemctl start kiosk
   ```

5. **Check service status**
   ```bash
   sudo systemctl status mediaserver
   sudo systemctl status client-server
   sudo systemctl status kiosk
   ```

## Step 8: Configure WiFi Access Point

### 8.1 Install Required Packages

```bash
sudo apt install -y hostapd dnsmasq
```

### 8.2 Configure hostapd

1. **Copy configuration**
   ```bash
   sudo cp /home/pi/mediaserver/deployment/raspberry-pi/hostapd.conf /etc/hostapd/hostapd.conf
   ```

2. **Set daemon configuration**
   ```bash
   sudo nano /etc/default/hostapd
   ```
   Add or update:
   ```
   DAEMON_CONF="/etc/hostapd/hostapd.conf"
   ```

### 8.3 Configure dnsmasq

1. **Backup original config** (if exists)
   ```bash
   sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.orig
   ```

2. **Copy configuration**
   ```bash
   sudo cp /home/pi/mediaserver/deployment/raspberry-pi/dnsmasq.conf /etc/dnsmasq.conf
   ```

### 8.4 Configure Network Interface

1. **Stop services**
   ```bash
   sudo systemctl stop hostapd
   sudo systemctl stop dnsmasq
   ```

2. **Configure static IP for wlan0**
   ```bash
   sudo nano /etc/dhcpcd.conf
   ```
   Add at the end:
   ```
   interface wlan0
   static ip_address=192.168.4.1/24
   nohook wpa_supplicant
   ```

3. **Disable wpa_supplicant for wlan0**
   ```bash
   sudo systemctl stop wpa_supplicant
   sudo systemctl disable wpa_supplicant
   ```

4. **Restart networking**
   ```bash
   sudo systemctl restart dhcpcd
   ```

5. **Configure wlan0 IP manually** (immediate)
   ```bash
   sudo ip addr add 192.168.4.1/24 dev wlan0
   ```

### 8.5 Enable IP Forwarding

```bash
# Enable IP forwarding
sudo sysctl net.ipv4.ip_forward=1

# Make it permanent
sudo sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf
```

### 8.6 Configure NAT (IP Masquerading)

Create iptables rules:
```bash
# Allow forwarding between wlan0 and eth0
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT

# Save iptables rules
sudo sh -c "iptables-save > /etc/iptables.ipv4.nat"
```

Make iptables persistent:
```bash
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

Or create a systemd service to restore rules on boot:
```bash
sudo nano /etc/systemd/system/iptables-restore.service
```

Add:
```ini
[Unit]
Description=Restore iptables rules
After=network.target

[Service]
Type=oneshot
ExecStart=/sbin/iptables-restore < /etc/iptables.ipv4.nat
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable iptables-restore
```

### 8.7 Start Access Point Services

```bash
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl enable dnsmasq
sudo systemctl start hostapd
sudo systemctl start dnsmasq
```

### 8.8 Verify WiFi Access Point

- Scan for WiFi networks on your phone/computer
- Look for network named "projektor"
- Connect using password: `projektor123` (configured in hostapd.conf)
- Your device should get IP in range 192.168.4.2-20
- Access admin at: http://projektor:5000 or http://192.168.4.1:5000

## Step 9: Verify Deployment

### 9.1 Check Services

```bash
# Check all services are running
sudo systemctl status mediaserver
sudo systemctl status client-server
sudo systemctl status kiosk

# View logs
sudo journalctl -u mediaserver -f
sudo journalctl -u client-server -f
sudo journalctl -u kiosk -f
```

### 9.2 Test Access

1. **From Raspberry Pi itself:**
   ```bash
   curl http://localhost:5000/health
   curl http://localhost:5001
   ```

2. **From connected device (via WiFi AP or network):**
   - Open browser: http://projektor:5000 (admin app)
   - Open browser: http://projektor:5001 (client app)
   - Or use IP: http://1.2.3.4:5000 or http://192.168.4.1:5000

3. **Check Chromium kiosk mode:**
   - Should automatically open fullscreen on boot
   - Display client app from port 5001
   - No browser UI visible

## Step 10: Troubleshooting

### Services Not Starting

```bash
# Check service status
sudo systemctl status <service-name>

# View detailed logs
sudo journalctl -u <service-name> -n 50 --no-pager

# Check if ports are in use
sudo netstat -tlnp | grep -E ':(5000|5001)'
```

### WiFi Access Point Not Working

```bash
# Check hostapd status
sudo systemctl status hostapd

# Check dnsmasq status
sudo systemctl status dnsmasq

# Check wlan0 interface
ip addr show wlan0

# Check iptables rules
sudo iptables -t nat -L -v -n

# Restart services
sudo systemctl restart hostapd
sudo systemctl restart dnsmasq
sudo systemctl restart dhcpcd
```

### Chromium Not Starting

```bash
# Check if X server is running
echo $DISPLAY

# Check kiosk service logs
sudo journalctl -u kiosk -n 50

# Test Chromium manually
DISPLAY=:0 chromium-browser --kiosk http://localhost:5001

# Check if client server is accessible
curl http://localhost:5001
```

### Hostname Not Resolving

```bash
# Check /etc/hostname
cat /etc/hostname

# Check /etc/hosts
cat /etc/hosts

# Test hostname
hostname
ping projektor
```

### Network Issues

```bash
# Check network interfaces
ip addr

# Check routing
ip route

# Check DNS resolution
nslookup projektor

# Restart networking (use with caution)
sudo systemctl restart networking
```

## Step 11: Configuration Customization

### Change WiFi SSID/Password

Edit `/etc/hostapd/hostapd.conf`:
```bash
sudo nano /etc/hostapd/hostapd.conf
```
Update:
```
ssid=your-network-name
wpa_passphrase=your-password
```
Restart:
```bash
sudo systemctl restart hostapd
```

### Change Server Ports

Edit systemd service files:
```bash
sudo nano /etc/systemd/system/mediaserver.service
# Change Environment="PORT=5000" to desired port

sudo nano /etc/systemd/system/client-server.service
# Change Environment="PORT=5001" to desired port
```

Also update:
- `kiosk-start.sh`: Change `CLIENT_URL` variable
- Rebuild application with updated URLs in `build.config.js`

Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart mediaserver client-server
```

### Disable Kiosk Mode (for debugging)

```bash
sudo systemctl disable kiosk
sudo systemctl stop kiosk
```

Then access admin via browser normally.

## Step 12: Maintenance

### Update Application

1. **Rebuild on development machine**
   ```bash
   npm run build -- --profile raspberry-pi
   ```

2. **Copy new dist folder**
   ```bash
   scp -r dist/ pi@projektor.local:/home/pi/mediaserver/
   ```

3. **Restart services**
   ```bash
   ssh pi@projektor.local
   sudo systemctl restart mediaserver
   sudo systemctl restart client-server
   ```

### View Logs

```bash
# All services
sudo journalctl -u mediaserver -u client-server -u kiosk -f

# Specific service
sudo journalctl -u mediaserver -f

# Last 100 lines
sudo journalctl -u mediaserver -n 100
```

### Backup Database

```bash
# Database is located at:
# /home/pi/mediaserver/dist/server/data/mediaserver.db

# Create backup
cp /home/pi/mediaserver/dist/server/data/mediaserver.db \
   /home/pi/mediaserver/dist/server/data/mediaserver.db.backup.$(date +%Y%m%d)
```

## Security Notes

1. **Change default passwords**: Especially SSH and admin user passwords
2. **Update regularly**: `sudo apt update && sudo apt upgrade`
3. **Firewall**: Consider enabling UFW or iptables rules for additional security
4. **SSH keys**: Use SSH key authentication instead of passwords
5. **WiFi password**: Change default WiFi password in hostapd.conf

## Next Steps

- Access admin interface at http://projektor:5000
- Configure library items and playlists
- Connect display devices to the client app at http://projektor:5001
- Monitor logs for any issues

## Support

For issues or questions:
- Check service logs: `sudo journalctl -u <service-name>`
- Verify configuration files are correct
- Ensure all prerequisites are installed
- Check network connectivity and firewall rules

---

**Built on**: Date when built  
**Deployment profile**: raspberry-pi  
**Server port**: 5000  
**Client port**: 5001  
**Hostname**: projektor  

