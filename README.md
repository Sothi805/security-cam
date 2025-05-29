# CCTV Streaming Backend

Professional CCTV streaming system with real-time HLS streaming, historical playback, and Flutter-compatible API.

## 🎯 Features

- **Real-time HLS Streaming**: Live video streaming from RTSP cameras
- **Dual Quality Streams**: 480p@12fps (always-on) + native resolution streams
- **Historical Playback**: 30-day retention with date-based organization
- **Flutter Compatible API**: RESTful API designed for mobile app integration
- **Auto-restart Capability**: Automatic stream recovery on failures
- **24/7 Operation**: Production-ready with comprehensive monitoring
- **Web Dashboard**: Real-time monitoring interface

## 🚀 Quick Start

### Development Setup
```bash
npm install
npm run dev
```

### Production Setup
```bash
npm install
npm run production
```

### Test Camera Connections
```bash
npm test
```

## 📁 Folder Structure

```
hls/
├── {CAMERA_ID}/
│   └── {YYYY-MM-DD}/
│       ├── {HH-mm}-low.m3u8    # 480p stream
│       ├── {HH-mm}-high.m3u8   # Native quality
│       └── *.ts                # Video segments
```

## 🌐 API Endpoints

- **Live Streams**: `GET /api/streams/live/{cameraId}/{quality}`
- **Camera Status**: `GET /api/streams/cameras`
- **Playback**: `GET /api/streams/playback/{cameraId}`
- **System Status**: `GET /api/streams/status`

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Detailed setup instructions
- **[SERVER_REQUIREMENTS.md](SERVER_REQUIREMENTS.md)** - Hardware specifications
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete API reference
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide
- **[CONFIGURATION.md](CONFIGURATION.md)** - Configuration options

## 🛠️ Requirements

- **Node.js**: 16+ 
- **FFmpeg**: Latest version
- **Storage**: 1GB per camera per day (480p)
- **Network**: Stable connection to RTSP cameras

## 🎬 Stream URLs

- **Live**: `http://server:3000/hls/{camera_id}/{date}/{hour}-{quality}.m3u8`
- **Dashboard**: `http://server:3000/`
- **API**: `http://server:3000/api`

## 📦 Supported Environments

- **Development**: Windows 11, macOS, Linux
- **Production**: Ubuntu Server, CentOS, Docker

## 🔧 Technologies

- **Backend**: Node.js + Express
- **Streaming**: FFmpeg + HLS
- **Storage**: File-based with automatic cleanup
- **Monitoring**: Winston logging + built-in dashboard

---

**Version**: 3.0.0 | **License**: MIT | **Node.js**: 16+