# CCTV Streaming Backend Quick Start Guide

This guide will help you quickly set up and run the CCTV Streaming Backend on your system.

## Prerequisites

- Node.js 18 or later
- FFmpeg
- Git (for cloning the repository)
- 2GB RAM minimum (4GB recommended)
- 50GB storage space minimum

## Installation Options

Choose one of the following installation methods:

### 1. Docker Installation (Recommended)

The easiest way to get started is using Docker:

```bash
# Clone the repository
git clone https://github.com/yourusername/cctv-streaming.git
cd cctv-streaming

# Create config directory and copy environment file
mkdir -p config
cp production.env config/production.env

# Edit the configuration
nano config/production.env

# Start the container
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 2. Windows Installation

1. Open PowerShell as Administrator
2. Navigate to the project directory
3. Run the setup script:

```powershell
.\scripts\setup.ps1
```

The script will:
- Install required dependencies
- Create necessary directories
- Set up the Windows service
- Create desktop shortcuts

### 3. Linux Installation

1. Open terminal
2. Navigate to the project directory
3. Run the setup script:

```bash
sudo ./scripts/setup.sh
```

The script will:
- Install required dependencies
- Create necessary directories
- Set up the systemd service
- Configure permissions

## Configuration

Edit the configuration file based on your installation method:

- Docker: `./config/production.env`
- Windows: `C:\ProgramData\CCTV-Streaming\config\production.env`
- Linux: `/etc/cctv-streaming/production.env`

Essential settings to configure:

```env
# Camera Configuration
CAMERA_IDS=101,102,103
RTSP_USER=admin
RTSP_PASS=your_password
RTSP_HOST=192.168.0.105
RTSP_PORT=554

# Storage Settings
RETENTION_DAYS=30
MAX_STORAGE_PER_CAMERA=50
```

## Verifying Installation

1. Check if the service is running:
   - Docker: `docker-compose ps`
   - Windows: `Get-Service CCTV-Streaming`
   - Linux: `systemctl status cctv-streaming`

2. Open a web browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Check system health:
   ```
   http://localhost:3000/api/system/health
   ```

## Common Operations

### Starting the Service

- Docker: `docker-compose up -d`
- Windows: `Start-Service CCTV-Streaming`
- Linux: `sudo systemctl start cctv-streaming`

### Stopping the Service

- Docker: `docker-compose down`
- Windows: `Stop-Service CCTV-Streaming`
- Linux: `sudo systemctl stop cctv-streaming`

### Viewing Logs

- Docker: `docker-compose logs -f`
- Windows: Check the logs directory shortcut on desktop
- Linux: `journalctl -u cctv-streaming -f`

### Updating the Application

1. Stop the service
2. Pull latest changes: `git pull`
3. Install dependencies: `npm install`
4. Start the service

## Troubleshooting

### Common Issues

1. **Service won't start**
   - Check logs for errors
   - Verify FFmpeg installation
   - Ensure correct permissions

2. **Can't connect to cameras**
   - Verify camera IP addresses
   - Check RTSP credentials
   - Ensure cameras are accessible

3. **High CPU/Memory Usage**
   - Reduce number of concurrent streams
   - Lower video quality settings
   - Check system resources

4. **Storage Issues**
   - Verify retention settings
   - Check available disk space
   - Monitor storage usage

### Getting Help

1. Check the logs for detailed error messages
2. Review the API documentation
3. Check GitHub issues for similar problems
4. Contact support with:
   - Log files
   - System information
   - Error messages
   - Steps to reproduce

## Next Steps

1. Set up Flutter mobile app
2. Configure additional cameras
3. Customize retention policies
4. Set up monitoring
5. Configure backup solution

## Security Recommendations

1. Change default passwords
2. Use HTTPS
3. Configure firewall
4. Keep system updated
5. Monitor access logs
6. Use strong authentication

## Performance Tips

1. Adjust video quality based on bandwidth
2. Monitor system resources
3. Clean up old recordings regularly
4. Use appropriate retention settings
5. Configure motion detection

## Support

For additional help:
- Documentation: `/docs`
- Issues: GitHub Issues
- Email: support@example.com 