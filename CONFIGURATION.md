# 🔧 CCTV Streaming API Configuration Guide

This document provides a comprehensive guide to all configurable environment variables in the CCTV Streaming API.

## 📋 Quick Start

1. Copy the example configuration below to a `.env` file
2. Modify the values according to your setup
3. Run `npm run setup` to initialize the system
4. Start with `npm start`

## 🎯 Environment Variables Reference

### 🖥️ Server Configuration

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `PORT` | `3000` | Server listening port | `3000`, `8080`, `80` |
| `NODE_ENV` | `development` | Environment mode | `development`, `production`, `test` |
| `GRACEFUL_SHUTDOWN_TIMEOUT` | `30000` | Shutdown timeout (ms) | `30000` (30 sec), `60000` (1 min) |
| `CACHE_CONTROL_MAX_AGE` | `31536000` | Video cache duration (sec) | `31536000` (1 year), `86400` (1 day) |

### 📹 Camera Configuration

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `CAMERA_IDS` | `1,102,202` | Camera IDs (comma-separated) | `1,102,202`, `cam1,cam2,office` |
| `RTSP_USER` | `admin` | RTSP username | `admin`, `camera_user` |
| `RTSP_PASS` | `password123` | RTSP password | `your_password` |
| `RTSP_HOST` | `192.168.1.100` | Camera IP/hostname | `192.168.1.100`, `cameras.local` |
| `RTSP_PORT` | `554` | RTSP port | `554`, `8554` |
| `RTSP_TRANSPORT` | `tcp` | Transport protocol | `tcp`, `udp` |

### 🎬 HLS Configuration

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `HLS_ROOT` | `hls` | HLS files directory | `hls`, `/var/streams`, `C:/streams` |
| `SEGMENT_DURATION` | `5` | Segment length (seconds) | `2`, `5`, `10` |
| `HLS_LIST_SIZE` | `6` | Segments in playlist | `6`, `10`, `12` |
| `HLS_FLAGS` | `delete_segments+append_list` | HLS management flags | Standard FFmpeg HLS flags |

### 🎥 Video Quality Settings

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `LOW_QUALITY_WIDTH` | `854` | Low quality width | `640`, `854`, `1280` |
| `LOW_QUALITY_HEIGHT` | `480` | Low quality height | `360`, `480`, `720` |
| `LOW_QUALITY_FPS` | `12` | Low quality frame rate | `8`, `12`, `15`, `30` |
| `LOW_QUALITY_BITRATE` | `800k` | Low quality bitrate | `400k`, `800k`, `1M`, `2M` |
| `LOW_QUALITY_PRESET` | `veryfast` | FFmpeg preset | `ultrafast`, `veryfast`, `fast`, `medium` |
| `LOW_QUALITY_PROFILE` | `baseline` | H.264 profile | `baseline`, `main`, `high` |
| `LOW_QUALITY_LEVEL` | `3.0` | H.264 level | `3.0`, `3.1`, `4.0`, `4.1` |

### 🔊 Audio Settings

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `AUDIO_CODEC` | `aac` | Audio codec | `aac`, `mp3`, `ac3` |
| `AUDIO_BITRATE` | `64k` | Audio bitrate | `32k`, `64k`, `128k` |
| `AUDIO_SAMPLE_RATE` | `22050` | Sample rate (Hz) | `22050`, `44100`, `48000` |

### 💾 Storage & Cleanup

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `RETENTION_MINUTES` | `30` | Keep recordings (min) | `30`, `1440` (24h), `43200` (30d) |
| `CLEANUP_INTERVAL_MINUTES` | `5` | Cleanup frequency (min) | `5`, `15`, `60` |
| `MAX_STORAGE_GB` | `100` | Storage limit (GB) | `50`, `100`, `500`, `1000` |
| `INITIAL_CLEANUP_DELAY_SECONDS` | `5` | Startup cleanup delay | `5`, `10`, `30` |
| `EMERGENCY_CLEANUP_THRESHOLD` | `95` | Emergency cleanup (%) | `90`, `95`, `98` |
| `WARNING_THRESHOLD` | `80` | Warning threshold (%) | `70`, `80`, `85` |
| `ORPHANED_FILE_MAX_AGE_HOURS` | `1` | Orphaned file age (hrs) | `1`, `6`, `24` |

### ⚙️ FFmpeg Configuration

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `FFMPEG_PATH` | `ffmpeg` | FFmpeg executable path | `ffmpeg`, `/usr/bin/ffmpeg` |
| `FFMPEG_LOG_LEVEL` | `error` | FFmpeg log level | `quiet`, `error`, `warning`, `info` |

### 📹 Recording Configuration

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `ENABLE_RECORDING` | `false` | Enable file recording | `true`, `false` |
| `RECORDING_FORMAT` | `mp4` | Recording file format | `mp4`, `mkv`, `avi` |
| `RECORDING_SEGMENT_MINUTES` | `60` | Recording segment length | `30`, `60`, `120` |

### 🔄 System Configuration

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `MAX_RESTART_ATTEMPTS` | `5` | Max restart attempts | `3`, `5`, `10` |
| `RESTART_DELAY_SECONDS` | `10` | Restart delay (sec) | `5`, `10`, `30` |
| `HEALTH_CHECK_INTERVAL_SECONDS` | `30` | Health check interval | `15`, `30`, `60` |
| `STREAM_RESTART_PAUSE_SECONDS` | `2` | Single camera pause | `1`, `2`, `5` |
| `ALL_CAMERAS_RESTART_PAUSE_SECONDS` | `3` | All cameras pause | `2`, `3`, `5` |
| `PLAYLIST_STALE_THRESHOLD_MINUTES` | `5` | Stale playlist threshold | `2`, `5`, `10` |

### 📊 Monitoring & Logging

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `ENABLE_MONITORING` | `true` | Enable monitoring | `true`, `false` |
| `LOG_LEVEL` | `info` | Application log level | `error`, `warn`, `info`, `debug` |
| `LOG_RETENTION_DAYS` | `7` | Log retention (days) | `3`, `7`, `30` |

### 📝 Log File Configuration

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `LOG_MAX_FILE_SIZE` | `10485760` | Log file size (bytes) | `5242880` (5MB), `10485760` (10MB) |
| `LOG_MAX_FILES` | `5` | Number of log files | `3`, `5`, `10` |
| `CLEANUP_LOG_MAX_SIZE` | `5242880` | Cleanup log size | `2097152` (2MB), `5242880` (5MB) |
| `CLEANUP_LOG_MAX_FILES` | `2` | Cleanup log files | `2`, `3`, `5` |
| `STREAM_LOG_MAX_FILES` | `3` | Stream log files | `2`, `3`, `5` |
| `SYSTEM_LOG_MAX_FILES` | `3` | System log files | `2`, `3`, `5` |

### 🔧 PM2 Configuration

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `PM2_INSTANCES` | `1` | PM2 instances | `1` (recommended for streaming) |
| `PM2_MAX_MEMORY_RESTART` | `2G` | Memory restart limit | `1G`, `2G`, `4G`, `8G` |
| `PM2_MAX_RESTARTS` | `10` | Max restarts | `5`, `10`, `15` |
| `PM2_MIN_UPTIME` | `10s` | Min uptime | `10s`, `30s`, `1m` |
| `PM2_RESTART_DELAY` | `5000` | Restart delay (ms) | `3000`, `5000`, `10000` |
| `PM2_KILL_TIMEOUT` | `30000` | Kill timeout (ms) | `15000`, `30000`, `60000` |
| `PM2_LISTEN_TIMEOUT` | `10000` | Listen timeout (ms) | `5000`, `10000`, `20000` |
| `PM2_HEALTH_CHECK_GRACE_PERIOD` | `30000` | Health check grace (ms) | `15000`, `30000`, `60000` |
| `NODE_MAX_OLD_SPACE_SIZE` | `4096` | Node heap size (MB) | `2048`, `4096`, `8192` |

### 🌐 CORS Configuration

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `CORS_ORIGIN` | `*` | Allowed origins | `*`, `http://localhost:3000` |
| `CORS_METHODS` | `GET,POST,PUT,DELETE` | Allowed methods | Comma-separated HTTP methods |
| `CORS_ALLOWED_HEADERS` | `Content-Type,Authorization` | Allowed headers | Comma-separated headers |

### 📡 Request Limits

| Variable | Default | Description | Example Values |
|----------|---------|-------------|----------------|
| `REQUEST_JSON_LIMIT` | `10mb` | JSON body limit | `1mb`, `10mb`, `50mb` |
| `REQUEST_URL_ENCODED_LIMIT` | `10mb` | URL-encoded limit | `1mb`, `10mb`, `50mb` |

## 🎯 Configuration Examples

### Development Setup (Low Resources)
```bash
# .env for development
SEGMENT_DURATION=10
RETENTION_MINUTES=60
LOW_QUALITY_FPS=8
LOG_LEVEL=debug
MAX_STORAGE_GB=10
PM2_MAX_MEMORY_RESTART=1G
```

### Production Setup (High Quality)
```bash
# .env for production
SEGMENT_DURATION=5
RETENTION_MINUTES=43200
LOW_QUALITY_FPS=15
MAX_STORAGE_GB=500
LOG_LEVEL=info
PM2_MAX_MEMORY_RESTART=4G
NODE_MAX_OLD_SPACE_SIZE=8192
```

### High-End Setup (Maximum Quality)
```bash
# .env for high-end deployment
SEGMENT_DURATION=2
LOW_QUALITY_WIDTH=1280
LOW_QUALITY_HEIGHT=720
LOW_QUALITY_FPS=30
LOW_QUALITY_BITRATE=2M
PM2_MAX_MEMORY_RESTART=8G
MAX_STORAGE_GB=1000
```

### Bandwidth-Limited Setup
```bash
# .env for limited bandwidth
LOW_QUALITY_WIDTH=640
LOW_QUALITY_HEIGHT=360
LOW_QUALITY_FPS=8
LOW_QUALITY_BITRATE=400k
AUDIO_BITRATE=32k
SEGMENT_DURATION=10
```

## 🔧 Configuration Validation

The system validates all configuration values on startup:
- Port ranges (1-65535)
- Percentage values (0-100)
- File size limits
- Time intervals
- Required dependencies

Invalid configurations will prevent startup with clear error messages.

## 📚 Additional Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [HLS Specification](https://tools.ietf.org/html/rfc8216)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Express.js Guide](https://expressjs.com/) 