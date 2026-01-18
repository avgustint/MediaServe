#!/bin/bash
# Chromium Kiosk Mode Launcher for MediaServer Client
# This script launches Chromium in kiosk mode with all necessary flags for auto-play and no popups

# Wait for client server to be ready
CLIENT_URL="http://localhost:5001"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s -f "$CLIENT_URL" > /dev/null 2>&1; then
        echo "Client server is ready"
        break
    fi
    echo "Waiting for client server... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 1
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "Warning: Client server may not be ready, starting Chromium anyway"
fi

# Set display (use first available)
export DISPLAY=:0

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

exec chromium-browser \
    --kiosk \
    --autoplay-policy=no-user-gesture-required \
    --disable-popup-blocking \
    --disable-notifications \
    --disable-infobars \
    --no-first-run \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --disable-translate \
    --disable-features=TranslateUI \
    --noerrdialogs \
    --disable-component-update \
    --check-for-update-interval=31536000 \
    --enable-hardware-acceleration \
    --use-gl=egl \
    --disable-gpu-vsync \
    --incognito \
    --disable-background-networking \
    --disable-background-timer-throttling \
    --disable-breakpad \
    --disable-client-side-phishing-detection \
    --disable-default-apps \
    --disable-dev-shm-usage \
    --disable-extensions \
    --disable-hang-monitor \
    --disable-prompt-on-repost \
    --disable-sync \
    --metrics-recording-only \
    --no-pings \
    --password-store=basic \
    --use-mock-keychain \
    "$CLIENT_URL"

