const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const config = require('./config');
const { logger } = require('./logger');

class StreamManager {
    constructor() {
        this.activeStreams = new Map(); // cameraId -> { low: process, high: process }
        this.streamStatus = new Map(); // cameraId -> { low: status, high: status }
        this.restartAttempts = new Map(); // cameraId-quality -> attempts
        this.hourlyTimer = null;
        this.retentionDays = process.env.NODE_ENV === 'production' ? 30 : 1; // 30 days in prod, 1 day in dev
        this.setupHourlyRotation();
        this.setupRetentionCleanup();
        this.setupSegmentMover();
    }

    // Initialize streams for all cameras
    async initializeStreams() {
        logger.info('🚀 Initializing streams for all configured cameras');
        logger.info(`📹 Configured cameras: [${config.cameraIds.join(', ')}]`);
        logger.info(`🌐 RTSP Host: ${config.rtspHost}:${config.rtspPort}`);
        logger.info(`👤 RTSP User: ${config.rtspUser}`);
        logger.info(`🔧 FFmpeg Path: ${config.ffmpegPath}`);
        logger.info(`📅 Retention period: ${this.retentionDays} days`);
        
        for (const cameraId of config.cameraIds) {
            logger.info(`🎬 Starting streams for camera ${cameraId}...`);
            await this.startCameraStreams(cameraId);
        }
        
        logger.info(`✅ Stream initialization completed for ${config.cameraIds.length} cameras`);
    }

    // Start both quality streams for a camera
    async startCameraStreams(cameraId) {
        logger.info(`Starting streams for camera ${cameraId}`);
        
        // Ensure camera directories exist
        await this.ensureCameraDirectories(cameraId);
        
        // Start both quality streams
        await this.startStream(cameraId, 'low');
        await this.startStream(cameraId, 'high');
        
        this.updateStreamStatus(cameraId, 'low', 'starting');
        this.updateStreamStatus(cameraId, 'high', 'starting');
    }

    // Ensure all required directories exist
    async ensureCameraDirectories(cameraId) {
        // Base camera directory
        const cameraDir = path.join(config.paths.hls, cameraId.toString());
        await fs.ensureDir(cameraDir);

        // Live directory
        const liveDir = path.join(cameraDir, 'live');
        await fs.ensureDir(liveDir);
        
        // Recordings directory with date and hour structure
        const date = moment().format('YYYY-MM-DD');
        const hour = moment().format('HH');
        const recordingsDir = path.join(cameraDir, 'recordings', date, hour);
        await fs.ensureDir(recordingsDir);
    }

    // Start a specific quality stream
    async startStream(cameraId, quality) {
        const streamKey = `${cameraId}-${quality}`;
        
        try {
            // Stop existing stream if running
            await this.stopStream(cameraId, quality);
            
            // Ensure directories exist
            await this.ensureCameraDirectories(cameraId);
            
            // Get FFmpeg commands for both live and recording
            const liveCommand = this.getLiveStreamCommand(cameraId, quality);
            const recordCommand = this.getRecordingCommand(cameraId, quality);
            
            // Start both processes
            const [livePath, ...liveArgs] = liveCommand;
            const [recordPath, ...recordArgs] = recordCommand;
            
            // Spawn FFmpeg processes
            const liveProcess = spawn(livePath, liveArgs, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false
            });
            
            const recordProcess = spawn(recordPath, recordArgs, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false
            });

            // Store process references
            if (!this.activeStreams.has(cameraId)) {
                this.activeStreams.set(cameraId, {});
            }
            this.activeStreams.get(cameraId)[quality] = {
                live: liveProcess,
                record: recordProcess
            };

            // Setup process handlers
            this.setupProcessHandlers(liveProcess, cameraId, quality, 'live');
            this.setupProcessHandlers(recordProcess, cameraId, quality, 'record');
            
            logger.info(`✅ Started ${quality} streams for camera ${cameraId}`);
            
        } catch (error) {
            logger.error(`❌ Failed to start ${quality} stream for camera ${cameraId}:`, error.message);
            this.updateStreamStatus(cameraId, quality, 'error');
            
            if (config.autoRestart) {
                this.scheduleRestart(cameraId, quality);
            }
        }
    }

    // Get FFmpeg command for live streaming
    getLiveStreamCommand(cameraId, quality) {
        const liveDir = path.join(config.paths.hls, cameraId.toString(), 'live');
        
        const baseArgs = [
            '-rtsp_transport', 'tcp',
            '-user_agent', 'LibVLC/3.0.0',
            '-i', this.getRtspUrl(cameraId),
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-profile:v', 'baseline',
            '-level', '3.0',
            '-g', '30',
            '-keyint_min', '30',  // Force keyframe every 30 frames
            '-sc_threshold', '0',
            '-bufsize', '2M',     // Increase buffer size
            '-maxrate', '2M',     // Set max bitrate
            '-f', 'hls',
            '-hls_time', '2',     // 2-second segments
            '-hls_list_size', '30', // Keep 1 minute of segments (30 * 2 seconds)
            '-hls_flags', 'delete_segments+append_list+discont_start+split_by_time',
            '-hls_segment_type', 'mpegts',
            '-hls_allow_cache', '0',
            '-hls_segment_filename', path.join(liveDir, 'segment%d.ts'),
            path.join(liveDir, 'live.m3u8')
        ];

        // Add quality-specific settings
        if (quality === 'low') {
            baseArgs.splice(8, 0, '-vf', 'scale=640:360', '-b:v', '800k');
        } else {
            baseArgs.splice(8, 0, '-vf', 'scale=1280:720', '-b:v', '2000k');
        }

        return [config.ffmpegPath, ...baseArgs];
    }

    // Get FFmpeg command for recording
    getRecordingCommand(cameraId, quality) {
        const date = moment().format('YYYY-MM-DD');
        const hour = moment().format('HH');
        const recordingsDir = path.join(config.paths.hls, cameraId.toString(), 'recordings', date, hour);
        
        const baseArgs = [
            '-rtsp_transport', 'tcp',
            '-user_agent', 'LibVLC/3.0.0',
            '-i', this.getRtspUrl(cameraId),
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-profile:v', 'main',
            '-level', '4.0',
            '-g', '60',
            '-keyint_min', '60',
            '-sc_threshold', '0',
            '-bufsize', '4M',
            '-maxrate', '4M',
            '-f', 'hls',
            '-hls_time', '60',    // 1-minute segments
            '-hls_list_size', '0', // Keep all segments
            '-hls_flags', 'append_list+discont_start+split_by_time',
            '-hls_segment_type', 'mpegts',
            '-strftime', '1',     // Enable strftime in segment names
            '-hls_segment_filename', path.join(recordingsDir, '%M.ts'),
            path.join(recordingsDir, 'playlist.m3u8')
        ];

        // Add quality-specific settings
        if (quality === 'low') {
            baseArgs.splice(8, 0, '-vf', 'scale=640:360', '-b:v', '1000k');
        } else {
            baseArgs.splice(8, 0, '-vf', 'scale=1280:720', '-b:v', '2500k');
        }

        return [config.ffmpegPath, ...baseArgs];
    }

    // Setup retention cleanup
    setupRetentionCleanup() {
        // Run cleanup daily at midnight
        setInterval(async () => {
            if (moment().hour() === 0 && moment().minute() === 0) {
                await this.cleanupOldRecordings();
            }
        }, 60000); // Check every minute
    }

    // Cleanup old recordings
    async cleanupOldRecordings() {
        try {
            const cutoffDate = moment().subtract(this.retentionDays, 'days').format('YYYY-MM-DD');
            
            for (const cameraId of config.cameraIds) {
                const cameraDir = path.join(config.paths.hls, cameraId.toString());
                const dates = await fs.readdir(cameraDir);
                
                for (const date of dates) {
                    if (date !== 'live' && date < cutoffDate) {
                        const dateDir = path.join(cameraDir, date);
                        await fs.remove(dateDir);
                        logger.info(`🧹 Cleaned up old recordings for camera ${cameraId} from ${date}`);
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to cleanup old recordings:', error);
        }
    }

    // Setup process event handlers
    setupProcessHandlers(process, cameraId, quality, type) {
        const streamKey = `${cameraId}-${quality}`;
        
        process.stdout.on('data', (data) => {
            const rawMessage = data.toString();
            const message = rawMessage.trim();
            
            // Only log if message has actual visible content (not just whitespace, newlines, or empty)
            if (message && message.length > 0 && message.replace(/\s/g, '').length > 0) {
                logger.info(`FFmpeg stdout [${streamKey}]:`, message);
            }
        });

        process.stderr.on('data', (data) => {
            const rawMessage = data.toString();
            const message = rawMessage.trim();
            
            // Only log if message has actual visible content (not just whitespace, newlines, or empty)
            if (message && message.length > 0 && message.replace(/\s/g, '').length > 0) {
                // Enhanced logging with different levels based on content
                if (message.includes('Error') || message.includes('Failed') || message.includes('Connection refused')) {
                    logger.error(`🔴 FFmpeg ERROR [${streamKey}]:`, message);
                } else if (message.includes('Warning') || message.includes('timeout')) {
                    logger.warn(`🟡 FFmpeg WARNING [${streamKey}]:`, message);
                } else if (message.includes('Opening') || message.includes('Stream') || message.includes('Video:') || message.includes('Audio:')) {
                    logger.info(`🔵 FFmpeg INFO [${streamKey}]:`, message);
                } else {
                    logger.debug(`⚪ FFmpeg DEBUG [${streamKey}]:`, message);
                }
                
                // Look for specific error patterns with detailed logging
                if (message.includes('Connection refused') || message.includes('Network is unreachable')) {
                    logger.error(`🚨 NETWORK ERROR for ${streamKey}: Cannot reach camera at ${this.getRtspUrl(cameraId).replace(/:.*@/, ':***@')}`);
                    this.updateStreamStatus(cameraId, quality, 'network_error');
                } else if (message.includes('Invalid data found') || message.includes('No such file or directory')) {
                    logger.error(`🚨 STREAM ERROR for ${streamKey}: Invalid RTSP stream or wrong URL format`);
                    this.updateStreamStatus(cameraId, quality, 'data_error');
                } else if (message.includes('401 Unauthorized') || message.includes('Authentication failed')) {
                    logger.error(`🚨 AUTH ERROR for ${streamKey}: Wrong username/password for camera`);
                    this.updateStreamStatus(cameraId, quality, 'auth_error');
                } else if (message.includes('404 Not Found') || message.includes('Stream not found')) {
                    logger.error(`🚨 STREAM NOT FOUND for ${streamKey}: Camera channel ${cameraId} does not exist`);
                    this.updateStreamStatus(cameraId, quality, 'not_found');
                }
            }
        });

        process.on('close', (code, signal) => {
            if (code === 0) {
                logger.info(`✅ FFmpeg process ${streamKey} closed cleanly`);
            } else {
                logger.error(`❌ FFmpeg process ${streamKey} closed with ERROR code ${code}, signal ${signal}`);
                if (code === 1) {
                    logger.error(`🔍 Exit code 1 usually means: Connection failed, wrong URL, or authentication issue`);
                } else if (code === 255 || code === -1) {
                    logger.error(`🔍 Exit code ${code} usually means: Network timeout or camera unreachable`);
                }
            }
            
            this.updateStreamStatus(cameraId, quality, code === 0 ? 'stopped' : 'error');
            
            // Remove from active streams
            if (this.activeStreams.has(cameraId)) {
                delete this.activeStreams.get(cameraId)[quality];
            }
            
            // Auto-restart if configured and not manually stopped
            if (config.autoRestart && code !== 0) {
                logger.warn(`🔄 Auto-restarting ${streamKey} due to error (exit code: ${code})`);
                this.scheduleRestart(cameraId, quality);
            }
        });

        process.on('error', (error) => {
            logger.error(`💥 FFmpeg process SPAWN ERROR for ${streamKey}:`, error.message);
            if (error.code === 'ENOENT') {
                logger.error(`🔍 ENOENT error means: FFmpeg not found. Check FFMPEG_PATH in environment`);
            } else if (error.code === 'EACCES') {
                logger.error(`🔍 EACCES error means: Permission denied to run FFmpeg`);
            }
            logger.error(`🔍 Full error:`, error);
            this.updateStreamStatus(cameraId, quality, 'error');
            
            if (config.autoRestart) {
                logger.info(`🔄 Scheduling restart after spawn error for ${streamKey}`);
                this.scheduleRestart(cameraId, quality);
            }
        });

        // Mark as running after successful start
        setTimeout(() => {
            if (process.pid && !process.killed) {
                this.updateStreamStatus(cameraId, quality, 'running');
                this.resetRestartAttempts(cameraId, quality);
            }
        }, 15000); // Increased from 5 seconds to 15 seconds for transcoding startup
    }

    // Stop a specific quality stream
    async stopStream(cameraId, quality) {
        if (this.activeStreams.has(cameraId)) {
            const streams = this.activeStreams.get(cameraId);
            if (streams[quality]) {
                logger.info(`Stopping ${quality} stream for camera ${cameraId}`);
                
                streams[quality].live.kill('SIGTERM');
                streams[quality].record.kill('SIGTERM');
                
                // Force kill after timeout
                setTimeout(() => {
                    if (streams[quality].live && !streams[quality].live.killed) {
                        logger.warn(`Force killing live stream for camera ${cameraId}`);
                        streams[quality].live.kill('SIGKILL');
                    }
                    if (streams[quality].record && !streams[quality].record.killed) {
                        logger.warn(`Force killing recording stream for camera ${cameraId}`);
                        streams[quality].record.kill('SIGKILL');
                    }
                }, 10000); // Increased from 5 seconds to 10 seconds
                
                delete streams[quality];
                this.updateStreamStatus(cameraId, quality, 'stopped');
            }
        }
    }

    // Stop all streams for a camera
    async stopCameraStreams(cameraId) {
        logger.info(`Stopping all streams for camera ${cameraId}`);
        await Promise.all([
            this.stopStream(cameraId, 'low'),
            this.stopStream(cameraId, 'high')
        ]);
    }

    // Stop all streams
    async stopAllStreams() {
        logger.info('Stopping all streams');
        
        const stopPromises = [];
        for (const cameraId of config.cameraIds) {
            stopPromises.push(this.stopCameraStreams(cameraId));
        }
        
        await Promise.all(stopPromises);
        
        // Clear all data structures
        this.activeStreams.clear();
        this.streamStatus.clear();
        this.restartAttempts.clear();
        
        logger.info('All streams stopped');
    }

    // Restart a specific stream
    async restartStream(cameraId, quality) {
        logger.info(`Restarting ${quality} stream for camera ${cameraId}`);
        await this.stopStream(cameraId, quality);
        
        // Wait a moment before restarting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await this.startStream(cameraId, quality);
    }

    // Schedule a restart with exponential backoff
    scheduleRestart(cameraId, quality) {
        const streamKey = `${cameraId}-${quality}`;
        const attempts = this.getRestartAttempts(cameraId, quality);
        
        if (attempts >= 5) {
            logger.error(`Max restart attempts reached for ${streamKey}, giving up`);
            this.updateStreamStatus(cameraId, quality, 'failed');
            return;
        }
        
        const delay = Math.min(1000 * Math.pow(2, attempts), 60000); // Max 1 minute
        logger.info(`Scheduling restart for ${streamKey} in ${delay}ms (attempt ${attempts + 1})`);
        
        setTimeout(async () => {
            this.incrementRestartAttempts(cameraId, quality);
            await this.restartStream(cameraId, quality);
        }, delay);
    }

    // Setup hourly rotation for new playlist files
    setupHourlyRotation() {
        // Check every minute if we need to rotate to a new hour
        this.hourlyTimer = setInterval(() => {
            const currentHour = moment().format('HH-mm');
            
            // If we're at minute 00, start new hour streams
            if (moment().minute() === 0) {
                logger.info(`Rotating to new hour: ${currentHour}`);
                this.rotateAllStreams();
            }
        }, 60000); // Check every minute
    }

    // Rotate all streams to new hour
    async rotateAllStreams() {
        for (const cameraId of config.cameraIds) {
            for (const quality of ['low', 'high']) {
                if (this.isStreamRunning(cameraId, quality)) {
                    // Just restart the stream - FFmpeg will automatically create new files
                    await this.restartStream(cameraId, quality);
                }
            }
        }
    }

    // Status management
    updateStreamStatus(cameraId, quality, status) {
        if (!this.streamStatus.has(cameraId)) {
            this.streamStatus.set(cameraId, {});
        }
        this.streamStatus.get(cameraId)[quality] = {
            status,
            timestamp: moment().toISOString()
        };
        
        logger.debug(`Stream status updated: ${cameraId}-${quality} = ${status}`);
    }

    getStreamStatus(cameraId, quality) {
        if (this.streamStatus.has(cameraId)) {
            return this.streamStatus.get(cameraId)[quality] || { status: 'unknown', timestamp: null };
        }
        return { status: 'unknown', timestamp: null };
    }

    isStreamRunning(cameraId, quality) {
        const status = this.getStreamStatus(cameraId, quality);
        return status.status === 'running';
    }

    // Restart attempt management
    getRestartAttempts(cameraId, quality) {
        const key = `${cameraId}-${quality}`;
        return this.restartAttempts.get(key) || 0;
    }

    incrementRestartAttempts(cameraId, quality) {
        const key = `${cameraId}-${quality}`;
        const current = this.getRestartAttempts(cameraId, quality);
        this.restartAttempts.set(key, current + 1);
    }

    resetRestartAttempts(cameraId, quality) {
        const key = `${cameraId}-${quality}`;
        this.restartAttempts.delete(key);
    }

    // Get comprehensive status for all streams
    getAllStreamStatus() {
        const status = {};
        
        for (const cameraId of config.cameraIds) {
            status[cameraId] = {
                low: this.getStreamStatus(cameraId, 'low'),
                high: this.getStreamStatus(cameraId, 'high'),
                restartAttempts: {
                    low: this.getRestartAttempts(cameraId, 'low'),
                    high: this.getRestartAttempts(cameraId, 'high')
                }
            };
        }
        
        return status;
    }

    // Check stream health
    async checkStreamHealth() {
        const health = {};
        
        for (const cameraId of config.cameraIds) {
            health[cameraId] = {
                low: await this.checkStreamFile(cameraId, 'low'),
                high: await this.checkStreamFile(cameraId, 'high')
            };
        }
        
        return health;
    }

    // Check if stream file exists and is recent
    async checkStreamFile(cameraId, quality) {
        try {
            const streamPath = config.getStreamPath(cameraId, quality);
            
            if (!await fs.pathExists(streamPath)) {
                return { healthy: false, reason: 'file_not_found' };
            }
            
            const stats = await fs.stat(streamPath);
            const ageMs = Date.now() - stats.mtime.getTime();
            const maxAge = 300000; // 5 minutes - more forgiving for hour transitions and startup delays
            
            if (ageMs > maxAge) {
                return { healthy: false, reason: 'file_stale', ageMs };
            }
            
            return { healthy: true, lastModified: stats.mtime };
            
        } catch (error) {
            return { healthy: false, reason: 'check_error', error: error.message };
        }
    }

    // Cleanup on shutdown
    async shutdown() {
        logger.info('Shutting down stream manager');
        
        if (this.hourlyTimer) {
            clearInterval(this.hourlyTimer);
        }
        
        await this.stopAllStreams();
        
        logger.info('Stream manager shutdown complete');
    }

    getStreamDirectory(cameraId) {
        const date = moment().format('YYYY-MM-DD');
        const baseDir = path.join(config.paths.hls, cameraId.toString(), date);
        fs.mkdirSync(baseDir, { recursive: true });
        return baseDir;
    }

    getStreamPath(cameraId, quality) {
        const dir = this.getStreamDirectory(cameraId);
        const hour = moment().format('HH-mm');
        return {
            playlist: path.join(dir, `${hour}-${quality}.m3u8`),
            segment: path.join(dir, `${hour}-${quality}_%03d.ts`)
        };
    }

    getRtspUrl(cameraId) {
        return `rtsp://${config.rtspUser}:${config.rtspPassword}@${config.rtspHost}:${config.rtspPort}/Streaming/Channels/${cameraId}`;
    }

    // Setup segment mover
    setupSegmentMover() {
        setInterval(async () => {
            for (const cameraId of config.cameraIds) {
                await this.moveOldSegments(cameraId);
            }
        }, 30000); // Check every 30 seconds
    }

    // Move old segments from live to recordings
    async moveOldSegments(cameraId) {
        try {
            const liveDir = path.join(config.paths.hls, cameraId.toString(), 'live');
            const files = await fs.readdir(liveDir);
            const now = moment();

            for (const file of files) {
                if (!file.endsWith('.ts')) continue;

                const filePath = path.join(liveDir, file);
                const stats = await fs.stat(filePath);
                const fileAge = moment().diff(moment(stats.mtime), 'seconds');

                // Move segments older than 60 seconds
                if (fileAge > 60) {
                    const date = moment(stats.mtime).format('YYYY-MM-DD');
                    const hour = moment(stats.mtime).format('HH');
                    const minute = moment(stats.mtime).format('mm');
                    
                    const recordingsDir = path.join(
                        config.paths.hls,
                        cameraId.toString(),
                        'recordings',
                        date,
                        hour
                    );

                    await fs.ensureDir(recordingsDir);
                    const targetPath = path.join(recordingsDir, `${minute}.ts`);

                    try {
                        await fs.move(filePath, targetPath, { overwrite: true });
                        logger.debug(`Moved old segment: ${file} to ${targetPath}`);
                    } catch (moveError) {
                        logger.error(`Failed to move segment ${file}:`, moveError);
                    }
                }
            }
        } catch (error) {
            logger.error(`Error moving old segments for camera ${cameraId}:`, error);
        }
    }
}

module.exports = new StreamManager(); 