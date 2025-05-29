# Production Deployment Guide

Complete guide for deploying the CCTV Streaming Backend in production environments.

## 🎯 Deployment Overview

This guide covers:
- 🏗️ Infrastructure setup
- 🔧 System configuration  
- 🚀 Application deployment
- 🔒 Security hardening
- 📊 Monitoring setup
- 🔄 Maintenance procedures

## 🏗️ Infrastructure Setup

### Ubuntu Server 22.04 LTS (Recommended)

#### 1. Initial Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git htop iotop ufw fail2ban nginx

# Create application user
sudo useradd -r -s /bin/false -m -d /opt/cctv cctv

# Create directories
sudo mkdir -p /opt/cctv-streaming
sudo mkdir -p /var/log/cctv-streaming
sudo mkdir -p /var/lib/cctv-streaming

# Set ownership
sudo chown -R cctv:cctv /opt/cctv-streaming
sudo chown -R cctv:cctv /var/log/cctv-streaming
sudo chown -R cctv:cctv /var/lib/cctv-streaming
```

#### 2. Install Node.js 18 LTS
```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### 3. Install FFmpeg
```bash
# Install FFmpeg
sudo apt install -y ffmpeg

# Verify installation
ffmpeg -version
```

#### 4. Configure Storage
```bash
# For production, consider mounting additional storage
# Example: Mount 1TB drive for video storage
sudo mkdir -p /mnt/cctv-storage
sudo mount /dev/sdb1 /mnt/cctv-storage
sudo chown -R cctv:cctv /mnt/cctv-storage

# Add to fstab for persistent mounting
echo '/dev/sdb1 /mnt/cctv-storage ext4 defaults 0 2' | sudo tee -a /etc/fstab
```

## 🚀 Application Deployment

### 1. Deploy Application
```bash
# Switch to application user
sudo -u cctv -i

# Clone repository (or upload files)
cd /opt/cctv-streaming
git clone https://github.com/your-username/cctv-streaming-backend.git .

# Install dependencies
npm install --production

# Copy production environment
cp env.production .env

# Edit configuration
nano .env
```

### 2. Configure Environment
Update `.env` with production settings:

```env
# Server Configuration
NODE_ENV=production
HOST=0.0.0.0
PORT=3000

# Camera Configuration
CAMERA_IDS=101,102,103,104,105,106
RTSP_USER=admin
RTSP_PASSWORD=your_secure_password
RTSP_HOST=192.168.1.100
RTSP_PORT=554

# Storage (use mounted storage)
HLS_PATH=/mnt/cctv-storage/hls

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/cctv-streaming

# Production Settings
RETENTION_DAYS=30
AUTO_RESTART=true
DEBUG_MODE=false
```

### 3. Test Configuration
```bash
# Test camera connections
npm test

# Test application startup
npm start
```

## 🔧 System Service Setup

### 1. Create Systemd Service
```bash
sudo nano /etc/systemd/system/cctv-streaming.service
```

```ini
[Unit]
Description=CCTV Streaming Backend
Documentation=https://github.com/your-username/cctv-streaming-backend
After=network.target

[Service]
Type=simple
User=cctv
Group=cctv
WorkingDirectory=/opt/cctv-streaming
ExecStart=/usr/bin/node app.js
ExecReload=/bin/kill -HUP $MAINPID
KillMode=mixed
KillSignal=SIGINT
TimeoutStopSec=5
PrivateTmp=true
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/cctv-streaming /var/log/cctv-streaming /mnt/cctv-storage

# Environment
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/bin
EnvironmentFile=/opt/cctv-streaming/.env

[Install]
WantedBy=multi-user.target
```

### 2. Enable and Start Service
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable cctv-streaming

# Start service
sudo systemctl start cctv-streaming

# Check status
sudo systemctl status cctv-streaming

# View logs
sudo journalctl -u cctv-streaming -f
```

## 🌐 Reverse Proxy Setup (nginx)

### 1. Install and Configure nginx
```bash
# Install nginx (if not already installed)
sudo apt install -y nginx

# Create configuration
sudo nano /etc/nginx/sites-available/cctv-streaming
```

### 2. nginx Configuration
```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=streams:10m rate=2r/s;

# Upstream
upstream cctv_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name cctv.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cctv.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/cctv.crt;
    ssl_certificate_key /etc/ssl/private/cctv.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    
    # Logging
    access_log /var/log/nginx/cctv_access.log;
    error_log /var/log/nginx/cctv_error.log;
    
    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://cctv_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_timeout 30s;
    }
    
    # HLS streams
    location /hls/ {
        limit_req zone=streams burst=10 nodelay;
        
        # Cache configuration
        location ~* \.(m3u8)$ {
            proxy_pass http://cctv_backend;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
        }
        
        location ~* \.(ts)$ {
            proxy_pass http://cctv_backend;
            add_header Cache-Control "public, max-age=3600";
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
        }
    }
    
    # Health check
    location /health {
        proxy_pass http://cctv_backend;
        access_log off;
    }
    
    # Dashboard
    location / {
        proxy_pass http://cctv_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Enable nginx Configuration
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/cctv-streaming /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## 🔒 Security Configuration

### 1. Firewall Setup (UFW)
```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow specific IPs only (recommended)
sudo ufw allow from 192.168.1.0/24 to any port 3000

# Check status
sudo ufw status verbose
```

### 2. Fail2Ban Configuration
```bash
# Create jail for nginx
sudo nano /etc/fail2ban/jail.local
```

```ini
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/cctv_error.log
maxretry = 3
bantime = 3600

[nginx-req-limit]
enabled = true
port = http,https
logpath = /var/log/nginx/cctv_error.log
failregex = limiting requests, excess:.* by zone.*client: <HOST>
maxretry = 5
bantime = 3600
```

```bash
# Restart fail2ban
sudo systemctl restart fail2ban
```

### 3. SSL Certificate Setup

#### Option A: Let's Encrypt (Free)
```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d cctv.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Option B: Self-Signed (Development)
```bash
# Create self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/cctv.key \
  -out /etc/ssl/certs/cctv.crt
```

### 4. System Hardening
```bash
# Disable root SSH login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Configure automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Set up log rotation
sudo nano /etc/logrotate.d/cctv-streaming
```

```
/var/log/cctv-streaming/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 cctv cctv
    postrotate
        systemctl reload cctv-streaming
    endscript
}
```

## 📊 Monitoring Setup

### 1. System Monitoring
```bash
# Install monitoring tools
sudo apt install -y htop iotop netstat-nat lm-sensors

# Set up disk space monitoring
sudo nano /etc/cron.daily/disk-space-check
```

```bash
#!/bin/bash
THRESHOLD=90
USAGE=$(df /mnt/cctv-storage | awk 'NR==2 {print $5}' | sed 's/%//')

if [ $USAGE -gt $THRESHOLD ]; then
    echo "Disk usage is ${USAGE}%" | mail -s "CCTV Storage Alert" admin@yourdomain.com
fi
```

### 2. Application Monitoring
```bash
# Create health check script
sudo nano /usr/local/bin/cctv-health-check
```

```bash
#!/bin/bash
HEALTH_URL="http://localhost:3000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -ne 200 ]; then
    echo "CCTV application health check failed (HTTP $RESPONSE)" | \
        mail -s "CCTV Health Alert" admin@yourdomain.com
    systemctl restart cctv-streaming
fi
```

```bash
# Make executable and add to cron
sudo chmod +x /usr/local/bin/cctv-health-check
sudo crontab -e
# Add: */5 * * * * /usr/local/bin/cctv-health-check
```

### 3. Log Monitoring
```bash
# Install logwatch for daily summaries
sudo apt install -y logwatch

# Configure custom log monitoring
sudo nano /etc/logwatch/conf/logfiles/cctv.conf
```

```
LogFile = /var/log/cctv-streaming/*.log
Archive = /var/log/cctv-streaming/*.log.*
```

## 🔄 Backup and Recovery

### 1. Configuration Backup
```bash
# Create backup script
sudo nano /usr/local/bin/cctv-backup
```

```bash
#!/bin/bash
BACKUP_DIR="/backup/cctv"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup configuration
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
    /opt/cctv-streaming/.env \
    /opt/cctv-streaming/package.json \
    /etc/systemd/system/cctv-streaming.service \
    /etc/nginx/sites-available/cctv-streaming

# Backup recent recordings (last 7 days)
find /mnt/cctv-storage -mtime -7 -type f | \
    tar -czf $BACKUP_DIR/recent_recordings_$DATE.tar.gz -T -

# Clean old backups (keep 30 days)
find $BACKUP_DIR -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR"
```

### 2. Recovery Procedures
```bash
# Service recovery
sudo systemctl restart cctv-streaming

# Complete system recovery
sudo systemctl stop cctv-streaming
cd /opt/cctv-streaming
git pull origin main
npm install --production
sudo systemctl start cctv-streaming
```

## 🚀 Production Checklist

### Pre-Deployment
- [ ] Server meets hardware requirements
- [ ] All dependencies installed
- [ ] Camera network configured
- [ ] Storage mounted and accessible
- [ ] SSL certificates obtained
- [ ] Firewall configured
- [ ] Backup strategy implemented

### Post-Deployment
- [ ] All cameras streaming successfully
- [ ] API endpoints responding
- [ ] nginx proxy working
- [ ] SSL/HTTPS working
- [ ] Logs rotating properly
- [ ] Monitoring alerts configured
- [ ] Backup scripts scheduled

### Performance Validation
- [ ] CPU usage < 70% under normal load
- [ ] Memory usage stable
- [ ] Disk I/O reasonable
- [ ] Network bandwidth sufficient
- [ ] Stream latency acceptable

## 🔧 Maintenance Procedures

### Daily Tasks
```bash
# Check system status
sudo systemctl status cctv-streaming nginx
sudo journalctl -u cctv-streaming --since "1 day ago" | grep ERROR

# Check storage usage
df -h /mnt/cctv-storage

# Check active streams
curl -s http://localhost:3000/api/streams/status | jq '.configuration'
```

### Weekly Tasks
```bash
# Review logs
sudo logwatch --service cctv --range "between -7 days and today"

# Update system packages
sudo apt update && sudo apt upgrade -y

# Verify backups
ls -la /backup/cctv/
```

### Monthly Tasks
```bash
# Review performance metrics
# Plan capacity upgrades if needed
# Review and update security settings
# Test disaster recovery procedures
```

## 🆘 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
sudo journalctl -u cctv-streaming -n 50

# Check permissions
sudo ls -la /opt/cctv-streaming/
sudo ls -la /var/log/cctv-streaming/

# Check environment
sudo -u cctv cat /opt/cctv-streaming/.env
```

#### Camera Connection Issues
```bash
# Test RTSP manually
ffprobe -v quiet -show_format "rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101"

# Check network connectivity
ping 192.168.1.100
telnet 192.168.1.100 554
```

#### High Resource Usage
```bash
# Monitor processes
htop
iotop -o

# Check stream health
curl http://localhost:3000/api/streams/status

# Review FFmpeg processes
ps aux | grep ffmpeg
```

#### Storage Issues
```bash
# Check disk space
df -h
du -sh /mnt/cctv-storage/*

# Check cleanup manager
sudo journalctl -u cctv-streaming | grep cleanup

# Manual cleanup if needed
sudo systemctl stop cctv-streaming
sudo find /mnt/cctv-storage -mtime +30 -delete
sudo systemctl start cctv-streaming
```

---

**Production deployment complete!** Your CCTV streaming system is now ready for 24/7 operation. 