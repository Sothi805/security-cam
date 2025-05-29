# API Documentation

Complete API reference for the CCTV Streaming Backend system.

## 🌐 Base Information

- **Base URL**: `http://your-server:3000`
- **API Version**: 3.0.0
- **Content Type**: `application/json`
- **Authentication**: None (configure firewall/reverse proxy for security)

## 📊 Response Format

All API responses follow this standard format:

```json
{
  "data": {},
  "timestamp": "2024-01-15T14:30:00.000Z",
  "status": "success"
}
```

Error responses:
```json
{
  "error": "Error message",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "status": "error"
}
```

## 🎥 Live Streaming Endpoints

### Get All Cameras
Get status and information for all configured cameras.

```http
GET /api/streams/cameras
```

**Response:**
```json
{
  "cameras": [
    {
      "id": "102",
      "rtsp_url": "rtsp://admin:***@192.168.0.105:554/Streaming/Channels/102",
      "qualities": ["low", "high"],
      "status": {
        "low": {
          "running": true,
          "status": "running",
          "healthy": true,
          "lastUpdated": "2024-01-15T14:30:00.000Z"
        },
        "high": {
          "running": true,
          "status": "running",
          "healthy": true,
          "lastUpdated": "2024-01-15T14:30:00.000Z"
        }
      },
      "restartAttempts": {
        "low": 0,
        "high": 0
      }
    }
  ],
  "count": 1,
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

### Get Live Stream URL (Specific Quality)
Get live stream URL for a specific camera and quality.

```http
GET /api/streams/live/{cameraId}/{quality}
```

**Parameters:**
- `cameraId` (string): Camera identifier (e.g., "102")
- `quality` (string): Stream quality ("low" or "high")

**Example:**
```http
GET /api/streams/live/102/low
```

**Response:**
```json
{
  "camera_id": "102",
  "quality": "low",
  "stream_url": "/hls/102/2024-01-15/14-30-low.m3u8",
  "full_url": "http://your-server:3000/hls/102/2024-01-15/14-30-low.m3u8",
  "status": "available",
  "health": {
    "healthy": true,
    "reason": "ok",
    "lastModified": "2024-01-15T14:30:00.000Z"
  },
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

### Get Live Stream URLs (All Qualities)
Get live stream URLs for all qualities of a specific camera.

```http
GET /api/streams/live/{cameraId}
```

**Example:**
```http
GET /api/streams/live/102
```

**Response:**
```json
{
  "camera_id": "102",
  "streams": {
    "low": {
      "stream_url": "/hls/102/2024-01-15/14-30-low.m3u8",
      "full_url": "http://your-server:3000/hls/102/2024-01-15/14-30-low.m3u8",
      "status": "available",
      "health": {
        "healthy": true,
        "reason": "ok"
      }
    },
    "high": {
      "stream_url": "/hls/102/2024-01-15/14-30-high.m3u8",
      "full_url": "http://your-server:3000/hls/102/2024-01-15/14-30-high.m3u8",
      "status": "available",
      "health": {
        "healthy": true,
        "reason": "ok"
      }
    }
  },
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

## 📼 Playback Endpoints

### Get Playback Information
Get available playback data for a camera, or specific time range.

```http
GET /api/streams/playback/{cameraId}
```

**Query Parameters:**
- `date` (optional): Specific date (YYYY-MM-DD)
- `startHour` (optional): Start hour (HH-mm)
- `endHour` (optional): End hour (HH-mm)
- `quality` (optional): Stream quality ("low" or "high", default: "low")

**Example 1: Get available dates**
```http
GET /api/streams/playback/102
```

**Response:**
```json
{
  "camera_id": "102",
  "available_dates": [
    "2024-01-14",
    "2024-01-15"
  ],
  "recent_hours": [
    {
      "date": "2024-01-15",
      "hour": "14-30",
      "timestamp": "2024-01-15T14:30:00.000Z",
      "label": "Jan 15, 14:30"
    }
  ],
  "qualities": ["low", "high"],
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

**Example 2: Get specific time range**
```http
GET /api/streams/playback/102?date=2024-01-15&startHour=10-00&endHour=12-00&quality=low
```

**Response:**
```json
{
  "camera_id": "102",
  "quality": "low",
  "date": "2024-01-15",
  "start_hour": "10-00",
  "end_hour": "12-00",
  "playback_urls": [
    {
      "date": "2024-01-15",
      "hour": "10-00",
      "timestamp": "2024-01-15T10:00:00.000Z",
      "url": "/hls/102/2024-01-15/10-00-low.m3u8",
      "available": true
    },
    {
      "date": "2024-01-15",
      "hour": "11-00",
      "timestamp": "2024-01-15T11:00:00.000Z",
      "url": "/hls/102/2024-01-15/11-00-low.m3u8",
      "available": true
    }
  ],
  "count": 2
}
```

## 🔧 Management Endpoints

### Restart Camera Streams
Restart streaming for a specific camera.

```http
POST /api/streams/restart/{cameraId}
```

**Request Body (optional):**
```json
{
  "quality": "low"
}
```

**Example 1: Restart all qualities**
```http
POST /api/streams/restart/102
```

**Example 2: Restart specific quality**
```http
POST /api/streams/restart/102
Content-Type: application/json

{
  "quality": "low"
}
```

**Response:**
```json
{
  "message": "Restarted all streams for camera 102",
  "camera_id": "102",
  "qualities": ["low", "high"],
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

### Get System Status
Get comprehensive system status including all streams, health, and storage.

```http
GET /api/streams/status
```

**Response:**
```json
{
  "streams": {
    "102": {
      "low": {
        "status": "running",
        "timestamp": "2024-01-15T14:30:00.000Z"
      },
      "high": {
        "status": "running",
        "timestamp": "2024-01-15T14:30:00.000Z"
      },
      "restartAttempts": {
        "low": 0,
        "high": 0
      }
    }
  },
  "health": {
    "102": {
      "low": {
        "healthy": true,
        "lastModified": "2024-01-15T14:30:00.000Z"
      },
      "high": {
        "healthy": true,
        "lastModified": "2024-01-15T14:30:00.000Z"
      }
    }
  },
  "storage": {
    "totalSize": 1073741824,
    "sizeFormatted": "1.0 GB",
    "cameras": {
      "102": {
        "totalSize": 536870912,
        "fileCount": 145,
        "dateCount": 2,
        "sizeFormatted": "512.0 MB"
      }
    }
  },
  "configuration": {
    "cameras": ["102"],
    "retention_days": 30,
    "qualities": ["low", "high"],
    "fps": 12
  },
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

## 🏥 Health Check Endpoints

### Simple Health Check
Basic server health check.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "uptime": 3600,
  "version": "3.0.0",
  "environment": "production"
}
```

### API Information
Get API documentation and endpoint information.

```http
GET /api
```

**Response:**
```json
{
  "name": "CCTV Streaming Backend API",
  "version": "3.0.0",
  "environment": "production",
  "endpoints": {
    "health": "/health",
    "cameras": "/api/streams/cameras",
    "live": "/api/streams/live/:cameraId/:quality",
    "playback": "/api/streams/playback/:cameraId",
    "system": "/api/streams/status"
  }
}
```

## 📱 Flutter Integration

### Video Player Setup
Example Flutter code for HLS video playback:

```dart
import 'package:video_player/video_player.dart';

class CCTVPlayer extends StatefulWidget {
  final String streamUrl;
  
  @override
  _CCTVPlayerState createState() => _CCTVPlayerState();
}

class _CCTVPlayerState extends State<CCTVPlayer> {
  VideoPlayerController? _controller;
  
  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }
  
  void _initializePlayer() {
    _controller = VideoPlayerController.network(widget.streamUrl)
      ..initialize().then((_) {
        setState(() {});
        _controller!.play();
      });
  }
  
  @override
  Widget build(BuildContext context) {
    return _controller != null && _controller!.value.isInitialized
      ? AspectRatio(
          aspectRatio: _controller!.value.aspectRatio,
          child: VideoPlayer(_controller!),
        )
      : CircularProgressIndicator();
  }
}
```

### API Service Class
```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class CCTVApiService {
  final String baseUrl;
  
  CCTVApiService(this.baseUrl);
  
  Future<List<Camera>> getCameras() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/streams/cameras'),
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return (data['cameras'] as List)
          .map((json) => Camera.fromJson(json))
          .toList();
    }
    throw Exception('Failed to load cameras');
  }
  
  Future<StreamInfo> getLiveStream(String cameraId, String quality) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/streams/live/$cameraId/$quality'),
    );
    
    if (response.statusCode == 200) {
      return StreamInfo.fromJson(json.decode(response.body));
    }
    throw Exception('Failed to get stream');
  }
}
```

## 🔍 Error Codes

| Status Code | Description | Example |
|-------------|-------------|---------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Invalid quality parameter |
| 404 | Not Found | Camera ID not found |
| 500 | Internal Server Error | FFmpeg process failed |

### Common Error Responses

**Camera Not Found:**
```json
{
  "error": "Camera not found",
  "available_cameras": ["102", "103"],
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

**Invalid Quality:**
```json
{
  "error": "Invalid quality",
  "available_qualities": ["low", "high"],
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

**Stream Unavailable:**
```json
{
  "error": "Stream unavailable",
  "reason": "Camera offline",
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

## 📊 Rate Limiting

Current implementation has no rate limiting, but for production consider:

- **API calls**: 100 requests per minute per IP
- **Stream requests**: 10 concurrent streams per IP
- **Management operations**: 5 per minute per IP

## 🔐 Security Considerations

### Recommended Security Measures

1. **Reverse Proxy**: Use nginx/Apache with SSL
2. **Firewall**: Restrict access to necessary IPs only
3. **VPN**: Require VPN for remote access
4. **Authentication**: Add JWT/API key authentication
5. **HTTPS**: Always use SSL/TLS in production

### Example nginx Configuration
```nginx
server {
    listen 443 ssl;
    server_name cctv.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /hls/ {
        proxy_pass http://localhost:3000/hls/;
        proxy_cache hls_cache;
        proxy_cache_valid 200 10s;
    }
}
```

## 🧪 Testing Examples

### curl Examples
```bash
# Get all cameras
curl http://localhost:3000/api/streams/cameras

# Get live stream URL
curl http://localhost:3000/api/streams/live/102/low

# Get system status
curl http://localhost:3000/api/streams/status

# Restart camera
curl -X POST http://localhost:3000/api/streams/restart/102 \
  -H "Content-Type: application/json" \
  -d '{"quality": "low"}'
```

### JavaScript Examples
```javascript
// Fetch cameras
const cameras = await fetch('/api/streams/cameras')
  .then(response => response.json());

// Get live stream
const stream = await fetch('/api/streams/live/102/low')
  .then(response => response.json());

// Play in video element
const video = document.getElementById('player');
if (Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource(stream.full_url);
  hls.attachMedia(video);
}
```

---

**Next Steps**: See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment instructions 