const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const config = require('./config');
const { logger } = require('./logger');
const { PathUtils } = require('./pathUtils');

class StreamManager {
    constructor() {
        this.activeStreams = new Map(); // cameraId -> process
        this.streamStatus = new Map(); // cameraId -> status
        this.restartAttempts = new Map(); // cameraId -> attempts
        this.hourlyTimer = null;
        this.retentionDays = process.env.NODE_ENV === 'production' ? 30 : 1;
        this.setupHourlyRotation();
        this.setupRetentionCleanup();
        this.pathUtils = new PathUtils();
        this.init();
    }

    async init() {
        await this.pathUtils.init();
        // Clean up old structure and ensure new structure
        await this.migrateToNewStructure();
    }

    // Migrate from old structure to new structure
    async migrateToNewStructure() {
        logger.info('🔄 Migrating to new HLS file structure...');
        
        for (const cameraId of config.cameraIds) {
            const cameraDir = path.join(config.paths.hls, cameraId.toString());
            
            // Remove old quality-based directories if they exist
            const oldHighDir = path.join(cameraDir, 'live', 'high');
            const oldLowDir = path.join(cameraDir, 'live', 'low');
            
            if (await fs.pathExists(oldHighDir)) {
                await fs.remove(oldHighDir);
                logger.info(`🗑️ Removed old high quality directory for camera ${cameraId}`);
            }
            
            if (await fs.pathExists(oldLowDir)) {
                await fs.remove(oldLowDir);
                logger.info(`🗑️ Removed old low quality directory for camera ${cameraId}`);
            }
            
            // Ensure new structure exists
            await this.ensureCameraDirectories(cameraId);
        }
        
        logger.info('✅ Migration to new HLS structure completed');
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

    // Ensure all required directories exist with new structure
    async ensureCameraDirectories(cameraId) {
        // Base camera directory: hls/{camera_id}/
        const cameraDir = path.join(config.paths.hls, cameraId.toString());
        await fs.ensureDir(cameraDir);

        // Live directory: hls/{camera_id}/live/
        const liveDir = path.join(cameraDir, 'live');
        await fs.ensureDir(liveDir);
        
        // Recordings directory: hls/{camera_id}/recordings/
        const recordingsBaseDir = path.join(cameraDir, 'recordings');
        await fs.ensureDir(recordingsBaseDir);
        
        // Current date and hour directories: hls/{camera_id}/recordings/YYYY-MM-DD/HH/
        const date = moment().format('YYYY-MM-DD');
        const hour = moment().format('HH');
        const recordingsDir = path.join(recordingsBaseDir, date, hour);
        await fs.ensureDir(recordingsDir);
        
        logger.debug(`✅ Directory structure ensured for camera ${cameraId}:`);
        logger.debug(`   📁 ${cameraDir}`);
        logger.debug(`   📁 ${liveDir}`);
        logger.debug(`   📁 ${recordingsDir}`);
    }

    // Get FFmpeg command for dual output (live streaming + recording)
    getDualOutputCommand(cameraId) {
        const cameraDir = path.join(config.paths.hls, cameraId.toString());
        const liveDir = path.join(cameraDir, 'live');
        const recordingsBaseDir = path.join(cameraDir, 'recordings');
        
        // Ensure directories exist
        fs.ensureDirSync(liveDir);
        fs.ensureDirSync(recordingsBaseDir);
        
        const date = moment().format('YYYY-MM-DD');
        const hour = moment().format('HH');
        const recordingsDir = path.join(recordingsBaseDir, date, hour);
        fs.ensureDirSync(recordingsDir);
        
        logger.info(`Setting up native quality stream for camera ${cameraId}:`);
        logger.info(`Live: ${liveDir}`);
        logger.info(`Recordings: ${recordingsDir}`);
        
        const rtspUrl = this.getRtspUrl(cameraId);
        
        // Simple live stream only - native quality with copy
        const args = [
            '-y',  // Overwrite output files
            '-rtsp_transport', 'tcp',
            '-user_agent', 'SecurityCam/1.0',
            '-i', rtspUrl,
            
            // Input options for stability
            '-fflags', '+genpts',
            '-avoid_negative_ts', 'make_zero',
            '-max_delay', '5000000',
            '-rtbufsize', '100M',
            '-stimeout', '20000000',
            '-timeout', '20000000',
            
            // Native quality - just copy streams
            '-c', 'copy',
            
            // HLS output for live streaming
            '-f', 'hls',
            '-hls_time', '2',
            '-hls_list_size', '3',
            '-hls_flags', 'delete_segments+append_list+omit_endlist',
            '-hls_segment_type', 'mpegts',
            '-hls_allow_cache', '0',
            '-hls_segment_filename', path.join(liveDir, 'segment%d.ts'),
            path.join(liveDir, 'live.m3u8')
        ];

        return [config.ffmpegPath, ...args];
    }

    // Start separate recording process
    async startRecordingProcess(cameraId) {
        try {
            const cameraDir = path.join(config.paths.hls, cameraId.toString());
            const recordingsBaseDir = path.join(cameraDir, 'recordings');
            
            const date = moment().format('YYYY-MM-DD');
            const hour = moment().format('HH');
            const recordingsDir = path.join(recordingsBaseDir, date, hour);
            fs.ensureDirSync(recordingsDir);
            
            const rtspUrl = this.getRtspUrl(cameraId);
            
            // Recording process - native quality
            const recordingArgs = [
                '-y',
                '-rtsp_transport', 'tcp',
                '-user_agent', 'SecurityCam/1.0',
                '-i', rtspUrl,
                
                '-fflags', '+genpts',
                '-avoid_negative_ts', 'make_zero',
                '-max_delay', '5000000',
                '-rtbufsize', '100M',
                '-stimeout', '20000000',
                '-timeout', '20000000',
                
                // Native quality - copy
                '-c', 'copy',
                
                // Recording HLS output
                '-f', 'hls',
                '-hls_time', '60',
                '-hls_list_size', '0',
                '-hls_flags', 'append_list+split_by_time',
                '-hls_segment_type', 'mpegts',
                '-strftime', '1',
                '-hls_segment_filename', path.join(recordingsDir, '%M.ts'),
                path.join(recordingsDir, 'playlist.m3u8')
            ];

            const recordingProcess = spawn(config.ffmpegPath, recordingArgs, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false,
                windowsHide: true
            });

            if (recordingProcess.pid) {
                this.activeStreams.set(`${cameraId}-recording`, recordingProcess);
                this.setupProcessHandlers(recordingProcess, cameraId, 'recording');
                logger.info(`✅ Started recording process for camera ${cameraId} (PID: ${recordingProcess.pid})`);
            }
        } catch (error) {
            logger.error(`Failed to start recording process for camera ${cameraId}:`, error);
        }
    }

    // Start stream for a camera (simplified single process)
    async startStream(cameraId) {
        try {
            // Stop existing streams if running
            await this.stopStream(cameraId);
            
            // Ensure directories exist
            await this.ensureCameraDirectories(cameraId);
            
            // Get FFmpeg command for live stream only
            const ffmpegCommand = this.getDualOutputCommand(cameraId);
            
            // Mask sensitive information in logs
            const maskCommand = (cmd) => {
                return cmd.map(arg => {
                    if (arg.includes('@') && arg.includes('rtsp://')) {
                        return arg.replace(/:[^:@]+@/, ':***@');
                    }
                    return arg;
                });
            };
            
            logger.info(`Starting FFmpeg live stream for camera ${cameraId}:`);
            logger.info(`Command: ${maskCommand(ffmpegCommand).join(' ')}`);
            
            // Start live stream process
            const [ffmpegPath, ...args] = ffmpegCommand;
            
            const ffmpegProcess = spawn(ffmpegPath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false,
                windowsHide: true
            });

            if (!ffmpegProcess.pid) {
                throw new Error(`Failed to start FFmpeg process for camera ${cameraId}`);
            }

            // Store process reference
            this.activeStreams.set(cameraId, ffmpegProcess);

            // Setup process handlers
            this.setupProcessHandlers(ffmpegProcess, cameraId, 'live');
            
            logger.info(`✅ Started live stream for camera ${cameraId} (PID: ${ffmpegProcess.pid})`);
            
            // Start separate recording process
            setTimeout(() => {
                this.startRecordingProcess(cameraId);
            }, 3000); // Start recording 3 seconds after live stream
            
            this.updateStreamStatus(cameraId, 'running');
            
        } catch (error) {
            logger.error(`❌ Failed to start stream for camera ${cameraId}:`, error.message);
            logger.error('Stack trace:', error.stack);
            this.updateStreamStatus(cameraId, 'error');
            
            if (config.autoRestart) {
                this.scheduleRestart(cameraId);
            }
        }
    }

    // Stop a stream
    async stopStream(cameraId) {
        try {
            // Stop live stream
            if (this.activeStreams.has(cameraId)) {
                const process = this.activeStreams.get(cameraId);
                logger.info(`Stopping live stream for camera ${cameraId}`);
                
                if (process && !process.killed) {
                    process.kill('SIGTERM');
                    
                    setTimeout(() => {
                        if (process && !process.killed) {
                            logger.warn(`Force killing live stream for camera ${cameraId}`);
                            process.kill('SIGKILL');
                        }
                    }, 5000);
                }
                
                this.activeStreams.delete(cameraId);
            }
            
            // Stop recording stream
            const recordingKey = `${cameraId}-recording`;
            if (this.activeStreams.has(recordingKey)) {
                const recordingProcess = this.activeStreams.get(recordingKey);
                logger.info(`Stopping recording stream for camera ${cameraId}`);
                
                if (recordingProcess && !recordingProcess.killed) {
                    recordingProcess.kill('SIGTERM');
                    
                    setTimeout(() => {
                        if (recordingProcess && !recordingProcess.killed) {
                            logger.warn(`Force killing recording stream for camera ${cameraId}`);
                            recordingProcess.kill('SIGKILL');
                        }
                    }, 5000);
                }
                
                this.activeStreams.delete(recordingKey);
            }
            
            this.updateStreamStatus(cameraId, 'stopped');
        } catch (error) {
            logger.error(`Error stopping streams for camera ${cameraId}:`, error);
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

    // Setup hourly rotation for recordings
    setupHourlyRotation() {
        // Check every minute and rotate at the start of each hour
        this.hourlyTimer = setInterval(async () => {
            const now = moment();
            if (now.minute() === 0 && now.second() < 30) {
                logger.info('🔄 Starting hourly rotation...');
                await this.rotateAllStreams();
            }
        }, 30000); // Check every 30 seconds
    }

    // Rotate all streams to new hour directories
    async rotateAllStreams() {
        for (const cameraId of config.cameraIds) {
            try {
                if (this.isStreamRunning(cameraId)) {
                    logger.info(`🔄 Rotating recording for camera ${cameraId} to new hour`);
                    
                    // Stop current recording process
                    const recordingKey = `${cameraId}-recording`;
                    if (this.activeStreams.has(recordingKey)) {
                        const recordingProcess = this.activeStreams.get(recordingKey);
                        if (recordingProcess && !recordingProcess.killed) {
                            recordingProcess.kill('SIGTERM');
                        }
                        this.activeStreams.delete(recordingKey);
                    }
                    
                    // Ensure new hour directory exists and restart recording
                    await this.ensureCameraDirectories(cameraId);
                    
                    // Start new recording process for new hour
                    setTimeout(() => {
                        this.startRecordingProcess(cameraId);
                    }, 2000);
                }
            } catch (error) {
                logger.error(`Failed to rotate recording for camera ${cameraId}:`, error);
            }
        }
    }

    // Setup retention cleanup
    setupRetentionCleanup() {
        // Run cleanup every hour
        setInterval(async () => {
            await this.cleanupOldRecordings();
        }, 3600000); // Every hour
    }

    // Cleanup old recordings based on retention policy
    async cleanupOldRecordings() {
        try {
            const cutoffDate = moment().subtract(this.retentionDays, 'days').format('YYYY-MM-DD');
            logger.info(`🧹 Cleaning up recordings older than ${cutoffDate}`);
            
            for (const cameraId of config.cameraIds) {
                const cameraDir = path.join(config.paths.hls, cameraId.toString());
                const recordingsDir = path.join(cameraDir, 'recordings');
                
                if (!await fs.pathExists(recordingsDir)) continue;
                
                const dates = await fs.readdir(recordingsDir);
                
                for (const date of dates) {
                    if (date < cutoffDate) {
                        const dateDir = path.join(recordingsDir, date);
                        await fs.remove(dateDir);
                        logger.info(`🗑️ Cleaned up old recordings for camera ${cameraId} from ${date}`);
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
            
            // Log important messages
            if (message && message.length > 0 && message.replace(/\s/g, '').length > 0) {
                if (message.includes('error') || message.includes('failed') || message.includes('warning')) {
                    logger.warn(`FFmpeg [${streamKey}]: ${message}`);
                } else if (config.debugMode) {
                    logger.debug(`FFmpeg [${streamKey}]: ${message}`);
                }
            }
        });

        process.stderr.on('data', (data) => {
            const rawMessage = data.toString();
            const message = rawMessage.trim();
            
            if (message && message.length > 0) {
                // Filter out common non-error messages
                if (!message.includes('frame=') && 
                    !message.includes('fps=') && 
                    !message.includes('size=') && 
                    !message.includes('time=') && 
                    !message.includes('bitrate=') && 
                    !message.includes('speed=')) {
                    
                    if (message.includes('error') || message.includes('failed')) {
                        logger.error(`FFmpeg [${streamKey}]: ${message}`);
                    } else if (message.includes('warning')) {
                        logger.warn(`FFmpeg [${streamKey}]: ${message}`);
                    } else if (config.debugMode) {
                        logger.debug(`FFmpeg [${streamKey}]: ${message}`);
                    }
                }
            }
        });

        process.on('close', (code) => {
            if (code !== 0) {
                logger.error(`FFmpeg process [${streamKey}] exited with code ${code}`);
                this.updateStreamStatus(cameraId, 'error');
                
                if (config.autoRestart && this.getRestartAttempts(cameraId) < 5) {
                    this.scheduleRestart(cameraId);
                }
            } else {
                logger.info(`FFmpeg process [${streamKey}] ended normally`);
            }
        });

        process.on('error', (error) => {
            logger.error(`FFmpeg process [${streamKey}] error:`, error);
            this.updateStreamStatus(cameraId, 'error');
            
            if (config.autoRestart) {
                this.scheduleRestart(cameraId);
            }
        });

        // Update status to running when process starts successfully
        setTimeout(() => {
            if (process && !process.killed) {
                this.updateStreamStatus(cameraId, 'running');
                this.resetRestartAttempts(cameraId);
                logger.info(`✅ Stream for camera ${cameraId} is running (PID: ${process.pid})`);
            }
        }, 5000);
    }

    // Schedule restart with exponential backoff
    scheduleRestart(cameraId) {
        const attempts = this.incrementRestartAttempts(cameraId);
        const delay = Math.min(1000 * Math.pow(2, attempts), 60000); // Max 1 minute delay
        
        logger.info(`⏰ Scheduling restart for camera ${cameraId} in ${delay}ms (attempt ${attempts})`);
        
        setTimeout(async () => {
            try {
                if (attempts <= 5) {
                    logger.info(`🔄 Restarting camera ${cameraId} (attempt ${attempts})`);
                    await this.startStream(cameraId);
                } else {
                    logger.error(`❌ Max restart attempts reached for camera ${cameraId}`);
                    this.updateStreamStatus(cameraId, 'failed');
                }
            } catch (error) {
                logger.error(`Failed to restart camera ${cameraId}:`, error);
            }
        }, delay);
    }

    updateStreamStatus(cameraId, status) {
        this.streamStatus.set(cameraId, {
            status,
            timestamp: moment().toISOString(),
            restartAttempts: this.getRestartAttempts(cameraId)
        });
        
        logger.debug(`📊 Camera ${cameraId} status: ${status}`);
    }

    getStreamStatus(cameraId) {
        return this.streamStatus.get(cameraId) || { 
            status: 'unknown', 
            timestamp: null,
            restartAttempts: 0
        };
    }

    isStreamRunning(cameraId) {
        const status = this.getStreamStatus(cameraId);
        return status.status === 'running';
    }

    getRestartAttempts(cameraId) {
        return this.restartAttempts.get(cameraId) || 0;
    }

    incrementRestartAttempts(cameraId) {
        const current = this.getRestartAttempts(cameraId);
        const newCount = current + 1;
        this.restartAttempts.set(cameraId, newCount);
        return newCount;
    }

    resetRestartAttempts(cameraId) {
        this.restartAttempts.set(cameraId, 0);
    }

    getAllStreamStatus() {
        const status = {};
        for (const cameraId of config.cameraIds) {
            status[cameraId] = this.getStreamStatus(cameraId);
        }
        return status;
    }

    async checkStreamHealth() {
        const health = {};
        
        for (const cameraId of config.cameraIds) {
            try {
                const streamHealth = await this.pathUtils.getStreamHealth(cameraId);
                health[cameraId] = streamHealth;
            } catch (error) {
                health[cameraId] = {
                    healthy: false,
                    error: error.message,
                    lastCheck: moment().toISOString()
                };
            }
        }
        
        return health;
    }

    async checkStreamFile(cameraId) {
        try {
            const livePlaylist = path.join(config.paths.hls, cameraId.toString(), 'live', 'live.m3u8');
            
            if (!await fs.pathExists(livePlaylist)) {
                return { exists: false, error: 'Live playlist not found' };
            }
            
            const stats = await fs.stat(livePlaylist);
            const age = moment().diff(moment(stats.mtime), 'seconds');
            
            return {
                exists: true,
                lastModified: stats.mtime,
                ageSeconds: age,
                stale: age > 30 // Consider stale if older than 30 seconds
            };
        } catch (error) {
            return { exists: false, error: error.message };
        }
    }

    async shutdown() {
        logger.info('🛑 Shutting down StreamManager...');
        
        if (this.hourlyTimer) {
            clearInterval(this.hourlyTimer);
        }
        
        await this.stopAllStreams();
        logger.info('✅ StreamManager shutdown complete');
    }

    // Helper methods for backward compatibility
    getStreamDirectory(cameraId) {
        return path.join(config.paths.hls, cameraId.toString());
    }

    getLiveDirectory(cameraId) {
        return path.join(this.getStreamDirectory(cameraId), 'live');
    }

    getRecordingsDirectory(cameraId, date = null, hour = null) {
        let recordingsPath = path.join(this.getStreamDirectory(cameraId), 'recordings');
        
        if (date) {
            recordingsPath = path.join(recordingsPath, date);
            if (hour) {
                recordingsPath = path.join(recordingsPath, hour);
            }
        }
        
        return recordingsPath;
    }

    getRtspUrl(cameraId) {
        return config.getRtspUrl(cameraId);
    }

    // Alias for stopping all streams
    async stopAll() {
        return this.stopAllStreams();
    }

    // Stop a specific camera stream (missing method)
    async stopCameraStream(cameraId) {
        logger.info(`Stopping stream for camera ${cameraId}`);
        await this.stopStream(cameraId);
    }
}

module.exports = new StreamManager(); 