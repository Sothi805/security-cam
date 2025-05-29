@echo off
echo.
echo ========================================
echo    CCTV Development Network Setup
echo ========================================
echo.

REM Get the current IP address
echo Detecting your PC's IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4" ^| findstr "192.168"') do set CURRENT_IP=%%a
set CURRENT_IP=%CURRENT_IP: =%

if "%CURRENT_IP%"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4" ^| findstr "10.0"') do set CURRENT_IP=%%a
    set CURRENT_IP=%CURRENT_IP: =%
)

if "%CURRENT_IP%"=="" (
    echo ERROR: Could not detect IP address automatically
    echo Please run 'ipconfig' and find your IPv4 address manually
    pause
    exit /b 1
)

echo.
echo ✓ Detected IP Address: %CURRENT_IP%
echo.

REM Check if .env file exists
if not exist .env (
    echo Creating .env file from example...
    if exist example.env (
        copy example.env .env >nul
        echo ✓ .env file created from example.env
    ) else (
        echo ERROR: example.env file not found!
        echo Please ensure you're in the security-cam directory
        pause
        exit /b 1
    )
) else (
    echo ✓ .env file already exists
)

echo.
echo ========================================
echo         Network Configuration
echo ========================================
echo.
echo Your development server will be accessible at:
echo.
echo 📍 From this PC:
echo    Dashboard: http://localhost:3000
echo    API:       http://localhost:3000/api
echo.
echo 📱 From mobile devices (same WiFi):
echo    Dashboard: http://%CURRENT_IP%:3000
echo    API:       http://%CURRENT_IP%:3000/api
echo.

REM Update Flutter API service file if it exists
if exist "..\app_live\lib\services\api_service.dart" (
    echo ========================================
    echo      Mobile App Configuration
    echo ========================================
    echo.
    echo To connect your mobile app, update this line in:
    echo app_live\lib\services\api_service.dart
    echo.
    echo Change:
    echo   static const String _devBaseUrl = 'http://localhost:3000';
    echo To:
    echo   static const String _devBaseUrl = 'http://%CURRENT_IP%:3000';
    echo.
)

echo ========================================
echo        Firewall Configuration
echo ========================================
echo.
echo If you can't access from other devices, you may need to:
echo 1. Allow Node.js through Windows Firewall
echo 2. Or run this command as Administrator:
echo.
echo netsh advfirewall firewall add rule name="CCTV Dev Server" dir=in action=allow protocol=TCP localport=3000
echo.

set /p ADD_FIREWALL_RULE="Add firewall rule now? (y/n): "
if /i "%ADD_FIREWALL_RULE%"=="y" (
    echo.
    echo Adding firewall rule...
    netsh advfirewall firewall add rule name="CCTV Dev Server" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo ✓ Firewall rule added successfully
    ) else (
        echo ⚠ Failed to add firewall rule (may need Administrator privileges)
        echo Please run as Administrator or add manually
    )
)

echo.
echo ========================================
echo           Quick Test
echo ========================================
echo.
set /p START_SERVER="Start development server now? (y/n): "
if /i "%START_SERVER%"=="y" (
    echo.
    echo Starting development server...
    echo Server will be available at http://%CURRENT_IP%:3000
    echo Press Ctrl+C to stop the server
    echo.
    npm run dev
) else (
    echo.
    echo To start the server manually, run:
    echo   npm run dev
    echo.
    echo Then access the dashboard at:
    echo   http://%CURRENT_IP%:3000
    echo.
)

echo.
echo ========================================
echo        Setup Complete!
echo ========================================
echo.
echo 📝 Next steps:
echo 1. Start the server: npm run dev
echo 2. Access dashboard: http://%CURRENT_IP%:3000
echo 3. Update mobile app API URL (if using)
echo 4. Test from other devices on same WiFi
echo.
pause 