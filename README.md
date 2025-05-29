# 🎬 Production CCTV Streaming API

A rock-solid, 24/7 CCTV streaming system using Node.js, Express, and FFmpeg with HLS (HTTP Live Streaming), automatic cleanup, and comprehensive monitoring.

## ✨ Features

### 🔴 Live Streaming
- **24/7 continuous streaming** with automatic restart on failure
- **Dual quality streams** per camera:
  - **High Quality**: Native resolution (stream copy, no encoding)
  - **Low Quality**: 480p @ 12fps (H.264 encoded for bandwidth efficiency)
- **Resilient design** with health monitoring and auto-recovery
- **HLS protocol** for broad device compatibility

### 📼 Playback System
- **Time-based playback** with precise date/time navigation
- **Organized storage**: `hls/{camera_id}/{YYYY-MM-DD}/{HH-mm}.m3u8`
- **Easy navigation** API to find available dates and times
- **Configurable retention** (default: 30 minutes for testing, up to 30 days for production)

### 🧹 Storage Management
- **Automatic cleanup** with configurable retention periods
- **Smart storage monitoring** with usage alerts
- **Emergency cleanup** when storage reaches critical levels
- **Orphaned file detection** and removal

### 📊 Monitoring & Logging
- **Comprehensive logging** with file rotation
- **Health check endpoints** for system monitoring
- **Real-time status** API for all cameras and system components
- **Performance metrics** and error tracking

## 🚀 Quick Start

### 1. Installation

```bash
# Clone and setup
cd security-cam
npm install

# Run setup script
npm run setup
```

### 2. Configuration

Copy `.env.example` to `.env` and configure:

```env
# Camera Configuration
CAMERA_IDS=1,102,202
RTSP_USER=admin
RTSP_PASS=your_password
RTSP_HOST=192.168.1.100
RTSP_PORT=554

# Storage Settings
SEGMENT_DURATION=5
RETENTION_MINUTES=30
MAX_STORAGE_GB=100

# System Settings
PORT=3000
```

### 3. Start Server

```bash
# Development
npm run dev

# Production
npm start

# Production with PM2
pm2 start ecosystem.config.js
```

## 📡 API Endpoints

### Live Streaming

| Endpoint | Description |
|----------|-------------|
| `GET /streams/live/:camera_id/:quality` | Get live stream URL |
| `GET /streams/cameras` | Get all cameras status |
| `POST /streams/restart/:camera_id` | Restart specific camera |
| `POST /streams/restart` | Restart all cameras |

**Example Live Stream URLs:**
```
http://localhost:3000/hls/1/live/high/index.m3u8
http://localhost:3000/hls/1/live/low/index.m3u8
```

### Playback

| Endpoint | Description |
|----------|-------------|
| `GET /streams/playback/:camera_id/:date/:time` | Get playback stream |
| `GET /streams/available/:camera_id` | Get available dates |
| `GET /streams/available/:camera_id/:date` | Get available times for date |

**Example Playback:**
```bash
# Get playback for camera 1 on 2025-01-15 at 14:30
GET /streams/playback/1/2025-01-15/14-30

# Response:
{
  "camera_id": "1",
  "date": "2025-01-15", 
  "time": "14-30",
  "stream_url": "/hls/1/2025-01-15/14-30.m3u8",
  "type": "playback"
}
```

### System Management

| Endpoint | Description |
|----------|-------------|
| `GET /streams/status` | Comprehensive system status |
| `GET /streams/health` | Simple health check |
| `POST /streams/cleanup` | Trigger manual cleanup |
| `GET /api` | API documentation |

## 🏗️ Directory Structure

```
security-cam/
├── app.js                 # Main application
├── package.json           # Dependencies and scripts
├── ecosystem.config.js    # PM2 configuration
├── .env.example          # Environment template
├── routes/
│   └── stream.js         # API routes
├── utils/
│   ├── config.js         # Configuration management
│   ├── logger.js         # Logging system
│   ├── pathUtils.js      # Path and file utilities
│   ├── streamManager.js  # FFmpeg process management
│   └── cleanupManager.js # Storage cleanup
├── scripts/
│   ├── setup.js          # Initial setup
│   └── cleanup.js        # Manual cleanup
├── logs/                 # Application logs
│   ├── app.log
│   ├── streams.log
│   ├── cleanup.log
│   └── system.log
└── hls/                  # Video storage
    └── {camera_id}/
        ├── live/
        │   ├── high/     # Native quality live stream
        │   └── low/      # 480p live stream  
        └── {YYYY-MM-DD}/
            └── {HH-mm}.m3u8  # Time-based segments
```

## ⚙️ Configuration Options

### Camera Settings
```env
CAMERA_IDS=1,102,202           # Comma-separated camera IDs
RTSP_USER=admin                # RTSP username
RTSP_PASS=password             # RTSP password  
RTSP_HOST=192.168.1.100        # Camera IP/hostname
RTSP_PORT=554                  # RTSP port
```

### Quality Settings
```env
LOW_QUALITY_WIDTH=854          # Low quality width
LOW_QUALITY_HEIGHT=480         # Low quality height
LOW_QUALITY_FPS=12             # Low quality framerate
LOW_QUALITY_BITRATE=800k       # Low quality bitrate
```

### Storage Management
```env
SEGMENT_DURATION=5             # HLS segment length (seconds)
RETENTION_MINUTES=30           # How long to keep segments
CLEANUP_INTERVAL_MINUTES=5     # Cleanup frequency
MAX_STORAGE_GB=100             # Maximum storage limit
```

### System Settings
```env
MAX_RESTART_ATTEMPTS=5         # Max restart attempts per camera
RESTART_DELAY_SECONDS=10       # Delay between restart attempts
HEALTH_CHECK_INTERVAL_SECONDS=30  # Health check frequency
```

## 🔧 Advanced Usage

### Manual Operations

```bash
# Manual cleanup
npm run cleanup

# Setup directories and config
npm run setup

# View logs
tail -f logs/app.log
tail -f logs/streams.log
```

### API Examples

```bash
# Check system status
curl http://localhost:3000/streams/status

# Get camera 1 live stream (high quality)
curl http://localhost:3000/streams/live/1/high

# Get available dates for camera 1
curl http://localhost:3000/streams/available/1

# Get available times for camera 1 on specific date
curl http://localhost:3000/streams/available/1/2025-01-15

# Restart camera 1
curl -X POST http://localhost:3000/streams/restart/1
```

### PM2 Management

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 status
pm2 logs
pm2 monit

# Stop/restart
pm2 restart cctv-api
pm2 stop cctv-api
```

## 🔍 Monitoring & Troubleshooting

### Log Files
- `logs/app.log` - General application logs
- `logs/streams.log` - FFmpeg and streaming logs  
- `logs/cleanup.log` - Storage cleanup logs
- `logs/system.log` - System health and monitoring
- `logs/error.log` - Error-specific logs

### Health Checks
- `GET /health` - Basic server health
- `GET /streams/health` - Detailed streaming health
- `GET /streams/status` - Comprehensive system status

### Common Issues

**Streams not starting:**
1. Check RTSP credentials in `.env`
2. Verify camera accessibility: `ffmpeg -i rtsp://...`
3. Check logs: `tail -f logs/streams.log`

**Storage issues:**
1. Check available disk space
2. Review retention settings
3. Trigger manual cleanup: `npm run cleanup`

**Performance issues:**
1. Monitor system resources: `GET /streams/status`
2. Adjust quality settings for lower bandwidth
3. Increase cleanup frequency

## 📦 Dependencies

### Core Dependencies
- **Express** - Web framework
- **FFmpeg** - Video processing
- **Winston** - Logging
- **Moment** - Date/time handling
- **node-cron** - Scheduled tasks
- **fs-extra** - Enhanced file operations

### System Requirements
- **Node.js** 14+ 
- **FFmpeg** with H.264 support
- **Ubuntu 20.04+** (recommended)
- **4GB+ RAM** for multiple streams
- **SSD storage** for better I/O performance

## 🔒 Production Deployment

### Server Hardening
1. Configure firewall (UFW)
2. Set up SSL/TLS (nginx reverse proxy)
3. Configure log rotation
4. Set up monitoring (Prometheus/Grafana)
5. Regular security updates

### Performance Optimization
1. Tune FFmpeg settings for your hardware
2. Configure nginx for static file serving
3. Set up CDN for global access
4. Monitor and adjust storage retention
5. Use SSD for hot storage, HDD for archives

### Backup Strategy
1. Regular configuration backups
2. Critical footage archival
3. Database backup (if using one)
4. Disaster recovery plan

## 📄 License

ISC License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Submit pull request

---

Built with ❤️ for reliable 24/7 CCTV operations