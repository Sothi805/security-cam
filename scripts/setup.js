#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const config = require('../utils/config');
const { logger } = require('../utils/logger');

async function setupDirectories() {
  console.log('🏗️  Setting up directory structure...');
  
  const directories = [
    config.hls.root,
    'logs',
    path.join(config.hls.root, 'temp')
  ];

  // Create camera-specific directories
  for (const cameraId of config.cameras.ids) {
    directories.push(
      path.join(config.hls.root, cameraId),
      path.join(config.hls.root, cameraId, 'live', 'high'),
      path.join(config.hls.root, cameraId, 'live', 'low'),
      path.join(config.hls.root, cameraId, 'recordings')
    );
  }

  for (const dir of directories) {
    try {
      await fs.ensureDir(dir);
      console.log(`✅ Created directory: ${dir}`);
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error.message);
    }
  }
}

function validateConfiguration() {
  console.log('🔧 Validating configuration...');
  
  const issues = [];
  
  // Check camera configuration
  if (config.cameras.ids.length === 0) {
    issues.push('No cameras configured');
  }
  
  // Check RTSP configuration
  if (!config.cameras.rtsp.host || !config.cameras.rtsp.user) {
    issues.push('RTSP configuration incomplete');
  }
  
  // Check storage limits
  if (config.storage.retentionMinutes < 5) {
    issues.push('Retention period too short (minimum 5 minutes recommended)');
  }
  
  if (config.storage.maxStorageGB < 1) {
    issues.push('Maximum storage too small (minimum 1GB recommended)');
  }
  
  // Check segment duration
  if (config.hls.segmentDuration < 1 || config.hls.segmentDuration > 60) {
    issues.push('Segment duration should be between 1-60 seconds');
  }
  
  if (issues.length > 0) {
    console.log('⚠️  Configuration issues found:');
    issues.forEach(issue => console.log(`   • ${issue}`));
  } else {
    console.log('✅ Configuration validation passed');
  }
  
  return issues.length === 0;
}

function checkSystemRequirements() {
  console.log('🔍 Checking system requirements...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 14) {
    console.log(`⚠️  Node.js version ${nodeVersion} detected. Recommended: v14+`);
  } else {
    console.log(`✅ Node.js version ${nodeVersion} is compatible`);
  }
  
  // Check available memory
  const totalMemory = process.memoryUsage();
  const memoryMB = Math.round(totalMemory.rss / 1024 / 1024);
  console.log(`📊 Current memory usage: ${memoryMB} MB`);
  
  // Check disk space (simplified check)
  try {
    const stats = fs.statSync('.');
    console.log('✅ Disk access verified');
  } catch (error) {
    console.log('❌ Disk access issue:', error.message);
  }
  
  return true;
}

function displayConfiguration() {
  console.log('\n📋 Current Configuration:');
  console.log(`   • Cameras: ${config.cameras.ids.join(', ')}`);
  console.log(`   • Server Port: ${config.server.port}`);
  console.log(`   • Segment Duration: ${config.hls.segmentDuration}s`);
  console.log(`   • Retention Period: ${config.storage.retentionMinutes} minutes`);
  console.log(`   • Cleanup Interval: ${config.storage.cleanupIntervalMinutes} minutes`);
  console.log(`   • Max Storage: ${config.storage.maxStorageGB} GB`);
  console.log(`   • HLS Root: ${config.hls.root}`);
  console.log(`   • Low Quality: ${config.quality.low.width}x${config.quality.low.height}@${config.quality.low.fps}fps`);
}

function generateSampleEnv() {
  const envPath = '.env';
  
  if (!fs.existsSync(envPath)) {
    console.log('📝 Generating sample .env file...');
    
    const sampleEnv = `# CCTV Streaming API Configuration
# Copy from .env.example and modify as needed

# Server Configuration
PORT=3000
NODE_ENV=development
GRACEFUL_SHUTDOWN_TIMEOUT=30000
CACHE_CONTROL_MAX_AGE=31536000

# Camera Configuration  
CAMERA_IDS=1,102,202
RTSP_USER=admin
RTSP_PASS=password123
RTSP_HOST=192.168.1.100
RTSP_PORT=554
RTSP_TRANSPORT=tcp

# HLS Configuration
HLS_ROOT=hls
SEGMENT_DURATION=5
HLS_LIST_SIZE=6
HLS_FLAGS=delete_segments+append_list

# Quality Settings
LOW_QUALITY_WIDTH=854
LOW_QUALITY_HEIGHT=480
LOW_QUALITY_FPS=12
LOW_QUALITY_BITRATE=800k
LOW_QUALITY_PRESET=veryfast
LOW_QUALITY_PROFILE=baseline
LOW_QUALITY_LEVEL=3.0

# Audio Settings
AUDIO_CODEC=aac
AUDIO_BITRATE=64k
AUDIO_SAMPLE_RATE=22050

# Storage and Cleanup
RETENTION_MINUTES=30
CLEANUP_INTERVAL_MINUTES=5
MAX_STORAGE_GB=100
INITIAL_CLEANUP_DELAY_SECONDS=5
EMERGENCY_CLEANUP_THRESHOLD=95
WARNING_THRESHOLD=80
ORPHANED_FILE_MAX_AGE_HOURS=1

# FFmpeg Configuration
FFMPEG_PATH=ffmpeg
FFMPEG_LOG_LEVEL=error

# Recording Configuration
ENABLE_RECORDING=false
RECORDING_FORMAT=mp4
RECORDING_SEGMENT_MINUTES=60

# System Configuration
MAX_RESTART_ATTEMPTS=5
RESTART_DELAY_SECONDS=10
HEALTH_CHECK_INTERVAL_SECONDS=30
STREAM_RESTART_PAUSE_SECONDS=2
ALL_CAMERAS_RESTART_PAUSE_SECONDS=3
PLAYLIST_STALE_THRESHOLD_MINUTES=5

# Monitoring and Logging
ENABLE_MONITORING=true
LOG_LEVEL=info
LOG_RETENTION_DAYS=7

# Log File Configuration
LOG_MAX_FILE_SIZE=10485760
LOG_MAX_FILES=5
CLEANUP_LOG_MAX_SIZE=5242880
CLEANUP_LOG_MAX_FILES=2
STREAM_LOG_MAX_FILES=3
SYSTEM_LOG_MAX_FILES=3

# PM2 Configuration
PM2_INSTANCES=1
PM2_MAX_MEMORY_RESTART=2G
PM2_MAX_RESTARTS=10
PM2_MIN_UPTIME=10s
PM2_RESTART_DELAY=5000
PM2_KILL_TIMEOUT=30000
PM2_LISTEN_TIMEOUT=10000
PM2_HEALTH_CHECK_GRACE_PERIOD=30000
NODE_MAX_OLD_SPACE_SIZE=4096

# CORS Configuration
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_ALLOWED_HEADERS=Content-Type,Authorization

# Request Limits
REQUEST_JSON_LIMIT=10mb
REQUEST_URL_ENCODED_LIMIT=10mb
`;
    
    fs.writeFileSync(envPath, sampleEnv);
    console.log('✅ Sample .env file created');
  } else {
    console.log('✅ .env file already exists');
  }
}

function displayNextSteps() {
  console.log('\n🚀 Setup Complete! Next Steps:');
  console.log('');
  console.log('1. Configure your .env file with actual camera credentials');
  console.log('2. Install dependencies: npm install');
  console.log('3. Test the configuration: npm run dev');
  console.log('4. Start the production server: npm start');
  console.log('');
  console.log('📖 Useful commands:');
  console.log('   • npm start                 - Start production server');
  console.log('   • npm run dev              - Start development server');
  console.log('   • npm run cleanup          - Manual cleanup');
  console.log('');
  console.log('📡 API endpoints (after starting):');
  console.log(`   • http://localhost:${config.server.port}/api`);
  console.log(`   • http://localhost:${config.server.port}/streams/cameras`);
  console.log(`   • http://localhost:${config.server.port}/streams/status`);
  console.log('');
  console.log('📺 Live streams will be available at:');
  config.cameras.ids.forEach(id => {
    console.log(`   • http://localhost:${config.server.port}/hls/${id}/live/high/index.m3u8`);
    console.log(`   • http://localhost:${config.server.port}/hls/${id}/live/low/index.m3u8`);
  });
}

async function main() {
  console.log('🎬 CCTV Streaming API Setup');
  console.log('============================\n');
  
  try {
    // Run setup tasks
    await setupDirectories();
    validateConfiguration();
    checkSystemRequirements();
    generateSampleEnv();
    displayConfiguration();
    displayNextSteps();
    
    console.log('\n✅ Setup completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  main();
}

module.exports = { setupDirectories, validateConfiguration, checkSystemRequirements }; 