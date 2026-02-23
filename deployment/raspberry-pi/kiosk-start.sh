#!/bin/bash
# Chromium Kiosk Mode Launcher for MediaServer Client
# This script launches Chromium in kiosk mode with all necessary flags for auto-play and no popups

# Log script start
echo "Kiosk start script: Starting at $(date)"
echo "Kiosk start script: User=$(whoami), HOME=$HOME"

# Set display (use first available)
export DISPLAY=:0
export HOME=/home/avgustin

# Verify XAUTHORITY is set
if [ -z "$XAUTHORITY" ]; then
    export XAUTHORITY=/home/avgustin/.Xauthority
    echo "Kiosk start script: Set XAUTHORITY to $XAUTHORITY"
fi

# Wait for X server to be ready (use xset which is more commonly available than xdpyinfo)
echo "Kiosk start script: Waiting for X server..."
MAX_X_ATTEMPTS=60
X_ATTEMPT=0
while [ $X_ATTEMPT -lt $MAX_X_ATTEMPTS ]; do
    # Try xset first (more commonly available), then xdpyinfo if available
    if xset q >/dev/null 2>&1 || (command -v xdpyinfo >/dev/null 2>&1 && xdpyinfo -display :0 >/dev/null 2>&1); then
        echo "Kiosk start script: X server is ready"
        break
    fi
    if [ $((X_ATTEMPT % 10)) -eq 0 ]; then
        echo "Kiosk start script: Waiting for X server... ($X_ATTEMPT/$MAX_X_ATTEMPTS)"
    fi
    sleep 1
    X_ATTEMPT=$((X_ATTEMPT + 1))
done

if [ $X_ATTEMPT -eq $MAX_X_ATTEMPTS ]; then
    echo "Kiosk start script: ERROR - X server may not be ready after $MAX_X_ATTEMPTS seconds"
    echo "Kiosk start script: Attempting to continue anyway..."
fi

# Wait a bit more to ensure X server is fully initialized
sleep 2

# Enable Num Lock - try multiple methods for reliability
echo "Enabling Num Lock..."
NUM_LOCK_ENABLED=false

# Method 1: setleds (console/TTY level) - do this first for OS-level keyboard listener
if command -v setleds &> /dev/null; then
    # Try different TTY devices and methods
    for tty in /dev/tty1 /dev/tty2 /dev/tty3 /dev/console /dev/tty; do
        if [ -e "$tty" ]; then
            # Method 1a: Direct setleds with input redirection
            if setleds +num < "$tty" 2>/dev/null; then
                echo "Num Lock enabled using setleds on $tty (method 1)"
                NUM_LOCK_ENABLED=true
                break
            fi
            # Method 1b: Using echo to send setleds command
            if echo "+num" | setleds -F +num 2>/dev/null; then
                echo "Num Lock enabled using setleds (method 2)"
                NUM_LOCK_ENABLED=true
                break
            fi
            # Method 1c: Try with explicit TTY
            if [ -w "$tty" ]; then
                setleds -D +num < "$tty" 2>/dev/null || setleds +num < "$tty" 2>/dev/null && {
                    echo "Num Lock enabled using setleds on $tty (method 3)"
                    NUM_LOCK_ENABLED=true
                    break
                }
            fi
        fi
    done
fi

# Method 2: numlockx (X11 utility) - for X11 applications
if command -v numlockx &> /dev/null; then
    # Try multiple times in case X server needs more time
    for i in 1 2 3 4 5; do
        if DISPLAY=:0 numlockx on 2>/dev/null; then
            echo "Num Lock enabled using numlockx (attempt $i)"
            NUM_LOCK_ENABLED=true
            break
        fi
        sleep 1
    done
fi

# Method 3: xdotool (if numlockx didn't work) - X11 fallback
if command -v xdotool &> /dev/null; then
    # Try multiple times with delay
    for i in 1 2 3; do
        if DISPLAY=:0 xdotool key Num_Lock 2>/dev/null; then
            sleep 0.5
            # Verify it's on by checking state (optional)
            if DISPLAY=:0 xdotool key Num_Lock 2>/dev/null; then
                echo "Num Lock enabled using xdotool (attempt $i)"
                NUM_LOCK_ENABLED=true
                break
            fi
        fi
        sleep 1
    done
fi

if [ "$NUM_LOCK_ENABLED" = false ]; then
    echo "Warning: Num Lock could not be enabled."
    echo "Install numlockx with: sudo apt install numlockx"
    echo "Or install xdotool with: sudo apt install xdotool"
    echo "Or ensure setleds is available (usually pre-installed)"
else
    echo "Num Lock successfully enabled"
fi

# Wait for servers to be ready
# Use localhost when running on the Pi (change to Pi's IP if needed for network access)
CLIENT_URL="http://localhost:5001"
SERVER_URL="http://localhost:5000"  # Mediaserver API/WebSocket (client connects here)

MAX_ATTEMPTS=60  # Increased timeout to 60 seconds
ATTEMPT=0

# Function to check if systemd service is active
check_service_active() {
    local service=$1
    systemctl is-active --quiet "$service" 2>/dev/null
}

# Function to check if server is ready and serving actual content
check_server_ready() {
    local url=$1
    local check_type=$2
    
    if [ "$check_type" = "health" ]; then
        # For admin server, check both health endpoint AND that it serves the admin app HTML
        # First check health endpoint
        if ! curl -s -f "$url/health" > /dev/null 2>&1; then
            return 1
        fi
        # Then check that admin app HTML is being served (not just health endpoint)
        local response=$(curl -s -f "$url" 2>/dev/null)
        if [ $? -eq 0 ] && [ -n "$response" ] && echo "$response" | grep -qiE "<!DOCTYPE html|<html|<app-root|<title" 2>/dev/null; then
            # If HTML is served with app-root or title, Angular app should be there
            # JavaScript files are served as static assets, so if HTML loads, JS should too
            return 0
        fi
        return 1
    else
        # For client server, check if it returns HTML content (not just 200)
        local response=$(curl -s -f "$url" 2>/dev/null)
        if [ $? -eq 0 ] && [ -n "$response" ] && echo "$response" | grep -qiE "<!DOCTYPE html|<html|<app-root|<title" 2>/dev/null; then
            # If HTML is served with app-root or title, Angular app should be there
            # JavaScript files are served as static assets, so if HTML loads, JS should too
            return 0
        fi
        return 1
    fi
}

# First, wait for systemd services to be active
echo "Waiting for systemd services to be active..."
ATTEMPT=0
while [ $ATTEMPT -lt 30 ]; do
    if check_service_active "mediaserver.service" && check_service_active "client-server.service"; then
        # Also verify Node.js processes are actually running
        if pgrep -f "node.*server.js" > /dev/null && pgrep -f "node.*client-server.js" > /dev/null; then
            echo "Both services are active and Node.js processes are running"
            break
        else
            echo "Services active but Node.js processes not yet started... ($ATTEMPT/30)"
        fi
    else
        echo "Waiting for services to be active... ($ATTEMPT/30)"
    fi
    sleep 1
    ATTEMPT=$((ATTEMPT + 1))
done

# Wait for mediaserver (API/WebSocket) - client connects here
echo "Waiting for mediaserver (API/WebSocket) to be ready..."
ATTEMPT=0
SERVER_READY=false
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s -f "$SERVER_URL/health" > /dev/null 2>&1; then
        echo "Mediaserver is ready (API/WebSocket)"
        SERVER_READY=true
        break
    else
        echo "Waiting for mediaserver... ($ATTEMPT/$MAX_ATTEMPTS)"
    fi
    sleep 1
    ATTEMPT=$((ATTEMPT + 1))
done

if [ "$SERVER_READY" = false ]; then
    echo "Warning: Mediaserver did not become ready within $MAX_ATTEMPTS seconds"
    echo "Continuing anyway, but client may not connect to WebSocket..."
fi

# Wait for client server
echo "Waiting for client server to be ready..."
ATTEMPT=0
CLIENT_READY=false
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if check_server_ready "$CLIENT_URL" "html"; then
        # HTML check already verifies JS references are in HTML
        # If HTML is served with JS refs, assets should be available
        echo "Client server is ready (HTML with JavaScript references verified)"
        CLIENT_READY=true
        break
    else
        echo "Waiting for client server... ($ATTEMPT/$MAX_ATTEMPTS)"
    fi
    sleep 1
    ATTEMPT=$((ATTEMPT + 1))
done

if [ "$CLIENT_READY" = false ]; then
    echo "Warning: Client server did not become ready within $MAX_ATTEMPTS seconds"
    echo "Continuing anyway, but pages may not load correctly..."
fi

# Additional wait to ensure services are fully initialized
if [ "$SERVER_READY" = true ] && [ "$CLIENT_READY" = true ]; then
    echo "Both servers are ready. Waiting additional 5 seconds for client app to bootstrap..."
    sleep 5
else
    echo "Waiting additional 10 seconds (some services may not be fully ready)..."
    sleep 10
fi

# Final verification - client app only
echo "Performing final verification..."
FINAL_CHECK_PASSED=false
FINAL_ATTEMPTS=0
MAX_FINAL_ATTEMPTS=10

while [ $FINAL_ATTEMPTS -lt $MAX_FINAL_ATTEMPTS ]; do
    CLIENT_OK=false
    local client_response=$(curl -s -f "$CLIENT_URL" 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$client_response" ] && echo "$client_response" | grep -qiE "<!DOCTYPE html|<html|<app-root" 2>/dev/null; then
        CLIENT_OK=true
    fi
    
    if [ "$CLIENT_OK" = true ]; then
        echo "Final verification passed: Client app is serving complete HTML"
        FINAL_CHECK_PASSED=true
        break
    else
        echo "Final verification attempt $((FINAL_ATTEMPTS + 1))/$MAX_FINAL_ATTEMPTS: Client=$CLIENT_OK"
        sleep 2
        FINAL_ATTEMPTS=$((FINAL_ATTEMPTS + 1))
    fi
done

if [ "$FINAL_CHECK_PASSED" = true ]; then
    echo "All checks passed. Launching Chromium (client only, fullscreen)..."
else
    echo "Warning: Final verification incomplete, but launching Chromium anyway..."
fi

# Chromium flags for kiosk mode
# --kiosk: Fullscreen mode without browser UI
# --autoplay-policy=no-user-gesture-required: Allow auto-play without user interaction
# --disable-popup-blocking: Don't block popups (for embedded content)
# --disable-notifications: Disable notification prompts
# --disable-infobars: Hide info bars (e.g., Chrome is controlled by automated test software)
# --no-first-run: Skip first-run tasks
# --disable-session-crashed-bubble: Don't show session restore dialog
# --disable-restore-session-state: Don't restore previous session
# --disable-translate: Disable translate popups
# --disable-features=TranslateUI: Disable translate UI
# --noerrdialogs: Suppress error dialogs
# --disable-component-update: Disable component updates that may show dialogs
# --check-for-update-interval=31536000: Check for updates once a year
# --enable-hardware-acceleration: Use hardware acceleration for better performance
# --use-gl=egl: Use EGL for better Raspberry Pi compatibility
# --disable-gpu-vsync: Disable VSync for smoother playback
# --incognito: Start in incognito mode (no cache interference)
# --disable-background-networking: Disable background network activity
# --disable-background-timer-throttling: Don't throttle background timers
# --disable-breakpad: Disable crash reporting
# --disable-client-side-phishing-detection: Disable phishing warnings
# --disable-default-apps: Disable default apps
# --disable-dev-shm-usage: Use /tmp instead of /dev/shm (may help with crashes)
# --disable-extensions: Disable extensions (not needed in kiosk)
# --disable-hang-monitor: Disable hang detection
# --disable-prompt-on-repost: Don't prompt on form repost
# --disable-sync: Disable sync
# --metrics-recording-only: Disable metrics reporting
# --no-pings: Don't send pings
# --password-store=basic: Use basic password store (no keychain prompts)
# --use-mock-keychain: Use mock keychain (macOS, but safe to include)
# --app: Treat URL as an app (fullscreen by default)

# Detect Chromium command (on Raspberry Pi it's usually 'chromium')
if command -v chromium &> /dev/null; then
    CHROMIUM_CMD="chromium"
elif command -v chromium-browser &> /dev/null; then
    CHROMIUM_CMD="chromium-browser"
else
    echo "Error: Chromium not found. Please install with: sudo apt install chromium"
    exit 1
fi

# Kill any existing Chromium processes to avoid profile lock issues
echo "Checking for existing Chromium processes..."
pkill -f "$CHROMIUM_CMD" || true
sleep 2

# Client-only profile (no admin window)
CLIENT_PROFILE_DIR="$HOME/.config/chromium-client"
mkdir -p "$CLIENT_PROFILE_DIR"

# Clear session data to prevent "Restore pages" popup
echo "Clearing session data to prevent restore popup..."
for profile_dir in "$CLIENT_PROFILE_DIR"; do
    if [ -d "$profile_dir" ]; then
        # Remove session files
        rm -f "$profile_dir/Default/Session" 2>/dev/null || true
        rm -f "$profile_dir/Default/Current Session" 2>/dev/null || true
        rm -f "$profile_dir/Default/Current Tabs" 2>/dev/null || true
        rm -f "$profile_dir/Default/Last Session" 2>/dev/null || true
        rm -f "$profile_dir/Default/Last Tabs" 2>/dev/null || true
        rm -rf "$profile_dir/Default/Session Storage" 2>/dev/null || true
        rm -rf "$profile_dir/Default/GPUCache" 2>/dev/null || true
        
        # Modify preferences to disable session restore
        if [ -f "$profile_dir/Default/Preferences" ]; then
            # Use Python or sed to modify JSON preferences if available
            if command -v python3 &> /dev/null; then
                python3 << EOF
import json
import os
prefs_file = "$profile_dir/Default/Preferences"
if os.path.exists(prefs_file):
    try:
        with open(prefs_file, 'r') as f:
            prefs = json.load(f)
        # Disable session restore
        if 'session' not in prefs:
            prefs['session'] = {}
        prefs['session']['restore_on_startup'] = 5  # 5 = restore_on_startup = kRestoreOnStartupNever
        if 'profile' not in prefs:
            prefs['profile'] = {}
        prefs['profile']['exit_type'] = 'Normal'
        with open(prefs_file, 'w') as f:
            json.dump(prefs, f)
    except:
        pass
EOF
            fi
        fi
    fi
done

# Common Chromium flags
# --autoplay-policy=no-user-gesture-required: Allow autoplay for both video and audio without user interaction
# --autoplay-policy=no-user-gesture-required: Enables autoplay with sound
CHROMIUM_FLAGS=(
    --autoplay-policy=no-user-gesture-required
    --disable-popup-blocking
    --disable-notifications
    --disable-infobars
    --no-first-run
    --disable-session-crashed-bubble
    --disable-restore-session-state
    --disable-translate
    --disable-features=TranslateUI,SessionRestore
    --force-device-scale-factor=1
    --disable-features=AutofillServerCommunication
    --noerrdialogs
    --disable-component-update
    --check-for-update-interval=31536000
    --enable-hardware-acceleration
    --use-gl=egl
    --disable-gpu-vsync
    --disable-background-networking
    --disable-background-timer-throttling
    --disable-breakpad
    --disable-client-side-phishing-detection
    --disable-default-apps
    --disable-dev-shm-usage
    --disable-extensions
    --disable-hang-monitor
    --disable-prompt-on-repost
    --disable-sync
    --metrics-recording-only
    --no-pings
    --password-store=basic
    --use-mock-keychain
    --disable-background-downloads
)

echo "Starting Chromium (client only, fullscreen)..."
echo "Client URL: $CLIENT_URL"

# Enable Num Lock one more time after a short delay (in case it didn't work earlier)
# Try both console/TTY level and X11 level
(sleep 3 && \
  (for tty in /dev/tty1 /dev/tty2 /dev/tty3 /dev/console; do [ -e "$tty" ] && setleds +num < "$tty" 2>/dev/null && break; done || true) && \
  (DISPLAY=:0 numlockx on 2>/dev/null || DISPLAY=:0 xdotool key Num_Lock 2>/dev/null || true)) &

# Launch client in kiosk mode (fullscreen, no browser UI)
"$CHROMIUM_CMD" \
    --user-data-dir="$CLIENT_PROFILE_DIR" \
    --kiosk \
    "${CHROMIUM_FLAGS[@]}" \
    "$CLIENT_URL" &

CLIENT_PID=$!

# Wait for client window to appear and ensure it's in foreground
echo "Waiting for client window to appear and ensuring it's in foreground..."
sleep 3

# Function to bring client window to foreground
bring_client_to_foreground() {
    local client_winid=""
    
    if command -v wmctrl &> /dev/null; then
        # Method 1: Find by URL pattern
        client_winid=$(wmctrl -l | grep -iE "localhost:5001|5001" | awk '{print $1}' | head -1)
        
        # Method 2: If not found, find by process ID (most reliable)
        if [ -z "$client_winid" ] && [ -n "$CLIENT_PID" ]; then
            # Get window IDs for the client process
            client_winid=$(wmctrl -lp | grep " $CLIENT_PID " | awk '{print $1}' | head -1)
        fi
        
        # Method 3: Find largest/fullscreen chromium window (fallback)
        if [ -z "$client_winid" ]; then
            # Get all chromium windows and find the one that's fullscreen or largest
            for winid in $(wmctrl -lx | grep -i chromium | awk '{print $1}'); do
                # Check if window is fullscreen or try to make it fullscreen
                if wmctrl -i -r "$winid" -b add,fullscreen 2>/dev/null; then
                    client_winid="$winid"
                    break
                fi
            done
        fi
        
        if [ -n "$client_winid" ]; then
            echo "Bringing client window $client_winid to foreground..."
            # Remove any hidden/minimized state
            wmctrl -i -r "$client_winid" -b remove,hidden 2>/dev/null || true
            wmctrl -i -r "$client_winid" -b remove,shaded 2>/dev/null || true
            # Activate and make fullscreen
            wmctrl -i -a "$client_winid" 2>/dev/null || true
            wmctrl -i -r "$client_winid" -b add,fullscreen 2>/dev/null || true
            # Raise to top
            wmctrl -i -r "$client_winid" -b add,above 2>/dev/null || true
        else
            echo "Warning: Could not find client window"
        fi
        
    elif command -v xdotool &> /dev/null; then
        # Method 1: Find by process ID (most reliable)
        if [ -n "$CLIENT_PID" ]; then
            # Get all windows for the client process
            client_winid=$(xdotool search --pid "$CLIENT_PID" --class "chromium" 2>/dev/null | head -1)
        fi
        
        # Method 2: Find by URL in window name
        if [ -z "$client_winid" ]; then
            client_winid=$(xdotool search --name ".*localhost:5001.*" --class "chromium" 2>/dev/null | head -1)
        fi
        
        # Method 3: Find largest chromium window (fallback)
        if [ -z "$client_winid" ]; then
            # Get all chromium windows and find the largest one
            largest_size=0
            largest_winid=""
            for winid in $(xdotool search --class "chromium" 2>/dev/null); do
                geometry=$(xdotool getwindowgeometry "$winid" 2>/dev/null | grep -oP 'Geometry: \K[0-9]+x[0-9]+' || echo "")
                if [ -n "$geometry" ]; then
                    width=$(echo "$geometry" | cut -d'x' -f1)
                    height=$(echo "$geometry" | cut -d'x' -f2)
                    size=$((width * height))
                    if [ "$size" -gt "$largest_size" ]; then
                        largest_size=$size
                        largest_winid="$winid"
                    fi
                fi
            done
            client_winid="$largest_winid"
        fi
        
        if [ -n "$client_winid" ]; then
            echo "Bringing client window $client_winid to foreground..."
            # Activate, focus, and make fullscreen
            xdotool windowactivate "$client_winid" 2>/dev/null || true
            xdotool windowfocus "$client_winid" 2>/dev/null || true
            # Get screen dimensions and set window to fullscreen
            screen_size=$(xdotool getdisplaygeometry | awk '{print $1"x"$2}')
            xdotool windowsize "$client_winid" "$screen_size" 2>/dev/null || true
            xdotool windowmove "$client_winid" 0 0 2>/dev/null || true
        else
            echo "Warning: Could not find client window"
        fi
    else
        echo "Warning: Neither wmctrl nor xdotool found. Cannot bring window to foreground."
    fi
}

# Try multiple times to ensure client window is in foreground
# Wait a bit longer for window to fully initialize before trying to focus
sleep 2
for i in 1 2 3 4 5 6 7 8 9 10; do
    echo "Ensuring client window is in foreground (attempt $i/10)..."
    bring_client_to_foreground
    sleep 0.5
done

# Start a background process to periodically check and bring client to foreground
# This ensures the client window stays in foreground even if something tries to steal focus
(
    # Wait a bit before starting the monitor to let window fully initialize
    sleep 5
    while true; do
        # Check if client process is still running
        if ! kill -0 "$CLIENT_PID" 2>/dev/null; then
            echo "Client process ended, exiting foreground monitor"
            break
        fi
        # Bring client window to foreground periodically (every 5 seconds)
        bring_client_to_foreground
        sleep 5
    done
) &
FOREGROUND_MONITOR_PID=$!

# Wait for client process
wait "$CLIENT_PID"
CLIENT_EXIT_CODE=$?

# Kill foreground monitor when client exits
kill "$FOREGROUND_MONITOR_PID" 2>/dev/null || true

exit $CLIENT_EXIT_CODE

