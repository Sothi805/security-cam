# Flutter Integration Guide

This document outlines how to integrate the CCTV Streaming Backend with a Flutter application.

## API Endpoints

All endpoints are designed to be Flutter-compatible and return consistent JSON structures.

### Stream Management

```
GET /api/streams/cameras
Response: {
    "cameras": [
        {
            "id": "101",
            "name": "Camera 1",
            "status": "active|inactive",
            "streamUrl": "http://server:port/hls/101/stream.m3u8",
            "previewUrl": "http://server:port/hls/101/preview.jpg"
        }
    ]
}

GET /api/streams/live/:cameraId/:quality
Response: {
    "url": "http://server:port/hls/101/stream.m3u8",
    "type": "application/vnd.apple.mpegurl",
    "quality": "480p|720p",
    "status": "active"
}

GET /api/streams/playback/:cameraId
Query params: date, startTime, endTime
Response: {
    "segments": [
        {
            "url": "http://server:port/hls/101/2024-03-10/12-00-00.m3u8",
            "startTime": "2024-03-10T12:00:00Z",
            "duration": 300
        }
    ]
}
```

### System Health

```
GET /api/system/health
Response: {
    "status": "healthy|warning|error",
    "lastUpdate": "2024-03-10T12:00:00Z",
    "metrics": {
        "cpu": {
            "loadAverage": 1.5,
            "cores": 4
        },
        "memory": {
            "used": 1073741824,
            "total": 8589934592,
            "percentage": "12.5"
        },
        "storage": {
            "used": 107374182400,
            "total": 1099511627776,
            "percentage": "9.8"
        }
    },
    "alerts": [
        {
            "id": 1234567890,
            "type": "storage",
            "severity": "warning",
            "message": "High storage usage: 85%",
            "timestamp": "2024-03-10T12:00:00Z"
        }
    ]
}

GET /api/system/metrics
GET /api/system/metrics/history
GET /api/system/alerts
```

### Retention Management

```
GET /api/retention/stats
Response: {
    "cameras": {
        "101": {
            "retentionDays": 30,
            "maxStorageGB": 50,
            "currentStorageGB": 35.5,
            "oldestFootage": "2024-02-10T00:00:00Z"
        }
    }
}

PUT /api/retention/policy/:cameraId
Request: {
    "retentionDays": 30,
    "maxStorageGB": 50,
    "keepMotionEvents": true,
    "minMotionRetentionDays": 7
}
```

## Flutter Implementation Guide

### 1. Dependencies

Add these dependencies to your `pubspec.yaml`:

```yaml
dependencies:
  video_player: ^2.8.1
  chewie: ^1.7.4
  http: ^1.1.0
  provider: ^6.1.1
  path_provider: ^2.1.1
```

### 2. Video Player Setup

```dart
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';

class CameraPlayer extends StatefulWidget {
  final String streamUrl;
  
  CameraPlayer({required this.streamUrl});
  
  @override
  _CameraPlayerState createState() => _CameraPlayerState();
}

class _CameraPlayerState extends State<CameraPlayer> {
  late VideoPlayerController _videoController;
  ChewieController? _chewieController;
  
  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }
  
  Future<void> _initializePlayer() async {
    _videoController = VideoPlayerController.network(widget.streamUrl);
    await _videoController.initialize();
    
    _chewieController = ChewieController(
      videoPlayerController: _videoController,
      autoPlay: true,
      looping: true,
      aspectRatio: 16/9,
      allowPlaybackSpeedChanging: false,
    );
    
    setState(() {});
  }
  
  @override
  Widget build(BuildContext context) {
    return _chewieController != null
        ? Chewie(controller: _chewieController!)
        : Center(child: CircularProgressIndicator());
  }
  
  @override
  void dispose() {
    _videoController.dispose();
    _chewieController?.dispose();
    super.dispose();
  }
}
```

### 3. API Service

```dart
class CCTVApiService {
  final String baseUrl;
  final http.Client client;
  
  CCTVApiService({
    required this.baseUrl,
    http.Client? client,
  }) : client = client ?? http.Client();
  
  Future<List<Camera>> getCameras() async {
    final response = await client.get(Uri.parse('$baseUrl/api/streams/cameras'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return (data['cameras'] as List)
          .map((json) => Camera.fromJson(json))
          .toList();
    }
    throw Exception('Failed to load cameras');
  }
  
  Future<SystemHealth> getSystemHealth() async {
    final response = await client.get(Uri.parse('$baseUrl/api/system/health'));
    if (response.statusCode == 200) {
      return SystemHealth.fromJson(json.decode(response.body));
    }
    throw Exception('Failed to load system health');
  }
}
```

### 4. State Management

```dart
class CameraProvider extends ChangeNotifier {
  final CCTVApiService _api;
  List<Camera> _cameras = [];
  SystemHealth? _health;
  Timer? _healthCheckTimer;
  
  CameraProvider(this._api) {
    _initializeData();
    _startHealthCheck();
  }
  
  Future<void> _initializeData() async {
    try {
      _cameras = await _api.getCameras();
      notifyListeners();
    } catch (e) {
      print('Failed to load cameras: $e');
    }
  }
  
  void _startHealthCheck() {
    _healthCheckTimer = Timer.periodic(Duration(seconds: 30), (_) async {
      try {
        _health = await _api.getSystemHealth();
        notifyListeners();
      } catch (e) {
        print('Failed to update health: $e');
      }
    });
  }
  
  @override
  void dispose() {
    _healthCheckTimer?.cancel();
    super.dispose();
  }
}
```

### 5. Error Handling

Implement proper error handling for network issues and API errors:

```dart
class ApiError implements Exception {
  final String message;
  final int? statusCode;
  
  ApiError(this.message, {this.statusCode});
  
  @override
  String toString() => 'ApiError: $message ${statusCode != null ? '($statusCode)' : ''}';
}

extension ApiErrorHandling on Future<Response> {
  Future<T> handleError<T>() async {
    try {
      final response = await this;
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return json.decode(response.body);
      }
      throw ApiError(
        'Request failed',
        statusCode: response.statusCode,
      );
    } catch (e) {
      if (e is ApiError) rethrow;
      throw ApiError('Network error: $e');
    }
  }
}
```

## Best Practices

1. **State Management**: Use Provider or Riverpod for state management.
2. **Error Handling**: Implement proper error handling and display user-friendly error messages.
3. **Caching**: Cache camera list and other static data to improve performance.
4. **Background Services**: Handle background tasks properly to avoid memory leaks.
5. **UI Responsiveness**: Use loading indicators and handle loading states appropriately.
6. **Network Connectivity**: Monitor network connectivity and handle offline scenarios.

## Security Considerations

1. Use HTTPS for all API communications
2. Implement proper authentication
3. Handle sensitive data securely
4. Validate all server responses
5. Implement request timeouts
6. Handle session expiration

## Performance Optimization

1. Use lazy loading for camera streams
2. Implement proper stream disposal
3. Cache network requests where appropriate
4. Optimize image loading and caching
5. Handle memory management properly
6. Use appropriate video quality based on network conditions

## Testing

1. Write unit tests for API services
2. Write widget tests for UI components
3. Implement integration tests
4. Test error scenarios
5. Test offline functionality
6. Test memory usage and performance

## Troubleshooting

Common issues and solutions:

1. **Video playback issues**
   - Check HLS stream compatibility
   - Verify network connectivity
   - Check video player initialization

2. **Performance issues**
   - Monitor memory usage
   - Dispose resources properly
   - Use appropriate video quality

3. **Network issues**
   - Implement retry logic
   - Handle timeouts gracefully
   - Show appropriate error messages 