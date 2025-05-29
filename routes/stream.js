const express = require('express');
const moment = require('moment');
const config = require('../utils/config');
const streamManager = require('../utils/streamManager');
const cleanupManager = require('../utils/cleanupManager');
const pathUtils = require('../utils/pathUtils');
const logger = require('../utils/logger');

const router = express.Router();

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
                id: cameraId,
                rtsp_url: config.getRtspUrl(cameraId).replace(/:.*@/, ':***@'), // Hide password
                qualities: ['low', 'high'],
                status: {
                    low: {
                        running: status.low?.status === 'running',
                        status: status.low?.status || 'unknown',
                        healthy: health.low?.healthy || false,
                        lastUpdated: status.low?.timestamp
                    },
                    high: {
                        running: status.high?.status === 'running',
                        status: status.high?.status || 'unknown', 
                        healthy: health.high?.healthy || false,
                        lastUpdated: status.high?.timestamp
                    }
                },
                restartAttempts: status.restartAttempts || { low: 0, high: 0 }
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
 * GET /live/:cameraId/:quality
 * Get live stream URL for specific camera and quality
 */
router.get('/live/:cameraId/:quality', async (req, res) => {
    try {
        const { cameraId, quality } = req.params;
        
        // Validate camera ID
        if (!pathUtils.isValidCameraId(cameraId)) {
            return res.status(404).json({
                error: 'Camera not found',
                available_cameras: config.cameraIds
            });
        }
        
        // Validate quality
        if (!pathUtils.isValidQuality(quality)) {
            return res.status(400).json({
                error: 'Invalid quality',
                available_qualities: ['low', 'high']
            });
        }
        
        // Get live stream URL
        const streamUrl = config.getLiveStreamUrl(cameraId, quality);
        
        // Check if stream is healthy
        const health = await pathUtils.getStreamHealth(cameraId, quality);
        
        res.json({
            camera_id: cameraId,
            quality,
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
 * GET /live/:cameraId
 * Get live stream URLs for all qualities of a camera
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
        
        const qualities = ['low', 'high'];
        const streams = {};
        
        for (const quality of qualities) {
            const streamUrl = config.getLiveStreamUrl(cameraId, quality);
            const health = await pathUtils.getStreamHealth(cameraId, quality);
            
            streams[quality] = {
                stream_url: streamUrl,
                full_url: `${req.protocol}://${req.get('host')}${streamUrl}`,
                status: health.healthy ? 'available' : 'unavailable',
                health
            };
        }
        
        res.json({
            camera_id: cameraId,
            streams,
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to get live streams for camera ${req.params.cameraId}:`, error);
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
        const { date, startHour, endHour, quality = 'low' } = req.query;
        
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
            
            const playbackUrls = await pathUtils.getPlaybackUrls(cameraId, quality, date, startHour, date, endHour);
            
            return res.json({
                camera_id: cameraId,
                quality,
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
            qualities: ['low', 'high'],
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error(`Failed to get playback info for camera ${req.params.cameraId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /restart/:cameraId
 * Restart streams for a specific camera
 */
router.post('/restart/:cameraId', async (req, res) => {
    try {
        const { cameraId } = req.params;
        const { quality } = req.body;
        
        // Validate camera ID
        if (!pathUtils.isValidCameraId(cameraId)) {
            return res.status(404).json({
                error: 'Camera not found',
                available_cameras: config.cameraIds
            });
        }
        
        logger.info(`Manual restart requested for camera ${cameraId}${quality ? ` (${quality} quality)` : ''}`);
        
        if (quality) {
            // Restart specific quality
            if (!pathUtils.isValidQuality(quality)) {
                return res.status(400).json({
                    error: 'Invalid quality',
                    available_qualities: ['low', 'high']
                });
            }
            
            await streamManager.restartStream(cameraId, quality);
            
            res.json({
                message: `Restarted ${quality} quality stream for camera ${cameraId}`,
                camera_id: cameraId,
                quality,
                timestamp: moment().toISOString()
            });
        } else {
            // Restart all qualities
            await streamManager.stopCameraStreams(cameraId);
            await streamManager.startCameraStreams(cameraId);
            
            res.json({
                message: `Restarted all streams for camera ${cameraId}`,
                camera_id: cameraId,
                qualities: ['low', 'high'],
                timestamp: moment().toISOString()
            });
        }
        
    } catch (error) {
        logger.error(`Failed to restart camera ${req.params.cameraId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /status
 * Get comprehensive status of all streams
 */
router.get('/status', async (req, res) => {
    try {
        const streamStatus = streamManager.getAllStreamStatus();
        const healthCheck = await streamManager.checkStreamHealth();
        const storageStats = await pathUtils.getOverallStorageStats();
        
        res.json({
            streams: streamStatus,
            health: healthCheck,
            storage: storageStats,
            configuration: {
                cameras: config.cameraIds,
                retention_days: config.retentionDays,
                qualities: ['low', 'high'],
                fps: config.fps
            },
            timestamp: moment().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to get streams status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
