@echo off
echo =================================================================
echo                HIKVISION CAMERA CONNECTION TEST
echo =================================================================
echo.
echo Testing camera connection using FFprobe...
echo Camera: 192.168.0.105:554 (Channel 102)
echo.

REM Load environment variables from dotenv
REM Using %RTSP_USER% and %RTSP_PASS% from environment
ffprobe -v quiet -print_format json -show_streams -rtsp_transport tcp -timeout 10000000 "rtsp://%RTSP_USER%:%RTSP_PASS%@192.168.0.105:554/Streaming/Channels/102"

echo.
echo Test completed. Check output above for connection status. 