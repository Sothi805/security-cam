const path = require('path');
const fs = require('fs-extra');
const moment = require('moment');

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
        this.rtspPassword = process.env.RTSP_PASSWORD || '';
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
        
        // Ensure directories exist
        fs.ensureDirSync(this.hlsPath);
        fs.ensureDirSync(this.publicPath);
        fs.ensureDirSync(this.logsPath);
    }

    // Path generators for new folder structure: hls/{CAMERA_ID}/{YYYY-MM-DD}/{HH-mm}.m3u8
    getStreamPath(cameraId, quality = 'low', date = null, hour = null) {
        if (!date) date = moment().format('YYYY-MM-DD');
        if (!hour) hour = moment().format('HH-mm');
        
        return path.join(this.hlsPath, cameraId.toString(), date, `${hour}-${quality}.m3u8`);
    }

    getStreamDirectory(cameraId, date = null) {
        if (!date) date = moment().format('YYYY-MM-DD');
        return path.join(this.hlsPath, cameraId.toString(), date);
    }

    getCameraDirectory(cameraId) {
        return path.join(this.hlsPath, cameraId.toString());
    }

    // RTSP URL generator
    getRtspUrl(cameraId) {
        const channelId = cameraId; // Direct mapping for now
        // URL encode the password to handle special characters like @ symbol
        const encodedPassword = encodeURIComponent(this.rtspPassword);
        return `rtsp://${this.rtspUser}:${encodedPassword}@${this.rtspHost}:${this.rtspPort}/Streaming/Channels/${channelId}`;
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
        const rtspUrl = this.getRtspUrl(cameraId);
        const date = moment().format('YYYY-MM-DD');
        const hour = moment().format('HH-mm');
        const outputPath = this.getStreamPath(cameraId, quality, date, hour);
        
        // Ensure output directory exists
        fs.ensureDirSync(path.dirname(outputPath));
        
        let command = [
            this.ffmpegPath,
            // Simplified RTSP options that work with ffplay
            '-rtsp_transport', 'tcp',
            '-user_agent', 'LibVLC/3.0.0',  // Critical for Hikvision compatibility
            '-i', rtspUrl,
            '-c:v', quality === 'low' ? 'libx264' : 'copy',
            '-c:a', quality === 'low' ? 'aac' : 'copy'
        ];

        if (quality === 'low') {
            command.push(
                '-s', `${this.lowQuality.width}x${this.lowQuality.height}`,
                '-r', this.fps.toString(),
                '-b:v', this.lowQuality.bitrate,
                '-maxrate', this.lowQuality.bitrate,
                '-bufsize', `${parseInt(this.lowQuality.bitrate) * 2}k`
            );
        }

        command.push(
            '-f', 'hls',
            '-hls_time', '6',
            '-hls_list_size', '10',
            '-hls_flags', 'delete_segments',
            '-hls_segment_filename', path.join(path.dirname(outputPath), `${hour}-${quality}_%03d.ts`),
            outputPath
        );

        return command;
    }

    // Configuration summary for debugging
    getSummary() {
        return {
            environment: this.nodeEnv,
            server: { host: this.host, port: this.port },
            cameras: this.cameraIds,
            retention: `${this.retentionDays} days`,
            qualities: ['low (480p)', 'high (native)'],
            fps: this.fps,
            autoRestart: this.autoRestart,
            paths: {
                hls: this.hlsPath,
                logs: this.logsPath,
                public: this.publicPath
            }
        };
    }
}

module.exports = new Config(); 