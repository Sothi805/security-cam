# CCTV Streaming Backend Setup Script for Windows
# Run this script as Administrator

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Please run this script as Administrator" -ForegroundColor Red
    exit 1
}

# Helper functions
function Write-Status($message) {
    Write-Host "[✓] $message" -ForegroundColor Green
}

function Write-Warning($message) {
    Write-Host "[!] $message" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "[✗] $message" -ForegroundColor Red
}

# Check system requirements
Write-Status "Checking system requirements..."

# Check Node.js
try {
    $nodeVersion = node -v
    Write-Status "Node.js found: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed"
    Write-Warning "Please install Node.js from https://nodejs.org/"
    exit 1
}

# Check FFmpeg
try {
    $ffmpegVersion = ffmpeg -version
    Write-Status "FFmpeg found"
} catch {
    Write-Error "FFmpeg is not installed"
    Write-Warning "Installing FFmpeg using Chocolatey..."
    
    # Check if Chocolatey is installed
    try {
        $chocoVersion = choco -v
    } catch {
        Write-Warning "Installing Chocolatey..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    }
    
    # Install FFmpeg
    choco install ffmpeg -y
    
    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Create necessary directories
Write-Status "Creating directories..."

$programData = $env:ProgramData
$appData = Join-Path $programData "CCTV-Streaming"
$logPath = Join-Path $appData "logs"
$hlsPath = Join-Path $appData "hls"
$configPath = Join-Path $appData "config"

New-Item -ItemType Directory -Force -Path $logPath | Out-Null
New-Item -ItemType Directory -Force -Path $hlsPath | Out-Null
New-Item -ItemType Directory -Force -Path $configPath | Out-Null

# Set permissions
Write-Status "Setting permissions..."
$acl = Get-Acl $appData
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("Users","Modify","ContainerInherit,ObjectInherit","None","Allow")
$acl.SetAccessRule($rule)
Set-Acl $appData $acl

# Install dependencies
Write-Status "Installing Node.js dependencies..."
npm install

# Create environment file
$envFile = Join-Path $configPath "production.env"
if (-not (Test-Path $envFile)) {
    Write-Status "Creating environment file..."
    Copy-Item "production.env" -Destination $envFile
    Write-Warning "Please edit $envFile with your settings"
}

# Create Windows service using NSSM
Write-Status "Installing Windows Service..."

# Check if NSSM is installed
try {
    $nssmVersion = nssm version
} catch {
    Write-Warning "Installing NSSM using Chocolatey..."
    choco install nssm -y
}

# Remove existing service if it exists
nssm remove "CCTV-Streaming" confirm

# Install new service
$nodePath = (Get-Command node).Path
$appPath = Join-Path $PSScriptRoot ".." "app.js"
$workingDir = Join-Path $PSScriptRoot ".."

nssm install "CCTV-Streaming" $nodePath $appPath
nssm set "CCTV-Streaming" AppDirectory $workingDir
nssm set "CCTV-Streaming" DisplayName "CCTV Streaming Backend"
nssm set "CCTV-Streaming" Description "CCTV Streaming Backend Service"
nssm set "CCTV-Streaming" AppEnvironmentExtra "NODE_ENV=production"
nssm set "CCTV-Streaming" AppStdout $logPath\service.log
nssm set "CCTV-Streaming" AppStderr $logPath\error.log
nssm set "CCTV-Streaming" Start SERVICE_AUTO_START

# Start service
Write-Status "Starting CCTV Streaming service..."
Start-Service "CCTV-Streaming"

# Check service status
$service = Get-Service "CCTV-Streaming" -ErrorAction SilentlyContinue
if ($service.Status -eq "Running") {
    Write-Status "CCTV Streaming service is running"
} else {
    Write-Error "Failed to start CCTV Streaming service"
    Write-Warning "Check logs in $logPath"
}

# Final instructions
Write-Host ""
Write-Status "Setup completed!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Edit configuration: $envFile"
Write-Host "2. Check logs in: $logPath"
Write-Host "3. Service commands:"
Write-Host "   - Start: Start-Service CCTV-Streaming"
Write-Host "   - Stop: Stop-Service CCTV-Streaming"
Write-Host "   - Restart: Restart-Service CCTV-Streaming"
Write-Host "   - Status: Get-Service CCTV-Streaming"
Write-Host ""
Write-Warning "Don't forget to configure Windows Firewall to allow required ports"

# Create shortcut for easy access to logs
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\CCTV-Streaming Logs.lnk")
$Shortcut.TargetPath = $logPath
$Shortcut.Save()

Write-Status "Created desktop shortcut to logs directory" 