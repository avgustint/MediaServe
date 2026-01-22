# Customizing Raspberry Pi Startup Image

This guide explains how to customize the startup image shown during Raspberry Pi boot and before the kiosk application loads.

## Overview

There are several types of "startup images" you can customize:

1. **Boot Splash Screen** - The image shown during boot (before OS loads)
2. **Desktop Wallpaper** - Background shown on desktop (if visible before kiosk)
3. **Custom Loading Screen** - A custom HTML page shown while services start

## Option 1: Custom Boot Splash Screen (Plymouth)

The boot splash screen is controlled by Plymouth. Here's how to customize it:

### Step 1: Prepare Your Image

1. Create a PNG image file (recommended: 1920x1080 or match your display resolution)
2. Save it as `splash.png` or your preferred name
3. Place it in an accessible location (e.g., `~/Desktop/MediaServer/deployment/raspberry-pi/splash.png`)

### Step 2: Replace the Default Splash Image

```bash
# Backup the original splash image
sudo cp /usr/share/plymouth/themes/pix/splash.png /usr/share/plymouth/themes/pix/splash.png.bak

# Copy your custom image
sudo cp ~/Desktop/MediaServer/deployment/raspberry-pi/splash.png /usr/share/plymouth/themes/pix/splash.png

# Update initramfs (required for changes to take effect)
sudo update-initramfs -u
```

### Step 3: Make Boot "Silent" (Hide Logs and Logos)

To show only your custom splash screen without boot messages:

1. **Edit `/boot/config.txt`** (or `/boot/firmware/config.txt` on newer OS):
   ```bash
   sudo nano /boot/config.txt
   ```
   Add at the end:
   ```
   disable_splash=1
   ```

2. **Edit `/boot/cmdline.txt`** (must remain a single line):
   ```bash
   sudo nano /boot/cmdline.txt
   ```
   Append these parameters to the end of the line (add spaces between parameters):
   ```
   logo.nologo quiet loglevel=3 vt.global_cursor_default=0
   ```

3. **Reboot to see changes:**
   ```bash
   sudo reboot
   ```

### Alternative: Use a Script

A helper script is available at `customize-splash.sh` that automates this process.

## Option 2: Desktop Wallpaper

If you want to customize the desktop wallpaper (shown briefly before kiosk mode):

### For Raspberry Pi OS Desktop

```bash
# Set wallpaper using pcmanfm (if using LXDE)
pcmanfm --set-wallpaper=/path/to/your/image.png

# Or manually edit desktop configuration
mkdir -p ~/.config/pcmanfm/LXDE-pi
nano ~/.config/pcmanfm/LXDE-pi/desktop-items-0.conf
```

Add:
```ini
[wallpaper]
wallpaper_mode=stretch
wallpaper_common=1
wallpaper=/path/to/your/image.png
```

## Option 3: Custom Loading Screen (HTML)

You can create a custom HTML loading screen that shows while services are starting. This is useful for showing a branded loading screen before the kiosk app loads.

### Step 1: Create Custom Loading HTML

Create a file at `~/Desktop/MediaServer/deployment/raspberry-pi/loading-screen.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MediaServer Loading</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            color: #fff;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
        }
        .logo {
            max-width: 400px;
            margin-bottom: 30px;
        }
        .spinner {
            border: 4px solid #333;
            border-top: 4px solid #fff;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .message {
            margin-top: 20px;
            font-size: 18px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <!-- Replace with your logo/image -->
    <img src="logo.png" alt="MediaServer" class="logo" />
    <div class="spinner"></div>
    <div class="message">Starting MediaServer...</div>
</body>
</html>
```

### Step 2: Modify kiosk-start.sh

Edit the kiosk startup script to show the loading screen first, then switch to the client app once ready.

The script already waits for services to be ready, but you could modify it to open the loading screen first.

## Option 4: Video Splash Screen

You can play a video during boot using a video player:

### Install Video Player

```bash
# For older Raspberry Pi OS
sudo apt install omxplayer

# For newer versions
sudo apt install mpv
```

### Add to rc.local

```bash
sudo nano /etc/rc.local
```

Add before `exit 0`:
```bash
# Play startup video (if exists)
if [ -f /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/startup-video.mp4 ]; then
    omxplayer --no-osd --loop /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/startup-video.mp4 &
fi
```

## Quick Setup Script

A helper script `customize-splash.sh` is provided to automate the splash screen customization:

```bash
cd ~/Desktop/MediaServer/deployment/raspberry-pi
chmod +x customize-splash.sh
./customize-splash.sh /path/to/your/splash.png
```

## Troubleshooting

### Splash Screen Not Showing

1. **Check if Plymouth is installed:**
   ```bash
   dpkg -l | grep plymouth
   ```

2. **Verify initramfs was updated:**
   ```bash
   ls -la /boot/initrd.img*
   ```

3. **Check boot configuration:**
   ```bash
   cat /boot/cmdline.txt
   cat /boot/config.txt | grep splash
   ```

### Image Not Displaying Correctly

- Ensure image is PNG format
- Check image resolution matches your display
- Verify image file permissions: `sudo chmod 644 /usr/share/plymouth/themes/pix/splash.png`

### Boot Messages Still Showing

- Verify `/boot/cmdline.txt` has `quiet loglevel=3` parameters
- Check `/boot/config.txt` has `disable_splash=1`
- Ensure parameters are on a single line in cmdline.txt

## Reverting Changes

To restore the original splash screen:

```bash
# Restore original splash image
sudo cp /usr/share/plymouth/themes/pix/splash.png.bak /usr/share/plymouth/themes/pix/splash.png

# Update initramfs
sudo update-initramfs -u

# Remove silent boot parameters from /boot/cmdline.txt
# Remove disable_splash=1 from /boot/config.txt

# Reboot
sudo reboot
```

## Best Practices

1. **Image Format**: Use PNG with transparency support
2. **Resolution**: Match your display resolution for best quality
3. **File Size**: Keep images under 2MB for faster boot
4. **Testing**: Test changes in a safe environment before production
5. **Backup**: Always backup original files before making changes

## Notes

- Changes to boot splash require `update-initramfs` and a reboot
- The splash screen is shown during early boot, before the desktop environment loads
- For kiosk mode, the splash screen will be visible for a few seconds before Chromium launches
- Custom loading screens (HTML) can be shown longer while services start

