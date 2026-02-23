# MediaServer Raspberry Pi Deployment Guide

Complete guide for deploying MediaServer to Raspberry Pi with custom hostname, auto-start services, and Chromium kiosk mode.

## Architecture Overview

- **Server (port 5000)**: Node.js backend serving API and admin app
- **Client Server (port 5001)**: Simple HTTP server serving client display app
- **Chromium Kiosk**: Opens only the client app in fullscreen
  - Client window (port 5001): Fullscreen kiosk mode with auto-play enabled
  - Admin app is NOT started on the Pi display—access it from another device at `http://mediaplayer.local:5000` or `http://<pi-ip>:5000`
- **Hostname**: `mediaplayer.local` 
  - **From Raspberry Pi**: http://mediaplayer.local:5000 or http://localhost:5000
  - **From other computers**: 
    - Use mDNS: http://mediaplayer.local:5000 (requires Avahi - see Step 4.5)
    - Or use IP address: http://<raspberry-pi-ip>:5000 (fallback if mDNS not available)

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
   # SSH into Raspberry Pi
   ssh avgustin@raspberrypi.local
   # Or use your configured username and hostname
   # Or use your configured username
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

## Step 3.5: Install additional tools

```bash
sudo apt install -y wmctrl xdotool numlockx
```

**Note**: 
- `wmctrl` and `xdotool` are used by the kiosk startup script to keep the client window in foreground
- `numlockx` is used to enable Num Lock by default on startup (useful for numeric keypad input)

## Step 3.6: Configure Num Lock to Enable by Default (System-Wide)

There are several ways to enable Num Lock by default. Choose the method that works best for your setup:

### Option A: Systemd Service (Recommended for Kiosk Mode)

This creates a systemd service that enables Num Lock when the graphical session starts:

```bash
# Copy the numlock service file
sudo cp /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/numlock.service /etc/systemd/system/

# Update the service file with your username (if not avgustin)
sudo sed -i "s/User=avgustin/User=$(whoami)/g" /etc/systemd/system/numlock.service
sudo sed -i "s/Group=avgustin/Group=$(id -gn)/g" /etc/systemd/system/numlock.service
sudo sed -i "s|/home/avgustin|/home/$(whoami)|g" /etc/systemd/system/numlock.service

# Reload systemd and enable the service
sudo systemctl daemon-reload
sudo systemctl enable numlock.service
```

### Option B: LightDM Configuration (For Login Screen)

If you want Num Lock enabled at the login screen (before auto-login):

```bash
# Edit LightDM configuration
sudo nano /usr/share/lightdm/lightdm.conf.d/01_debian.conf
```

Add or modify the `[Seat:*]` section:
```ini
[Seat:*]
greeter-setup-script=/usr/bin/numlockx on
```

### Option C: X11 Autostart Script (User-Level)

Create an autostart script that runs when the user logs in:

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/numlock.desktop << EOF
[Desktop Entry]
Type=Application
Name=NumLock
Exec=/usr/bin/numlockx on
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
```

**Note**: Option A (systemd service) is recommended for kiosk mode as it's more reliable and runs at the system level.

## Step 4: Configure Hostname

```bash
# Set hostname to "mediaplayer"
sudo hostnamectl set-hostname mediaplayer

# Update /etc/hosts to include both mediaplayer and mediaplayer.local
sudo sed -i 's/127.0.1.1.*/127.0.1.1\tmediaplayer mediaplayer.local/' /etc/hosts
# If the line doesn't exist, add it:
if ! grep -q "127.0.1.1.*mediaplayer" /etc/hosts; then
  echo -e "127.0.1.1\tmediaplayer mediaplayer.local" | sudo tee -a /etc/hosts
fi
```

Reboot to apply hostname changes:
```bash
sudo reboot
```

## Step 4.5: Configure mDNS/Avahi for Network Hostname Resolution (Required for mediaplayer.local)

To allow other computers on your network to resolve `mediaplayer.local`, you need to set up mDNS (multicast DNS) using Avahi. The `.local` suffix is required by the mDNS protocol.

**Note**: Without mDNS, you'll need to use the Raspberry Pi's IP address directly (e.g., `http://192.168.1.100:5000`) instead of the hostname.

1. **Install Avahi daemon:**
   ```bash
   sudo apt update
   sudo apt install -y avahi-daemon
   ```

2. **Enable and start the service:**
   ```bash
   sudo systemctl enable avahi-daemon
   sudo systemctl start avahi-daemon
   ```

3. **Verify Avahi is running:**
   ```bash
   sudo systemctl status avahi-daemon
   ```

4. **Test hostname resolution:**
   ```bash
   # From Raspberry Pi itself
   ping mediaplayer.local
   
   # From another computer on the same network
   ping mediaplayer.local
   ```

**Important Notes:**
- Always use `mediaplayer.local` (with `.local` suffix) - this works both locally and from network devices
- The `.local` suffix is required by the mDNS protocol and cannot be changed
- After installing Avahi and configuring `/etc/hosts`, `mediaplayer.local` should work everywhere
- If mDNS doesn't work, use the IP address directly: `http://<raspberry-pi-ip>:5000`

**Ensure Local Resolution Works:**

Run the fix script to ensure `mediaplayer.local` works locally:

```bash
sudo /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/fix-local-hostname-resolution.sh
```

This ensures `/etc/hosts` has both `mediaplayer` and `mediaplayer.local` entries, so `mediaplayer.local` resolves both locally and from network devices.

**Alternative: Use IP Address (No Setup Required)**
- Find the Raspberry Pi's IP address: `ip addr` or `hostname -I`
- Access directly: `http://<raspberry-pi-ip>:5000` (most reliable method)

## Step 5: Build and Deploy Application

### Option A: Automated Deployment (from your development machine)

1. **Build application with Raspberry Pi profile**
   ```bash
   cd /path/to/MediaServer
   npm run build -- --profile raspberry-pi
   ```

2. **Configure auto-login (optional)** - Edit `build.config.js` before building:
   ```javascript
   // In build.config.js, find the 'raspberry-pi' profile
   'raspberry-pi': {
     // ... other config ...
     admin: {
       // ... other admin config ...
       
       // Auto-login configuration for admin app
       autoLoginUsername: 'your-username',    // Username for auto-login
       autoLoginPassword: 'your-password',    // Password for auto-login
       autoLoginLocationId: 1,                // Location ID to select after login
       autoLoginTimeout: 5                    // Seconds to wait before auto-login (0 = disabled)
     },
     client: {
       // ... other client config ...
       
       // Auto-login location configuration for client app
       autoLoginLocationId: 1                 // Location ID to automatically select (0 = disabled)
     }
   }
   ```
   
   **Note**: 
   - **Admin app**: Set `autoLoginTimeout: 0` to disable auto-login
   - **Client app**: Set `autoLoginLocationId: 0` to disable auto-selection (will show location selector)
   - Auto-login is useful for kiosk mode where you want apps to automatically configure themselves
   - Make sure the username/password and location IDs exist in your database

3. **Run deployment script**
   ```bash
   cd deployment/raspberry-pi
   chmod +x deploy.sh
   ./deploy.sh avgustin@mediaplayer.local
   # Or use IP: ./deploy.sh avgustin@1.2.3.4
   ```

   The script will:
   - Copy `dist/` directory to Raspberry Pi
   - Install Node.js dependencies
   - Copy systemd service files
   - Copy configuration script (`configure-services.sh`)

4. **Configure services** (on Raspberry Pi)
   ```bash
   # SSH into Raspberry Pi
   ssh avgustin@mediaplayer.local
   
   # Run configuration script
   cd /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi
   bash configure-services.sh
   ```
   
   This script will configure hostname, services, permissions, and restart everything. See **Step 6** for details.

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
   sudo mkdir -p /home/avgustin/Desktop/MediaServer
   sudo cp -r dist /home/avgustin/Desktop/MediaServer/
   sudo cp -r deployment/raspberry-pi /home/avgustin/Desktop/MediaServer/deployment/
   sudo chown -R avgustin:avgustin /home/avgustin/Desktop/MediaServer
   ```

3. **Install dependencies**
   ```bash
   cd /home/avgustin/Desktop/MediaServer/dist
   npm install --omit=dev
   ```

4. **Make scripts executable**
   ```bash
   chmod +x /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/kiosk-start.sh
   chmod +x /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/client-server.js
   chmod +x /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/configure-services.sh
   # Ensure launcher HTML file is readable
   chmod 644 /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/kiosk-launcher.html
   ```

5. **Run configuration script** (recommended)
   ```bash
   cd /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi
   bash configure-services.sh
   ```
   
   This will automatically configure all services, permissions, and restart them. See **Step 6** for details.

## Step 6: Configure Systemd Services

### Option A: Automated Configuration (Recommended)

Use the `configure-services.sh` script to automatically configure all services, permissions, and restart them:

```bash
cd /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi
bash configure-services.sh
```

The script will:
- Configure hostname (optional)
- Enable all MediaServer services (mediaserver, client-server, kiosk)
- Reload systemd daemon
- Restart all services
- Display service status

The script is interactive and will prompt you for optional configurations. It automatically detects:
- Current user and group
- MediaServer directory path
- Server port from mediaserver.service

### Option B: Manual Configuration

If you prefer to configure services manually, follow these steps:

1. **Copy service files**
   ```bash
   sudo cp /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/mediaserver.service /etc/systemd/system/
   sudo cp /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/client-server.service /etc/systemd/system/
   sudo cp /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/kiosk.service /etc/systemd/system/
   sudo cp /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/numlock.service /etc/systemd/system/
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
   sudo systemctl enable numlock
   ```

4. **Start services manually** (test before reboot)
   ```bash
   sudo systemctl start mediaserver
   sudo systemctl start client-server
   sudo systemctl start kiosk
   sudo systemctl start numlock
   ```

5. **Check service status**
   ```bash
   sudo systemctl status mediaserver
   sudo systemctl status client-server
   sudo systemctl status kiosk
   sudo systemctl status numlock
   ```

### 7.6 Fix Service User (If Username is Not 'avgustin')

If your Raspberry Pi username is not `avgustin`, you'll need to update the service files:

**Option A: Use the fix script** (easiest)
```bash
# Copy fix script to Raspberry Pi if not already there
cd /home/$(whoami)/Desktop/MediaServer/deployment/raspberry-pi
chmod +x fix-services-user.sh
./fix-services-user.sh
```

**Option B: Manual fix**
```bash
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

# Update all service files
sudo sed -i "s/User=avgustin/User=$CURRENT_USER/g" /etc/systemd/system/mediaserver.service
sudo sed -i "s/Group=avgustin/Group=$CURRENT_GROUP/g" /etc/systemd/system/mediaserver.service
sudo sed -i "s|/home/avgustin/Desktop/MediaServer|/home/$CURRENT_USER/Desktop/MediaServer|g" /etc/systemd/system/mediaserver.service

sudo sed -i "s/User=avgustin/User=$CURRENT_USER/g" /etc/systemd/system/client-server.service
sudo sed -i "s/Group=avgustin/Group=$CURRENT_GROUP/g" /etc/systemd/system/client-server.service
sudo sed -i "s|/home/avgustin/Desktop/MediaServer|/home/$CURRENT_USER/Desktop/MediaServer|g" /etc/systemd/system/client-server.service

sudo sed -i "s/User=avgustin/User=$CURRENT_USER/g" /etc/systemd/system/kiosk.service
sudo sed -i "s/Group=avgustin/Group=$CURRENT_GROUP/g" /etc/systemd/system/kiosk.service
sudo sed -i "s|/home/avgustin/Desktop/MediaServer|/home/$CURRENT_USER/Desktop/MediaServer|g" /etc/systemd/system/kiosk.service

# Reload systemd
sudo systemctl daemon-reload

# Restart services
sudo systemctl restart mediaserver
sudo systemctl restart client-server
sudo systemctl restart kiosk
sudo systemctl restart numlock
```

After fixing, verify services are running:
```bash
sudo systemctl status mediaserver
sudo systemctl status numlock
```

## Step 7: Verify Deployment

### 7.1 Check Services

```bash
# Check all services are running
sudo systemctl status mediaserver
sudo systemctl status client-server
sudo systemctl status kiosk
sudo systemctl status numlock

# View logs
sudo journalctl -u mediaserver -f
sudo journalctl -u client-server -f
sudo journalctl -u kiosk -f
sudo journalctl -u numlock -f
```

### 7.2 Test Access

```bash
# Check all services are running
sudo systemctl status mediaserver
sudo systemctl status client-server
sudo systemctl status kiosk
sudo systemctl status numlock

# View logs
sudo journalctl -u mediaserver -f
sudo journalctl -u client-server -f
sudo journalctl -u kiosk -f
sudo journalctl -u numlock -f
```

### 7.2 Test Access

1. **From Raspberry Pi itself:**
   ```bash
   curl http://localhost:5000/health
   curl http://localhost:5001
   ```

2. **From connected device (on same network):**
   - **Recommended**: Use IP address directly (most reliable)
     - Find IP: `ssh` to Raspberry Pi and run `hostname -I` or `ip addr`
     - Open browser: http://<raspberry-pi-ip>:5000 (admin app)
     - Open browser: http://<raspberry-pi-ip>:5001 (client app)
   - **Recommended**: Use mDNS (requires Avahi - see Step 4.5)
     - Open browser: http://mediaplayer.local:5000 (admin app)
     - Open browser: http://mediaplayer.local:5001 (client app)
   - **Alternative**: Use IP address directly (if mDNS not available)

3. **Check Chromium kiosk mode:**
   - Should automatically open fullscreen on boot
   - Displays client app from port 5001 in fullscreen kiosk
   - Admin app is not shown on the Pi—access from another device

## Step 8: Troubleshooting

### Services Not Starting

**If you see `status=217/USER` error:**
This means the service file specifies a user that doesn't exist. See **Step 6.6** above to fix this.

**Other service issues:**
```bash
# Check service status
sudo systemctl status <service-name>

# View detailed logs
sudo journalctl -u <service-name> -n 50 --no-pager

# Check if ports are in use
sudo netstat -tlnp | grep -E ':(5000|5001)'
```

### Accessing Admin App in Kiosk Mode

**The kiosk launcher opens only the client app in fullscreen on the Raspberry Pi display.**

1. **Client window:**
   - Opens in fullscreen kiosk mode automatically
   - Displays the media content
   - Only app visible on the Pi display

2. **Admin app:** Not started on the Pi display. Access it from another device:
   - Connect to the same network
   - **Recommended**: Use mDNS: `http://mediaplayer.local:5000` (requires Avahi - see Step 4.5)
   - **Alternative**: Use IP address: `http://<raspberry-pi-ip>:5000` (find IP with `hostname -I` on Raspberry Pi)

### White Screen / Empty Pages After Reboot

**If Chromium opens but shows white/empty pages:**

This usually means Chromium launched before the services were fully ready or Angular apps finished loading. The kiosk-start.sh script includes comprehensive waiting logic, but if you still see this issue:

1. **Check service logs for timing issues:**
   ```bash
   sudo journalctl -u kiosk -n 100 --no-pager | grep -E "ready|Waiting|verification"
   ```

2. **Verify services started in correct order:**
   ```bash
   sudo systemctl status mediaserver
   sudo systemctl status client-server
   sudo systemctl status kiosk
   sudo systemctl status numlock
   ```
   
   Check the timestamps - kiosk should start AFTER mediaserver and client-server.

3. **Check if services are actually responding:**
   ```bash
   # Test admin server
   curl -v http://localhost:5000/health
   curl -v http://localhost:5000 | head -20
   
   # Test client server
   curl -v http://localhost:5001 | head -20
   ```

4. **Verify Angular apps are built and JavaScript files exist:**
   ```bash
   # Check admin app
   ls -la /home/avgustin/Desktop/MediaServer/dist/admin/*.js 2>/dev/null | head -5
   
   # Check client app  
   ls -la /home/avgustin/Desktop/MediaServer/dist/client/*.js 2>/dev/null | head -5
   ```

5. **Increase wait times** (if Raspberry Pi is very slow):
   Edit `/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/kiosk-start.sh`:
   - Increase `MAX_ATTEMPTS` from 60 to 90 or 120
   - Increase the Angular bootstrap wait from 12 to 20 seconds
   - Increase systemd `ExecStartPre` sleep in `kiosk.service` from 20 to 30 seconds

6. **Manually reload pages in Chromium:**
   - Press F11 to exit fullscreen
   - Press Ctrl+R or F5 to reload both tabs
   - Press F11 again to return to fullscreen

7. **Check if it's a database initialization issue:**
   ```bash
   # Check if database exists and is accessible
   ls -la /home/avgustin/Desktop/MediaServer/dist/server/data/
   sudo journalctl -u mediaserver -n 50 --no-pager | grep -i "database\|error"
   ```

8. **Restart services in order with delays:**
   ```bash
   sudo systemctl restart mediaserver
   sleep 10
   sudo systemctl restart client-server
   sleep 10
   sudo systemctl restart kiosk
   ```

1. **Check service logs:**
   ```bash
   sudo journalctl -u kiosk -n 50 --no-pager
   ```

2. **Verify services are running:**
   ```bash
   sudo systemctl status mediaserver
   sudo systemctl status client-server
   ```

3. **Check if services are listening on ports:**
   ```bash
   sudo netstat -tlnp | grep -E ':(5000|5001)'
   # Or use ss:
   sudo ss -tlnp | grep -E ':(5000|5001)'
   ```

4. **Manually test URLs:**
   ```bash
   curl http://localhost:5000/health
   curl http://localhost:5001
   ```

5. **Restart services in order:**
   ```bash
   sudo systemctl restart mediaserver
   sleep 5
   sudo systemctl restart client-server
   sleep 5
   sudo systemctl restart kiosk
   ```

6. **Increase wait time** (if services are slow to start):
   Edit `kiosk-start.sh` and increase `MAX_ATTEMPTS` or add more sleep time.

### Chromium Not Starting

**Common causes and solutions:**

1. **Check kiosk service status:**
   ```bash
   sudo systemctl status kiosk
   sudo journalctl -u kiosk -n 100 --no-pager
   ```

2. **Check if X server is running:**
   ```bash
   echo $DISPLAY
   xset q  # Should not error if X is running
   ```

3. **Ensure auto-login is enabled** (Raspberry Pi desktop):
   ```bash
   sudo raspi-config
   # Navigate to: System Options → Boot / Auto Login → Desktop Autologin
   ```

4. **Check XAUTHORITY permissions:**
   ```bash
   ls -la ~/.Xauthority
   # If file doesn't exist, start X session once manually, then restart service
   ```

5. **Test Chromium manually** (as the service user):
   ```bash
   DISPLAY=:0 XAUTHORITY=/home/avgustin/.Xauthority chromium-browser --kiosk http://localhost:5001
   ```

6. **Check if client server is accessible:**
   ```bash
   curl http://localhost:5001
   # Should return HTML, not connection error
   ```

7. **Verify X server starts on boot:**
   ```bash
   sudo systemctl status lightdm  # or gdm3, depending on desktop
   # Enable if not running: sudo systemctl enable lightdm
   ```

8. **Check if graphical.target is reached:**
   ```bash
   systemctl get-default  # Should show graphical.target or multi-user.target
   ```

9. **Restart kiosk service after ensuring X is running:**
   ```bash
   sudo systemctl restart kiosk
   sudo journalctl -u kiosk -f  # Watch logs in real-time
   ```

### Hostname Not Resolving

**Understanding the Issue:**
- The hostname `mediaplayer` is only configured locally on the Raspberry Pi (in `/etc/hostname` and `/etc/hosts`)
- Other computers on the network don't know how to resolve `mediaplayer` to an IP address
- This is normal behavior - hostnames are not automatically shared across the network

**Solutions (choose one):**

1. **Use IP Address Directly (Recommended - Most Reliable)**
   ```bash
   # Find Raspberry Pi's IP address
   ip addr
   # Or
   hostname -I
   
   # Then access from other computers using:
   # http://<raspberry-pi-ip>:5000
   # Example: http://192.168.1.100:5000
   ```
   This works immediately without any additional setup.

2. **Use mDNS with .local Suffix (Requires Avahi)**
   ```bash
   # On Raspberry Pi, install Avahi (if not already installed)
   sudo apt install -y avahi-daemon
   sudo systemctl enable avahi-daemon
   sudo systemctl start avahi-daemon
   
   # From other computers, use:
   # http://mediaplayer.local:5000
   ```
   Note: Requires Avahi to be installed on both the Raspberry Pi and the client computer (most modern systems have it).

3. **Check Current Configuration:**
   ```bash
   # Check /etc/hostname
   cat /etc/hostname
   
   # Check /etc/hosts
   cat /etc/hosts
   
   # Test hostname locally
   hostname
   ping mediaplayer
   
   # Check if Avahi is running
   sudo systemctl status avahi-daemon
   
   # Test .local resolution
   ping mediaplayer.local
   ```

4. **Verify from Another Computer:**
   ```bash
   # Try pinging with .local suffix
   ping mediaplayer.local
   
   # If that fails, try with IP address
   ping <raspberry-pi-ip>
   
   # Check DNS resolution
   nslookup mediaplayer.local
   ```

**Troubleshooting Steps:**
- If `ping mediaplayer.local` fails from another computer, ensure Avahi is installed and running on the Raspberry Pi
- If Avahi is running but still not resolving, check firewall settings: `sudo ufw status`
- Some networks block mDNS traffic - in that case, use IP address directly
- Windows computers may need "Bonjour Print Services" installed for .local resolution

### Network Issues

**If you cannot access the server from other computers:**

1. **Find the Raspberry Pi's IP address:**
   ```bash
   # On Raspberry Pi
   ip addr
   # Look for inet address under eth0 (Ethernet) or wlan0 (WiFi)
   # Or use:
   hostname -I
   ```

2. **Test connectivity from another computer:**
   ```bash
   # Replace <raspberry-pi-ip> with actual IP address
   ping <raspberry-pi-ip>
   
   # Test HTTP access
   curl http://<raspberry-pi-ip>:5000/health
   ```

3. **Check network interfaces:**
   ```bash
   ip addr
   ip route
   ```

4. **Check if services are listening on all interfaces:**
   ```bash
   # Should show 0.0.0.0:5000 (listening on all interfaces)
   sudo netstat -tlnp | grep -E ':(5000|5001)'
   # Or use:
   sudo ss -tlnp | grep -E ':(5000|5001)'
   ```

5. **Check firewall settings:**
   ```bash
   # Check if firewall is blocking ports
   sudo ufw status
   # If firewall is active, allow ports:
   sudo ufw allow 5000/tcp
   sudo ufw allow 5001/tcp
   ```

6. **Check DNS resolution (for hostname):**
   ```bash
   # Test mediaplayer.local resolution
   nslookup mediaplayer.local
   ping mediaplayer.local
   # Or use IP address directly if mDNS not available
   ```

7. **Restart networking (use with caution):**
   ```bash
   sudo systemctl restart networking
   # Or for NetworkManager:
   sudo systemctl restart NetworkManager
   ```

### DNS Resolution Issues When Using Wired Network

**Problem**: When switching from WiFi Access Point mode to wired network, DNS resolution may stop working.

**Cause**: 
- `dnsmasq` (used for AP mode) may still be running and interfering with DNS
- DNS configuration may not be updated when switching network modes
- `/etc/resolv.conf` may not be properly configured

**Solution**:

1. **Run the DNS fix script:**
   ```bash
   sudo /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/fix-dns-wired-network.sh
   ```
   
   Or if deployed:
   ```bash
   sudo bash fix-dns-wired-network.sh
   ```

2. **Manual fix - Stop dnsmasq if using wired network:**
   ```bash
   # Check if dnsmasq is running
   sudo systemctl status dnsmasq
   
   # If running and you're using wired network, stop it:
   sudo systemctl stop dnsmasq
   sudo systemctl disable dnsmasq
   ```

3. **Manual fix - Configure DNS in NetworkManager:**
   ```bash
   # Check current DNS
   nmcli dev show | grep DNS
   
   # Set DNS servers (if needed)
   sudo nmcli connection modify "Wired connection 1" ipv4.dns "8.8.8.8 8.8.4.4"
   sudo nmcli connection up "Wired connection 1"
   ```

4. **Manual fix - Configure DNS in dhcpcd.conf:**
   ```bash
   # Edit /etc/dhcpcd.conf
   sudo nano /etc/dhcpcd.conf
   
   # Add or uncomment (for static IP):
   # interface eth0
   # static domain_name_servers=8.8.8.8 8.8.4.4
   
   # Or let DHCP provide DNS (remove static DNS lines)
   ```

5. **Test DNS resolution:**
   ```bash
   # Test DNS
   nslookup google.com
   ping google.com
   
   # Check current DNS servers
   cat /etc/resolv.conf
   # Or if using systemd-resolved:
   resolvectl status
   ```

**Quick Fix: Use IP Address**
- The most reliable method is to use the IP address directly
- Find IP: `hostname -I` on Raspberry Pi
- Access: `http://<raspberry-pi-ip>:5000` from any computer on the network

## Step 9: Configuration Customization

### Customize Startup/Boot Splash Screen

You can customize the Raspberry Pi boot splash screen (the image shown during boot). See **[CUSTOMIZE_STARTUP_IMAGE.md](./CUSTOMIZE_STARTUP_IMAGE.md)** for detailed instructions.

Quick setup:
```bash
cd ~/Desktop/MediaServer/deployment/raspberry-pi
chmod +x customize-splash.sh
./customize-splash.sh /path/to/your/splash.png
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

## Step 10: Maintenance

### Update Application

1. **Rebuild on development machine**
   ```bash
   npm run build -- --profile raspberry-pi
   ```

2. **Copy new dist folder**
   ```bash
   scp -r dist/ avgustin@mediaplayer.local:/home/avgustin/Desktop/MediaServer/
   ```

3. **Restart services**
   ```bash
   ssh avgustin@mediaplayer.local
   sudo systemctl restart mediaserver
   sudo systemctl restart client-server
   ```

### View Logs

```bash
# All services
sudo journalctl -u mediaserver -u client-server -u kiosk -u numlock -f

# Specific service
sudo journalctl -u mediaserver -f

# Last 100 lines
sudo journalctl -u mediaserver -n 100
```

### Backup Database

```bash
# Database is located at:
# /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db

# Create backup
cp /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db \
   /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db.backup.$(date +%Y%m%d)
```

## Security Notes

1. **Change default passwords**: Especially SSH and admin user passwords
2. **Update regularly**: `sudo apt update && sudo apt upgrade`
3. **Firewall**: Consider enabling UFW or iptables rules for additional security
4. **SSH keys**: Use SSH key authentication instead of passwords
5. **Network security**: Ensure your network is properly secured

## Next Steps

- Access admin interface:
  - From any computer: http://mediaplayer.local:5000 (requires Avahi - see Step 4.5)
  - Alternative: http://<raspberry-pi-ip>:5000 (if mDNS not available)
- Configure library items and playlists
- Connect display devices to the client app:
  - From any computer: http://mediaplayer.local:5001 (requires Avahi - see Step 4.5)
  - Alternative: http://<raspberry-pi-ip>:5001 (if mDNS not available)
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
**Hostname**: mediaplayer.local (works both locally and from network devices via mDNS/Avahi)  

