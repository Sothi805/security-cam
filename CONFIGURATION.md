# 🔧 CCTV System Configuration Guide

This document provides comprehensive information about all configuration variables, their units, valid values, and usage in the CCTV streaming system.

## 📋 Configuration Variables Reference

### 🌐 **Server Configuration**

| Variable | Unit | Default | Description | Valid Values |
|----------|------|---------|-------------|--------------|
| `NODE_ENV` | string | `development` | Application environment | `development`, `production` |
| `PORT` | integer | `3000` | HTTP server port number | 1-65535 |
| `GRACEFUL_SHUTDOWN_TIMEOUT` | milliseconds | `30000` | Time to wait for graceful shutdown | 1000-300000 |
| `CACHE_CONTROL_MAX_AGE` | seconds | `31536000` | Browser cache duration for static files | 0-31536000 |

### 📹 **Camera Configuration**

| Variable | Unit | Default | Description | Valid Values |
|----------|------|---------|-------------|--------------|
| `CAMERA_IDS` | string (comma-separated) | `1,102,202` | List of camera identifiers | Any alphanumeric IDs |
| `RTSP_USER` | string | `admin` | Username for RTSP authentication | Any string |
| `RTSP_PASS` | string | `password123` | Password for RTSP authentication | Any string |
| `RTSP_HOST` | IP address | `192.168.1.100` | RTSP server IP address | Valid IPv4 address |
| `RTSP_PORT` | integer | `554` | RTSP server port | 1-65535 |
| `RTSP_TRANSPORT` | string | `tcp` | RTSP transport protocol | `tcp`, `udp` |

### 🎬 **HLS Configuration**

| Variable | Unit | Default | Description | Valid Values |
|----------|------|---------|-------------|--------------|
| `HLS_ROOT` | directory path | `hls` | Root directory for HLS files | Valid directory path |
| `SEGMENT_DURATION` | seconds | `5-10` | Duration of each video segment | 1-30 |
| `HLS_LIST_SIZE` | integer | `6-10` | Number of segments in playlist | 3-50 |
| `HLS_FLAGS` | string | `delete_segments+append_list` | FFmpeg HLS flags | FFmpeg HLS flags |

### 🎥 **Video Quality Settings**

#### **Low Quality Stream (480p)**
| Variable | Unit | Default (Dev/Prod) | Description | Valid Values |
|----------|------|--------------------|-------------|--------------|
| `LOW_QUALITY_WIDTH` | pixels | `640` / `1280` | Video width | 320-1920 |
| `LOW_QUALITY_HEIGHT` | pixels | `360` / `720` | Video height | 240-1080 |
| `LOW_QUALITY_FPS` | frames per second | `8` / `15` | Frame rate | 1-60 |
| `LOW_QUALITY_BITRATE` | bitrate | `400k` / `2M` | Video bitrate | 100k-10M |
| `LOW_QUALITY_PRESET` | string | `ultrafast` / `fast` | Encoding speed preset | `ultrafast`, `superfast`, `veryfast`, `faster`, `fast`, `medium`, `slow`, `slower`, `veryslow` |
| `LOW_QUALITY_PROFILE` | string | `baseline` / `main` | H.264 profile | `baseline`, `main`, `high` |
| `LOW_QUALITY_LEVEL` | string | `3.0` / `4.0` | H.264 level | `1.0`-`5.2` |

### 🔊 **Audio Settings**

| Variable | Unit | Default (Dev/Prod) | Description | Valid Values |
|----------|------|--------------------|-------------|--------------|
| `AUDIO_CODEC` | string | `aac` | Audio codec | `aac`, `mp3`, `opus` |
| `AUDIO_BITRATE` | bitrate | `32k` / `128k` | Audio bitrate | 16k-320k |
| `AUDIO_SAMPLE_RATE` | Hz | `22050` / `44100` | Audio sample rate | 8000, 16000, 22050, 44100, 48000 |

### 💾 **Storage Configuration**

| Variable | Unit | Default (Dev/Prod) | Description | Valid Values |
|----------|------|--------------------|-------------|--------------|
| `RETENTION_MINUTES` | minutes | `60` / `43200` | How long to keep recordings (1h / 30 days) | 1-525600 |
| `CLEANUP_INTERVAL_MINUTES` | minutes | `5` / `15` | How often to run cleanup | 1-1440 |
| `MAX_STORAGE_GB` | gigabytes | `10` / `500` | Maximum storage allocation | 1-10000 |
| `INITIAL_CLEANUP_DELAY_SECONDS` | seconds | `5` / `30` | Delay before first cleanup | 1-3600 |
| `EMERGENCY_CLEANUP_THRESHOLD` | percentage | `95` | Storage usage to trigger emergency cleanup | 50-99 |
| `WARNING_THRESHOLD` | percentage | `80` | Storage usage to show warnings | 50-95 |
| `ORPHANED_FILE_MAX_AGE_HOURS` | hours | `1` / `6` | Max age for orphaned files | 1-168 |

### ⚙️ **FFmpeg Configuration**

| Variable | Unit | Default | Description | Valid Values |
|----------|------|---------|-------------|--------------|
| `FFMPEG_PATH` | file path | `ffmpeg` | Path to FFmpeg executable | Valid executable path |
| `FFMPEG_LOG_LEVEL` | string | `error` / `warning` | FFmpeg logging level | `quiet`, `panic`, `fatal`, `error`, `warning`, `info`, `verbose`, `debug`, `trace` |

### 📽️ **Recording Configuration**

| Variable | Unit | Default | Description | Valid Values |
|----------|------|---------|-------------|--------------|
| `ENABLE_RECORDING` | boolean | `false` / `true` | Enable video recording | `true`, `false` |
| `RECORDING_FORMAT` | string | `mp4` | Recording file format | `mp4`, `mkv`, `avi` |
| `RECORDING_SEGMENT_MINUTES` | minutes | `30` / `60` | Duration of each recording segment | 1-1440 |

### 🔄 **System Restart & Health**

| Variable | Unit | Default (Dev/Prod) | Description | Valid Values |
|----------|------|--------------------|-------------|--------------|
| `MAX_RESTART_ATTEMPTS` | integer | `3` / `10` | Max camera restart attempts | 1-100 |
| `RESTART_DELAY_SECONDS` | seconds | `5` / `10` | Delay between restart attempts | 1-300 |
| `HEALTH_CHECK_INTERVAL_SECONDS` | seconds | `30` | How often to check camera health | 10-3600 |
| `STREAM_RESTART_PAUSE_SECONDS` | seconds | `2` | Pause between stream restarts | 1-60 |
| `ALL_CAMERAS_RESTART_PAUSE_SECONDS` | seconds | `3` | Pause between camera restarts | 1-60 |
| `PLAYLIST_STALE_THRESHOLD_MINUTES` | minutes | `5` | When to consider playlist stale | 1-60 |

### 📊 **Monitoring & Logging**

| Variable | Unit | Default (Dev/Prod) | Description | Valid Values |
|----------|------|--------------------|-------------|--------------|
| `ENABLE_MONITORING` | boolean | `true` | Enable system monitoring | `true`, `false` |
| `LOG_LEVEL` | string | `debug` / `info` | Application log level | `error`, `warn`, `info`, `debug` |
| `LOG_RETENTION_DAYS` | days | `3` / `30` | How long to keep log files | 1-365 |

### 📝 **Log File Configuration**

| Variable | Unit | Default (Dev/Prod) | Description | Valid Values |
|----------|------|--------------------|-------------|--------------|
| `LOG_MAX_FILE_SIZE` | bytes | `5242880` / `10485760` | Max size per log file (5MB / 10MB) | 1048576-104857600 |
| `LOG_MAX_FILES` | integer | `3` / `10` | Max number of log files to keep | 1-100 |
| `CLEANUP_LOG_MAX_SIZE` | bytes | `2097152` / `5242880` | Max cleanup log size (2MB / 5MB) | 1048576-52428800 |
| `CLEANUP_LOG_MAX_FILES` | integer | `2` / `5` | Max cleanup log files | 1-50 |
| `STREAM_LOG_MAX_FILES` | integer | `2` / `5` | Max stream log files | 1-50 |
| `SYSTEM_LOG_MAX_FILES` | integer | `2` / `5` | Max system log files | 1-50 |

### 🔧 **PM2 Process Management**

| Variable | Unit | Default (Dev/Prod) | Description | Valid Values |
|----------|------|--------------------|-------------|--------------|
| `PM2_INSTANCES` | integer | `1` | Number of PM2 instances | 1-16 |
| `PM2_MAX_MEMORY_RESTART` | memory size | `1G` / `4G` | Memory limit before restart | 512M-32G |
| `PM2_MAX_RESTARTS` | integer | `5` / `15` | Max restarts per hour | 1-100 |
| `PM2_MIN_UPTIME` | time duration | `10s` / `30s` | Min uptime before restart | 1s-300s |
| `PM2_RESTART_DELAY` | milliseconds | `3000` / `5000` | Delay between restarts | 1000-60000 |
| `PM2_KILL_TIMEOUT` | milliseconds | `15000` / `30000` | Time to wait before killing process | 5000-120000 |
| `PM2_LISTEN_TIMEOUT` | milliseconds | `5000` / `10000` | Time to wait for process to start | 1000-60000 |
| `PM2_HEALTH_CHECK_GRACE_PERIOD` | milliseconds | `15000` / `30000` | Grace period for health checks | 5000-120000 |
| `NODE_MAX_OLD_SPACE_SIZE` | megabytes | `2048` / `8192` | Node.js heap size limit | 512-32768 |

### 🌐 **CORS Configuration**

| Variable | Unit | Default | Description | Valid Values |
|----------|------|---------|-------------|--------------|
| `CORS_ORIGIN` | string | `*` | Allowed origins for CORS | `*`, specific domains, comma-separated list |
| `CORS_METHODS` | string | `GET,POST,PUT,DELETE` | Allowed HTTP methods | HTTP method names |
| `CORS_ALLOWED_HEADERS` | string | `Content-Type,Authorization` | Allowed request headers | Header names |

### 📡 **Request Limits**

| Variable | Unit | Default | Description | Valid Values |
|----------|------|---------|-------------|--------------|
| `REQUEST_JSON_LIMIT` | size | `10mb` | Max JSON request body size | 1kb-100mb |
| `REQUEST_URL_ENCODED_LIMIT` | size | `10mb` | Max URL-encoded request size | 1kb-100mb |

## 📊 **Unit Conversion Reference**

### **Time Units**
- **Seconds**: Used for timeouts, intervals, delays
- **Minutes**: Used for retention, cleanup intervals
- **Hours**: Used for file age, long-term scheduling
- **Days**: Used for log retention, backup schedules
- **Milliseconds**: Used for precise timing, PM2 settings

### **Size Units**
- **Bytes**: Exact file sizes (1024 bytes = 1KB)
- **KB/MB/GB**: Human-readable sizes (1000-based)
- **Pixels**: Video dimensions (width × height)
- **Bitrate**: Data transfer rate (k = 1000, M = 1,000,000)

### **Common Size Conversions**
```
1 KB = 1,024 bytes
1 MB = 1,048,576 bytes (1024²)
1 GB = 1,073,741,824 bytes (1024³)

Bitrate:
100k = 100,000 bits per second
1M = 1,000,000 bits per second
2M = 2,000,000 bits per second
```

## 🎯 **Environment-Specific Recommendations**

### **Development Environment**
- Lower video quality for faster processing
- Short retention times to save disk space
- Debug logging for troubleshooting
- Faster restart attempts for quick iteration

### **Production Environment**
- Higher video quality for better surveillance
- Longer retention for compliance/security
- Optimized logging for performance
- Conservative restart policies for stability

## ⚠️ **Important Notes**

1. **Memory Settings**: Ensure `PM2_MAX_MEMORY_RESTART` is less than available system RAM
2. **Storage Planning**: Calculate storage needs: `cameras × quality × fps × retention`
3. **Network Bandwidth**: Higher quality settings require more bandwidth
4. **CPU Usage**: Lower presets (`ultrafast`) use more CPU but encode faster
5. **File Permissions**: Ensure the application has write access to `HLS_ROOT` and log directories

## 🔍 **Validation**

Run configuration validation:
```bash
npm run validate
```

This will check all settings and warn about potential issues.

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