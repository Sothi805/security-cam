@echo off
echo Stopping existing Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM ffmpeg.exe >nul 2>&1

echo Waiting for processes to stop...
timeout /t 2 >nul

echo Starting CCTV Streaming Backend...
npm run dev 