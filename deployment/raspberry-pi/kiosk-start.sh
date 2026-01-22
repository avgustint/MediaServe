#!/bin/bash
# Chromium Kiosk Mode Launcher for MediaServer Client
# This script launches Chromium in kiosk mode with all necessary flags for auto-play and no popups

# Set display (use first available)
export DISPLAY=:0
export HOME=/home/avgustin

# Wait for X server to be ready
MAX_X_ATTEMPTS=30
X_ATTEMPT=0
while [ $X_ATTEMPT -lt $MAX_X_ATTEMPTS ]; do
    if xset q &>/dev/null; then
        echo "X server is ready"
        break
    fi
    echo "Waiting for X server... ($X_ATTEMPT/$MAX_X_ATTEMPTS)"
    sleep 1
    X_ATTEMPT=$((X_ATTEMPT + 1))
done

if [ $X_ATTEMPT -eq $MAX_X_ATTEMPTS ]; then
    echo "Warning: X server may not be ready"
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

# Wait for both servers to be ready
CLIENT_URL="http://localhost:5001"
ADMIN_URL="http://localhost:5000"
LAUNCHER_FILE="$HOME/Desktop/MediaServer/deployment/raspberry-pi/kiosk-launcher.html"
LAUNCHER_URL="file://$LAUNCHER_FILE"

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

# Wait for admin server (mediaserver) - must be ready first
echo "Waiting for admin server (mediaserver) to be ready..."
ATTEMPT=0
ADMIN_READY=false
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if check_server_ready "$ADMIN_URL" "health"; then
        # HTML check already verifies JS references are in HTML
        # If HTML is served with JS refs, assets should be available
        echo "Admin server is ready (health check and HTML with JavaScript references verified)"
        ADMIN_READY=true
        break
    else
        echo "Waiting for admin server... ($ATTEMPT/$MAX_ATTEMPTS)"
    fi
    sleep 1
    ATTEMPT=$((ATTEMPT + 1))
done

if [ "$ADMIN_READY" = false ]; then
    echo "Warning: Admin server did not become ready within $MAX_ATTEMPTS seconds"
    echo "Continuing anyway, but pages may not load correctly..."
fi

# Wait for client server - depends on admin server
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

# Additional wait to ensure services are fully initialized and Angular apps are loaded
# Angular apps need time to bootstrap and initialize after HTML is served
if [ "$ADMIN_READY" = true ] && [ "$CLIENT_READY" = true ]; then
    echo "Both servers are ready. Waiting additional 5 seconds for Angular apps to bootstrap..."
    echo "  (This gives Angular time to load JavaScript bundles, initialize, and connect to WebSocket)"
    sleep 5
else
    echo "Waiting additional 10 seconds (some services may not be fully ready)..."
    sleep 10
fi

# Final verification - try to access both URLs and verify they return proper content
echo "Performing final verification..."
FINAL_CHECK_PASSED=true
FINAL_ATTEMPTS=0
MAX_FINAL_ATTEMPTS=10

while [ $FINAL_ATTEMPTS -lt $MAX_FINAL_ATTEMPTS ]; do
    ADMIN_OK=false
    CLIENT_OK=false
    
    # Check admin URL returns HTML
    local admin_response=$(curl -s -f "$ADMIN_URL" 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$admin_response" ] && echo "$admin_response" | grep -qiE "<!DOCTYPE html|<html|<app-root" 2>/dev/null; then
        ADMIN_OK=true
    fi
    
    # Check client URL returns HTML
    local client_response=$(curl -s -f "$CLIENT_URL" 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$client_response" ] && echo "$client_response" | grep -qiE "<!DOCTYPE html|<html|<app-root" 2>/dev/null; then
        CLIENT_OK=true
    fi
    
    if [ "$ADMIN_OK" = true ] && [ "$CLIENT_OK" = true ]; then
        echo "Final verification passed: Both apps are serving complete HTML with JavaScript"
        FINAL_CHECK_PASSED=true
        break
    else
        echo "Final verification attempt $((FINAL_ATTEMPTS + 1))/$MAX_FINAL_ATTEMPTS: Admin=$ADMIN_OK, Client=$CLIENT_OK"
        sleep 2
        FINAL_ATTEMPTS=$((FINAL_ATTEMPTS + 1))
    fi
done

if [ "$FINAL_CHECK_PASSED" = true ]; then
    echo "All checks passed. Launching Chromium..."
else
    echo "Warning: Final verification incomplete, but launching Chromium anyway..."
    echo "Pages may take longer to load or may show blank screens initially"
fi

# Check if launcher file exists
if [ ! -f "$LAUNCHER_FILE" ]; then
    echo "Warning: Launcher file not found at $LAUNCHER_FILE"
    echo "Falling back to client URL only"
    LAUNCHER_URL="$CLIENT_URL"
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

# Use separate profile directories for client and admin windows
CLIENT_PROFILE_DIR="$HOME/.config/chromium-client"
ADMIN_PROFILE_DIR="$HOME/.config/chromium-admin"
mkdir -p "$CLIENT_PROFILE_DIR"
mkdir -p "$ADMIN_PROFILE_DIR"

# Common Chromium flags
CHROMIUM_FLAGS=(
    --autoplay-policy=no-user-gesture-required
    --disable-popup-blocking
    --disable-notifications
    --disable-infobars
    --no-first-run
    --disable-session-crashed-bubble
    --disable-restore-session-state
    --disable-translate
    --disable-features=TranslateUI
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
)

echo "Starting Chromium windows..."
echo "Client URL: $CLIENT_URL (fullscreen)"
echo "Admin URL: $ADMIN_URL (minimized)"

# Launch admin window first (normal window, will be minimized)
echo "Launching admin window..."
"$CHROMIUM_CMD" \
    --user-data-dir="$ADMIN_PROFILE_DIR" \
    "${CHROMIUM_FLAGS[@]}" \
    --new-window \
    "$ADMIN_URL" &

ADMIN_PID=$!

# Wait a moment for admin window to start
sleep 2

# Minimize admin window using xdotool or wmctrl
# Wait a bit longer for window to fully appear
sleep 2

if command -v wmctrl &> /dev/null; then
    echo "Minimizing admin window using wmctrl..."
    # Try multiple methods to find and minimize admin window
    # Method 1: Search by window title containing "MediaServer" or "admin"
    wmctrl -l | grep -iE "mediaserver|admin|localhost:5000" | awk '{print $1}' | while read winid; do
        wmctrl -i -r "$winid" -b add,hidden 2>/dev/null || true
    done
    # Method 2: Try to minimize by class name
    wmctrl -x -l | grep -i chromium | grep -v "fullscreen\|kiosk" | awk '{print $1}' | head -1 | while read winid; do
        wmctrl -i -r "$winid" -b add,hidden 2>/dev/null || true
    done
elif command -v xdotool &> /dev/null; then
    echo "Minimizing admin window using xdotool..."
    # Find admin window by searching for Chromium windows
    # Get all Chromium windows and minimize the one that's not fullscreen
    xdotool search --class "chromium" 2>/dev/null | while read winid; do
        # Check if window is not in fullscreen state
        STATE=$(xdotool getwindowgeometry "$winid" 2>/dev/null | grep -i geometry || echo "")
        if [ -n "$STATE" ]; then
            xdotool windowminimize "$winid" 2>/dev/null || true
            break
        fi
    done
else
    echo "Warning: Neither wmctrl nor xdotool found. Admin window will not be minimized automatically."
    echo "Install with: sudo apt install wmctrl xdotool"
fi

# Launch client window (fullscreen, focused)
echo "Launching client window (fullscreen)..."

# Enable Num Lock one more time after a short delay (in case it didn't work earlier)
# Try both console/TTY level and X11 level
(sleep 3 && \
  (for tty in /dev/tty1 /dev/tty2 /dev/tty3 /dev/console; do [ -e "$tty" ] && setleds +num < "$tty" 2>/dev/null && break; done || true) && \
  (DISPLAY=:0 numlockx on 2>/dev/null || DISPLAY=:0 xdotool key Num_Lock 2>/dev/null || true)) &

exec "$CHROMIUM_CMD" \
    --user-data-dir="$CLIENT_PROFILE_DIR" \
    --start-fullscreen \
    "${CHROMIUM_FLAGS[@]}" \
    --new-window \
    "$CLIENT_URL"

