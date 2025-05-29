#!/bin/bash

# CCTV System - Production Setup Script for Ubuntu Linux
# Run with: sudo bash setup-production.sh

set -e  # Exit on any error

echo "========================================"
echo "   CCTV System - Production Setup"
echo "      Ubuntu Linux Production"
echo "========================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}ERROR: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Get the actual user (not root) for proper permissions
ACTUAL_USER=${SUDO_USER:-$(logname)}
ACTUAL_HOME=$(eval echo ~$ACTUAL_USER)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}Setting up for user: $ACTUAL_USER${NC}"
echo -e "${BLUE}Project directory: $PROJECT_DIR${NC}"
echo

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Step 1: Update system packages
echo -e "${BLUE}Step 1: Updating system packages...${NC}"
apt update && apt upgrade -y
print_status "System packages updated"

# Step 2: Install required system packages
echo -e "${BLUE}Step 2: Installing system dependencies...${NC}"
apt install -y curl wget git nginx ufw fail2ban htop iotop tree unzip

# Install Node.js 18 LTS
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 18 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# Install FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "Installing FFmpeg..."
    apt install -y ffmpeg
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
    # Set up PM2 startup script
    env PATH=$PATH:/usr/bin pm2 startup systemd -u $ACTUAL_USER --hp $ACTUAL_HOME
fi

print_status "System dependencies installed"

# Step 3: Configure firewall
echo -e "${BLUE}Step 3: Configuring firewall...${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # CCTV API
ufw allow 554/tcp   # RTSP
print_status "Firewall configured"

# Step 4: Create production directories
echo -e "${BLUE}Step 4: Creating production directories...${NC}"
mkdir -p /var/log/cctv
mkdir -p /var/lib/cctv/hls
mkdir -p /var/lib/cctv/recordings
mkdir -p /etc/cctv

# Set proper ownership
chown -R $ACTUAL_USER:$ACTUAL_USER /var/log/cctv
chown -R $ACTUAL_USER:$ACTUAL_USER /var/lib/cctv
chown -R $ACTUAL_USER:$ACTUAL_USER /etc/cctv
print_status "Production directories created"

# Step 5: Install Node.js dependencies
echo -e "${BLUE}Step 5: Installing Node.js dependencies...${NC}"
cd "$PROJECT_DIR"
sudo -u $ACTUAL_USER npm install --production
print_status "Node.js dependencies installed"

# Step 6: Create production environment file
echo -e "${BLUE}Step 6: Creating production environment file...${NC}"
if [ ! -f "$PROJECT_DIR/.env" ]; then
    cat > "$PROJECT_DIR/.env" << 'EOF'
# CCTV System - Production Configuration
NODE_ENV=production

# Server Configuration
PORT=3000
GRACEFUL_SHUTDOWN_TIMEOUT=30000
CACHE_CONTROL_MAX_AGE=31536000

# Camera Configuration (Production)
CAMERA_IDS=1,102,202
RTSP_USER=admin
RTSP_PASS=change_this_password
RTSP_HOST=192.168.1.100
RTSP_PORT=554
RTSP_TRANSPORT=tcp

# HLS Configuration (Production)
HLS_ROOT=/var/lib/cctv/hls
SEGMENT_DURATION=5
HLS_LIST_SIZE=10
HLS_FLAGS=delete_segments+append_list

# Video Quality (Production - High quality)
LOW_QUALITY_WIDTH=1280
LOW_QUALITY_HEIGHT=720
LOW_QUALITY_FPS=15
LOW_QUALITY_BITRATE=2M
LOW_QUALITY_PRESET=fast
LOW_QUALITY_PROFILE=main
LOW_QUALITY_LEVEL=4.0

# Audio Settings (Production)
AUDIO_CODEC=aac
AUDIO_BITRATE=128k
AUDIO_SAMPLE_RATE=44100

# Storage (Production - Long retention)
RETENTION_MINUTES=43200
CLEANUP_INTERVAL_MINUTES=15
MAX_STORAGE_GB=500
INITIAL_CLEANUP_DELAY_SECONDS=30
EMERGENCY_CLEANUP_THRESHOLD=95
WARNING_THRESHOLD=80
ORPHANED_FILE_MAX_AGE_HOURS=6

# FFmpeg Configuration
FFMPEG_PATH=/usr/bin/ffmpeg
FFMPEG_LOG_LEVEL=warning

# Recording (Production)
ENABLE_RECORDING=true
RECORDING_FORMAT=mp4
RECORDING_SEGMENT_MINUTES=60

# System Configuration (Production)
MAX_RESTART_ATTEMPTS=10
RESTART_DELAY_SECONDS=10
HEALTH_CHECK_INTERVAL_SECONDS=30
STREAM_RESTART_PAUSE_SECONDS=2
ALL_CAMERAS_RESTART_PAUSE_SECONDS=3
PLAYLIST_STALE_THRESHOLD_MINUTES=5

# Monitoring (Production)
ENABLE_MONITORING=true
LOG_LEVEL=info
LOG_RETENTION_DAYS=30

# Log Configuration (Production)
LOG_MAX_FILE_SIZE=10485760
LOG_MAX_FILES=10
CLEANUP_LOG_MAX_SIZE=5242880
CLEANUP_LOG_MAX_FILES=5
STREAM_LOG_MAX_FILES=5
SYSTEM_LOG_MAX_FILES=5

# PM2 Configuration (Production)
PM2_INSTANCES=1
PM2_MAX_MEMORY_RESTART=4G
PM2_MAX_RESTARTS=15
PM2_MIN_UPTIME=30s
PM2_RESTART_DELAY=5000
PM2_KILL_TIMEOUT=30000
PM2_LISTEN_TIMEOUT=10000
PM2_HEALTH_CHECK_GRACE_PERIOD=30000
NODE_MAX_OLD_SPACE_SIZE=8192

# CORS Configuration (Production - Restrictive)
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_ALLOWED_HEADERS=Content-Type,Authorization

# Request Limits (Production)
REQUEST_JSON_LIMIT=10mb
REQUEST_URL_ENCODED_LIMIT=10mb
EOF

    chown $ACTUAL_USER:$ACTUAL_USER "$PROJECT_DIR/.env"
    print_status "Production environment file created"
    print_warning "IMPORTANT: Edit .env file to configure your camera settings!"
else
    print_status "Environment file already exists"
fi

# Step 7: Configure Nginx reverse proxy
echo -e "${BLUE}Step 7: Configuring Nginx reverse proxy...${NC}"
cat > /etc/nginx/sites-available/cctv << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Increase client max body size for video uploads
    client_max_body_size 100M;
    
    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for video streaming
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
    }
    
    # HLS video segments - serve directly with caching
    location /hls/ {
        alias /var/lib/cctv/hls/;
        
        # CORS headers for video streaming
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
        add_header Access-Control-Allow-Headers 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
        
        # Caching for HLS segments
        location ~* \.(m3u8)$ {
            expires 1s;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
        
        location ~* \.(ts)$ {
            expires 1h;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/cctv /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t
systemctl restart nginx
systemctl enable nginx
print_status "Nginx reverse proxy configured"

# Step 8: Configure log rotation
echo -e "${BLUE}Step 8: Configuring log rotation...${NC}"
cat > /etc/logrotate.d/cctv << 'EOF'
/var/log/cctv/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    su root root
}
EOF
print_status "Log rotation configured"

# Step 9: Create systemd service (alternative to PM2)
echo -e "${BLUE}Step 9: Creating systemd service...${NC}"
cat > /etc/systemd/system/cctv.service << EOF
[Unit]
Description=CCTV Streaming Server
After=network.target
Wants=network.target

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cctv

# Resource limits
LimitNOFILE=65536
MemoryMax=8G

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cctv
print_status "Systemd service created"

# Step 10: Configure system optimization
echo -e "${BLUE}Step 10: Optimizing system for video streaming...${NC}"

# Increase file descriptor limits
cat >> /etc/security/limits.conf << 'EOF'
# CCTV system file descriptor limits
* soft nofile 65536
* hard nofile 65536
EOF

# Optimize network settings for video streaming
cat > /etc/sysctl.d/99-cctv.conf << 'EOF'
# Network optimizations for video streaming
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 65536 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_congestion_control = bbr
EOF

sysctl -p /etc/sysctl.d/99-cctv.conf
print_status "System optimized for video streaming"

# Step 11: Create maintenance scripts
echo -e "${BLUE}Step 11: Creating maintenance scripts...${NC}"
mkdir -p /usr/local/bin

# Create backup script
cat > /usr/local/bin/cctv-backup << 'EOF'
#!/bin/bash
# CCTV System Backup Script

BACKUP_DIR="/var/backups/cctv"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/path/to/your/cctv/project"  # Update this path

mkdir -p "$BACKUP_DIR"

# Backup configuration
tar -czf "$BACKUP_DIR/cctv-config-$DATE.tar.gz" \
    "$PROJECT_DIR/.env" \
    "$PROJECT_DIR/ecosystem.config.js" \
    /etc/nginx/sites-available/cctv \
    /etc/systemd/system/cctv.service

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/cctv-config-$DATE.tar.gz"
EOF

# Create system status script
cat > /usr/local/bin/cctv-status << 'EOF'
#!/bin/bash
# CCTV System Status Script

echo "========================================"
echo "         CCTV System Status"
echo "========================================"
echo

# Service status
echo "🔧 Service Status:"
systemctl is-active --quiet cctv && echo "✓ CCTV Service: Running" || echo "✗ CCTV Service: Stopped"
systemctl is-active --quiet nginx && echo "✓ Nginx: Running" || echo "✗ Nginx: Stopped"

# System resources
echo
echo "💻 System Resources:"
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "Memory Usage: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
echo "Disk Usage: $(df /var/lib/cctv | tail -1 | awk '{print $5}')"

# FFmpeg processes
echo
echo "🎬 FFmpeg Processes:"
pgrep -c ffmpeg | xargs echo "Active FFmpeg processes:"

# Recent logs
echo
echo "📝 Recent Logs (last 5 lines):"
journalctl -u cctv --no-pager -n 5

echo
echo "========================================"
EOF

# Make scripts executable
chmod +x /usr/local/bin/cctv-backup
chmod +x /usr/local/bin/cctv-status

# Create cron job for automatic backups
echo "0 2 * * * root /usr/local/bin/cctv-backup" >> /etc/crontab

print_status "Maintenance scripts created"

# Step 12: Set proper permissions
echo -e "${BLUE}Step 12: Setting proper permissions...${NC}"
chown -R $ACTUAL_USER:$ACTUAL_USER "$PROJECT_DIR"
chmod -R 755 "$PROJECT_DIR"
chmod 600 "$PROJECT_DIR/.env"
print_status "Permissions set"

# Final setup summary
echo
echo "========================================"
echo "     Production Setup Complete!"
echo "========================================"
echo
echo -e "${GREEN}✓ System packages installed and updated${NC}"
echo -e "${GREEN}✓ Node.js, FFmpeg, and PM2 installed${NC}"
echo -e "${GREEN}✓ Firewall configured${NC}"
echo -e "${GREEN}✓ Production directories created${NC}"
echo -e "${GREEN}✓ Nginx reverse proxy configured${NC}"
echo -e "${GREEN}✓ Systemd service created${NC}"
echo -e "${GREEN}✓ System optimized for video streaming${NC}"
echo -e "${GREEN}✓ Maintenance scripts installed${NC}"
echo
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Edit the environment file: nano $PROJECT_DIR/.env"
echo "2. Configure your camera settings (RTSP credentials, IP addresses)"
echo "3. Start the service: systemctl start cctv"
echo "4. Check status: cctv-status"
echo
echo -e "${BLUE}🌐 Access Points:${NC}"
echo "Dashboard: http://$(hostname -I | awk '{print $1}')/"
echo "API: http://$(hostname -I | awk '{print $1}')/api"
echo
echo -e "${BLUE}🛠 Management Commands:${NC}"
echo "systemctl start cctv      - Start service"
echo "systemctl stop cctv       - Stop service"
echo "systemctl restart cctv    - Restart service"
echo "systemctl status cctv     - Check service status"
echo "cctv-status              - System status overview"
echo "cctv-backup              - Create configuration backup"
echo "journalctl -u cctv -f    - View live logs"
echo
echo -e "${GREEN}Production setup completed successfully! 🚀${NC}"
echo 