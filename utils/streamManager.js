const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const config = require('./config');
const logger = require('./logger');

class StreamManager {
    constructor() {
        this.activeStreams = new Map(); // cameraId -> { low: process, high: process }
        this.streamStatus = new Map(); // cameraId -> { low: status, high: status }
        this.restartAttempts = new Map(); // cameraId-quality -> attempts
        this.hourlyTimer = null;
        this.setupHourlyRotation();
    }

    // Initialize streams for all cameras
    async initializeStreams() {
        logger.info('Initializing streams for all configured cameras');
        
        for (const cameraId of config.cameraIds) {
            await this.startCameraStreams(cameraId);
        }
        
        logger.info(`Initialized streams for ${config.cameraIds.length} cameras`);
    }

    // Start both quality streams for a camera
    async startCameraStreams(cameraId) {
        logger.info(`Starting streams for camera ${cameraId}`);
        
        // Ensure camera directory exists
        const cameraDir = config.getCameraDirectory(cameraId);
        await fs.ensureDir(cameraDir);
        
        // Start both quality streams
        await this.startStream(cameraId, 'low');
        await this.startStream(cameraId, 'high');
        
        this.updateStreamStatus(cameraId, 'low', 'starting');
        this.updateStreamStatus(cameraId, 'high', 'starting');
    }

    // Start a specific quality stream
    async startStream(cameraId, quality) {
        const streamKey = `${cameraId}-${quality}`;
        
        try {
            // Stop existing stream if running
            await this.stopStream(cameraId, quality);
            
            // Get FFmpeg command
            const command = config.getFFmpegCommand(cameraId, quality);
            const [ffmpegPath, ...args] = command;
            
            logger.debug(`Starting ${quality} stream for camera ${cameraId}`, { command: command.join(' ') });
            
            // Spawn FFmpeg process
            const ffmpegProcess = spawn(ffmpegPath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false
            });

            // Store process reference
            if (!this.activeStreams.has(cameraId)) {
                this.activeStreams.set(cameraId, {});
            }
            this.activeStreams.get(cameraId)[quality] = ffmpegProcess;

            // Setup process event handlers
            this.setupProcessHandlers(ffmpegProcess, cameraId, quality);
            
            logger.info(`Started ${quality} stream for camera ${cameraId} (PID: ${ffmpegProcess.pid})`);
            
        } catch (error) {
            logger.error(`Failed to start ${quality} stream for camera ${cameraId}:`, error);
            this.updateStreamStatus(cameraId, quality, 'error');
            
            // Attempt restart if configured
            if (config.autoRestart) {
                this.scheduleRestart(cameraId, quality);
            }
        }
    }

    // Setup process event handlers
    setupProcessHandlers(process, cameraId, quality) {
        const streamKey = `${cameraId}-${quality}`;
        
        process.stdout.on('data', (data) => {
            if (config.debugMode) {
                logger.debug(`FFmpeg stdout [${streamKey}]:`, data.toString().trim());
            }
        });

        process.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (config.debugMode) {
                logger.debug(`FFmpeg stderr [${streamKey}]:`, message);
            }
            
            // Look for error patterns
            if (message.includes('Connection refused') || message.includes('Network is unreachable')) {
                logger.warn(`Network error for ${streamKey}:`, message);
                this.updateStreamStatus(cameraId, quality, 'network_error');
            } else if (message.includes('Invalid data found')) {
                logger.warn(`Invalid data for ${streamKey}:`, message);
                this.updateStreamStatus(cameraId, quality, 'data_error');
            }
        });

        process.on('close', (code, signal) => {
            logger.warn(`FFmpeg process ${streamKey} closed with code ${code}, signal ${signal}`);
            this.updateStreamStatus(cameraId, quality, 'stopped');
            
            // Remove from active streams
            if (this.activeStreams.has(cameraId)) {
                delete this.activeStreams.get(cameraId)[quality];
            }
            
            // Auto-restart if configured and not manually stopped
            if (config.autoRestart && code !== 0) {
                this.scheduleRestart(cameraId, quality);
            }
        });

        process.on('error', (error) => {
            logger.error(`FFmpeg process error for ${streamKey}:`, error);
            this.updateStreamStatus(cameraId, quality, 'error');
            
            if (config.autoRestart) {
                this.scheduleRestart(cameraId, quality);
            }
        });

        // Mark as running after successful start
        setTimeout(() => {
            if (process.pid && !process.killed) {
                this.updateStreamStatus(cameraId, quality, 'running');
                this.resetRestartAttempts(cameraId, quality);
            }
        }, 5000);
    }

    // Stop a specific quality stream
    async stopStream(cameraId, quality) {
        if (this.activeStreams.has(cameraId)) {
            const streams = this.activeStreams.get(cameraId);
            if (streams[quality]) {
                logger.info(`Stopping ${quality} stream for camera ${cameraId}`);
                
                streams[quality].kill('SIGTERM');
                
                // Force kill after timeout
                setTimeout(() => {
                    if (streams[quality] && !streams[quality].killed) {
                        logger.warn(`Force killing ${quality} stream for camera ${cameraId}`);
                        streams[quality].kill('SIGKILL');
                    }
                }, 5000);
                
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
            const maxAge = 30000; // 30 seconds
            
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
}

module.exports = new StreamManager(); 