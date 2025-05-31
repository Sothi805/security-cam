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

        // Set up paths object for easy access
        this.paths = {
            hls: this.hlsPath,
            logs: this.logsPath,
            public: this.publicPath
        };

        // Create camera directories with proper structure
        if (this.cameraIds && this.cameraIds.length > 0) {
            for (const cameraId of this.cameraIds) {
                // Camera base directory
                const cameraDir = path.join(this.hlsPath, cameraId.toString());
                fs.ensureDirSync(cameraDir);
                console.log(`📁 Created camera directory: ${cameraDir}`);

                // Live directory structure
                const liveDir = path.join(cameraDir, 'live');
                fs.ensureDirSync(liveDir);
                console.log(`📁 Created live directory: ${liveDir}`);

                // Recordings directory structure
                const recordingsDir = path.join(cameraDir, 'recordings');
                fs.ensureDirSync(recordingsDir);
                console.log(`📁 Created recordings directory: ${recordingsDir}`);

                // Current date directory
                const currentDate = moment().format('YYYY-MM-DD');
                const dateDir = path.join(recordingsDir, currentDate);
                fs.ensureDirSync(dateDir);
                console.log(`📁 Created date directory: ${dateDir}`);

                // Current hour directory
                const currentHour = moment().format('HH');
                const hourDir = path.join(dateDir, currentHour);
                fs.ensureDirSync(hourDir);
                console.log(`📁 Created hour directory: ${hourDir}`);
            }
        }

        // Remove any stray directories at root level
        try {
            const rootDirs = fs.readdirSync(this.hlsPath);
            for (const dir of rootDirs) {
                const fullPath = path.join(this.hlsPath, dir);
                if (dir === 'live' || dir === 'recordings') {
                    fs.removeSync(fullPath);
                    console.log(`🗑️ Removed stray directory: ${fullPath}`);
                }
            }
        } catch (error) {
            console.error('Error cleaning up stray directories:', error);
        }
    }

    // Path generators for new folder structure: hls/{CAMERA_ID}/{YYYY-MM-DD}/{HH-mm}-live.m3u8
    getStreamPath(cameraId, date = null, hour = null) {
        if (!date) date = moment().format('YYYY-MM-DD');
        if (!hour) hour = moment().format('HH-mm');
        return path.join(
            this.hlsPath,
            cameraId.toString(),
            date,
            `${hour}-live.m3u8`
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
        // URL encode the password to handle special characters
        const encodedPassword = encodeURIComponent(this.rtspPassword);
        // Hikvision format: /Streaming/Channels/{id}
        return `rtsp://${this.rtspUser}:${encodedPassword}@${this.rtspHost}:${this.rtspPort}/Streaming/Channels/${cameraId}`;
    }

    // Stream URL generators for API responses
    getStreamUrl(cameraId, date = null, hour = null) {
        if (!date) date = moment().format('YYYY-MM-DD');
        if (!hour) hour = moment().format('HH-mm');
        
        return `/hls/${cameraId}/${date}/${hour}-live.m3u8`;
    }

    // Live stream URL (current hour)
    getLiveStreamUrl(cameraId) {
        return `/hls/${cameraId}/live/live.m3u8`;
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
                const match = file.match(/^(\d{2}-\d{2})-live\.m3u8$/);
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
            quality: 'Single stream (480p)',
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