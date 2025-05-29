const { spawn } = require('child_process');
const moment = require('moment');
const path = require('path');
const config = require('./config');
const PathUtils = require('./pathUtils');
const { streamLogger, systemLogger } = require('./logger');

class StreamManager {
  constructor() {
    this.processes = new Map(); // camera_id -> { high: process, low: process }
    this.restartAttempts = new Map(); // camera_id -> count
    this.healthChecks = new Map(); // camera_id -> interval
    this.isShuttingDown = false;
  }

  /**
   * Start streaming for a specific camera with both quality variants
   */
  async startCamera(cameraId) {
    streamLogger.info(`Starting streams for camera ${cameraId}`);
    
    try {
      // Ensure directories exist
      const livePaths = {
        high: PathUtils.getLiveStreamPath(cameraId, 'high'),
        low: PathUtils.getLiveStreamPath(cameraId, 'low')
      };

      await PathUtils.ensureDirectoryExists(livePaths.high.liveDir);
      await PathUtils.ensureDirectoryExists(livePaths.low.liveDir);

      // Start both quality streams
      const highQualityProcess = await this.startStream(cameraId, 'high');
      const lowQualityProcess = await this.startStream(cameraId, 'low');

      this.processes.set(cameraId, {
        high: highQualityProcess,
        low: lowQualityProcess
      });

      // Reset restart attempts on successful start
      this.restartAttempts.set(cameraId, 0);

      // Start health monitoring
      this.startHealthCheck(cameraId);

      streamLogger.info(`Successfully started streams for camera ${cameraId}`);
      return true;
    } catch (error) {
      streamLogger.error(`Failed to start camera ${cameraId}:`, error);
      return false;
    }
  }

  /**
   * Start a single stream process
   */
  async startStream(cameraId, quality) {
    const rtspUrl = this.buildRTSPUrl(cameraId);
    const outputPaths = this.getOutputPaths(cameraId, quality);
    
    // Build FFmpeg arguments based on quality
    const args = this.buildFFmpegArgs(rtspUrl, outputPaths, quality);
    
    streamLogger.info(`Starting ${quality} quality stream for camera ${cameraId}`, {
      rtspUrl: rtspUrl.replace(/:.*@/, ':***@'), // Hide credentials in logs
      outputPath: outputPaths.playlist
    });

    const process = spawn(config.ffmpeg.path, args);
    
    // Set up process event handlers
    this.setupProcessHandlers(process, cameraId, quality);
    
    return process;
  }

  /**
   * Build RTSP URL for camera
   */
  buildRTSPUrl(cameraId) {
    const { user, pass, host, port } = config.cameras.rtsp;
    return `rtsp://${user}:${pass}@${host}:${port}/Streaming/Channels/${cameraId}`;
  }

  /**
   * Get output paths for different streaming modes
   */
  getOutputPaths(cameraId, quality) {
    const livePaths = PathUtils.getLiveStreamPath(cameraId, quality);
    
    return {
      playlist: livePaths.playlist,
      segmentPattern: livePaths.segmentPattern,
      liveDir: livePaths.liveDir
    };
  }

  /**
   * Build FFmpeg arguments based on quality setting
   */
  buildFFmpegArgs(rtspUrl, outputPaths, quality) {
    const baseArgs = [
      '-rtsp_transport', config.cameras.rtsp.transport,
      '-i', rtspUrl,
      '-avoid_negative_ts', 'make_zero',
      '-fflags', '+genpts'
    ];

    let videoArgs = [];
    
    if (quality === 'low') {
      // Low quality: 480p @ 15fps with encoding
      videoArgs = [
        '-c:v', 'libx264',
        '-preset', config.quality.low.preset,
        '-tune', 'zerolatency',
        '-profile:v', config.quality.low.profile,
        '-level', config.quality.low.level,
        '-s', `${config.quality.low.width}x${config.quality.low.height}`,
        '-r', config.quality.low.fps.toString(),
        '-b:v', config.quality.low.bitrate,
        '-maxrate', config.quality.low.bitrate,
        '-bufsize', `${parseInt(config.quality.low.bitrate) * 2}M`,
        '-g', (config.quality.low.fps * 2).toString(), // Keyframe every 2 seconds
        '-keyint_min', config.quality.low.fps.toString(),
        '-c:a', config.quality.audio.codec,
        '-b:a', config.quality.audio.bitrate,
        '-ar', config.quality.audio.sampleRate.toString()
      ];
    } else {
      // High quality: copy original stream without encoding
      videoArgs = [
        '-c', 'copy'
      ];
    }

    const hlsArgs = [
      '-f', 'hls',
      '-hls_time', config.hls.segmentDuration.toString(),
      '-hls_list_size', config.hls.listSize.toString(),
      '-hls_flags', config.hls.flags,
      '-hls_segment_filename', outputPaths.segmentPattern,
      outputPaths.playlist
    ];

    return [...baseArgs, ...videoArgs, ...hlsArgs];
  }

  /**
   * Set up process event handlers
   */
  setupProcessHandlers(process, cameraId, quality) {
    process.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message && !message.includes('ffmpeg version')) {
        streamLogger.debug(`FFmpeg [${cameraId}-${quality}]: ${message}`);
      }
    });

    process.on('close', (code) => {
      streamLogger.warn(`Stream ${cameraId}-${quality} exited with code ${code}`);
      
      if (!this.isShuttingDown) {
        this.handleProcessExit(cameraId, quality, code);
      }
    });

    process.on('error', (error) => {
      streamLogger.error(`Stream ${cameraId}-${quality} error:`, error);
    });
  }

  /**
   * Handle process exit and restart logic
   */
  async handleProcessExit(cameraId, quality, exitCode) {
    const currentAttempts = this.restartAttempts.get(cameraId) || 0;
    
    if (currentAttempts >= config.system.maxRestartAttempts) {
      streamLogger.error(`Max restart attempts reached for camera ${cameraId}. Giving up.`);
      systemLogger.error(`Camera ${cameraId} failed permanently after ${currentAttempts} attempts`);
      return;
    }

    // Increment restart attempts
    this.restartAttempts.set(cameraId, currentAttempts + 1);
    
    streamLogger.info(`Restarting ${quality} stream for camera ${cameraId} (attempt ${currentAttempts + 1})`);
    
    // Wait before restarting
    setTimeout(async () => {
      try {
        const newProcess = await this.startStream(cameraId, quality);
        
        // Update the process reference
        const processes = this.processes.get(cameraId) || {};
        processes[quality] = newProcess;
        this.processes.set(cameraId, processes);
        
        streamLogger.info(`Successfully restarted ${quality} stream for camera ${cameraId}`);
      } catch (error) {
        streamLogger.error(`Failed to restart ${quality} stream for camera ${cameraId}:`, error);
      }
    }, config.system.restartDelaySeconds * 1000);
  }

  /**
   * Start health check monitoring for a camera
   */
  startHealthCheck(cameraId) {
    const interval = setInterval(async () => {
      await this.performHealthCheck(cameraId);
    }, config.system.healthCheckIntervalSeconds * 1000);
    
    this.healthChecks.set(cameraId, interval);
  }

  /**
   * Perform health check on camera streams
   */
  async performHealthCheck(cameraId) {
    const processes = this.processes.get(cameraId);
    if (!processes) return;

    const issues = [];
    
    // Check if processes are still running
    ['high', 'low'].forEach(quality => {
      const process = processes[quality];
      if (!process || process.killed || process.exitCode !== null) {
        issues.push(`${quality} quality stream not running`);
      }
    });

    // Check if playlist files exist and are recent
    try {
      const livePaths = {
        high: PathUtils.getLiveStreamPath(cameraId, 'high'),
        low: PathUtils.getLiveStreamPath(cameraId, 'low')
      };

      const fs = require('fs-extra');
      const staleThreshold = Date.now() - (config.system.playlistStaleThresholdMinutes * 60 * 1000);
      
      for (const [quality, paths] of Object.entries(livePaths)) {
        try {
          const stats = await fs.stat(paths.playlist);
          if (stats.mtime.getTime() < staleThreshold) {
            issues.push(`${quality} quality playlist is stale`);
          }
        } catch (error) {
          issues.push(`${quality} quality playlist not found`);
        }
      }
    } catch (error) {
      systemLogger.error(`Health check error for camera ${cameraId}:`, error);
    }

    if (issues.length > 0) {
      systemLogger.warn(`Health check issues for camera ${cameraId}:`, { issues });
      
      // Attempt to restart if there are critical issues
      if (issues.some(issue => issue.includes('not running') || issue.includes('not found'))) {
        streamLogger.info(`Health check triggered restart for camera ${cameraId}`);
        await this.restartCamera(cameraId);
      }
    }
  }

  /**
   * Stop streaming for a specific camera
   */
  async stopCamera(cameraId) {
    streamLogger.info(`Stopping streams for camera ${cameraId}`);
    
    const processes = this.processes.get(cameraId);
    if (processes) {
      ['high', 'low'].forEach(quality => {
        const process = processes[quality];
        if (process && !process.killed) {
          process.kill('SIGTERM');
          streamLogger.info(`Stopped ${quality} stream for camera ${cameraId}`);
        }
      });
      
      this.processes.delete(cameraId);
    }

    // Clear health check
    const healthCheck = this.healthChecks.get(cameraId);
    if (healthCheck) {
      clearInterval(healthCheck);
      this.healthChecks.delete(cameraId);
    }

    // Reset restart attempts
    this.restartAttempts.delete(cameraId);
  }

  /**
   * Restart a specific camera
   */
  async restartCamera(cameraId) {
    await this.stopCamera(cameraId);
    await new Promise(resolve => setTimeout(resolve, config.system.streamRestartPauseSeconds * 1000));
    return await this.startCamera(cameraId);
  }

  /**
   * Start all configured cameras
   */
  async startAllCameras() {
    streamLogger.info('Starting all cameras');
    
    const results = await Promise.allSettled(
      config.cameras.ids.map(cameraId => this.startCamera(cameraId))
    );

    const successful = results.filter(result => result.status === 'fulfilled' && result.value).length;
    const total = config.cameras.ids.length;
    
    streamLogger.info(`Started ${successful}/${total} cameras successfully`);
    return successful === total;
  }

  /**
   * Stop all cameras
   */
  async stopAllCameras() {
    this.isShuttingDown = true;
    streamLogger.info('Stopping all cameras');
    
    const stopPromises = Array.from(this.processes.keys()).map(cameraId => 
      this.stopCamera(cameraId)
    );
    
    await Promise.allSettled(stopPromises);
    streamLogger.info('All cameras stopped');
  }

  /**
   * Get status of all cameras
   */
  getStatus() {
    const status = {};
    
    config.cameras.ids.forEach(cameraId => {
      const processes = this.processes.get(cameraId);
      const restartAttempts = this.restartAttempts.get(cameraId) || 0;
      
      status[cameraId] = {
        running: {
          high: processes?.high && !processes.high.killed && processes.high.exitCode === null,
          low: processes?.low && !processes.low.killed && processes.low.exitCode === null
        },
        restartAttempts,
        healthCheck: this.healthChecks.has(cameraId)
      };
    });
    
    return status;
  }

  /**
   * Check if a specific camera is healthy
   */
  isCameraHealthy(cameraId) {
    const processes = this.processes.get(cameraId);
    if (!processes) return false;
    
    return ['high', 'low'].every(quality => {
      const process = processes[quality];
      return process && !process.killed && process.exitCode === null;
    });
  }
}

module.exports = StreamManager; 