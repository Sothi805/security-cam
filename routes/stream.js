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
                live_stream_url: config.getLiveStreamUrl(cameraId),
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
        const health = await pathUtils.getLiveStreamHealth(cameraId);
        
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
                    error: 'Invalid hour format. Use HH (00-23)'
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
                error: 'Invalid hour format. Use HH (00-23)'
            });
        }
        
        // Check if recording exists
        const exists = await pathUtils.recordingExists(cameraId, date, hour);
        
        if (!exists) {
            return res.status(404).json({
                error: 'Recording not found for the specified time',
                camera_id: cameraId,
                date,
                hour
            });
        }
        
        // Get recording stats
        const stats = await pathUtils.getRecordingStats(cameraId, date, hour);
        const streamUrl = config.getRecordingStreamUrl(cameraId, date, hour);
        
        res.json({
            camera_id: cameraId,
            date,
            hour,
            stream_url: streamUrl,
            full_url: `${req.protocol}://${req.get('host')}${streamUrl}`,
            recording_stats: stats,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to get playback for camera ${req.params.cameraId} at ${req.params.date} ${req.params.hour}:`, error);
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
        
        logger.info(`Manual restart requested for camera ${cameraId}`);
        
        // Stop current stream
        await streamManager.stopStream(cameraId);
        
        // Wait a moment then restart
        setTimeout(async () => {
            await streamManager.startStream(cameraId);
        }, 2000);
        
        res.json({
            message: `Restart initiated for camera ${cameraId}`,
            camera_id: cameraId,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to restart camera ${req.params.cameraId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /restart
 * Restart all camera streams
 */
router.post('/restart', async (req, res) => {
    try {
        logger.info('Manual restart requested for all cameras');
        
        // Stop all streams
        await streamManager.stopAllStreams();
        
        // Wait a moment then restart all
        setTimeout(async () => {
            await streamManager.initializeStreams();
        }, 3000);
        
        res.json({
            message: 'Restart initiated for all cameras',
            cameras: config.cameraIds,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to restart all cameras:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /status
 * Get streaming status for all cameras
 */
router.get('/status', async (req, res) => {
    try {
        const streamStatus = streamManager.getAllStreamStatus();
        const healthCheck = await streamManager.checkStreamHealth();
        
        const status = {};
        
        for (const cameraId of config.cameraIds) {
            const cameraStatus = streamStatus[cameraId] || {};
            const cameraHealth = healthCheck[cameraId] || {};
            
            status[cameraId] = {
                ...cameraStatus,
                health: cameraHealth,
                live_url: config.getLiveStreamUrl(cameraId)
            };
        }
        
        res.json({
            cameras: status,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to get stream status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /storage
 * Get storage statistics
 */
router.get('/storage', async (req, res) => {
    try {
        const overallStats = await pathUtils.getOverallStorageStats();
        
        res.json({
            storage: overallStats,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to get storage stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /storage/:cameraId
 * Get storage statistics for a specific camera
 */
router.get('/storage/:cameraId', async (req, res) => {
    try {
        const { cameraId } = req.params;
        
        // Validate camera ID
        if (!pathUtils.isValidCameraId(cameraId)) {
            return res.status(404).json({
                error: 'Camera not found',
                available_cameras: config.cameraIds
            });
        }
        
        const cameraStats = await pathUtils.getCameraStorageStats(cameraId);
        
        res.json({
            camera_id: cameraId,
            storage: cameraStats,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to get storage stats for camera ${req.params.cameraId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /cleanup/:cameraId/:date/:hour
 * Delete specific recording
 */
router.delete('/cleanup/:cameraId/:date/:hour', async (req, res) => {
    try {
        const { cameraId, date, hour } = req.params;
        
        // Validate camera ID
        if (!pathUtils.isValidCameraId(cameraId)) {
            return res.status(404).json({
                error: 'Camera not found',
                available_cameras: config.cameraIds
            });
        }
        
        // Validate date and hour
        if (!pathUtils.isValidDate(date) || !pathUtils.isValidHour(hour)) {
            return res.status(400).json({
                error: 'Invalid date or hour format'
            });
        }
        
        const recordingDir = pathUtils.getRecordingsDir(cameraId, date, hour);
        const fs = require('fs-extra');
        
        if (await fs.pathExists(recordingDir)) {
            await fs.remove(recordingDir);
            logger.info(`Manual cleanup: Removed recording ${cameraId}/${date}/${hour}`);
            
            res.json({
                message: 'Recording deleted successfully',
                camera_id: cameraId,
                date,
                hour,
                timestamp: moment().toISOString()
            });
        } else {
            res.status(404).json({
                error: 'Recording not found'
            });
        }
        
    } catch (error) {
        logger.error(`Failed to delete recording:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 