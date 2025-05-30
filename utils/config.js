const path = require('path');
const fs = require('fs-extra');
const moment = require('moment');
const logger = require('../utils/logger');

class Config {
    constructor() {
        this.loadEnvironment();
        this.validateConfig();
        this.setupPaths();
    }

    loadEnvironment() {
        require('dotenv').config();
        
        // Core server settings
        this.nodeEnv = process.env.NODE_ENV || 'development';
        this.port = parseInt(process.env.PORT) || 3000;
        this.host = process.env.HOST || 'localhost';
        
        // Camera configuration
        this.cameraIds = process.env.CAMERA_IDS ? 
            process.env.CAMERA_IDS.split(',').map(id => id.trim()) : ['102'];
        this.rtspUser = process.env.RTSP_USER || 'admin';
        this.rtspPassword = process.env.RTSP_PASSWORD || process.env.RTSP_PASS || '';
        this.rtspHost = process.env.RTSP_HOST || '192.168.0.105';
        this.rtspPort = parseInt(process.env.RTSP_PORT) || 554;
        
        // Stream settings
        this.fps = parseInt(process.env.FPS) || 12;
        this.retentionDays = this.nodeEnv === 'development' ? 
            parseInt(process.env.RETENTION_DAYS_DEV) || 1 :
            parseInt(process.env.RETENTION_DAYS) || 30;
        
        // FFmpeg settings
        this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
        
        // Quality settings
        this.lowQuality = {
            width: parseInt(process.env.LOW_QUALITY_WIDTH) || 854,
            height: parseInt(process.env.LOW_QUALITY_HEIGHT) || 480,
            bitrate: process.env.LOW_QUALITY_BITRATE || '1000k'
        };
        
        // Logging
        this.logLevel = process.env.LOG_LEVEL || (this.isDevelopment() ? 'debug' : 'info');
        this.logFilePath = process.env.LOG_FILE_PATH || './logs';
        
        // Other settings
        this.autoRestart = process.env.AUTO_RESTART === 'true';
        this.debugMode = process.env.DEBUG_MODE === 'true';
        this.streamTimeout = parseInt(process.env.STREAM_TIMEOUT) || 30000;

        // Retention settings
        this.minMotionRetentionDays = parseInt(process.env.MIN_MOTION_RETENTION_DAYS) || 7;
        this.maxStoragePerCamera = parseInt(process.env.MAX_STORAGE_PER_CAMERA) || 50;
        this.keepMotionEvents = process.env.KEEP_MOTION_EVENTS === 'true';
        this.quotaAction = process.env.QUOTA_ACTION || 'delete-oldest';
        this.storageCheckInterval = parseInt(process.env.STORAGE_CHECK_INTERVAL) || 15;

        this.paths = {
            hls: path.join(__dirname, '..', 'hls'),
            logs: path.join(__dirname, '..', 'logs'),
            public: path.join(__dirname, '..', 'public')
        };

        this.hlsOptions = {
            time: 2,
            listSize: 900,
            flags: 'delete_segments+append_list+discont_start+split_by_time',
            segmentType: 'mpegts',
            initTime: 2,
            allowCache: 0,
            baseDir: 'live'
        };
    }

    validateConfig() {
        const required = [
            'rtspUser', 'rtspPassword', 'rtspHost', 'cameraIds'
        ];
        
        for (const field of required) {
            if (!this[field] || (Array.isArray(this[field]) && this[field].length === 0)) {
                throw new Error(`Required configuration field missing: ${field}`);
            }
        }
        
        if (this.cameraIds.length === 0) {
            throw new Error('At least one camera ID must be configured');
        }
    }

    setupPaths() {
        this.basePath = path.resolve(__dirname, '..');
        this.hlsPath = path.join(this.basePath, 'hls');
        this.publicPath = path.join(this.basePath, 'public');
        this.logsPath = path.resolve(this.logFilePath);
        
        // Ensure base directories exist
        fs.ensureDirSync(this.hlsPath);
        console.log(`📁 Created HLS directory: ${this.hlsPath}`);
        
        fs.ensureDirSync(this.publicPath);
        console.log(`📁 Created public directory: ${this.publicPath}`);
        
        fs.ensureDirSync(this.logsPath);
        console.log(`📁 Created logs directory: ${this.logsPath}`);
    }

    // Path generators for new folder structure: hls/{CAMERA_ID}/{YYYY-MM-DD}/{HH-mm}.m3u8
    getStreamPath(cameraId, quality) {
        const date = moment().format('YYYY-MM-DD');
        const hour = moment().format('HH-mm');
        return path.join(
            this.hlsPath,
            cameraId.toString(),
            date,
            `${hour}-${quality}.m3u8`
        );
    }

    getStreamDirectory(cameraId, date = null) {
        if (!date) date = moment().format('YYYY-MM-DD');
        const dir = path.join(this.hlsPath, cameraId.toString(), date);
        fs.ensureDirSync(dir);
        return dir;
    }

    getCameraDirectory(cameraId) {
        return path.join(this.hlsPath, cameraId.toString());
    }

    // RTSP URL generator
    getRtspUrl(cameraId) {
        // URL encode the password to handle special characters like @ symbol
        const encodedPassword = encodeURIComponent(this.rtspPassword);
        return `rtsp://${this.rtspUser}:${encodedPassword}@${this.rtspHost}:${this.rtspPort}/Streaming/Channels/${cameraId}`;
    }

    // Stream URL generators for API responses
    getStreamUrl(cameraId, quality = 'low', date = null, hour = null) {
        if (!date) date = moment().format('YYYY-MM-DD');
        if (!hour) hour = moment().format('HH-mm');
        
        return `/hls/${cameraId}/${date}/${hour}-${quality}.m3u8`;
    }

    // Live stream URL (current hour)
    getLiveStreamUrl(cameraId, quality = 'low') {
        const date = moment().format('YYYY-MM-DD');
        const hour = moment().format('HH-mm');
        return `/hls/${cameraId}/${date}/${hour}-${quality}.m3u8`;
    }

    // Get available dates for a camera
    getAvailableDates(cameraId) {
        const cameraDir = this.getCameraDirectory(cameraId);
        if (!fs.existsSync(cameraDir)) return [];
        
        return fs.readdirSync(cameraDir)
            .filter(item => fs.statSync(path.join(cameraDir, item)).isDirectory())
            .filter(date => moment(date, 'YYYY-MM-DD').isValid())
            .sort();
    }

    // Get available hours for a camera and date
    getAvailableHours(cameraId, date) {
        const dateDir = this.getStreamDirectory(cameraId, date);
        if (!fs.existsSync(dateDir)) return [];
        
        const hours = new Set();
        fs.readdirSync(dateDir)
            .filter(file => file.endsWith('.m3u8'))
            .forEach(file => {
                const match = file.match(/^(\d{2}-\d{2})-(low|high)\.m3u8$/);
                if (match) {
                    hours.add(match[1]);
                }
            });
        
        return Array.from(hours).sort();
    }

    // Environment helpers
    isDevelopment() {
        return this.nodeEnv === 'development';
    }

    isProduction() {
        return this.nodeEnv === 'production';
    }

    // FFmpeg command generators
    getFFmpegCommand(cameraId, quality) {
        const date = moment().format('YYYY-MM-DD');
        const hour = moment().format('HH-mm');
        const outputDir = path.join(this.hlsPath, cameraId.toString(), date);
        fs.ensureDirSync(outputDir);
        
        // Base arguments for all streams
        const baseArgs = [
            '-rtsp_transport', 'tcp',
            '-user_agent', 'LibVLC/3.0.0',
            '-i', this.getRtspUrl(cameraId),
            '-c:v', 'libx264',  // Transcode to H.264 for better compatibility
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-profile:v', 'baseline',
            '-level', '3.0',
            '-g', '30',  // Keyframe interval
            '-sc_threshold', '0',  // Disable scene change detection
            '-f', 'hls',
            '-hls_time', '2',
            '-hls_list_size', '900',  // Keep 30 minutes of segments (900 * 2 seconds)
            '-hls_flags', 'delete_segments+append_list+discont_start+split_by_time',
            '-hls_segment_type', 'mpegts',
            '-hls_init_time', '2',
            '-hls_allow_cache', '0',
            '-hls_segment_filename', path.join(outputDir, `${hour}-${quality}_%03d.ts`),
            path.join(outputDir, `${hour}-${quality}.m3u8`)
        ];

        return [this.ffmpegPath, ...baseArgs];
    }

    // Configuration summary for debugging
    getSummary() {
        return {
            environment: this.nodeEnv,
            server: { 
                host: this.host || 'localhost', 
                port: this.port || 3000 
            },
            cameras: this.cameraIds || [],
            rtsp: {
                host: this.rtspHost,
                port: this.rtspPort,
                user: this.rtspUser,
                cameras: this.cameraIds
            },
            retention: `${this.retentionDays || 1} days`,
            qualities: ['low (480p)', 'high (native)'],
            fps: this.fps || 12,
            autoRestart: this.autoRestart || false,
            paths: {
                hls: this.hlsPath || './hls',
                logs: this.logsPath || './logs',
                public: this.publicPath || './public'
            },
            minMotionRetentionDays: this.minMotionRetentionDays || 7,
            maxStoragePerCamera: this.maxStoragePerCamera || 50,
            keepMotionEvents: this.keepMotionEvents || false,
            quotaAction: this.quotaAction || 'delete-oldest',
            storageCheckInterval: this.storageCheckInterval || 15
        };
    }
}

module.exports = new Config(); 