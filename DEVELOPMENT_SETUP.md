# 🖥️ Development Setup on Different PC

This guide explains how to set up the CCTV system for development on any PC, including network configuration for cross-device testing.

## 📋 **Prerequisites**

### **Required Software**
- **Node.js 16+** - [Download here](https://nodejs.org/)
- **FFmpeg** - [Download here](https://ffmpeg.org/download.html)
- **Git** - [Download here](https://git-scm.com/)
- **Flutter SDK** (for mobile development) - [Download here](https://flutter.dev/docs/get-started/install)

### **System Requirements**
- Windows 10/11, Linux, or macOS
- 4GB+ RAM
- 10GB+ free disk space
- Network access to camera system

## 🚀 **Quick Setup**

### **1. Clone the Repository**
```bash
git clone <repository-url>
cd security_cam_project/security-cam
```

### **2. Run Development Setup**

**Windows:**
```bash
scripts\setup-dev.bat
```

**Linux/macOS:**
```bash
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh
```

### **3. Configure for Your Network**

#### **Find Your PC's IP Address**

**Windows:**
```bash
ipconfig
# Look for "IPv4 Address" under your network adapter
# Example: 192.168.1.150
```

**Linux/macOS:**
```bash
ip addr show
# or
ifconfig
# Look for inet address
# Example: 192.168.1.150
```

#### **Create Your .env File**
```bash
# Copy the example and edit it
cp example.env .env
```

#### **Edit Key Network Settings in .env**
```bash
# Your PC's IP address (replace with your actual IP)
RTSP_HOST=192.168.1.100  # Your camera system IP
PORT=3000                # Keep this for development

# Development optimized settings
NODE_ENV=development
LOW_QUALITY_WIDTH=640
LOW_QUALITY_HEIGHT=360
LOW_QUALITY_FPS=8
LOW_QUALITY_BITRATE=400k
RETENTION_MINUTES=60
MAX_STORAGE_GB=10
LOG_LEVEL=debug
```

### **4. Start Development Server**
```bash
npm run dev
```

## 🌐 **Network Configuration**

### **Accessing from Same PC**
- **Web Dashboard**: http://localhost:3000
- **API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

### **Accessing from Other Devices (Mobile/Tablet)**
Replace `localhost` with your PC's IP address:
- **Web Dashboard**: http://192.168.1.150:3000 
- **API**: http://192.168.1.150:3000/api
- **Mobile App**: Configure API base URL to http://192.168.1.150:3000

### **Configure Windows Firewall**
If you can't access from other devices:

**Option 1: Allow Node.js through firewall**
1. Windows Security → Firewall & network protection
2. Allow an app through firewall
3. Add Node.js or allow port 3000

**Option 2: Temporary disable firewall**
```bash
# Run as Administrator
netsh advfirewall set allprofiles state off
# Remember to turn back on: netsh advfirewall set allprofiles state on
```

**Option 3: Add specific port rule**
```bash
# Run as Administrator
netsh advfirewall firewall add rule name="CCTV Dev Server" dir=in action=allow protocol=TCP localport=3000
```

## 📱 **Mobile App Configuration**

### **Update API Service for Development**
Edit `app_live/lib/services/api_service.dart`:

```dart
class ApiService {
  // Replace with your PC's IP address
  static const String _devBaseUrl = 'http://192.168.1.150:3000';
  static const String _prodBaseUrl = 'http://192.168.1.100:3000';
  
  // Rest of the code...
}
```

### **Run Mobile App**
```bash
cd app_live
flutter run
# Select your device (Android emulator, iOS simulator, or physical device)
```

### **Test Mobile Connection**
1. Ensure your mobile device is on the same WiFi network
2. Open the app and check if cameras load
3. If connection fails, verify IP address and firewall settings

## 🔧 **Common Configuration Scenarios**

### **Scenario 1: Different Camera System**
```bash
# In .env file, update camera details
CAMERA_IDS=cam1,cam2,cam3  # Your camera IDs
RTSP_USER=your_username
RTSP_PASS=your_password
RTSP_HOST=192.168.1.200   # Your camera system IP
RTSP_PORT=554
```

### **Scenario 2: Different Network Subnet**
```bash
# If camera system is on different subnet
RTSP_HOST=10.0.1.100      # Different subnet
# Ensure network routing allows access
```

### **Scenario 3: Laptop Development (Dynamic IP)**
For laptops that change IP addresses:

**Create a start script** (`start-dev.bat` or `start-dev.sh`):
```bash
@echo off
echo Getting current IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do set IP=%%a
set IP=%IP: =%
echo Current IP: %IP%
echo.
echo Access dashboard at: http://%IP%:3000
echo Configure mobile app to: http://%IP%:3000
echo.
npm run dev
```

### **Scenario 4: Multiple Developers**
Each developer should:
1. Use their own `.env` file with their IP
2. Use same camera system settings
3. Use different port if needed (`PORT=3001`, `PORT=3002`, etc.)

## 🔍 **Validation and Testing**

### **1. Validate Configuration**
```bash
npm run validate
```

### **2. Test API Endpoints**
```bash
# Test from same PC
curl http://localhost:3000/health

# Test from other device (replace IP)
curl http://192.168.1.150:3000/health
```

### **3. Test Camera Connection**
```bash
# Check if cameras are accessible
curl http://192.168.1.150:3000/streams/cameras
```

### **4. Test HLS Streaming**
Open in browser: `http://192.168.1.150:3000/hls/1/live/low.m3u8`

## 🐛 **Troubleshooting**

### **Cannot Access from Other Devices**
1. **Check IP Address**: Ensure you're using the correct IP
2. **Firewall**: Disable temporarily or add port exception
3. **Network**: Ensure devices are on same network
4. **Port**: Verify port 3000 is not blocked

### **Mobile App Cannot Connect**
1. **Update API URL**: Hardcode your PC's IP in api_service.dart
2. **Network Access**: Check mobile device can ping your PC
3. **CORS Settings**: Development uses `CORS_ORIGIN=*` (should work)

### **Camera Connection Issues**
1. **Network Access**: Ping camera system from your PC
2. **Credentials**: Verify RTSP username/password
3. **Firewall**: Camera system firewall might block your PC

### **FFmpeg Not Found**
**Windows:**
```bash
# Download FFmpeg and add to PATH, or specify full path
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

**Linux:**
```bash
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

## 📊 **Development Network Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Camera System │    │  Development PC  │    │  Mobile Device  │
│  192.168.1.100  │◄──►│ 192.168.1.150   │◄──►│ WiFi Connected  │
│                 │    │  Port: 3000      │    │                 │
│  RTSP Streams   │    │  CCTV Server     │    │  Flutter App    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 💡 **Development Tips**

### **1. Use Nodemon for Auto-Restart**
```bash
npm run dev:watch  # Auto-restarts on code changes
```

### **2. Monitor Logs**
```bash
npm run logs:tail  # View live logs
```

### **3. Quick IP Script**
Create `get-ip.bat`:
```bash
@echo off
ipconfig | findstr "IPv4" | findstr "192.168"
echo.
echo Update your mobile app to use this IP:3000
```

### **4. Development Bookmarks**
- Dashboard: http://[YOUR-IP]:3000
- API Docs: http://[YOUR-IP]:3000/api  
- Health: http://[YOUR-IP]:3000/health
- System Metrics: http://[YOUR-IP]:3000/system/metrics

Replace `[YOUR-IP]` with your actual IP address (e.g., 192.168.1.150)

## 🔄 **Quick Start Checklist**

- [ ] Install Node.js, FFmpeg, Git
- [ ] Clone repository
- [ ] Run setup script
- [ ] Find your PC's IP address
- [ ] Create .env with your network settings
- [ ] Configure firewall/port access
- [ ] Start development server
- [ ] Test access from browser
- [ ] Update mobile app API URL
- [ ] Test mobile app connection
- [ ] Validate configuration

Success! Your development environment is ready for cross-device testing. 