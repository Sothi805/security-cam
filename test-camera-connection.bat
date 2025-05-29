@echo off
echo Testing camera connectivity on production PC...
echo.

echo 1. Testing network connectivity to camera...
ping -n 4 192.168.0.105

echo.
echo 2. Testing RTSP connection with FFprobe...
ffprobe -v quiet -print_format json -show_streams -rtsp_transport tcp -timeout 10000000 "rtsp://admin:iME@1012@192.168.0.105:554/Streaming/Channels/102"

echo.
echo 3. If both tests pass, cameras should work!
pause 