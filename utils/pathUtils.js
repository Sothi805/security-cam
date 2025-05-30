const path = require('path');
const fs = require('fs-extra');
const moment = require('moment');
const config = require('./config');
const { logger } = require('./logger');

class PathUtils {
    constructor() {
        // Ensure base HLS directory exists
        this.ensureHLSDirectory();
    }

    // Ensure HLS directory structure exists
    async ensureHLSDirectory() {
        await fs.ensureDir(config.hlsPath);
    }

    // Get live stream path (current hour)
    getLiveStreamPath(cameraId, quality = 'low') {
        const date = moment().format('YYYY-MM-DD');
        const hour = moment().format('HH-mm');
        return config.getStreamPath(cameraId, quality, date, hour);
    }

    // Get historical stream path
    getHistoricalStreamPath(cameraId, quality, date, hour) {
        return config.getStreamPath(cameraId, quality, date, hour);
    }

    // Get web URL for stream
    getStreamWebUrl(cameraId, quality = 'low', date = null, hour = null) {
        return config.getStreamUrl(cameraId, quality, date, hour);
    }

    // Get live stream web URL
    getLiveStreamWebUrl(cameraId, quality = 'low') {
        return config.getLiveStreamUrl(cameraId, quality);
    }

    // Ensure directory exists for a stream path
    async ensureStreamDirectory(cameraId, date = null) {
        const streamDir = config.getStreamDirectory(cameraId, date);
        await fs.ensureDir(streamDir);
        return streamDir;
    }

    // Get all available dates for a camera
    async getAvailableDates(cameraId) {
        try {
            return config.getAvailableDates(cameraId);
        } catch (error) {
            return [];
        }
    }

    // Get all available hours for a camera and date
    async getAvailableHours(cameraId, date) {
        try {
            return config.getAvailableHours(cameraId, date);
        } catch (error) {
            return [];
        }
    }

    // Get all available qualities for a specific hour
    async getAvailableQualities(cameraId, date, hour) {
        try {
            const dateDir = config.getStreamDirectory(cameraId, date);
            if (!await fs.pathExists(dateDir)) {
                return [];
            }

            const files = await fs.readdir(dateDir);
            const qualities = [];
            
            const lowFile = `${hour}-low.m3u8`;
            const highFile = `${hour}-high.m3u8`;
            
            if (files.includes(lowFile)) qualities.push('low');
            if (files.includes(highFile)) qualities.push('high');
            
            return qualities;
        } catch (error) {
            return [];
        }
    }

    // Check if a stream file exists
    async streamExists(cameraId, quality, date = null, hour = null) {
        try {
            const streamPath = config.getStreamPath(cameraId, quality, date, hour);
            return await fs.pathExists(streamPath);
        } catch (error) {
            return false;
        }
    }

    // Get stream file stats
    async getStreamStats(cameraId, quality, date = null, hour = null) {
        try {
            const streamPath = config.getStreamPath(cameraId, quality, date, hour);
            if (!await fs.pathExists(streamPath)) {
                return null;
            }
            
            const stats = await fs.stat(streamPath);
            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                isStale: (Date.now() - stats.mtime.getTime()) > 60000 // 1 minute
            };
        } catch (error) {
            return null;
        }
    }

    // Get directory size in bytes
    async getDirectorySize(dirPath) {
        try {
            if (!await fs.pathExists(dirPath)) {
                return 0;
            }

            let totalSize = 0;
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isDirectory()) {
                    totalSize += await this.getDirectorySize(itemPath);
                } else {
                    totalSize += stats.size;
                }
            }
            
            return totalSize;
        } catch (error) {
            return 0;
        }
    }

    // Get camera storage statistics
    async getCameraStorageStats(cameraId) {
        try {
            const cameraDir = config.getCameraDirectory(cameraId);
            const totalSize = await this.getDirectorySize(cameraDir);
            const dates = await this.getAvailableDates(cameraId);
            
            let fileCount = 0;
            let oldestFile = null;
            let newestFile = null;
            
            for (const date of dates) {
                const dateDir = config.getStreamDirectory(cameraId, date);
                const files = await fs.readdir(dateDir);
                
                for (const file of files) {
                    const filePath = path.join(dateDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.isFile()) {
                        fileCount++;
                        
                        if (!oldestFile || stats.mtime < oldestFile) {
                            oldestFile = stats.mtime;
                        }
                        
                        if (!newestFile || stats.mtime > newestFile) {
                            newestFile = stats.mtime;
                        }
                    }
                }
            }
            
            return {
                totalSize,
                fileCount,
                dateCount: dates.length,
                oldestFile: oldestFile ? oldestFile.toISOString() : null,
                newestFile: newestFile ? newestFile.toISOString() : null,
                sizeFormatted: this.formatBytes(totalSize)
            };
            
        } catch (error) {
            return {
                totalSize: 0,
                fileCount: 0,
                dateCount: 0,
                oldestFile: null,
                newestFile: null,
                sizeFormatted: '0 B',
                error: error.message
            };
        }
    }

    // Get overall storage statistics
    async getOverallStorageStats() {
        try {
            const totalSize = await this.getDirectorySize(config.hlsPath);
            const stats = {
                totalSize,
                sizeFormatted: this.formatBytes(totalSize),
                cameras: {}
            };
            
            for (const cameraId of config.cameraIds) {
                stats.cameras[cameraId] = await this.getCameraStorageStats(cameraId);
            }
            
            return stats;
        } catch (error) {
            return {
                totalSize: 0,
                sizeFormatted: '0 B',
                cameras: {},
                error: error.message
            };
        }
    }

    // Format bytes to human readable format
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Get stream playlist content for a specific time
    async getPlaylistContent(cameraId, quality, date, hour) {
        try {
            const streamPath = config.getStreamPath(cameraId, quality, date, hour);
            
            if (!await fs.pathExists(streamPath)) {
                return null;
            }
            
            const content = await fs.readFile(streamPath, 'utf8');
            return content;
        } catch (error) {
            return null;
        }
    }

    // Build time range for playback
    buildTimeRange(startDate, startHour, endDate, endHour) {
        const range = [];
        
        const start = moment(`${startDate} ${startHour}:00`, 'YYYY-MM-DD HH:mm');
        const end = moment(`${endDate} ${endHour}:59`, 'YYYY-MM-DD HH:mm');
        
        let current = start.clone();
        
        while (current.isSameOrBefore(end, 'hour')) {
            range.push({
                date: current.format('YYYY-MM-DD'),
                hour: current.format('HH-mm'),
                timestamp: current.toISOString()
            });
            
            current.add(1, 'hour');
        }
        
        return range;
    }

    // Get playback URLs for a time range
    async getPlaybackUrls(cameraId, quality, startDate, startHour, endDate, endHour) {
        const timeRange = this.buildTimeRange(startDate, startHour, endDate, endHour);
        const urls = [];
        
        for (const timePoint of timeRange) {
            const exists = await this.streamExists(cameraId, quality, timePoint.date, timePoint.hour);
            
            if (exists) {
                urls.push({
                    ...timePoint,
                    url: this.getStreamWebUrl(cameraId, quality, timePoint.date, timePoint.hour),
                    available: true
                });
            } else {
                urls.push({
                    ...timePoint,
                    url: null,
                    available: false
                });
            }
        }
        
        return urls;
    }

    // Validate camera ID
    isValidCameraId(cameraId) {
        return config.cameraIds.includes(cameraId.toString());
    }

    // Validate quality parameter
    isValidQuality(quality) {
        return ['low', 'high'].includes(quality);
    }

    // Validate date format
    isValidDate(date) {
        return moment(date, 'YYYY-MM-DD', true).isValid();
    }

    // Validate hour format
    isValidHour(hour) {
        return /^\d{2}-\d{2}$/.test(hour);
    }

    // Get recent hours (for dashboard)
    getRecentHours(count = 24) {
        const hours = [];
        let current = moment();
        
        for (let i = 0; i < count; i++) {
            hours.push({
                date: current.format('YYYY-MM-DD'),
                hour: current.format('HH-mm'),
                timestamp: current.toISOString(),
                label: current.format('MMM DD, HH:mm')
            });
            
            current.subtract(1, 'hour');
        }
        
        return hours;
    }

    // Get stream health information
    async getStreamHealth(cameraId, quality) {
        try {
            const streamPath = config.getStreamPath(cameraId, quality);
            const streamDir = path.dirname(streamPath);
            
            // Check if stream directory exists
            if (!await fs.pathExists(streamDir)) {
                return {
                    healthy: false,
                    error: 'Stream directory not found',
                    lastCheck: moment().toISOString()
                };
            }
            
            // Check if m3u8 playlist exists
            if (!await fs.pathExists(streamPath)) {
                return {
                    healthy: false,
                    error: 'Stream playlist not found',
                    lastCheck: moment().toISOString()
                };
            }
            
            // Read and parse m3u8 playlist
            const playlist = await fs.readFile(streamPath, 'utf8');
            const segments = playlist
                .split('\n')
                .filter(line => line.endsWith('.ts'))
                .map(line => path.join(streamDir, line));
                
            if (segments.length === 0) {
                return {
                    healthy: false,
                    error: 'No segments found in playlist',
                    lastCheck: moment().toISOString()
                };
            }
            
            // Check if segments exist and are readable
            const segmentChecks = await Promise.all(
                segments.map(async segment => {
                    try {
                        const stats = await fs.stat(segment);
                        const age = moment().diff(moment(stats.mtime), 'seconds');
                        return {
                            exists: true,
                            size: stats.size,
                            age,
                            valid: stats.size > 0 && age < 30 // Segment should be non-empty and less than 30 seconds old
                        };
                    } catch (error) {
                        return { exists: false, error: error.message };
                    }
                })
            );
            
            const validSegments = segmentChecks.filter(check => check.exists && check.valid);
            const totalSegments = segments.length;
            const healthRatio = validSegments.length / totalSegments;
            
            return {
                healthy: healthRatio >= 0.7, // At least 70% of segments should be valid
                segmentCount: totalSegments,
                validSegments: validSegments.length,
                healthRatio: Math.round(healthRatio * 100) / 100,
                details: {
                    playlist: {
                        exists: true,
                        path: streamPath
                    },
                    segments: segmentChecks
                },
                lastCheck: moment().toISOString()
            };
        } catch (error) {
            logger.error(`Failed to check stream health for camera ${cameraId} (${quality}):`, error);
            return {
                healthy: false,
                error: error.message,
                lastCheck: moment().toISOString()
            };
        }
    }

    // Clean up specific stream files
    async cleanupStreamFiles(cameraId, quality, date, hour) {
        try {
            const streamPath = config.getStreamPath(cameraId, quality, date, hour);
            const streamDir = path.dirname(streamPath);
            
            // Remove playlist file
            if (await fs.pathExists(streamPath)) {
                await fs.remove(streamPath);
            }
            
            // Remove associated segment files
            if (await fs.pathExists(streamDir)) {
                const files = await fs.readdir(streamDir);
                const prefix = `${hour}-${quality}_`;
                
                for (const file of files) {
                    if (file.startsWith(prefix) && file.endsWith('.ts')) {
                        await fs.remove(path.join(streamDir, file));
                    }
                }
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new PathUtils(); 