# Setup Instructions

Complete guide for setting up the CCTV Streaming Backend system.

## 📋 Prerequisites

### Required Software
- **Node.js 16+** ([Download](https://nodejs.org/))
- **FFmpeg** with H.264 support ([Download](https://ffmpeg.org/download.html))
- **Git** (for cloning repository)

### Windows Installation
```powershell
# Install Node.js (download from nodejs.org)
# Install FFmpeg using Chocolatey
choco install ffmpeg

# Or download manually and add to PATH
# https://www.gyan.dev/ffmpeg/builds/
```

### Ubuntu/Debian Installation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install FFmpeg
sudo apt install ffmpeg

# Verify installations
node --version
npm --version
ffmpeg -version
```

### CentOS/RHEL Installation
```bash
# Install Node.js
sudo dnf install nodejs npm

# Enable RPM Fusion for FFmpeg
sudo dnf install https://download1.rpmfusion.org/free/el/rpmfusion-free-release-$(rpm -E %rhel).noarch.rpm
sudo dnf install ffmpeg
```

## 🚀 Installation

### 1. Clone Repository
```bash
git clone https://github.com/your-username/cctv-streaming-backend.git
cd cctv-streaming-backend/security-cam
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment

The system uses environment-specific configuration files:

#### Development Environment
```bash
# Copy development template
cp env.development .env

# Edit configuration
nano .env
```

Update these critical settings:
```env
# Camera Configuration
CAMERA_IDS=102,103,104
RTSP_USER=admin
RTSP_PASSWORD=your_password
RTSP_HOST=192.168.0.105
RTSP_PORT=554
```

#### Production Environment
```bash
# Copy production template
cp env.production .env

# Edit configuration
nano .env
```

Update these settings:
```env
# Server Configuration
HOST=0.0.0.0
PORT=3000

# Camera Configuration
CAMERA_IDS=101,102,103,104,105,106
RTSP_USER=admin
RTSP_PASSWORD=production_password
RTSP_HOST=192.168.1.100

# Logging
LOG_FILE_PATH=/var/log/cctv-streaming
```

## 🔧 Development Setup

### Quick Start
```bash
# Run development setup (includes validation)
npm run dev
```

This will:
1. ✅ Validate Node.js and FFmpeg
2. 📁 Create necessary directories
3. 🎬 Start the application with auto-restart
4. 📊 Enable debug logging

### Manual Development Setup
```bash
# Test camera connections
npm test

# Start development server manually
npm start
```

### Development Features
- 🔄 Auto-restart on file changes
- 📊 Verbose debug logging
- 🕐 1-day retention period
- 🌐 Localhost binding

## 🏭 Production Setup

### Automated Production Setup
```bash
# Run production setup
npm run production
```

This will:
1. ✅ Validate system requirements
2. 🔧 Configure production environment
3. 📂 Set proper file permissions
4. 🚀 Start production server

### Manual Production Setup

#### 1. System Preparation
```bash
# Create system user (recommended)
sudo useradd -r -s /bin/false cctv
sudo mkdir -p /opt/cctv-streaming
sudo chown cctv:cctv /opt/cctv-streaming

# Create log directory
sudo mkdir -p /var/log/cctv-streaming
sudo chown cctv:cctv /var/log/cctv-streaming

# Create systemd service
sudo nano /etc/systemd/system/cctv-streaming.service
```

#### 2. Systemd Service File
```ini
[Unit]
Description=CCTV Streaming Backend
After=network.target

[Service]
Type=simple
User=cctv
WorkingDirectory=/opt/cctv-streaming
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### 3. Start Service
```bash
# Reload systemd and start service
sudo systemctl daemon-reload
sudo systemctl enable cctv-streaming
sudo systemctl start cctv-streaming

# Check status
sudo systemctl status cctv-streaming
```

## 🧪 Testing & Validation

### Test Camera Connections
```bash
# Run comprehensive camera test
npm test
```

This tests:
- ✅ Environment configuration
- ✅ FFmpeg availability and codecs
- ✅ RTSP camera connections
- ✅ Network connectivity

### Manual Testing
```bash
# Test single camera RTSP connection
ffprobe -v quiet -print_format json -show_streams \
  "rtsp://admin:password@192.168.0.105:554/Streaming/Channels/102"

# Test FFmpeg streaming
ffmpeg -i "rtsp://admin:password@192.168.0.105:554/Streaming/Channels/102" \
  -c copy -f hls -hls_time 6 -hls_list_size 10 test_output.m3u8
```

## 🔍 Verification

### 1. Check Service Status
```bash
# Application health
curl http://localhost:3000/health

# Camera status
curl http://localhost:3000/api/streams/cameras

# System status
curl http://localhost:3000/api/streams/status
```

### 2. Verify File Structure
```bash
# Check HLS files are being created
ls -la hls/102/$(date +%Y-%m-%d)/

# Monitor logs
tail -f logs/app.log
tail -f logs/error.log
```

### 3. Test Streaming
```bash
# Test stream URL in VLC or browser
http://localhost:3000/hls/102/2024-01-15/14-30-low.m3u8
```

## 🔧 Configuration

### Camera RTSP URL Format
```
rtsp://{USER}:{PASSWORD}@{HOST}:{PORT}/Streaming/Channels/{CAMERA_ID}
```

Example:
```
rtsp://admin:password123@192.168.0.105:554/Streaming/Channels/102
```

### Environment Variables Reference

| Variable | Development | Production | Description |
|----------|-------------|------------|-------------|
| `NODE_ENV` | development | production | Runtime environment |
| `HOST` | localhost | 0.0.0.0 | Server bind address |
| `PORT` | 3000 | 3000 | Server port |
| `CAMERA_IDS` | 102 | 101,102,103... | Comma-separated camera IDs |
| `RETENTION_DAYS` | 1 | 30 | Video retention period |
| `LOG_LEVEL` | debug | info | Logging verbosity |
| `DEBUG_MODE` | true | false | Debug features |

## 🚨 Troubleshooting

### Common Issues

#### 1. FFmpeg Not Found
```bash
# Check FFmpeg installation
which ffmpeg
ffmpeg -version

# Install if missing (Ubuntu)
sudo apt install ffmpeg

# Update PATH if needed
export PATH=$PATH:/usr/local/bin
```

#### 2. Camera Connection Failed
```bash
# Test RTSP URL manually
vlc rtsp://admin:password@192.168.0.105:554/Streaming/Channels/102

# Check network connectivity
ping 192.168.0.105
telnet 192.168.0.105 554
```

#### 3. Permission Errors
```bash
# Fix directory permissions
sudo chown -R $USER:$USER hls/
sudo chown -R $USER:$USER logs/
chmod -R 755 hls/
```

#### 4. Port Already in Use
```bash
# Find process using port 3000
sudo lsof -i :3000
sudo netstat -tulpn | grep :3000

# Kill process if needed
sudo kill -9 {PID}
```

#### 5. Memory Issues
```bash
# Check system resources
free -h
df -h
top

# Monitor application memory
ps aux | grep node
```

### Log Analysis
```bash
# Application logs
tail -f logs/app.log

# Error logs
tail -f logs/error.log

# System logs (if using systemd)
sudo journalctl -u cctv-streaming -f
```

## 📞 Support

If you encounter issues:

1. **Check logs** in `logs/` directory
2. **Run tests** with `npm test`
3. **Verify configuration** in `.env` file
4. **Check system resources** (disk space, memory)
5. **Review documentation** for specific features

For production issues, ensure:
- ✅ System requirements are met
- ✅ Firewall rules allow necessary ports
- ✅ Camera network access is stable
- ✅ Adequate storage space available

---

**Next Steps**: See [SERVER_REQUIREMENTS.md](SERVER_REQUIREMENTS.md) for hardware specifications 