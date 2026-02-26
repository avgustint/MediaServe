# MediaServer Raspberry Pi Deployment Guide

Complete guide for deploying MediaServer to Raspberry Pi with custom hostname, auto-start services, and Chromium kiosk mode.

## Architecture Overview

- **Server (port 5000)**: Node.js backend serving API, WebSocket, and admin app
- **Client Server (port 5001)**: Simple HTTP server serving client display app
- **Chromium Kiosk**: Opens the client app in fullscreen on the Pi's display
  - Admin app is NOT shown on the Pi display -- access it from another device at `http://mediaplayer.local:5000` or `http://<pi-ip>:5000`
- **Hostname**: `mediaplayer.local`
  - From Raspberry Pi: `http://localhost:5000`
  - From other devices: `http://mediaplayer.local:5000` (requires Avahi) or `http://<pi-ip>:5000`

## Prerequisites

### Hardware
- Raspberry Pi (3B+ or newer recommended)
- MicroSD card (16GB minimum, Class 10 recommended)
- Power supply (official or compatible)
- HDMI display/TV
- Ethernet cable or WiFi

### Software
- Raspberry Pi OS (Bullseye or later, desktop variant recommended for kiosk mode)
- Node.js v24 or higher
- Chromium browser

## Step 1: Install Raspberry Pi OS and Basic Setup

1. **Flash Raspberry Pi OS** to microSD card using Raspberry Pi Imager
   - Choose "Raspberry Pi OS (64-bit)" with desktop (recommended for kiosk mode)
   - Enable SSH during imaging (Advanced Options)

2. **First Boot Setup**
   ```bash
   ssh avgustin@raspberrypi.local
   ```

3. **Update System**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

## Step 2: Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

node --version   # Should be v24.x or higher
npm --version
```

## Step 3: Install Chromium and Tools

```bash
sudo apt install -y chromium wmctrl xdotool
```

- `wmctrl` and `xdotool`: Used by the kiosk startup script to keep the client window in foreground

## Step 4: Configure Hostname

```bash
sudo hostnamectl set-hostname mediaplayer

sudo sed -i 's/127.0.1.1.*/127.0.1.1\tmediaplayer mediaplayer.local/' /etc/hosts
if ! grep -q "127.0.1.1.*mediaplayer" /etc/hosts; then
  echo -e "127.0.1.1\tmediaplayer mediaplayer.local" | sudo tee -a /etc/hosts
fi

sudo reboot
```

### Configure mDNS/Avahi (Required for mediaplayer.local)

To allow other devices on your network to resolve `mediaplayer.local`:

```bash
sudo apt install -y avahi-daemon
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
```

Verify:
```bash
sudo systemctl status avahi-daemon
ping mediaplayer.local   # Should work locally and from other devices
```

If `mediaplayer.local` doesn't resolve locally, run:
```bash
sudo /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/fix-local-hostname-resolution.sh
```

**Notes:**
- Always use `mediaplayer.local` (with `.local` suffix) -- required by mDNS protocol
- Windows devices may need "Bonjour Print Services" for `.local` resolution
- Fallback: use IP address directly (`hostname -I` to find the Pi's IP)

## Step 5: Build and Deploy Application

### Option A: Automated Deployment (from development machine)

1. **Build with Raspberry Pi profile**
   ```bash
   cd /path/to/MediaServer
   npm run build -- --profile raspberry-pi
   ```

2. **Configure auto-login** (optional) -- edit `build.config.js` before building:
   ```javascript
   'raspberry-pi': {
     admin: {
       autoLoginUsername: 'your-username',
       autoLoginPassword: 'your-password',
       autoLoginLocationId: 1,
       autoLoginTimeout: 5        // seconds (0 = disabled)
     },
     client: {
       autoLoginLocationId: 1     // 0 = show location selector
     }
   }
   ```

3. **Run deployment script**
   ```bash
   cd deployment/raspberry-pi
   chmod +x deploy.sh
   ./deploy.sh avgustin@mediaplayer.local
   ```

   The script copies the `dist/` directory, installs dependencies, and copies service files.

4. **Configure services** (on the Pi)
   ```bash
   ssh avgustin@mediaplayer.local
   cd /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi
   bash configure-services.sh
   ```

### Option B: Manual Deployment

1. **Build on Pi or copy dist folder**
   ```bash
   cd ~/MediaServer
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
   chmod 644 /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/kiosk-launcher.html
   ```

5. **Run configuration script**
   ```bash
   cd /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi
   bash configure-services.sh
   ```

## Step 6: Configure Systemd Services

### Option A: Automated Configuration (Recommended)

```bash
cd /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi
bash configure-services.sh
```

The script will configure hostname, enable all services, reload systemd, and restart everything.

### Option B: Manual Configuration

1. **Copy service files**
   ```bash
   sudo cp /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/mediaserver.service /etc/systemd/system/
   sudo cp /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/client-server.service /etc/systemd/system/
   sudo cp /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/kiosk.service /etc/systemd/system/
   ```

2. **Enable and start services**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable mediaserver client-server kiosk
   sudo systemctl start mediaserver client-server kiosk
   ```

3. **Verify**
   ```bash
   sudo systemctl status mediaserver client-server kiosk
   ```

### Fix Service User (If Username is Not 'avgustin')

**Option A: Use the fix script**
```bash
cd /home/$(whoami)/Desktop/MediaServer/deployment/raspberry-pi
chmod +x fix-services-user.sh
./fix-services-user.sh
```

**Option B: Manual fix**
```bash
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

for SERVICE in mediaserver client-server kiosk; do
  sudo sed -i "s/User=avgustin/User=$CURRENT_USER/g" /etc/systemd/system/$SERVICE.service
  sudo sed -i "s/Group=avgustin/Group=$CURRENT_GROUP/g" /etc/systemd/system/$SERVICE.service
  sudo sed -i "s|/home/avgustin/Desktop/MediaServer|/home/$CURRENT_USER/Desktop/MediaServer|g" /etc/systemd/system/$SERVICE.service
done

sudo systemctl daemon-reload
sudo systemctl restart mediaserver client-server kiosk
```

## Step 7: Verify Deployment

### Check Services

```bash
sudo systemctl status mediaserver client-server kiosk

# View logs
sudo journalctl -u mediaserver -f
sudo journalctl -u client-server -f
sudo journalctl -u kiosk -f
```

### Test Access

1. **From the Raspberry Pi:**
   ```bash
   curl http://localhost:5000/health
   curl http://localhost:5001
   ```

2. **From another device (same network):**
   - `http://mediaplayer.local:5000` -- admin app (requires Avahi)
   - `http://mediaplayer.local:5001` -- client app
   - Or use IP: `http://<pi-ip>:5000` (find IP with `hostname -I`)

3. **Chromium kiosk:** Should automatically open fullscreen on boot displaying the client app.

## Step 8: Troubleshooting

### Services Not Starting

**`status=217/USER` error:** The service file references a non-existent user. See "Fix Service User" in Step 6.

**General troubleshooting:**
```bash
sudo systemctl status <service-name>
sudo journalctl -u <service-name> -n 50 --no-pager
sudo netstat -tlnp | grep -E ':(5000|5001)'
```

### White Screen / Empty Pages After Reboot

Chromium may have launched before services were fully ready.

1. **Check timing in kiosk logs:**
   ```bash
   sudo journalctl -u kiosk -n 100 --no-pager | grep -E "ready|Waiting|verification"
   ```

2. **Verify services are responding:**
   ```bash
   curl -v http://localhost:5000/health
   curl -v http://localhost:5001 | head -20
   ```

3. **Verify Angular build files exist:**
   ```bash
   ls -la /home/avgustin/Desktop/MediaServer/dist/admin/*.js 2>/dev/null | head -5
   ls -la /home/avgustin/Desktop/MediaServer/dist/client/*.js 2>/dev/null | head -5
   ```

4. **Increase wait times** (if Pi is slow): edit `kiosk-start.sh` and increase `MAX_ATTEMPTS` or sleep durations.

5. **Restart services in order:**
   ```bash
   sudo systemctl restart mediaserver
   sleep 10
   sudo systemctl restart client-server
   sleep 10
   sudo systemctl restart kiosk
   ```

### Chromium Not Starting

1. **Check kiosk service:**
   ```bash
   sudo systemctl status kiosk
   sudo journalctl -u kiosk -n 100 --no-pager
   ```

2. **Ensure auto-login is enabled:**
   ```bash
   sudo raspi-config
   # System Options > Boot / Auto Login > Desktop Autologin
   ```

3. **Check X server is running:**
   ```bash
   echo $DISPLAY
   xset q
   ```

4. **Test Chromium manually:**
   ```bash
   DISPLAY=:0 XAUTHORITY=/home/avgustin/.Xauthority chromium --kiosk http://localhost:5001
   ```

### Hostname Not Resolving

**From other devices:**
1. Ensure Avahi is installed and running on the Pi: `sudo systemctl status avahi-daemon`
2. Use `mediaplayer.local` (with `.local` suffix)
3. Windows may need Bonjour Print Services installed
4. Fallback: use IP address (`hostname -I` on the Pi)

**Locally on the Pi:**
```bash
cat /etc/hosts          # Should have 127.0.1.1 mediaplayer mediaplayer.local
ping mediaplayer.local
```

### Network / DNS Issues

```bash
# Check IP address
hostname -I

# Check if services listen on all interfaces
sudo ss -tlnp | grep -E ':(5000|5001)'

# Check firewall
sudo ufw status
sudo ufw allow 5000/tcp
sudo ufw allow 5001/tcp
```

**DNS not resolving after switching from WiFi AP to wired:**
```bash
sudo /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/fix-dns-wired-network.sh
```

Or manually stop dnsmasq if it's interfering:
```bash
sudo systemctl stop dnsmasq
sudo systemctl disable dnsmasq
```

## Step 9: Configuration Customization

### Customize Boot Splash Screen

See **[CUSTOMIZE_STARTUP_IMAGE.md](./CUSTOMIZE_STARTUP_IMAGE.md)** for instructions.

```bash
cd ~/Desktop/MediaServer/deployment/raspberry-pi
chmod +x customize-splash.sh
./customize-splash.sh /path/to/your/splash.png
```

### Change Server Ports

Edit systemd service files:
```bash
sudo nano /etc/systemd/system/mediaserver.service    # Change PORT=5000
sudo nano /etc/systemd/system/client-server.service   # Change PORT=5001
```

Also update `kiosk-start.sh` (`CLIENT_URL` variable) and rebuild the application with updated URLs in `build.config.js`.

```bash
sudo systemctl daemon-reload
sudo systemctl restart mediaserver client-server
```

### Disable Kiosk Mode (for debugging)

```bash
sudo systemctl disable kiosk
sudo systemctl stop kiosk
```

## Step 10: Maintenance

### Update Application

1. **Rebuild on development machine:**
   ```bash
   npm run build -- --profile raspberry-pi
   ```

2. **Deploy to Pi:**
   ```bash
   scp -r dist/ avgustin@mediaplayer.local:/home/avgustin/Desktop/MediaServer/
   ```

3. **Restart services:**
   ```bash
   ssh avgustin@mediaplayer.local
   sudo systemctl restart mediaserver client-server
   ```

### View Logs

```bash
# All services
sudo journalctl -u mediaserver -u client-server -u kiosk -f

# Specific service, last 100 lines
sudo journalctl -u mediaserver -n 100
```

### Backup Database

```bash
cp /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db \
   /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db.backup.$(date +%Y%m%d)
```

## Security Notes

1. **Change default passwords**: SSH and admin user passwords
2. **Update regularly**: `sudo apt update && sudo apt upgrade`
3. **Firewall**: Consider enabling UFW for additional security
4. **SSH keys**: Use SSH key authentication instead of passwords
5. **Network security**: Ensure your network is properly secured

## Quick Reference

| Service | Port | Access |
|---|---|---|
| Admin app | 5000 | `http://mediaplayer.local:5000` |
| Client app | 5001 | `http://mediaplayer.local:5001` |
| Kiosk | -- | Auto-opens client on Pi display |

| Command | Description |
|---|---|
| `sudo systemctl status mediaserver` | Check server status |
| `sudo journalctl -u mediaserver -f` | Watch server logs |
| `sudo systemctl restart mediaserver client-server` | Restart services |
| `sudo systemctl restart kiosk` | Restart kiosk display |

---

**Deployment profile**: raspberry-pi
**Server port**: 5000
**Client port**: 5001
**Hostname**: mediaplayer.local (via mDNS/Avahi)
