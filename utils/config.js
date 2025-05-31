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
        this.fps = parseInt(process.env.FPS) || 15;
        this.retentionDays = this.nodeEnv === 'development' ? 
            parseInt(process.env.RETENTION_DAYS) || 1 :
            parseInt(process.env.RETENTION_DAYS) || 30;
        
        // FFmpeg settings
        this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
        
        // Logging
        this.logLevel = process.env.LOG_LEVEL || (this.isDevelopment() ? 'debug' : 'info');
        this.logFilePath = process.env.LOG_FILE_PATH || './logs';
        
        // Other settings
        this.autoRestart = process.env.AUTO_RESTART === 'true';
        this.debugMode = process.env.DEBUG_MODE === 'true';
        this.streamTimeout = parseInt(process.env.STREAM_TIMEOUT) || 30000;
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

        // Create camera directories with new proper structure
        if (this.cameraIds && this.cameraIds.length > 0) {
            for (const cameraId of this.cameraIds) {
                // Camera base directory: hls/{camera_id}/
                const cameraDir = path.join(this.hlsPath, cameraId.toString());
                fs.ensureDirSync(cameraDir);
                console.log(`📁 Created camera directory: ${cameraDir}`);

                // Live directory structure: hls/{camera_id}/live/
                const liveDir = path.join(cameraDir, 'live');
                fs.ensureDirSync(liveDir);
                console.log(`📁 Created live directory: ${liveDir}`);

                // Recordings directory structure: hls/{camera_id}/recordings/
                const recordingsDir = path.join(cameraDir, 'recordings');
                fs.ensureDirSync(recordingsDir);
                console.log(`📁 Created recordings directory: ${recordingsDir}`);

                // Current date directory: hls/{camera_id}/recordings/YYYY-MM-DD/
                const currentDate = moment().format('YYYY-MM-DD');
                const dateDir = path.join(recordingsDir, currentDate);
                fs.ensureDirSync(dateDir);
                console.log(`📁 Created date directory: ${dateDir}`);

                // Current hour directory: hls/{camera_id}/recordings/YYYY-MM-DD/HH/
                const currentHour = moment().format('HH');
                const hourDir = path.join(dateDir, currentHour);
                fs.ensureDirSync(hourDir);
                console.log(`📁 Created hour directory: ${hourDir}`);
            }
        }

        // Clean up any old structure remnants
        this.cleanupOldStructure();
    }

    // Clean up old directory structure
    cleanupOldStructure() {
        try {
            const rootDirs = fs.readdirSync(this.hlsPath);
            for (const dir of rootDirs) {
                const fullPath = path.join(this.hlsPath, dir);
                
                // Remove old root-level live/recordings directories if they exist
                if (dir === 'live' || dir === 'recordings') {
                    fs.removeSync(fullPath);
                    console.log(`🗑️ Removed old root directory: ${fullPath}`);
                }
                
                // Check camera directories for old quality subdirectories
                if (this.cameraIds.includes(dir)) {
                    const cameraPath = fullPath;
                    const livePath = path.join(cameraPath, 'live');
                    
                    if (fs.existsSync(livePath)) {
                        const liveContents = fs.readdirSync(livePath);
                        
                        // Remove old quality directories
                        for (const item of liveContents) {
                            if (item === 'high' || item === 'low') {
                                const qualityPath = path.join(livePath, item);
                                fs.removeSync(qualityPath);
                                console.log(`🗑️ Removed old quality directory: ${qualityPath}`);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error cleaning up old structure:', error);
        }
    }

    // Get camera base directory
    getCameraDirectory(cameraId) {
        return path.join(this.hlsPath, cameraId.toString());
    }

    // Get live directory for camera
    getLiveDirectory(cameraId) {
        return path.join(this.getCameraDirectory(cameraId), 'live');
    }

    // Get recordings directory for camera
    getRecordingsDirectory(cameraId, date = null, hour = null) {
        let recordingsPath = path.join(this.getCameraDirectory(cameraId), 'recordings');
        
        if (date) {
            recordingsPath = path.join(recordingsPath, date);
            if (hour) {
                recordingsPath = path.join(recordingsPath, hour);
            }
        }
        
        return recordingsPath;
    }

    // RTSP URL generator for Hikvision cameras
    getRtspUrl(cameraId) {
        // Manually encode @ as %40 for Hikvision compatibility
        const encodedPassword = this.rtspPassword.replace(/@/g, '%40');
        return `rtsp://${this.rtspUser}:${encodedPassword}@${this.rtspHost}:${this.rtspPort}/Streaming/Channels/${cameraId}`;
    }

    // Live stream URL (new format)
    getLiveStreamUrl(cameraId) {
        return `/hls/${cameraId}/live/live.m3u8`;
    }

    // Recording stream URL (new format)
    getRecordingStreamUrl(cameraId, date, hour) {
        return `/hls/${cameraId}/recordings/${date}/${hour}/playlist.m3u8`;
    }

    // Get available dates for a camera
    getAvailableDates(cameraId) {
        try {
            const recordingsDir = this.getRecordingsDirectory(cameraId);
            
            if (!fs.existsSync(recordingsDir)) {
                return [];
            }

            const items = fs.readdirSync(recordingsDir);
            const dates = items.filter(item => {
                const itemPath = path.join(recordingsDir, item);
                const stats = fs.statSync(itemPath);
                return stats.isDirectory() && moment(item, 'YYYY-MM-DD', true).isValid();
            });
            
            return dates.sort().reverse(); // Most recent first
        } catch (error) {
            return [];
        }
    }

    // Get available hours for a camera and date
    getAvailableHours(cameraId, date) {
        try {
            const dateDir = this.getRecordingsDirectory(cameraId, date);
            
            if (!fs.existsSync(dateDir)) {
                return [];
            }

            const items = fs.readdirSync(dateDir);
            const hours = items.filter(item => {
                const itemPath = path.join(dateDir, item);
                const stats = fs.statSync(itemPath);
                return stats.isDirectory() && /^\d{2}$/.test(item);
            });
            
            return hours.sort(); // Chronological order
        } catch (error) {
            return [];
        }
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
            quality: 'Native (no re-encoding)',
            fps: this.fps || 15,
            autoRestart: this.autoRestart || false,
            paths: {
                hls: this.hlsPath || './hls',
                logs: this.logsPath || './logs',
                public: this.publicPath || './public'
            }
        };
    }
}

module.exports = new Config(); 