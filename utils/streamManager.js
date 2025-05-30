const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const config = require('./config');
const { logger } = require('./logger');

class StreamManager {
    constructor() {
        this.activeStreams = new Map(); // cameraId -> process
        this.streamStatus = new Map(); // cameraId -> status
        this.restartAttempts = new Map(); // cameraId -> attempts
        this.hourlyTimer = null;
        this.retentionDays = process.env.NODE_ENV === 'production' ? 30 : 1;
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
            logger.info(`🎬 Starting stream for camera ${cameraId}...`);
            await this.startCameraStream(cameraId);
        }
    }

    // Start stream for a camera
    async startCameraStream(cameraId) {
        logger.info(`Starting stream for camera ${cameraId}`);
        
        // Ensure camera directories exist
        await this.ensureCameraDirectories(cameraId);
        
        // Start stream
        await this.startStream(cameraId);
        
        this.updateStreamStatus(cameraId, 'starting');
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

    // Start a stream
    async startStream(cameraId) {
        try {
            // Stop existing stream if running
            await this.stopStream(cameraId);
            
            // Ensure directories exist
            await this.ensureCameraDirectories(cameraId);
            
            // Get FFmpeg commands for both live and recording
            const liveCommand = this.getLiveStreamCommand(cameraId);
            const recordCommand = this.getRecordingCommand(cameraId);
            
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
            this.activeStreams.set(cameraId, {
                live: liveProcess,
                record: recordProcess
            });

            // Setup process handlers
            this.setupProcessHandlers(liveProcess, cameraId, 'live');
            this.setupProcessHandlers(recordProcess, cameraId, 'record');
            
            logger.info(`✅ Started streams for camera ${cameraId}`);
            
        } catch (error) {
            logger.error(`❌ Failed to start stream for camera ${cameraId}:`, error.message);
            this.updateStreamStatus(cameraId, 'error');
            
            if (config.autoRestart) {
                this.scheduleRestart(cameraId);
            }
        }
    }

    // Get FFmpeg command for live streaming
    getLiveStreamCommand(cameraId) {
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
            '-vf', 'scale=640:360',
            '-b:v', '800k',
            '-maxrate', '856k',
            '-bufsize', '2M',
            '-g', '30',
            '-keyint_min', '30',
            '-sc_threshold', '0',
            '-f', 'hls',
            '-hls_time', '2',
            '-hls_list_size', '30',
            '-hls_flags', 'delete_segments+append_list+discont_start+split_by_time',
            '-hls_segment_type', 'mpegts',
            '-hls_allow_cache', '0',
            '-hls_segment_filename', path.join(liveDir, 'segment%d.ts'),
            path.join(liveDir, 'live.m3u8')
        ];

        return [config.ffmpegPath, ...baseArgs];
    }

    // Get FFmpeg command for recording
    getRecordingCommand(cameraId) {
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
            '-vf', 'scale=640:360',
            '-b:v', '1000k',
            '-maxrate', '1200k',
            '-bufsize', '4M',
            '-g', '60',
            '-keyint_min', '60',
            '-sc_threshold', '0',
            '-f', 'hls',
            '-hls_time', '60',
            '-hls_list_size', '0',
            '-hls_flags', 'append_list+discont_start+split_by_time',
            '-hls_segment_type', 'mpegts',
            '-strftime', '1',
            '-hls_segment_filename', path.join(recordingsDir, '%M.ts'),
            path.join(recordingsDir, 'playlist.m3u8')
        ];

        return [config.ffmpegPath, ...baseArgs];
    }

    // Stop a stream
    async stopStream(cameraId) {
        if (this.activeStreams.has(cameraId)) {
            const streams = this.activeStreams.get(cameraId);
            logger.info(`Stopping stream for camera ${cameraId}`);
            
            if (streams.live) streams.live.kill('SIGTERM');
            if (streams.record) streams.record.kill('SIGTERM');
            
            // Force kill after timeout
            setTimeout(() => {
                if (streams.live && !streams.live.killed) {
                    logger.warn(`Force killing live stream for camera ${cameraId}`);
                    streams.live.kill('SIGKILL');
                }
                if (streams.record && !streams.record.killed) {
                    logger.warn(`Force killing recording stream for camera ${cameraId}`);
                    streams.record.kill('SIGKILL');
                }
            }, 10000);
            
            this.activeStreams.delete(cameraId);
            this.updateStreamStatus(cameraId, 'stopped');
        }
    }

    // Stop all streams
    async stopAllStreams() {
        logger.info('Stopping all streams');
        
        const stopPromises = [];
        for (const cameraId of config.cameraIds) {
            stopPromises.push(this.stopStream(cameraId));
        }
        
        await Promise.all(stopPromises);
        
        // Clear all data structures
        this.activeStreams.clear();
        this.streamStatus.clear();
        this.restartAttempts.clear();
        
        logger.info('All streams stopped');
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
    setupProcessHandlers(process, cameraId, type) {
        const streamKey = `${cameraId}-${type}`;
        
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
                    this.updateStreamStatus(cameraId, 'network_error');
                } else if (message.includes('Invalid data found') || message.includes('No such file or directory')) {
                    logger.error(`🚨 STREAM ERROR for ${streamKey}: Invalid RTSP stream or wrong URL format`);
                    this.updateStreamStatus(cameraId, 'data_error');
                } else if (message.includes('401 Unauthorized') || message.includes('Authentication failed')) {
                    logger.error(`🚨 AUTH ERROR for ${streamKey}: Wrong username/password for camera`);
                    this.updateStreamStatus(cameraId, 'auth_error');
                } else if (message.includes('404 Not Found') || message.includes('Stream not found')) {
                    logger.error(`🚨 STREAM NOT FOUND for ${streamKey}: Camera channel ${cameraId} does not exist`);
                    this.updateStreamStatus(cameraId, 'not_found');
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
            
            this.updateStreamStatus(cameraId, code === 0 ? 'stopped' : 'error');
            
            // Remove from active streams
            if (this.activeStreams.has(cameraId)) {
                delete this.activeStreams.get(cameraId)[type];
            }
            
            // Auto-restart if configured and not manually stopped
            if (config.autoRestart && code !== 0) {
                logger.warn(`🔄 Auto-restarting ${streamKey} due to error (exit code: ${code})`);
                this.scheduleRestart(cameraId);
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
            this.updateStreamStatus(cameraId, 'error');
            
            if (config.autoRestart) {
                logger.info(`�� Scheduling restart after spawn error for ${streamKey}`);
                this.scheduleRestart(cameraId);
            }
        });

        // Mark as running after successful start
        setTimeout(() => {
            if (process.pid && !process.killed) {
                this.updateStreamStatus(cameraId, 'running');
                this.resetRestartAttempts(cameraId);
            }
        }, 15000); // Increased from 5 seconds to 15 seconds for transcoding startup
    }

    // Schedule a restart with exponential backoff
    scheduleRestart(cameraId) {
        const streamKey = `${cameraId}-live`;
        const attempts = this.getRestartAttempts(cameraId);
        
        if (attempts >= 5) {
            logger.error(`Max restart attempts reached for ${streamKey}, giving up`);
            this.updateStreamStatus(cameraId, 'failed');
            return;
        }
        
        const delay = Math.min(1000 * Math.pow(2, attempts), 60000); // Max 1 minute
        logger.info(`Scheduling restart for ${streamKey} in ${delay}ms (attempt ${attempts + 1})`);
        
        setTimeout(async () => {
            this.incrementRestartAttempts(cameraId);
            await this.restartStream(cameraId);
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
            if (this.isStreamRunning(cameraId)) {
                // Just restart the stream - FFmpeg will automatically create new files
                await this.restartStream(cameraId);
            }
        }
    }

    // Status management
    updateStreamStatus(cameraId, status) {
        if (!this.streamStatus.has(cameraId)) {
            this.streamStatus.set(cameraId, {});
        }
        this.streamStatus.get(cameraId)['status'] = status;
        this.streamStatus.get(cameraId)['timestamp'] = moment().toISOString();
        
        logger.debug(`Stream status updated: ${cameraId} = ${status}`);
    }

    getStreamStatus(cameraId) {
        if (this.streamStatus.has(cameraId)) {
            return this.streamStatus.get(cameraId) || { status: 'unknown', timestamp: null };
        }
        return { status: 'unknown', timestamp: null };
    }

    isStreamRunning(cameraId) {
        const status = this.getStreamStatus(cameraId);
        return status.status === 'running';
    }

    // Restart attempt management
    getRestartAttempts(cameraId) {
        const key = `${cameraId}-live`;
        return this.restartAttempts.get(key) || 0;
    }

    incrementRestartAttempts(cameraId) {
        const key = `${cameraId}-live`;
        const current = this.getRestartAttempts(cameraId);
        this.restartAttempts.set(key, current + 1);
    }

    resetRestartAttempts(cameraId) {
        const key = `${cameraId}-live`;
        this.restartAttempts.delete(key);
    }

    // Get comprehensive status for all streams
    getAllStreamStatus() {
        const status = {};
        
        for (const cameraId of config.cameraIds) {
            status[cameraId] = this.getStreamStatus(cameraId);
        }
        
        return status;
    }

    // Check stream health
    async checkStreamHealth() {
        const health = {};
        
        for (const cameraId of config.cameraIds) {
            health[cameraId] = await this.checkStreamFile(cameraId);
        }
        
        return health;
    }

    // Check if stream file exists and is recent
    async checkStreamFile(cameraId) {
        try {
            const streamPath = config.getStreamPath(cameraId);
            
            if (!await fs.pathExists(streamPath)) {
                return { healthy: false, reason: 'file_not_found' };
            }
            
            const stats = await fs.stat(streamPath);
            const ageMs = Date.now() - stats.mtime.getTime();
            const maxAge = 120000; // 2 minutes - give FFmpeg time to start and transcode
            
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

    getStreamPath(cameraId) {
        const dir = this.getStreamDirectory(cameraId);
        const hour = moment().format('HH-mm');
        return {
            playlist: path.join(dir, `${hour}-live.m3u8`),
            segment: path.join(dir, `${hour}-live_%03d.ts`)
        };
    }

    getRtspUrl(cameraId) {
        return `rtsp://${config.rtspUser}:${config.rtspPassword}@${config.rtspHost}:${config.rtspPort}/Streaming/Channels/${cameraId}`;
    }
}

module.exports = new StreamManager(); 