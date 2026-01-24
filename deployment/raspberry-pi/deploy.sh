#!/bin/bash
# MediaServer Raspberry Pi Deployment Script
# This script automates the deployment of MediaServer to a Raspberry Pi
# 
# Usage:
#   ./deploy.sh [raspberry-pi-hostname-or-ip]
#
# Example:
#   ./deploy.sh avgustin@mediaplayer.local
#   ./deploy.sh avgustin@192.168.1.100

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get target from command line argument or prompt
TARGET="${1:-}"
if [ -z "$TARGET" ]; then
    echo -e "${YELLOW}Enter Raspberry Pi SSH target (e.g., avgustin@mediaplayer.local or avgustin@192.168.1.100):${NC}"
    read -r TARGET
fi

if [ -z "$TARGET" ]; then
    echo -e "${RED}Error: Target is required${NC}"
    exit 1
fi

echo -e "${GREEN}Deploying MediaServer to $TARGET${NC}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Setup SSH ControlMaster for connection reuse (reduces password prompts)
SSH_CONTROL_PATH="$HOME/.ssh/control-%r@%h:%p"
mkdir -p "$HOME/.ssh"

# Establish control master connection (this will prompt for password ONCE)
# ControlMaster=yes forces this to be the master connection
# ControlPersist=300s keeps connection alive for 5 minutes
echo -e "${YELLOW}Establishing SSH connection (you will be prompted for password once)...${NC}"
ssh -o ControlMaster=yes -o ControlPath="$SSH_CONTROL_PATH" -o ControlPersist=300s -o ConnectTimeout=10 -o ServerAliveInterval=60 -o ServerAliveCountMax=3 "$TARGET" "echo 'SSH connection established'" || {
    echo -e "${RED}Failed to establish SSH connection${NC}"
    echo -e "${YELLOW}Note: To avoid password prompts, set up SSH key authentication:${NC}"
    echo -e "${YELLOW}   ssh-copy-id $TARGET${NC}"
    exit 1
}
echo -e "${GREEN}✓ SSH connection established - subsequent commands will reuse this connection${NC}"
echo ""

# Check if dist directory exists
if [ ! -d "$PROJECT_ROOT/dist" ]; then
    echo -e "${YELLOW}dist directory not found. Building application...${NC}"
    cd "$PROJECT_ROOT"
    npm run build -- --profile raspberry-pi
fi

if [ ! -d "$PROJECT_ROOT/dist" ]; then
    echo -e "${RED}Error: dist directory not found after build${NC}"
    exit 1
fi

echo -e "${GREEN}Step 1: Copying files to Raspberry Pi...${NC}"

# Create remote directory structure and make scripts executable in one SSH session
# Use ControlMaster=auto to reuse the existing control connection
ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "mkdir -p /home/avgustin/Desktop/MediaServer/{dist,deployment/raspberry-pi}"

# Ask if user wants to deploy database
DEPLOY_DB=""
DB_FILE="$PROJECT_ROOT/server/data/mediaserver.db"
if [ -f "$DB_FILE" ]; then
    echo -e "${YELLOW}Database file found at: $DB_FILE${NC}"
    echo -e "${YELLOW}Do you want to deploy the database? This will overwrite any existing database on the Raspberry Pi. (y/N):${NC}"
    read -r DEPLOY_DB
    DEPLOY_DB=$(echo "$DEPLOY_DB" | tr '[:upper:]' '[:lower:]')
else
    echo -e "${YELLOW}No database file found at $DB_FILE - skipping database deployment${NC}"
fi

# Stop mediaserver service before cleanup to release database lock (when not deploying database)
if [ "$DEPLOY_DB" != "y" ] && [ "$DEPLOY_DB" != "yes" ]; then
    echo "Stopping mediaserver service to release database lock..."
    ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "sudo systemctl stop mediaserver.service 2>/dev/null || true"
    # Wait a moment for service to stop and database lock to be released
    sleep 2
fi

# Clean and copy dist directory (preserving node_modules and database)
echo "Cleaning old dist directory on Raspberry Pi (preserving node_modules and database)..."
# Remove old dist directory contents but preserve node_modules and database if they exist
ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "
  if [ -d /home/avgustin/Desktop/MediaServer/dist ]; then
    # Backup node_modules if it exists
    if [ -d /home/avgustin/Desktop/MediaServer/dist/node_modules ]; then
      echo 'Preserving existing node_modules...'
      mv /home/avgustin/Desktop/MediaServer/dist/node_modules /tmp/mediaserver_node_modules_backup 2>/dev/null || true
    fi
    # Backup database and videos if they exist (preserve them when user chooses not to deploy new database)
    if [ -f /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db ]; then
      echo 'Preserving existing database...'
      mkdir -p /tmp/mediaserver_db_backup/server/data
      # Copy database with verification
      if cp /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db /tmp/mediaserver_db_backup/server/data/mediaserver.db; then
        DB_SIZE=\$(stat -c%s /tmp/mediaserver_db_backup/server/data/mediaserver.db 2>/dev/null || stat -f%z /tmp/mediaserver_db_backup/server/data/mediaserver.db 2>/dev/null || echo 'unknown')
        echo \"Database backed up successfully (size: \$DB_SIZE bytes)\"
      else
        echo 'WARNING: Failed to backup database'
      fi
    else
      echo 'No existing database found to backup'
    fi
    # Backup videos directory if it exists
    if [ -d /home/avgustin/Desktop/MediaServer/dist/server/data/videos ]; then
      echo 'Preserving existing videos directory...'
      mkdir -p /tmp/mediaserver_db_backup/server/data
      # Copy videos directory with verification
      if cp -r /home/avgustin/Desktop/MediaServer/dist/server/data/videos /tmp/mediaserver_db_backup/server/data/videos 2>/dev/null; then
        VIDEO_COUNT=\$(find /tmp/mediaserver_db_backup/server/data/videos -type f 2>/dev/null | wc -l)
        echo \"Videos directory backed up successfully (\$VIDEO_COUNT files)\"
      else
        echo 'WARNING: Failed to backup videos directory'
      fi
    else
      echo 'No existing videos directory found to backup'
    fi
    # Remove dist directory contents (but preserve server/data when not deploying database)
    # Note: DEPLOY_DB variable is expanded locally (outside SSH), so we check the expanded value
    # Since this is inside double quotes, $DEPLOY_DB is already expanded to its value
    if [ \"$DEPLOY_DB\" != \"y\" ] && [ \"$DEPLOY_DB\" != \"yes\" ]; then
      # Preserve server/data directory during cleanup
      echo 'Preserving server/data directory during cleanup...'
      # First, clean everything except node_modules and server
      find /home/avgustin/Desktop/MediaServer/dist -mindepth 1 -maxdepth 1 ! -name 'node_modules' ! -name 'server' -exec rm -rf {} + 2>/dev/null || true
      # Then clean server directory but preserve data subdirectory
      if [ -d /home/avgustin/Desktop/MediaServer/dist/server ]; then
        find /home/avgustin/Desktop/MediaServer/dist/server -mindepth 1 -maxdepth 1 ! -name 'data' -exec rm -rf {} + 2>/dev/null || true
      fi
    else
      # Normal cleanup when deploying database
      find /home/avgustin/Desktop/MediaServer/dist -mindepth 1 -maxdepth 1 ! -name 'node_modules' -exec rm -rf {} + 2>/dev/null || true
    fi
    # Restore node_modules backup
    if [ -d /tmp/mediaserver_node_modules_backup ]; then
      mv /tmp/mediaserver_node_modules_backup /home/avgustin/Desktop/MediaServer/dist/node_modules 2>/dev/null || true
      echo 'node_modules preserved'
    fi
    # Database will be restored later if user chose not to deploy new one
  else
    mkdir -p /home/avgustin/Desktop/MediaServer/dist
  fi
"

echo "Copying dist directory (excluding node_modules and database if not deploying)..."
# Use tar to create archive excluding node_modules and database (if not deploying)
# This preserves existing node_modules and database on destination
cd "$PROJECT_ROOT"
# Build tar exclude list (use array to avoid quote issues)
TAR_EXCLUDE_ARGS=("--exclude=node_modules")
if [ "$DEPLOY_DB" != "y" ] && [ "$DEPLOY_DB" != "yes" ]; then
  # Exclude entire server/data directory from tar if we're not deploying database
  # This prevents any database files and video files from being included in the archive
  TAR_EXCLUDE_ARGS+=("--exclude=server/data")
  echo "Excluding server/data directory from archive to preserve existing database and video files"
fi

tar "${TAR_EXCLUDE_ARGS[@]}" -czf /tmp/mediaserver_dist.tar.gz -C dist . 2>/dev/null || {
  echo -e "${YELLOW}Warning: Failed to create tar archive, using direct copy (node_modules may be overwritten)${NC}"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" -r "$PROJECT_ROOT/dist/" "$TARGET:/home/avgustin/Desktop/MediaServer/"
  cd - >/dev/null
  exit 0
}
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" /tmp/mediaserver_dist.tar.gz "$TARGET:/tmp/"
# Extract tar archive, but exclude server/data if we're not deploying database
if [ "$DEPLOY_DB" != "y" ] && [ "$DEPLOY_DB" != "yes" ]; then
  # Extract while excluding server/data to prevent overwriting existing database
  # Use --exclude without quotes to ensure proper exclusion
  ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "cd /home/avgustin/Desktop/MediaServer/dist && tar --exclude=server/data -xzf /tmp/mediaserver_dist.tar.gz 2>/dev/null && rm -f /tmp/mediaserver_dist.tar.gz"
  echo "Tar extraction completed (server/data excluded)"
else
  # Normal extraction when deploying database
  ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "cd /home/avgustin/Desktop/MediaServer/dist && tar -xzf /tmp/mediaserver_dist.tar.gz 2>/dev/null && rm -f /tmp/mediaserver_dist.tar.gz"
  echo "Tar extraction completed"
fi
rm -f /tmp/mediaserver_dist.tar.gz
cd - >/dev/null

# Copy database if requested, otherwise restore existing database
if [ "$DEPLOY_DB" = "y" ] || [ "$DEPLOY_DB" = "yes" ]; then
    echo "Copying database file..."
    # Create data directory on remote if it doesn't exist
    ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "mkdir -p /home/avgustin/Desktop/MediaServer/dist/server/data"
    # Copy database file
    scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$DB_FILE" "$TARGET:/home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db"
    echo -e "${GREEN}✓ Database deployed${NC}"
else
    echo -e "${YELLOW}Database deployment skipped - restoring existing database and videos if available...${NC}"
    # Restore the backed up database and videos if they exist
    ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "
      # Ensure the directory exists
      mkdir -p /home/avgustin/Desktop/MediaServer/dist/server/data
      
      # Restore database if it exists
      if [ -f /tmp/mediaserver_db_backup/server/data/mediaserver.db ]; then
        echo 'Restoring existing database...'
        # Remove any existing database file that might have been created by tar extraction
        rm -f /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db 2>/dev/null || true
        # Copy with verbose output to verify it works
        if cp /tmp/mediaserver_db_backup/server/data/mediaserver.db /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db; then
          # Verify the file was copied successfully
          if [ -f /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db ]; then
            DB_SIZE=\$(stat -c%s /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db 2>/dev/null || stat -f%z /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db 2>/dev/null || echo 'unknown')
            BACKUP_SIZE=\$(stat -c%s /tmp/mediaserver_db_backup/server/data/mediaserver.db 2>/dev/null || stat -f%z /tmp/mediaserver_db_backup/server/data/mediaserver.db 2>/dev/null || echo 'unknown')
            echo \"Existing database restored successfully (restored: \$DB_SIZE bytes, backup: \$BACKUP_SIZE bytes)\"
            # Verify sizes match (within 1KB tolerance for file system differences)
            if [ \"\$DB_SIZE\" != \"unknown\" ] && [ \"\$BACKUP_SIZE\" != \"unknown\" ]; then
              SIZE_DIFF=\$((DB_SIZE > BACKUP_SIZE ? DB_SIZE - BACKUP_SIZE : BACKUP_SIZE - DB_SIZE))
              if [ \$SIZE_DIFF -gt 1024 ]; then
                echo 'WARNING: Database size mismatch after restore - file may be corrupted'
              fi
            fi
          else
            echo 'ERROR: Database file not found after restore attempt'
          fi
        else
          echo 'ERROR: Failed to restore database file'
        fi
      else
        echo 'No existing database found to restore'
      fi
      
      # Restore videos directory if it exists
      if [ -d /tmp/mediaserver_db_backup/server/data/videos ]; then
        echo 'Restoring existing videos directory...'
        # Remove any existing videos directory that might have been created by tar extraction
        rm -rf /home/avgustin/Desktop/MediaServer/dist/server/data/videos 2>/dev/null || true
        # Copy videos directory
        if cp -r /tmp/mediaserver_db_backup/server/data/videos /home/avgustin/Desktop/MediaServer/dist/server/data/videos 2>/dev/null; then
          VIDEO_COUNT=\$(find /home/avgustin/Desktop/MediaServer/dist/server/data/videos -type f 2>/dev/null | wc -l)
          BACKUP_VIDEO_COUNT=\$(find /tmp/mediaserver_db_backup/server/data/videos -type f 2>/dev/null | wc -l)
          echo \"Existing videos directory restored successfully (restored: \$VIDEO_COUNT files, backup: \$BACKUP_VIDEO_COUNT files)\"
          if [ \"\$VIDEO_COUNT\" != \"\$BACKUP_VIDEO_COUNT\" ]; then
            echo 'WARNING: Video file count mismatch after restore'
          fi
        else
          echo 'ERROR: Failed to restore videos directory'
        fi
      else
        echo 'No existing videos directory found to restore'
      fi
      
      # Clean up backup
      rm -rf /tmp/mediaserver_db_backup
      
      # Verify restore was successful
      RESTORE_SUCCESS=true
      if [ ! -f /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db ]; then
        echo 'ERROR: Database file not found after restore - restore may have failed'
        RESTORE_SUCCESS=false
      elif [ ! -s /home/avgustin/Desktop/MediaServer/dist/server/data/mediaserver.db ]; then
        echo 'ERROR: Restored database file is empty - restore may have failed'
        RESTORE_SUCCESS=false
      fi
      
      if [ \"\$RESTORE_SUCCESS\" = true ]; then
        echo 'Database and videos restore verification: SUCCESS'
      else
        echo 'Database and videos restore verification: FAILED'
        exit 1
      fi
    "
    
    # Restart mediaserver service after restore to ensure it picks up the restored database
    echo "Restarting mediaserver service to load restored database..."
    ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "sudo systemctl restart mediaserver.service 2>/dev/null || echo 'Warning: Failed to restart mediaserver service'"
fi

# Copy deployment files
echo "Copying deployment files..."
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/client-server.js" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/kiosk-start.sh" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/kiosk-launcher.html" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/configure-services.sh" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/enable-services.sh" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/" 2>/dev/null || true
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/ensure-services-running.sh" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/" 2>/dev/null || true
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/fix-dns-wired-network.sh" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/" 2>/dev/null || true
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/fix-local-hostname-resolution.sh" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/" 2>/dev/null || true
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/ensure-services.sh" "$TARGET:/home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/" 2>/dev/null || true

# Make scripts executable (combined into one command)
ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "chmod +x /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/kiosk-start.sh /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/client-server.js /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/configure-services.sh /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/enable-services.sh /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/ensure-services-running.sh /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/ensure-services.sh /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/fix-dns-wired-network.sh /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/fix-local-hostname-resolution.sh 2>/dev/null || true"

echo -e "${GREEN}Step 2: Installing Node.js dependencies...${NC}"
# Install/update dependencies and rebuild native modules
ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$TARGET" "
  cd /home/avgustin/Desktop/MediaServer/dist
  if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ] 2>/dev/null; then
    echo 'Installing/updating Node.js dependencies...'
    npm install --omit=dev
  else
    echo 'node_modules exists, rebuilding native modules...'
    # Rebuild native modules (like bcrypt) to ensure they match current Node.js version
    npm rebuild --omit=dev || npm install --omit=dev
  fi
"

echo -e "${GREEN}Step 3: Installing systemd services...${NC}"

# Copy service files (all in parallel using connection reuse)
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/mediaserver.service" "$TARGET:/tmp/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/client-server.service" "$TARGET:/tmp/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/kiosk.service" "$TARGET:/tmp/"
scp -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" "$SCRIPT_DIR/numlock.service" "$TARGET:/tmp/" 2>/dev/null || true
# Install services (requires sudo)
# Note: numlock.service is enabled but not started during deployment to avoid blocking (it will start on boot)
echo "Installing and enabling services..."
ssh -o ControlMaster=auto -o ControlPath="$SSH_CONTROL_PATH" -o ConnectTimeout=30 "$TARGET" bash << 'EOF' || true
set +e  # Don't exit on errors, continue anyway

# Copy service files
echo "Copying service files..."
sudo cp /tmp/mediaserver.service /etc/systemd/system/
sudo cp /tmp/client-server.service /etc/systemd/system/
sudo cp /tmp/kiosk.service /etc/systemd/system/
sudo cp /tmp/numlock.service /etc/systemd/system/ 2>/dev/null || true

# Reload systemd (with timeout to prevent hanging)
echo "Reloading systemd daemon..."
timeout 10 sudo systemctl daemon-reload || echo "Warning: daemon-reload timed out or failed"

# Enable services
echo "Enabling services..."
sudo systemctl enable mediaserver.service
sudo systemctl enable client-server.service
sudo systemctl enable kiosk.service
sudo systemctl enable numlock.service 2>/dev/null || true

# Note: Services are enabled but not started during deployment
# They will start automatically on boot, or can be started manually
# This prevents blocking during deployment

echo "Services installation complete"
exit 0
EOF

echo -e "${GREEN}Step 4: Configuration instructions${NC}"
echo -e "${YELLOW}The following steps need to be completed manually on the Raspberry Pi:${NC}"
echo ""
echo "1. Configure hostname:"
echo "   sudo hostnamectl set-hostname mediaplayer"
echo "   sudo sed -i 's/127.0.1.1.*/127.0.1.1\tmediaplayer mediaplayer.local/' /etc/hosts"
echo "   # Or run the fix script:"
echo "   sudo /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi/fix-local-hostname-resolution.sh"
echo ""
echo "2. Services are now enabled and will start automatically on boot."
echo "   (This was done automatically during deployment)"
echo ""
echo "3. Start services (or wait for next reboot):"
echo "   sudo systemctl start mediaserver"
echo "   sudo systemctl start client-server"
echo "   sudo systemctl start kiosk"
echo ""
echo "4. Check service status:"
echo "   sudo systemctl status mediaserver"
echo "   sudo systemctl status client-server"
echo "   sudo systemctl status kiosk"
echo ""
# Close SSH control connection
ssh -o ControlPath="$SSH_CONTROL_PATH" -O exit "$TARGET" 2>/dev/null || true

echo -e "${GREEN}Deployment files copied successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. SSH into the Raspberry Pi: ssh $TARGET"
echo "  2. Run the configuration script:"
echo "     cd /home/avgustin/Desktop/MediaServer/deployment/raspberry-pi"
echo "     bash configure-services.sh"
echo ""
echo "  Or configure manually - see instructions above."
echo ""
echo -e "${YELLOW}Tip: To avoid password prompts in the future, set up SSH key authentication:${NC}"
echo "   ssh-copy-id $TARGET"

