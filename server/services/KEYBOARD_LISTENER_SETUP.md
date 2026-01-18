# Keyboard Listener Setup Guide for Raspberry Pi

The keyboard listener service captures OS-level keyboard events (arrow keys, numbers, Enter) and forwards them to the MediaServer via HTTP. This allows keyboard control of the admin app even when the client app is in fullscreen mode.

## Setup Steps

### Option 1: Using systemd Service (Recommended)

1. **Edit the service file** to set the correct paths:
   ```bash
   sudo nano /etc/systemd/system/keyboard-listener.service
   ```

2. **Copy the service file** and update the paths:
   ```bash
   # Copy the service file to systemd directory
   sudo cp server/services/keyboard-listener.service /etc/systemd/system/
   
   # Edit and update the paths (replace /path/to/MediaServer with actual path)
   sudo nano /etc/systemd/system/keyboard-listener.service
   ```
   
   Update these lines:
   - `WorkingDirectory=/path/to/MediaServer/server` → Your actual path
   - `ExecStart=/usr/bin/node /path/to/MediaServer/server/services/keyboardListener.js` → Your actual path
   - `User=pi` → Your username if different

3. **Set permissions** (if using `/dev/input/event*` method):
   ```bash
   # Option A: Run as root (less secure)
   # Change User in service file to root
   
   # Option B: Add user to input group (recommended)
   sudo usermod -a -G input $USER
   # Log out and back in for group change to take effect
   ```

4. **Reload systemd and start the service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable keyboard-listener.service
   sudo systemctl start keyboard-listener.service
   ```

5. **Check service status**:
   ```bash
   sudo systemctl status keyboard-listener.service
   ```

6. **View logs**:
   ```bash
   sudo journalctl -u keyboard-listener.service -f
   ```

### Option 2: Manual Start (For Testing)

1. **Start the keyboard listener manually**:
   ```bash
   cd /path/to/MediaServer/server
   node services/keyboardListener.js
   ```

2. **To run in background** (using `screen` or `nohup`):
   ```bash
   # Using screen
   screen -S keyboard-listener
   node services/keyboardListener.js
   # Press Ctrl+A then D to detach
   
   # Or using nohup
   nohup node services/keyboardListener.js > keyboard-listener.log 2>&1 &
   ```

### Option 3: Using ioHook Library (Alternative)

If you prefer to use the `ioHook` library instead of reading `/dev/input/event*`:

1. **Install ioHook**:
   ```bash
   cd /path/to/MediaServer/server
   npm install iohook
   ```

2. **Note**: ioHook requires native compilation and may need build tools:
   ```bash
   sudo apt-get update
   sudo apt-get install build-essential libx11-dev libxtst-dev libpng++-dev
   ```

3. The keyboard listener will automatically use ioHook if available, otherwise fall back to `/dev/input/event*`.

## Permissions

The keyboard listener needs access to read keyboard input. Two methods:

### Method 1: Run as root (Simple but less secure)
- Change `User=root` in the systemd service file

### Method 2: Add user to input group (Recommended)
```bash
sudo usermod -a -G input $USER
# Log out and back in
```

### Method 3: udev rules (Most secure)
Create a udev rule to allow specific users to access input devices:
```bash
sudo nano /etc/udev/rules.d/99-input-permissions.rules
```

Add:
```
KERNEL=="event*", SUBSYSTEM=="input", MODE="0664", GROUP="input"
```

Then:
```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

## Troubleshooting

### Service won't start
- Check logs: `sudo journalctl -u keyboard-listener.service -n 50`
- Verify paths in service file are correct
- Check permissions on the keyboardListener.js file

### No keyboard events captured
- Verify the service is running: `sudo systemctl status keyboard-listener.service`
- Check if keyboard events are being read: `sudo journalctl -u keyboard-listener.service -f`
- Try running manually to see error messages: `node services/keyboardListener.js`
- Check permissions on `/dev/input/event*` devices: `ls -l /dev/input/event*`

### Permission denied errors
- Ensure user is in `input` group or service runs as root
- Check udev rules if using that method
- Verify `/dev/input/event*` files are accessible

### Server not receiving commands
- Verify server is running on port 3000
- Check firewall settings (shouldn't block localhost)
- Test manually: `curl -X POST http://localhost:3000/api/keyboard/command -H "Content-Type: application/json" -d '{"key":"ArrowRight"}'`

## Testing

1. **Test the keyboard listener**:
   ```bash
   # Start manually to see output
   node services/keyboardListener.js
   # Press arrow keys, numbers, Enter
   # Should see "Key pressed: ArrowRight" etc. in console
   ```

2. **Test server endpoint**:
   ```bash
   curl -X POST http://localhost:3000/api/keyboard/command \
     -H "Content-Type: application/json" \
     -d '{"key":"ArrowRight","timestamp":1234567890}'
   ```

3. **Verify admin app receives commands**:
   - Open admin app in browser
   - Check browser console for WebSocket messages
   - Should see KeyboardCommand messages when keys are pressed

## Notes

- The keyboard listener only captures: Arrow keys (Left, Right, Up, Down), Number keys (0-9), and Enter
- Commands are only sent to admin apps on the same IP as the server
- The service automatically restarts if it crashes (when using systemd)
- The listener can work with either ioHook library or Linux `/dev/input/event*` method

