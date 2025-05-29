const fs = require('fs');
const path = require('path');

class ConfigValidator {
    constructor(config) {
        this.config = config;
        this.errors = [];
        this.warnings = [];
    }

    validate() {
        this.validateServer();
        this.validateCameras();
        this.validateVideo();
        this.validateStorage();
        this.validateSystem();
        this.validateLogging();
        this.validatePM2();

        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings
        };
    }

    validateServer() {
        // Port validation (1-65535)
        if (this.config.server.port < 1 || this.config.server.port > 65535) {
            this.errors.push(`Invalid PORT: ${this.config.server.port}. Must be between 1-65535`);
        }

        // Timeout validation (1-300 seconds)
        const timeoutSeconds = this.config.server.gracefulShutdownTimeout / 1000;
        if (timeoutSeconds < 1 || timeoutSeconds > 300) {
            this.warnings.push(`GRACEFUL_SHUTDOWN_TIMEOUT: ${timeoutSeconds}s. Recommended: 30-120s`);
        }

        // Cache age validation (0-1 year in seconds)
        if (this.config.server.cacheControlMaxAge < 0 || this.config.server.cacheControlMaxAge > 31536000) {
            this.warnings.push(`CACHE_CONTROL_MAX_AGE: ${this.config.server.cacheControlMaxAge}s. Recommended: 3600-31536000s`);
        }
    }

    validateCameras() {
        // Camera IDs validation
        if (!Array.isArray(this.config.cameras.ids) || this.config.cameras.ids.length === 0) {
            this.errors.push('CAMERA_IDS: Must contain at least one camera ID');
        }

        // RTSP port validation
        if (this.config.cameras.rtsp.port < 1 || this.config.cameras.rtsp.port > 65535) {
            this.errors.push(`RTSP_PORT: ${this.config.cameras.rtsp.port}. Must be between 1-65535`);
        }

        // RTSP transport validation
        if (!['tcp', 'udp'].includes(this.config.cameras.rtsp.transport)) {
            this.errors.push(`RTSP_TRANSPORT: ${this.config.cameras.rtsp.transport}. Must be 'tcp' or 'udp'`);
        }

        // IP address validation (basic)
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(this.config.cameras.rtsp.host)) {
            this.warnings.push(`RTSP_HOST: ${this.config.cameras.rtsp.host}. Should be a valid IP address`);
        }
    }

    validateVideo() {
        const video = this.config.quality.low;
        const audio = this.config.quality.audio;

        // Resolution validation
        if (video.width < 320 || video.width > 1920) {
            this.warnings.push(`LOW_QUALITY_WIDTH: ${video.width}px. Recommended: 320-1920px`);
        }
        if (video.height < 240 || video.height > 1080) {
            this.warnings.push(`LOW_QUALITY_HEIGHT: ${video.height}px. Recommended: 240-1080px`);
        }

        // Frame rate validation
        if (video.fps < 1 || video.fps > 60) {
            this.warnings.push(`LOW_QUALITY_FPS: ${video.fps}fps. Recommended: 8-30fps`);
        }

        // Bitrate validation (parse k/M suffix)
        const bitrateMatch = video.bitrate.match(/^(\d+)([kM])$/);
        if (!bitrateMatch) {
            this.errors.push(`LOW_QUALITY_BITRATE: ${video.bitrate}. Must be in format like '400k' or '2M'`);
        } else {
            const value = parseInt(bitrateMatch[1]);
            const unit = bitrateMatch[2];
            if (unit === 'k' && (value < 100 || value > 10000)) {
                this.warnings.push(`LOW_QUALITY_BITRATE: ${video.bitrate}. Recommended: 100k-10000k`);
            } else if (unit === 'M' && (value < 1 || value > 50)) {
                this.warnings.push(`LOW_QUALITY_BITRATE: ${video.bitrate}. Recommended: 1M-50M`);
            }
        }

        // Preset validation
        const validPresets = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'];
        if (!validPresets.includes(video.preset)) {
            this.errors.push(`LOW_QUALITY_PRESET: ${video.preset}. Must be one of: ${validPresets.join(', ')}`);
        }

        // Profile validation
        const validProfiles = ['baseline', 'main', 'high'];
        if (!validProfiles.includes(video.profile)) {
            this.errors.push(`LOW_QUALITY_PROFILE: ${video.profile}. Must be one of: ${validProfiles.join(', ')}`);
        }

        // Audio sample rate validation
        const validSampleRates = [8000, 16000, 22050, 44100, 48000];
        if (!validSampleRates.includes(audio.sampleRate)) {
            this.warnings.push(`AUDIO_SAMPLE_RATE: ${audio.sampleRate}Hz. Recommended: ${validSampleRates.join(', ')}Hz`);
        }
    }

    validateStorage() {
        const storage = this.config.storage;

        // Retention validation (1 minute to 1 year)
        if (storage.retentionMinutes < 1 || storage.retentionMinutes > 525600) {
            this.warnings.push(`RETENTION_MINUTES: ${storage.retentionMinutes}. Recommended: 60-43200 (1h-30d)`);
        }

        // Storage limit validation
        if (storage.maxStorageGB < 1 || storage.maxStorageGB > 10000) {
            this.warnings.push(`MAX_STORAGE_GB: ${storage.maxStorageGB}GB. Recommended: 10-1000GB`);
        }

        // Cleanup interval validation
        if (storage.cleanupIntervalMinutes < 1 || storage.cleanupIntervalMinutes > 1440) {
            this.warnings.push(`CLEANUP_INTERVAL_MINUTES: ${storage.cleanupIntervalMinutes}. Recommended: 5-60 minutes`);
        }

        // Threshold validation (percentages)
        if (storage.warningThreshold < 50 || storage.warningThreshold > 95) {
            this.warnings.push(`WARNING_THRESHOLD: ${storage.warningThreshold}%. Recommended: 70-90%`);
        }
        if (storage.emergencyCleanupThreshold < 90 || storage.emergencyCleanupThreshold > 99) {
            this.warnings.push(`EMERGENCY_CLEANUP_THRESHOLD: ${storage.emergencyCleanupThreshold}%. Recommended: 90-98%`);
        }
        if (storage.emergencyCleanupThreshold <= storage.warningThreshold) {
            this.errors.push('EMERGENCY_CLEANUP_THRESHOLD must be higher than WARNING_THRESHOLD');
        }
    }

    validateSystem() {
        const system = this.config.system;

        // Restart attempts validation
        if (system.maxRestartAttempts < 1 || system.maxRestartAttempts > 100) {
            this.warnings.push(`MAX_RESTART_ATTEMPTS: ${system.maxRestartAttempts}. Recommended: 3-15`);
        }

        // Delay validation
        if (system.restartDelaySeconds < 1 || system.restartDelaySeconds > 300) {
            this.warnings.push(`RESTART_DELAY_SECONDS: ${system.restartDelaySeconds}s. Recommended: 5-60s`);
        }

        // Health check interval validation
        if (system.healthCheckIntervalSeconds < 10 || system.healthCheckIntervalSeconds > 3600) {
            this.warnings.push(`HEALTH_CHECK_INTERVAL_SECONDS: ${system.healthCheckIntervalSeconds}s. Recommended: 30-300s`);
        }
    }

    validateLogging() {
        const monitoring = this.config.monitoring;
        const logging = this.config.logging;

        // Log level validation
        const validLogLevels = ['error', 'warn', 'info', 'debug'];
        if (!validLogLevels.includes(monitoring.logLevel)) {
            this.errors.push(`LOG_LEVEL: ${monitoring.logLevel}. Must be one of: ${validLogLevels.join(', ')}`);
        }

        // Log retention validation
        if (monitoring.logRetentionDays < 1 || monitoring.logRetentionDays > 365) {
            this.warnings.push(`LOG_RETENTION_DAYS: ${monitoring.logRetentionDays}. Recommended: 7-90 days`);
        }

        // File size validation (1MB to 100MB)
        if (logging.maxFileSize < 1048576 || logging.maxFileSize > 104857600) {
            this.warnings.push(`LOG_MAX_FILE_SIZE: ${logging.maxFileSize} bytes. Recommended: 5MB-50MB`);
        }
    }

    validatePM2() {
        const pm2 = this.config.pm2;

        // Instance count validation
        if (pm2.instances < 1 || pm2.instances > 16) {
            this.warnings.push(`PM2_INSTANCES: ${pm2.instances}. Recommended: 1 for streaming applications`);
        }

        // Memory limit validation (parse G/M suffix)
        const memoryMatch = pm2.maxMemoryRestart.match(/^(\d+)([GM])$/);
        if (!memoryMatch) {
            this.errors.push(`PM2_MAX_MEMORY_RESTART: ${pm2.maxMemoryRestart}. Must be in format like '2G' or '512M'`);
        } else {
            const value = parseInt(memoryMatch[1]);
            const unit = memoryMatch[2];
            if (unit === 'M' && value < 512) {
                this.warnings.push(`PM2_MAX_MEMORY_RESTART: ${pm2.maxMemoryRestart}. Recommended minimum: 512M`);
            } else if (unit === 'G' && value > 32) {
                this.warnings.push(`PM2_MAX_MEMORY_RESTART: ${pm2.maxMemoryRestart}. Consider if system has enough RAM`);
            }
        }

        // Node heap size validation
        if (pm2.nodeMaxOldSpaceSize < 512 || pm2.nodeMaxOldSpaceSize > 32768) {
            this.warnings.push(`NODE_MAX_OLD_SPACE_SIZE: ${pm2.nodeMaxOldSpaceSize}MB. Recommended: 1024-8192MB`);
        }
    }

    // Check file system permissions
    validateFileSystem() {
        const hlsPath = this.config.hls.root;
        
        try {
            // Check if HLS directory exists and is writable
            if (!fs.existsSync(hlsPath)) {
                this.warnings.push(`HLS_ROOT directory does not exist: ${hlsPath}`);
            } else {
                fs.accessSync(hlsPath, fs.constants.W_OK);
            }
        } catch (error) {
            this.errors.push(`HLS_ROOT directory not writable: ${hlsPath}`);
        }

        // Check logs directory
        const logsPath = path.resolve('logs');
        try {
            if (!fs.existsSync(logsPath)) {
                fs.mkdirSync(logsPath, { recursive: true });
            } else {
                fs.accessSync(logsPath, fs.constants.W_OK);
            }
        } catch (error) {
            this.errors.push(`Logs directory not writable: ${logsPath}`);
        }
    }

    // Generate configuration summary
    generateSummary() {
        const storage = this.config.storage;
        const video = this.config.quality.low;
        
        // Calculate estimated storage usage
        const bytesPerPixel = 0.1; // Rough estimate for H.264
        const bytesPerSecond = video.width * video.height * video.fps * bytesPerPixel / 8;
        const mbPerHour = (bytesPerSecond * 3600) / (1024 * 1024);
        const gbPerDay = (mbPerHour * 24) / 1024;
        const totalGbPerDay = gbPerDay * this.config.cameras.ids.length;

        return {
            cameras: this.config.cameras.ids.length,
            videoQuality: `${video.width}x${video.height}@${video.fps}fps`,
            estimatedStorage: {
                perCameraPerDay: `${gbPerDay.toFixed(2)} GB`,
                totalPerDay: `${totalGbPerDay.toFixed(2)} GB`,
                retentionDays: Math.floor(storage.retentionMinutes / 1440),
                totalNeeded: `${(totalGbPerDay * Math.floor(storage.retentionMinutes / 1440)).toFixed(2)} GB`
            },
            storageLimit: `${storage.maxStorageGB} GB`,
            environment: this.config.server.nodeEnv
        };
    }
}

module.exports = ConfigValidator; 