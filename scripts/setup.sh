#!/bin/bash

# CCTV Streaming Backend Setup Script
# This script sets up the CCTV streaming backend on Unix/Linux systems

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print with color
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root"
    exit 1
fi

# Check system requirements
print_status "Checking system requirements..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    print_warning "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Check FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    print_error "FFmpeg is not installed"
    print_warning "Installing FFmpeg..."
    apt-get update
    apt-get install -y ffmpeg
fi

# Create necessary directories
print_status "Creating directories..."
mkdir -p /var/log/cctv-streaming
mkdir -p /var/lib/cctv-streaming/hls
mkdir -p /etc/cctv-streaming

# Set permissions
print_status "Setting permissions..."
chown -R $SUDO_USER:$SUDO_USER /var/log/cctv-streaming
chown -R $SUDO_USER:$SUDO_USER /var/lib/cctv-streaming
chmod 755 /var/log/cctv-streaming
chmod 755 /var/lib/cctv-streaming

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install

# Create environment file
if [ ! -f "/etc/cctv-streaming/production.env" ]; then
    print_status "Creating environment file..."
    cp production.env /etc/cctv-streaming/production.env
    print_warning "Please edit /etc/cctv-streaming/production.env with your settings"
fi

# Create systemd service
print_status "Creating systemd service..."
cat > /etc/systemd/system/cctv-streaming.service << EOL
[Unit]
Description=CCTV Streaming Backend
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$(pwd)
Environment=NODE_ENV=production
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd
systemctl daemon-reload

# Start service
print_status "Starting CCTV Streaming service..."
systemctl enable cctv-streaming
systemctl start cctv-streaming

# Check service status
if systemctl is-active --quiet cctv-streaming; then
    print_status "CCTV Streaming service is running"
else
    print_error "Failed to start CCTV Streaming service"
    print_warning "Check logs with: journalctl -u cctv-streaming"
fi

# Final instructions
echo
print_status "Setup completed!"
echo
echo "Next steps:"
echo "1. Edit configuration: /etc/cctv-streaming/production.env"
echo "2. Check logs: journalctl -u cctv-streaming -f"
echo "3. Service commands:"
echo "   - Start: systemctl start cctv-streaming"
echo "   - Stop: systemctl stop cctv-streaming"
echo "   - Restart: systemctl restart cctv-streaming"
echo "   - Status: systemctl status cctv-streaming"
echo
print_warning "Don't forget to configure your firewall to allow required ports" 