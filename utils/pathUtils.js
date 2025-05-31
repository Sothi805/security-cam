const path = require('path');
const fs = require('fs-extra');
const moment = require('moment');
const config = require('./config');
const { logger } = require('./logger');

class PathUtils {
    constructor() {
        this.init();
    }

    async init() {
        await this.ensureBaseDirectories();
    }

    // Ensure all base directories exist with new structure
    async ensureBaseDirectories() {
        for (const cameraId of config.cameraIds) {
            // Base camera directory: hls/{camera_id}/
            const cameraDir = path.join(config.hlsPath, cameraId.toString());
            await fs.ensureDir(cameraDir);
            
            // Live directory: hls/{camera_id}/live/
            const liveDir = path.join(cameraDir, 'live');
            await fs.ensureDir(liveDir);
            
            // Recordings directory: hls/{camera_id}/recordings/
            const recordingsDir = path.join(cameraDir, 'recordings');
            await fs.ensureDir(recordingsDir);
        }
    }

    // Get live directory path for a camera: hls/{camera_id}/live/
    getLiveDir(cameraId) {
        return path.join(config.hlsPath, cameraId.toString(), 'live');
    }

    // Get recordings directory path: hls/{camera_id}/recordings/YYYY-MM-DD/HH/
    getRecordingsDir(cameraId, date, hour) {
        return path.join(config.hlsPath, cameraId.toString(), 'recordings', date, hour);
    }

    // Ensure recording directory exists for specific date and hour
    async ensureRecordingDir(cameraId, date, hour) {
        const recordingDir = this.getRecordingsDir(cameraId, date, hour);
        await fs.ensureDir(recordingDir);
        return recordingDir;
    }

    // Get live segment path: hls/{camera_id}/live/segment{N}.ts
    getLiveSegmentPath(cameraId, segmentNumber) {
        return path.join(this.getLiveDir(cameraId), `segment${segmentNumber}.ts`);
    }

    // Get recording segment path: hls/{camera_id}/recordings/YYYY-MM-DD/HH/{MM}.ts
    getRecordingSegmentPath(cameraId, date, hour, minute) {
        return path.join(this.getRecordingsDir(cameraId, date, hour), `${minute.toString().padStart(2, '0')}.ts`);
    }

    // Get live playlist path: hls/{camera_id}/live/live.m3u8
    getLivePlaylistPath(cameraId) {
        return path.join(this.getLiveDir(cameraId), 'live.m3u8');
    }

    // Get recording playlist path: hls/{camera_id}/recordings/YYYY-MM-DD/HH/playlist.m3u8
    getRecordingPlaylistPath(cameraId, date, hour) {
        return path.join(this.getRecordingsDir(cameraId, date, hour), 'playlist.m3u8');
    }

    // Get live stream web URL
    getLiveStreamWebUrl(cameraId) {
        return `/hls/${cameraId}/live/live.m3u8`;
    }

    // Get recording stream web URL
    getRecordingStreamWebUrl(cameraId, date, hour) {
        return `/hls/${cameraId}/recordings/${date}/${hour}/playlist.m3u8`;
    }

    // Get all available dates for a camera
    async getAvailableDates(cameraId) {
        try {
            const recordingsDir = path.join(config.hlsPath, cameraId.toString(), 'recordings');
            
            if (!await fs.pathExists(recordingsDir)) {
                return [];
            }

            const items = await fs.readdir(recordingsDir);
            const dates = [];
            
            for (const item of items) {
                const itemPath = path.join(recordingsDir, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isDirectory() && this.isValidDate(item)) {
                    dates.push(item);
                }
            }
            
            return dates.sort().reverse(); // Most recent first
        } catch (error) {
            logger.error(`Failed to get available dates for camera ${cameraId}:`, error);
            return [];
        }
    }

    // Get all available hours for a camera and date
    async getAvailableHours(cameraId, date) {
        try {
            const dateDir = path.join(config.hlsPath, cameraId.toString(), 'recordings', date);
            
            if (!await fs.pathExists(dateDir)) {
                return [];
            }

            const items = await fs.readdir(dateDir);
            const hours = [];
            
            for (const item of items) {
                const itemPath = path.join(dateDir, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isDirectory() && this.isValidHour(item)) {
                    // Check if there are actual recordings in this hour
                    const hourDir = itemPath;
                    const files = await fs.readdir(hourDir);
                    const hasRecordings = files.some(f => f.endsWith('.ts') || f.endsWith('.m3u8'));
                    
                    if (hasRecordings) {
                        hours.push(item);
                    }
                }
            }
            
            return hours.sort(); // Chronological order
        } catch (error) {
            logger.error(`Failed to get available hours for camera ${cameraId} on ${date}:`, error);
            return [];
        }
    }

    // Check if a live stream exists and is healthy
    async getLiveStreamHealth(cameraId) {
        try {
            const livePlaylist = this.getLivePlaylistPath(cameraId);
            
            if (!await fs.pathExists(livePlaylist)) {
                return {
                    healthy: false,
                    error: 'Live playlist not found',
                    lastCheck: moment().toISOString()
                };
            }
            
            const stats = await fs.stat(livePlaylist);
            const age = moment().diff(moment(stats.mtime), 'seconds');
            
            // Check for recent segments
            const liveDir = this.getLiveDir(cameraId);
            const files = await fs.readdir(liveDir);
            const segments = files.filter(f => f.endsWith('.ts'));
            
            return {
                healthy: age < 30 && segments.length > 0,
                lastModified: stats.mtime,
                ageSeconds: age,
                segmentCount: segments.length,
                lastCheck: moment().toISOString()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                lastCheck: moment().toISOString()
            };
        }
    }

    // Get stream health information (alias for backward compatibility)
    async getStreamHealth(cameraId) {
        return this.getLiveStreamHealth(cameraId);
    }

    // Check if a recording exists for specific date and hour
    async recordingExists(cameraId, date, hour) {
        try {
            const recordingPlaylist = this.getRecordingPlaylistPath(cameraId, date, hour);
            return await fs.pathExists(recordingPlaylist);
        } catch (error) {
            return false;
        }
    }

    // Get recording stats for specific date and hour
    async getRecordingStats(cameraId, date, hour) {
        try {
            const recordingDir = this.getRecordingsDir(cameraId, date, hour);
            
            if (!await fs.pathExists(recordingDir)) {
                return null;
            }
            
            const files = await fs.readdir(recordingDir);
            const segments = files.filter(f => f.endsWith('.ts'));
            const playlist = files.find(f => f.endsWith('.m3u8'));
            
            let totalSize = 0;
            let earliestTime = null;
            let latestTime = null;
            
            for (const segment of segments) {
                const segmentPath = path.join(recordingDir, segment);
                const stats = await fs.stat(segmentPath);
                totalSize += stats.size;
                
                if (!earliestTime || stats.mtime < earliestTime) {
                    earliestTime = stats.mtime;
                }
                if (!latestTime || stats.mtime > latestTime) {
                    latestTime = stats.mtime;
                }
            }
            
            return {
                segmentCount: segments.length,
                hasPlaylist: !!playlist,
                totalSize,
                earliestTime,
                latestTime,
                durationMinutes: segments.length // Roughly, assuming 1 minute per segment
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
            const cameraDir = path.join(config.hlsPath, cameraId.toString());
            const liveDir = this.getLiveDir(cameraId);
            const recordingsDir = path.join(cameraDir, 'recordings');
            
            const liveSize = await this.getDirectorySize(liveDir);
            const recordingsSize = await this.getDirectorySize(recordingsDir);
            const totalSize = liveSize + recordingsSize;
            
            const dates = await this.getAvailableDates(cameraId);
            
            let recordingCount = 0;
            let oldestRecording = null;
            let newestRecording = null;
            
            for (const date of dates) {
                const hours = await this.getAvailableHours(cameraId, date);
                recordingCount += hours.length;
                
                if (hours.length > 0) {
                    const dateTime = moment(date + ' ' + hours[0], 'YYYY-MM-DD HH');
                    if (!oldestRecording || dateTime.isBefore(oldestRecording)) {
                        oldestRecording = dateTime;
                    }
                    
                    const latestDateTime = moment(date + ' ' + hours[hours.length - 1], 'YYYY-MM-DD HH');
                    if (!newestRecording || latestDateTime.isAfter(newestRecording)) {
                        newestRecording = latestDateTime;
                    }
                }
            }
            
            return {
                cameraId,
                totalSize,
                liveSize,
                recordingsSize,
                recordingCount,
                dateCount: dates.length,
                oldestRecording: oldestRecording ? oldestRecording.toISOString() : null,
                newestRecording: newestRecording ? newestRecording.toISOString() : null,
                formattedSize: this.formatBytes(totalSize)
            };
        } catch (error) {
            logger.error(`Failed to get storage stats for camera ${cameraId}:`, error);
            return null;
        }
    }

    // Get overall storage statistics
    async getOverallStorageStats() {
        try {
            const stats = {
                totalSize: 0,
                totalLiveSize: 0,
                totalRecordingsSize: 0,
                totalRecordingCount: 0,
                cameras: [],
                formattedTotalSize: ''
            };
            
            for (const cameraId of config.cameraIds) {
                const cameraStats = await this.getCameraStorageStats(cameraId);
                if (cameraStats) {
                    stats.totalSize += cameraStats.totalSize;
                    stats.totalLiveSize += cameraStats.liveSize;
                    stats.totalRecordingsSize += cameraStats.recordingsSize;
                    stats.totalRecordingCount += cameraStats.recordingCount;
                    stats.cameras.push(cameraStats);
                }
            }
            
            stats.formattedTotalSize = this.formatBytes(stats.totalSize);
            return stats;
        } catch (error) {
            logger.error('Failed to get overall storage stats:', error);
            return null;
        }
    }

    // Format bytes to human readable format
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Build time range URLs for playback
    buildTimeRange(startDate, startHour, endDate, endHour) {
        const urls = [];
        let current = moment(`${startDate} ${startHour}`, 'YYYY-MM-DD HH');
        const end = moment(`${endDate} ${endHour}`, 'YYYY-MM-DD HH');
        
        while (current.isSameOrBefore(end)) {
            urls.push({
                date: current.format('YYYY-MM-DD'),
                hour: current.format('HH'),
                timestamp: current.toISOString()
            });
            current.add(1, 'hour');
        }
        
        return urls;
    }

    // Get playback URLs for a time range
    async getPlaybackUrls(cameraId, startDate, startHour, endDate, endHour) {
        const timeRange = this.buildTimeRange(startDate, startHour, endDate, endHour);
        const urls = [];
        
        for (const timePoint of timeRange) {
            const exists = await this.recordingExists(cameraId, timePoint.date, timePoint.hour);
            
            if (exists) {
                urls.push({
                    ...timePoint,
                    url: this.getRecordingStreamWebUrl(cameraId, timePoint.date, timePoint.hour),
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

    // Validate date format (YYYY-MM-DD)
    isValidDate(date) {
        return moment(date, 'YYYY-MM-DD', true).isValid();
    }

    // Validate hour format (HH)
    isValidHour(hour) {
        return /^\d{2}$/.test(hour) && parseInt(hour) >= 0 && parseInt(hour) <= 23;
    }

    // Get recent hours (for dashboard)
    getRecentHours(count = 24) {
        const hours = [];
        let current = moment();
        
        for (let i = 0; i < count; i++) {
            hours.push({
                date: current.format('YYYY-MM-DD'),
                hour: current.format('HH'),
                timestamp: current.toISOString(),
                label: current.format('MMM DD, HH:mm')
            });
            
            current.subtract(1, 'hour');
        }
        
        return hours;
    }

    // Clean up empty directories
    async cleanupEmptyDirectories(cameraId) {
        try {
            const recordingsDir = path.join(config.hlsPath, cameraId.toString(), 'recordings');
            
            if (!await fs.pathExists(recordingsDir)) {
                return;
            }
            
            const dates = await fs.readdir(recordingsDir);
            
            for (const date of dates) {
                const dateDir = path.join(recordingsDir, date);
                const hours = await fs.readdir(dateDir);
                
                // Remove empty hour directories
                for (const hour of hours) {
                    const hourDir = path.join(dateDir, hour);
                    const files = await fs.readdir(hourDir);
                    
                    if (files.length === 0) {
                        await fs.remove(hourDir);
                        logger.debug(`Removed empty hour directory: ${hourDir}`);
                    }
                }
                
                // Remove empty date directories
                const remainingHours = await fs.readdir(dateDir);
                if (remainingHours.length === 0) {
                    await fs.remove(dateDir);
                    logger.debug(`Removed empty date directory: ${dateDir}`);
                }
            }
        } catch (error) {
            logger.error(`Failed to cleanup empty directories for camera ${cameraId}:`, error);
        }
    }

    // Cleanup all empty directories
    async cleanupAllEmptyDirectories() {
        for (const cameraId of config.cameraIds) {
            await this.cleanupEmptyDirectories(cameraId);
        }
    }
}

module.exports = { PathUtils }; 