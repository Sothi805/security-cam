@echo off
echo.
echo ========================================
echo    CCTV System - Development Setup
echo        Windows 11 Development
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if FFmpeg is installed
ffmpeg -version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: FFmpeg not found in PATH
    echo Please install FFmpeg from https://ffmpeg.org/download.html
    echo Add FFmpeg to your system PATH
    echo.
    set /p continue="Continue anyway? (y/n): "
    if /i not "%continue%"=="y" exit /b 1
)

echo Step 1: Installing Node.js dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Creating development environment file...
if not exist .env (
    echo Creating .env file with development settings...
    (
        echo # CCTV System - Development Configuration
        echo NODE_ENV=development
        echo.
        echo # Server Configuration
        echo PORT=3000
        echo GRACEFUL_SHUTDOWN_TIMEOUT=30000
        echo CACHE_CONTROL_MAX_AGE=31536000
        echo.
        echo # Camera Configuration ^(Development^)
        echo CAMERA_IDS=1,102,202
        echo RTSP_USER=admin
        echo RTSP_PASS=password123
        echo RTSP_HOST=192.168.1.100
        echo RTSP_PORT=554
        echo RTSP_TRANSPORT=tcp
        echo.
        echo # HLS Configuration ^(Development - Lower quality for faster testing^)
        echo HLS_ROOT=hls
        echo SEGMENT_DURATION=10
        echo HLS_LIST_SIZE=6
        echo HLS_FLAGS=delete_segments+append_list
        echo.
        echo # Video Quality ^(Development - Lower settings^)
        echo LOW_QUALITY_WIDTH=640
        echo LOW_QUALITY_HEIGHT=360
        echo LOW_QUALITY_FPS=8
        echo LOW_QUALITY_BITRATE=400k
        echo LOW_QUALITY_PRESET=ultrafast
        echo LOW_QUALITY_PROFILE=baseline
        echo LOW_QUALITY_LEVEL=3.0
        echo.
        echo # Audio Settings ^(Development^)
        echo AUDIO_CODEC=aac
        echo AUDIO_BITRATE=32k
        echo AUDIO_SAMPLE_RATE=22050
        echo.
        echo # Storage ^(Development - Short retention^)
        echo RETENTION_MINUTES=60
        echo CLEANUP_INTERVAL_MINUTES=5
        echo MAX_STORAGE_GB=10
        echo INITIAL_CLEANUP_DELAY_SECONDS=5
        echo EMERGENCY_CLEANUP_THRESHOLD=95
        echo WARNING_THRESHOLD=80
        echo ORPHANED_FILE_MAX_AGE_HOURS=1
        echo.
        echo # FFmpeg Configuration
        echo FFMPEG_PATH=ffmpeg
        echo FFMPEG_LOG_LEVEL=error
        echo.
        echo # Recording ^(Development - Disabled by default^)
        echo ENABLE_RECORDING=false
        echo RECORDING_FORMAT=mp4
        echo RECORDING_SEGMENT_MINUTES=30
        echo.
        echo # System Configuration ^(Development^)
        echo MAX_RESTART_ATTEMPTS=3
        echo RESTART_DELAY_SECONDS=5
        echo HEALTH_CHECK_INTERVAL_SECONDS=30
        echo STREAM_RESTART_PAUSE_SECONDS=2
        echo ALL_CAMERAS_RESTART_PAUSE_SECONDS=3
        echo PLAYLIST_STALE_THRESHOLD_MINUTES=5
        echo.
        echo # Monitoring ^(Development^)
        echo ENABLE_MONITORING=true
        echo LOG_LEVEL=debug
        echo LOG_RETENTION_DAYS=3
        echo.
        echo # Log Configuration ^(Development^)
        echo LOG_MAX_FILE_SIZE=5242880
        echo LOG_MAX_FILES=3
        echo CLEANUP_LOG_MAX_SIZE=2097152
        echo CLEANUP_LOG_MAX_FILES=2
        echo STREAM_LOG_MAX_FILES=2
        echo SYSTEM_LOG_MAX_FILES=2
        echo.
        echo # PM2 Configuration ^(Development^)
        echo PM2_INSTANCES=1
        echo PM2_MAX_MEMORY_RESTART=1G
        echo PM2_MAX_RESTARTS=5
        echo PM2_MIN_UPTIME=10s
        echo PM2_RESTART_DELAY=3000
        echo PM2_KILL_TIMEOUT=15000
        echo PM2_LISTEN_TIMEOUT=5000
        echo PM2_HEALTH_CHECK_GRACE_PERIOD=15000
        echo NODE_MAX_OLD_SPACE_SIZE=2048
        echo.
        echo # CORS Configuration ^(Development - Allow all^)
        echo CORS_ORIGIN=*
        echo CORS_METHODS=GET,POST,PUT,DELETE
        echo CORS_ALLOWED_HEADERS=Content-Type,Authorization
        echo.
        echo # Request Limits ^(Development^)
        echo REQUEST_JSON_LIMIT=10mb
        echo REQUEST_URL_ENCODED_LIMIT=10mb
    ) > .env
    echo ✓ Created .env file with development settings
) else (
    echo ✓ .env file already exists
)

echo.
echo Step 3: Creating HLS directory...
if not exist hls mkdir hls
echo ✓ HLS directory ready

echo.
echo Step 4: Creating logs directory...
if not exist logs mkdir logs
echo ✓ Logs directory ready

echo.
echo Step 5: Setting up Flutter mobile app...
cd app_live
if exist pubspec.yaml (
    echo Installing Flutter dependencies...
    call flutter pub get
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: Flutter pub get failed - Flutter might not be installed
        echo Install Flutter from https://flutter.dev/docs/get-started/install
    ) else (
        echo Generating model files...
        call flutter packages pub run build_runner build --delete-conflicting-outputs
        if %ERRORLEVEL% NEQ 0 (
            echo WARNING: Build runner failed - this is normal for initial setup
        )
        echo ✓ Flutter app ready for development
    )
) else (
    echo WARNING: Flutter app not found
)
cd ..

echo.
echo ========================================
echo      Development Setup Complete!
echo ========================================
echo.
echo Server will run on: http://localhost:3000
echo Dashboard: http://localhost:3000/
echo API docs: http://localhost:3000/api/docs
echo.
echo To start development:
echo   1. npm run dev          - Start development server
echo   2. npm run dev:watch    - Start with auto-restart
echo   3. npm run mobile       - Start Flutter app (in app_live directory)
echo.
echo Mobile app connects to: http://localhost:3000
echo.
echo Happy coding! 🚀
echo.
pause 