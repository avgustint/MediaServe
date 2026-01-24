#!/bin/bash
# Script to ensure MediaServer services are enabled and running
# This script ensures services are enabled (for boot) and attempts to start them if not running

echo "MediaServer Ensure Service: Starting..."

# Enable services if not already enabled
echo "Checking and enabling mediaserver.service..."
if ! systemctl is-enabled mediaserver.service >/dev/null 2>&1; then
  systemctl enable mediaserver.service
  echo "  Enabled mediaserver.service"
else
  echo "  mediaserver.service already enabled"
fi

echo "Checking and enabling client-server.service..."
if ! systemctl is-enabled client-server.service >/dev/null 2>&1; then
  systemctl enable client-server.service
  echo "  Enabled client-server.service"
else
  echo "  client-server.service already enabled"
fi

echo "Checking and enabling kiosk.service..."
if ! systemctl is-enabled kiosk.service >/dev/null 2>&1; then
  systemctl enable kiosk.service
  echo "  Enabled kiosk.service"
else
  echo "  kiosk.service already enabled"
fi

# Reload systemd to pick up any changes (non-blocking)
echo "Reloading systemd daemon..."
systemctl daemon-reload 2>&1 | head -1 || echo "Warning: systemctl daemon-reload had issues (continuing anyway)"

# Reset failed services if needed
if systemctl is-failed mediaserver.service >/dev/null 2>&1; then
  echo "Resetting failed mediaserver.service..."
  systemctl reset-failed mediaserver.service 2>/dev/null || true
fi

if systemctl is-failed client-server.service >/dev/null 2>&1; then
  echo "Resetting failed client-server.service..."
  systemctl reset-failed client-server.service 2>/dev/null || true
fi

# Note: We don't explicitly start services here to avoid blocking.
# Since services are enabled, systemd will start them automatically when dependencies are ready.
# If services need to be started immediately, they will be started by their dependencies or manually.
echo "Services are enabled. Systemd will start them automatically when ready."

echo "MediaServer Ensure Service: Complete"
exit 0

