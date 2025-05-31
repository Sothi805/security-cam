# Flutter CCTV Viewer App

## Overview
Simple Flutter mobile application for viewing CCTV camera streams and recordings using HLS (HTTP Live Streaming).

## API Endpoints

### Base URL
```
const API_BASE_URL = 'http://your_server:3000';
```

### Core Endpoints

1. **Live Stream**
```
http://your_server:3000/hls/{CAMERA_ID}/live/live.m3u8
```

2. **Recording Playback**
```
http://your_server:3000/hls/{CAMERA_ID}/recordings/{YYYY-MM-DD}/{HH}/playlist.m3u8
```

3. **Get Available Recordings**
```
GET /streams/playback/{cameraId}
Response:
{
    "camera_id": "102",
    "available_dates": ["2024-03-14", "2024-03-13"],
    "recent_hours": ["00:00", "01:00", ...],
    "timestamp": "2024-03-14T12:00:00Z"
}
```

## Core Features

### 1. Live View
- Full-screen video player for live streams
- Basic video controls (play/pause)
- Error handling with retry option

### 2. Recording Playback
- Date and hour selection
- Video player with basic controls
- Return to live button

## Dependencies
```yaml
dependencies:
  flutter:
    sdk: flutter
  video_player: ^2.8.1
  better_player: ^0.0.83  # For HLS support
  provider: ^6.1.1  # State management
  dio: ^5.4.0  # HTTP client
  intl: ^0.19.0  # Date formatting
```

## Project Structure
```
lib/
├── api/
│   └── api_service.dart
├── screens/
│   ├── live_view.dart
│   └── recordings.dart
├── widgets/
│   └── video_player.dart
└── main.dart
```

## Basic Video Player Implementation
```dart
class VideoPlayerWidget extends StatefulWidget {
  final String streamUrl;
  final bool isLive;
  
  // ... implementation with basic controls
}
```

## Theme
```dart
final primaryColor = Color(0xFFEF4444);
final backgroundColor = Color(0xFF0F1419);
final textColor = Colors.white;
``` 