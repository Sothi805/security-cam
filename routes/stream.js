const express = require('express');
const moment = require('moment');
const config = require('../utils/config');
const StreamManager = require('../utils/streamManager');
const CleanupManager = require('../utils/cleanupManager');
const PathUtils = require('../utils/pathUtils');
const { logger, systemLogger } = require('../utils/logger');

const router = express.Router();

// Initialize managers
const streamManager = new StreamManager();
const cleanupManager = new CleanupManager();

// Start services
streamManager.startAllCameras();
cleanupManager.start();

// Graceful shutdown handling
const gracefulShutdown = async () => {
  logger.info('Graceful shutdown initiated');
  await streamManager.stopAllCameras();
  cleanupManager.stop();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

/**
 * GET /streams/live/:camera_id/:quality
 * Get live stream URL for a specific camera and quality
 */
router.get('/live/:camera_id/:quality', async (req, res) => {
  try {
    const { camera_id, quality } = req.params;
    
    // Validate camera ID
    if (!config.cameras.ids.includes(camera_id)) {
      return res.status(404).json({ 
        error: 'Camera not found',
        available_cameras: config.cameras.ids 
      });
    }

    // Validate quality
    if (!['high', 'low'].includes(quality)) {
      return res.status(400).json({ 
        error: 'Invalid quality',
        available_qualities: ['high', 'low'] 
      });
    }

    // Check if camera is healthy
    if (!streamManager.isCameraHealthy(camera_id)) {
      logger.warn(`Live stream requested for unhealthy camera ${camera_id}`);
      
      // Try to restart the camera
      const restartSuccess = await streamManager.restartCamera(camera_id);
      if (!restartSuccess) {
        return res.status(503).json({ 
          error: 'Camera stream unavailable',
          camera_id,
          quality 
        });
      }
    }

    const streamUrl = `/hls/${camera_id}/live/${quality}/index.m3u8`;
    
    res.json({
      camera_id,
      quality,
      stream_url: streamUrl,
      status: 'active',
      timestamp: moment().toISOString()
    });

  } catch (error) {
    logger.error(`Failed to get live stream for camera ${req.params.camera_id}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /streams/live/:camera_id
 * Get live stream URL for a specific camera with default quality (high)
 */
router.get('/live/:camera_id', async (req, res) => {
  // Redirect to the specific quality route with default 'high' quality
  return res.redirect(`/streams/live/${req.params.camera_id}/high`);
});

/**
 * GET /streams/playback/:camera_id/:date/:time
 * Get playback stream for specific date and time
 * Date format: YYYY-MM-DD
 * Time format: HH-mm
 */
router.get('/playback/:camera_id/:date/:time', async (req, res) => {
  try {
    const { camera_id, date, time } = req.params;
    
    // Validate camera ID
    if (!config.cameras.ids.includes(camera_id)) {
      return res.status(404).json({ 
        error: 'Camera not found',
        available_cameras: config.cameras.ids 
      });
    }

    // Validate date format
    if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    // Validate time format
    if (!moment(time, 'HH-mm', true).isValid()) {
      return res.status(400).json({ 
        error: 'Invalid time format. Use HH-mm' 
      });
    }

    // Check if stream exists
    const streamExists = await PathUtils.streamExists(camera_id, date, time);
    if (!streamExists) {
      // Get available alternatives
      const availableTimes = await PathUtils.getAvailableTimes(camera_id, date);
      
      return res.status(404).json({ 
        error: 'Stream not found for specified date and time',
        camera_id,
        requested_date: date,
        requested_time: time,
        available_times: availableTimes.slice(0, 10) // Limit to 10 suggestions
      });
    }

    const streamUrl = `/hls/${camera_id}/${date}/${time}.m3u8`;
    
    res.json({
      camera_id,
      date,
      time,
      stream_url: streamUrl,
      type: 'playback',
      timestamp: moment().toISOString()
    });

  } catch (error) {
    logger.error(`Failed to get playback stream:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /streams/available/:camera_id
 * Get available dates for a camera
 */
router.get('/available/:camera_id', async (req, res) => {
  try {
    const { camera_id } = req.params;
    
    // Validate camera ID
    if (!config.cameras.ids.includes(camera_id)) {
      return res.status(404).json({ 
        error: 'Camera not found',
        available_cameras: config.cameras.ids 
      });
    }

    // Get available dates
    const dates = await PathUtils.getAvailableDates(camera_id);
    
    res.json({
      camera_id,
      available_dates: dates,
      count: dates.length
    });

  } catch (error) {
    logger.error(`Failed to get available streams:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /streams/available/:camera_id/:date
 * Get available times for a camera and specific date
 */
router.get('/available/:camera_id/:date', async (req, res) => {
  try {
    const { camera_id, date } = req.params;
    
    // Validate camera ID
    if (!config.cameras.ids.includes(camera_id)) {
      return res.status(404).json({ 
        error: 'Camera not found',
        available_cameras: config.cameras.ids 
      });
    }

    // Get available times for specific date
    if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    const times = await PathUtils.getAvailableTimes(camera_id, date);
    
    res.json({
      camera_id,
      date,
      available_times: times,
      count: times.length
    });

  } catch (error) {
    logger.error(`Failed to get available streams:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /streams/cameras
 * Get all camera information and status
 */
router.get('/cameras', (req, res) => {
  try {
    const status = streamManager.getStatus();
    const cameras = config.cameras.ids.map(camera_id => ({
      camera_id,
      status: status[camera_id] || { running: { high: false, low: false }, restartAttempts: 0 },
      live_streams: {
        high: `/streams/live/${camera_id}/high`,
        low: `/streams/live/${camera_id}/low`
      }
    }));

    res.json({
      cameras,
      total: cameras.length,
      timestamp: moment().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get cameras status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /streams/restart/:camera_id
 * Restart streams for a specific camera
 */
router.post('/restart/:camera_id', async (req, res) => {
  try {
    const { camera_id } = req.params;
    
    // Validate camera ID
    if (!config.cameras.ids.includes(camera_id)) {
      return res.status(404).json({ 
        error: 'Camera not found',
        available_cameras: config.cameras.ids 
      });
    }

    logger.info(`Manual restart requested for camera ${camera_id}`);
    const success = await streamManager.restartCamera(camera_id);
    
    res.json({
      camera_id,
      action: 'restart',
      success,
      timestamp: moment().toISOString()
    });

  } catch (error) {
    logger.error(`Failed to restart camera ${req.params.camera_id}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /streams/restart
 * Restart all camera streams
 */
router.post('/restart', async (req, res) => {
  try {
    logger.info('Manual restart requested for all cameras');
    
    await streamManager.stopAllCameras();
    await new Promise(resolve => setTimeout(resolve, config.system.allCamerasRestartPauseSeconds * 1000));
    const success = await streamManager.startAllCameras();
    
    res.json({
      action: 'restart_all',
      success,
      timestamp: moment().toISOString()
    });

  } catch (error) {
    logger.error('Failed to restart all cameras:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /streams/status
 * Get comprehensive system status
 */
router.get('/status', async (req, res) => {
  try {
    const streamStatus = streamManager.getStatus();
    const cleanupStats = await cleanupManager.getCleanupStats();
    
    const totalStreams = config.cameras.ids.length * 2; // high + low quality per camera
    const activeStreams = Object.values(streamStatus).reduce((count, camera) => {
      return count + (camera.running.high ? 1 : 0) + (camera.running.low ? 1 : 0);
    }, 0);

    res.json({
      system: {
        status: activeStreams === totalStreams ? 'healthy' : 'degraded',
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        timestamp: moment().toISOString()
      },
      streaming: {
        total_cameras: config.cameras.ids.length,
        active_streams: activeStreams,
        total_streams: totalStreams,
        cameras: streamStatus
      },
      storage: cleanupStats,
      configuration: {
        segment_duration: config.hls.segmentDuration,
        retention_minutes: config.storage.retentionMinutes,
        cleanup_interval: config.storage.cleanupIntervalMinutes,
        max_storage_gb: config.storage.maxStorageGB
      }
    });

  } catch (error) {
    logger.error('Failed to get system status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /streams/cleanup
 * Trigger manual cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    logger.info('Manual cleanup triggered via API');
    
    await cleanupManager.triggerManualCleanup();
    
    res.json({
      action: 'cleanup',
      success: true,
      timestamp: moment().toISOString()
    });

  } catch (error) {
    logger.error('Failed to trigger manual cleanup:', error);
    res.status(500).json({ 
      error: error.message === 'Cleanup is already running' ? 
        'Cleanup is already in progress' : 'Internal server error' 
    });
  }
});

/**
 * GET /streams/health
 * Simple health check endpoint
 */
router.get('/health', (req, res) => {
  const streamStatus = streamManager.getStatus();
  const healthyCount = Object.values(streamStatus).filter(camera => 
    camera.running.high && camera.running.low
  ).length;
  
  const isHealthy = healthyCount === config.cameras.ids.length;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    healthy_cameras: healthyCount,
    total_cameras: config.cameras.ids.length,
    timestamp: moment().toISOString()
  });
});

module.exports = router;
