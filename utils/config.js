require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT) || 30000,
    cacheControlMaxAge: parseInt(process.env.CACHE_CONTROL_MAX_AGE) || 31536000 // 1 year default
  },

  // Camera Configuration
  cameras: {
    ids: process.env.CAMERA_IDS ? process.env.CAMERA_IDS.split(',').map(id => id.trim()) : ['1', '102', '202'],
    rtsp: {
      user: process.env.RTSP_USER || 'admin',
      pass: process.env.RTSP_PASS || 'password123',
      host: process.env.RTSP_HOST || '192.168.1.100',
      port: parseInt(process.env.RTSP_PORT) || 554,
      transport: process.env.RTSP_TRANSPORT || 'tcp'
    }
  },

  // HLS Configuration
  hls: {
    root: process.env.HLS_ROOT || 'hls',
    segmentDuration: parseInt(process.env.SEGMENT_DURATION) || 5,
    listSize: parseInt(process.env.HLS_LIST_SIZE) || 6,
    flags: process.env.HLS_FLAGS || 'delete_segments+append_list'
  },

  // Quality Settings
  quality: {
    low: {
      width: parseInt(process.env.LOW_QUALITY_WIDTH) || 854,
      height: parseInt(process.env.LOW_QUALITY_HEIGHT) || 480,
      fps: parseInt(process.env.LOW_QUALITY_FPS) || 12,
      bitrate: process.env.LOW_QUALITY_BITRATE || '800k',
      preset: process.env.LOW_QUALITY_PRESET || 'veryfast',
      profile: process.env.LOW_QUALITY_PROFILE || 'baseline',
      level: process.env.LOW_QUALITY_LEVEL || '3.0'
    },
    audio: {
      codec: process.env.AUDIO_CODEC || 'aac',
      bitrate: process.env.AUDIO_BITRATE || '64k',
      sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE) || 22050
    }
  },

  // Storage and Cleanup
  storage: {
    retentionMinutes: parseInt(process.env.RETENTION_MINUTES) || 30,
    cleanupIntervalMinutes: parseInt(process.env.CLEANUP_INTERVAL_MINUTES) || 5,
    maxStorageGB: parseInt(process.env.MAX_STORAGE_GB) || 100,
    initialCleanupDelaySeconds: parseInt(process.env.INITIAL_CLEANUP_DELAY_SECONDS) || 5,
    emergencyCleanupThreshold: parseInt(process.env.EMERGENCY_CLEANUP_THRESHOLD) || 95,
    warningThreshold: parseInt(process.env.WARNING_THRESHOLD) || 80,
    orphanedFileMaxAgeHours: parseInt(process.env.ORPHANED_FILE_MAX_AGE_HOURS) || 1
  },

  // FFmpeg Configuration
  ffmpeg: {
    path: process.env.FFMPEG_PATH || 'ffmpeg',
    logLevel: process.env.FFMPEG_LOG_LEVEL || 'error'
  },

  // Recording Configuration
  recording: {
    enabled: process.env.ENABLE_RECORDING === 'true',
    format: process.env.RECORDING_FORMAT || 'mp4',
    segmentMinutes: parseInt(process.env.RECORDING_SEGMENT_MINUTES) || 60
  },

  // System Configuration
  system: {
    maxRestartAttempts: parseInt(process.env.MAX_RESTART_ATTEMPTS) || 5,
    restartDelaySeconds: parseInt(process.env.RESTART_DELAY_SECONDS) || 10,
    healthCheckIntervalSeconds: parseInt(process.env.HEALTH_CHECK_INTERVAL_SECONDS) || 30,
    streamRestartPauseSeconds: parseInt(process.env.STREAM_RESTART_PAUSE_SECONDS) || 2,
    allCamerasRestartPauseSeconds: parseInt(process.env.ALL_CAMERAS_RESTART_PAUSE_SECONDS) || 3,
    playlistStaleThresholdMinutes: parseInt(process.env.PLAYLIST_STALE_THRESHOLD_MINUTES) || 5
  },

  // Monitoring and Logging
  monitoring: {
    enabled: process.env.ENABLE_MONITORING === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
    logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 7
  },

  // Log File Configuration
  logging: {
    maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE) || 10485760, // 10MB default
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
    cleanupLogMaxSize: parseInt(process.env.CLEANUP_LOG_MAX_SIZE) || 5242880, // 5MB default
    cleanupLogMaxFiles: parseInt(process.env.CLEANUP_LOG_MAX_FILES) || 2,
    streamLogMaxFiles: parseInt(process.env.STREAM_LOG_MAX_FILES) || 3,
    systemLogMaxFiles: parseInt(process.env.SYSTEM_LOG_MAX_FILES) || 3
  },

  // PM2 Configuration (for ecosystem file generation)
  pm2: {
    instances: parseInt(process.env.PM2_INSTANCES) || 1,
    maxMemoryRestart: process.env.PM2_MAX_MEMORY_RESTART || '2G',
    maxRestarts: parseInt(process.env.PM2_MAX_RESTARTS) || 10,
    minUptime: process.env.PM2_MIN_UPTIME || '10s',
    restartDelay: parseInt(process.env.PM2_RESTART_DELAY) || 5000,
    killTimeout: parseInt(process.env.PM2_KILL_TIMEOUT) || 30000,
    listenTimeout: parseInt(process.env.PM2_LISTEN_TIMEOUT) || 10000,
    healthCheckGracePeriod: parseInt(process.env.PM2_HEALTH_CHECK_GRACE_PERIOD) || 30000,
    nodeMaxOldSpaceSize: parseInt(process.env.NODE_MAX_OLD_SPACE_SIZE) || 4096
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: process.env.CORS_METHODS ? process.env.CORS_METHODS.split(',') : ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: process.env.CORS_ALLOWED_HEADERS ? process.env.CORS_ALLOWED_HEADERS.split(',') : ['Content-Type', 'Authorization']
  },

  // Request Limits
  requests: {
    jsonLimit: process.env.REQUEST_JSON_LIMIT || '10mb',
    urlEncodedLimit: process.env.REQUEST_URL_ENCODED_LIMIT || '10mb'
  }
};

// Validation
function validateConfig() {
  const errors = [];

  if (config.cameras.ids.length === 0) {
    errors.push('At least one camera ID must be specified');
  }

  if (config.hls.segmentDuration < 1 || config.hls.segmentDuration > 60) {
    errors.push('Segment duration must be between 1 and 60 seconds');
  }

  if (config.storage.retentionMinutes < 1) {
    errors.push('Retention period must be at least 1 minute');
  }

  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Server port must be between 1 and 65535');
  }

  if (config.cameras.rtsp.port < 1 || config.cameras.rtsp.port > 65535) {
    errors.push('RTSP port must be between 1 and 65535');
  }

  if (config.quality.low.fps < 1 || config.quality.low.fps > 60) {
    errors.push('Low quality FPS must be between 1 and 60');
  }

  if (config.storage.emergencyCleanupThreshold < 50 || config.storage.emergencyCleanupThreshold > 99) {
    errors.push('Emergency cleanup threshold must be between 50 and 99 percent');
  }

  if (config.storage.warningThreshold < 50 || config.storage.warningThreshold >= config.storage.emergencyCleanupThreshold) {
    errors.push('Warning threshold must be between 50 and emergency cleanup threshold');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

validateConfig();

module.exports = config; 