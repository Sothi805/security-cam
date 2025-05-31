const express = require('express');
const moment = require('moment');
const config = require('../utils/config');
const streamManager = require('../utils/streamManager');
const cleanupManager = require('../utils/cleanupManager');
const { PathUtils } = require('../utils/pathUtils');
const { logger } = require('../utils/logger');

const router = express.Router();
const pathUtils = new PathUtils();

/**
 * GET /cameras
 * Get list of all configured cameras with their status
 */
router.get('/cameras', async (req, res) => {
    try {
        const cameras = [];
        const streamStatus = streamManager.getAllStreamStatus();
        const healthCheck = await streamManager.checkStreamHealth();
        
        for (const cameraId of config.cameraIds) {
            const status = streamStatus[cameraId] || {};
            const health = healthCheck[cameraId] || {};
            
            cameras.push({
                camera_id: cameraId,
                rtsp_url: config.getRtspUrl(cameraId).replace(/:.*@/, ':***@'), // Hide password
                status: {
                    running: status.status === 'running',
                    status: status.status || 'unknown',
                    healthy: health.healthy || false,
                    lastUpdated: status.timestamp
                },
                restartAttempts: status.restartAttempts || 0
            });
        }
        
        res.json({
            cameras,
            count: cameras.length,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to get cameras list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /live/:cameraId
 * Get live stream URL for specific camera
 */
router.get('/live/:cameraId', async (req, res) => {
    try {
        const { cameraId } = req.params;
        
        // Validate camera ID
        if (!pathUtils.isValidCameraId(cameraId)) {
            return res.status(404).json({
                error: 'Camera not found',
                available_cameras: config.cameraIds
            });
        }
        
        // Get live stream URL
        const streamUrl = config.getLiveStreamUrl(cameraId);
        
        // Check if stream is healthy
        const health = await pathUtils.getStreamHealth(cameraId);
        
        res.json({
            camera_id: cameraId,
            stream_url: streamUrl,
            full_url: `${req.protocol}://${req.get('host')}${streamUrl}`,
            status: health.healthy ? 'available' : 'unavailable',
            health,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to get live stream for camera ${req.params.cameraId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /playback/:cameraId
 * Get available playback data for a camera
 */
router.get('/playback/:cameraId', async (req, res) => {
    try {
        const { cameraId } = req.params;
        const { date, startHour, endHour } = req.query;
        
        // Validate camera ID
        if (!pathUtils.isValidCameraId(cameraId)) {
            return res.status(404).json({
                error: 'Camera not found',
                available_cameras: config.cameraIds
            });
        }
        
        // If specific date and time range requested
        if (date && startHour && endHour) {
            if (!pathUtils.isValidDate(date)) {
                return res.status(400).json({
                    error: 'Invalid date format. Use YYYY-MM-DD'
                });
            }
            
            if (!pathUtils.isValidHour(startHour) || !pathUtils.isValidHour(endHour)) {
                return res.status(400).json({
                    error: 'Invalid hour format. Use HH-mm'
                });
            }
            
            const playbackUrls = await pathUtils.getPlaybackUrls(cameraId, date, startHour, date, endHour);
            
            return res.json({
                camera_id: cameraId,
                date,
                start_hour: startHour,
                end_hour: endHour,
                playback_urls: playbackUrls,
                count: playbackUrls.length
            });
        }
        
        // Otherwise return available dates and recent hours
        const availableDates = await pathUtils.getAvailableDates(cameraId);
        const recentHours = pathUtils.getRecentHours(24);
        
        res.json({
            camera_id: cameraId,
            available_dates: availableDates,
            recent_hours: recentHours,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to get playback data for camera ${req.params.cameraId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /playback/:cameraId/:date
 * Get available hours for a specific camera and date
 */
router.get('/playback/:cameraId/:date', async (req, res) => {
    try {
        const { cameraId, date } = req.params;
        
        // Validate camera ID
        if (!pathUtils.isValidCameraId(cameraId)) {
            return res.status(404).json({
                error: 'Camera not found',
                available_cameras: config.cameraIds
            });
        }
        
        // Validate date
        if (!pathUtils.isValidDate(date)) {
            return res.status(400).json({
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }
        
        const availableHours = await pathUtils.getAvailableHours(cameraId, date);
        
        res.json({
            camera_id: cameraId,
            date,
            available_hours: availableHours,
            count: availableHours.length,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to get hours for camera ${req.params.cameraId} on ${req.params.date}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /playback/:cameraId/:date/:hour
 * Get stream URL for specific camera, date and hour
 */
router.get('/playback/:cameraId/:date/:hour', async (req, res) => {
    try {
        const { cameraId, date, hour } = req.params;
        
        // Validate camera ID
        if (!pathUtils.isValidCameraId(cameraId)) {
            return res.status(404).json({
                error: 'Camera not found',
                available_cameras: config.cameraIds
            });
        }
        
        // Validate date
        if (!pathUtils.isValidDate(date)) {
            return res.status(400).json({
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }
        
        // Validate hour
        if (!pathUtils.isValidHour(hour)) {
            return res.status(400).json({
                error: 'Invalid hour format. Use HH-mm'
            });
        }
        
        // Check if stream exists
        const exists = await pathUtils.streamExists(cameraId, date, hour);
        if (!exists) {
            return res.status(404).json({
                error: 'Stream not found for specified time',
                camera_id: cameraId,
                date,
                hour
            });
        }
        
        // Get stream URL and stats
        const streamUrl = pathUtils.getStreamWebUrl(cameraId, date, hour);
        const stats = await pathUtils.getStreamStats(cameraId, date, hour);
        
        res.json({
            camera_id: cameraId,
            date,
            hour,
            stream_url: streamUrl,
            full_url: `${req.protocol}://${req.get('host')}${streamUrl}`,
            stats,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to get stream for camera ${req.params.cameraId} at ${req.params.date} ${req.params.hour}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /start/:cameraId
 * Start streaming for a specific camera
 */
router.post('/start/:cameraId', async (req, res) => {
    try {
        const { cameraId } = req.params;
        
        // Validate camera ID
        if (!pathUtils.isValidCameraId(cameraId)) {
            return res.status(404).json({
                error: 'Camera not found',
                available_cameras: config.cameraIds
            });
        }
        
        await streamManager.startCameraStream(cameraId);
        
        res.json({
            message: `Started streaming for camera ${cameraId}`,
            camera_id: cameraId,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to start stream for camera ${req.params.cameraId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /stop/:cameraId
 * Stop streaming for a specific camera
 */
router.post('/stop/:cameraId', async (req, res) => {
    try {
        const { cameraId } = req.params;
        
        // Validate camera ID
        if (!pathUtils.isValidCameraId(cameraId)) {
            return res.status(404).json({
                error: 'Camera not found',
                available_cameras: config.cameraIds
            });
        }
        
        await streamManager.stopCameraStream(cameraId);
        
        res.json({
            message: `Stopped streaming for camera ${cameraId}`,
            camera_id: cameraId,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to stop stream for camera ${req.params.cameraId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /restart/:cameraId
 * Restart streaming for a specific camera
 */
router.post('/restart/:cameraId', async (req, res) => {
    try {
        const { cameraId } = req.params;
        
        // Validate camera ID
        if (!pathUtils.isValidCameraId(cameraId)) {
            return res.status(404).json({
                error: 'Camera not found',
                available_cameras: config.cameraIds
            });
        }
        
        await streamManager.restartCameraStream(cameraId);
        
        res.json({
            message: `Restarted streaming for camera ${cameraId}`,
            camera_id: cameraId,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to restart stream for camera ${req.params.cameraId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 