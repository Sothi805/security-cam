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

    // Ensure all base directories exist with proper structure
    async ensureBaseDirectories() {
        for (const cameraId of config.cameraIds) {
            await this.ensureCameraStructure(cameraId);
        }
    }

    // Ensure complete camera directory structure exists
    async ensureCameraStructure(cameraId) {
        const cameraDir = this.getCameraDir(cameraId);
        const liveDir = this.getLiveDir(cameraId);
        const recordingsDir = this.getRecordingsBaseDir(cameraId);

        // Create base directories
        await fs.ensureDir(cameraDir);
        await fs.ensureDir(liveDir);
        await fs.ensureDir(recordingsDir);

        // Create current date and hour directories
        const date = moment().format('YYYY-MM-DD');
        const hour = moment().format('HH');
        await this.ensureDateHourDirs(cameraId, date, hour);

        logger.debug(`✅ Ensured directory structure for camera ${cameraId}`);
    }

    // Ensure date and hour directories exist
    async ensureDateHourDirs(cameraId, date, hour) {
        const dateDir = path.join(this.getRecordingsBaseDir(cameraId), date);
        const hourDir = path.join(dateDir, hour);
        
        await fs.ensureDir(dateDir);
        await fs.ensureDir(hourDir);
        
        return hourDir;
    }

    // Get camera base directory
    getCameraDir(cameraId) {
        return path.join(config.paths.hls, cameraId.toString());
    }

    // Get live streaming directory
    getLiveDir(cameraId) {
        return path.join(this.getCameraDir(cameraId), 'live');
    }

    // Get recordings base directory
    getRecordingsBaseDir(cameraId) {
        return path.join(this.getCameraDir(cameraId), 'recordings');
    }

    // Get specific recording directory
    getRecordingDir(cameraId, date, hour) {
        return path.join(this.getRecordingsBaseDir(cameraId), date, hour);
    }

    // Alias for getRecordingDir (for backward compatibility)
    getRecordingsDir(cameraId, date, hour) {
        return this.getRecordingDir(cameraId, date, hour);
    }

    // Get live stream playlist path
    getLivePlaylistPath(cameraId) {
        return path.join(this.getLiveDir(cameraId), 'live.m3u8');
    }

    // Get recording playlist path
    getRecordingPlaylistPath(cameraId, date, hour) {
        return path.join(this.getRecordingDir(cameraId, date, hour), 'playlist.m3u8');
    }

    // Get live segment path pattern
    getLiveSegmentPattern(cameraId) {
        return path.join(this.getLiveDir(cameraId), 'segment%d.ts');
    }

    // Get recording segment path pattern
    getRecordingSegmentPattern(cameraId, date, hour) {
        return path.join(this.getRecordingDir(cameraId, date, hour), '%M.ts');
    }

    // Validate directory structure
    async validateStructure(cameraId) {
        const errors = [];
        
        // Check base directories
        const cameraDir = this.getCameraDir(cameraId);
        const liveDir = this.getLiveDir(cameraId);
        const recordingsDir = this.getRecordingsBaseDir(cameraId);

        if (!await fs.pathExists(cameraDir)) {
            errors.push(`Camera directory missing: ${cameraDir}`);
        }
        if (!await fs.pathExists(liveDir)) {
            errors.push(`Live directory missing: ${liveDir}`);
        }
        if (!await fs.pathExists(recordingsDir)) {
            errors.push(`Recordings directory missing: ${recordingsDir}`);
        }

        // Check current date/hour directories
        const date = moment().format('YYYY-MM-DD');
        const hour = moment().format('HH');
        const currentHourDir = this.getRecordingDir(cameraId, date, hour);

        if (!await fs.pathExists(currentHourDir)) {
            errors.push(`Current hour directory missing: ${currentHourDir}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Clean up empty directories
    async cleanupEmptyDirs(cameraId) {
        const recordingsDir = this.getRecordingsBaseDir(cameraId);
        
        if (!await fs.pathExists(recordingsDir)) {
            return;
        }

        const dates = await fs.readdir(recordingsDir);
        
        for (const date of dates) {
            if (!this.isValidDate(date)) continue;
            
            const dateDir = path.join(recordingsDir, date);
            const hours = await fs.readdir(dateDir);
            
            // Clean up empty hour directories
            for (const hour of hours) {
                if (!this.isValidHour(hour)) continue;
                
                const hourDir = path.join(dateDir, hour);
                const files = await fs.readdir(hourDir);
                
                if (files.length === 0) {
                    await fs.remove(hourDir);
                    logger.debug(`Removed empty hour directory: ${hourDir}`);
                }
            }
            
            // Clean up empty date directories
            const remainingHours = await fs.readdir(dateDir);
            if (remainingHours.length === 0) {
                await fs.remove(dateDir);
                logger.debug(`Removed empty date directory: ${dateDir}`);
            }
        }
    }

    // Validate date format
    isValidDate(date) {
        return moment(date, 'YYYY-MM-DD', true).isValid();
    }

    // Validate hour format
    isValidHour(hour) {
        return /^\d{2}$/.test(hour) && parseInt(hour) >= 0 && parseInt(hour) <= 23;
    }

    // Get available dates for a camera
    async getAvailableDates(cameraId) {
        try {
            const recordingsDir = this.getRecordingsBaseDir(cameraId);
            
            if (!await fs.pathExists(recordingsDir)) {
                return [];
            }

            const items = await fs.readdir(recordingsDir);
            const dates = items.filter(item => this.isValidDate(item));
            
            return dates.sort().reverse(); // Most recent first
        } catch (error) {
            logger.error(`Failed to get available dates for camera ${cameraId}:`, error);
            return [];
        }
    }

    // Get available hours for a camera and date
    async getAvailableHours(cameraId, date) {
        try {
            const dateDir = path.join(this.getRecordingsBaseDir(cameraId), date);
            
            if (!await fs.pathExists(dateDir)) {
                return [];
            }

            const items = await fs.readdir(dateDir);
            const hours = items.filter(item => {
                return this.isValidHour(item) && this.hasValidRecordings(cameraId, date, item);
            });
            
            return hours.sort(); // Chronological order
        } catch (error) {
            logger.error(`Failed to get available hours for camera ${cameraId} on ${date}:`, error);
            return [];
        }
    }

    // Check if hour directory has valid recordings
    async hasValidRecordings(cameraId, date, hour) {
        const hourDir = this.getRecordingDir(cameraId, date, hour);
        
        try {
            const files = await fs.readdir(hourDir);
            return files.some(f => f.endsWith('.ts') || f.endsWith('.m3u8'));
        } catch (error) {
            return false;
        }
    }

    // Get live stream web URL
    getLiveStreamWebUrl(cameraId) {
        return `/hls/${cameraId}/live/live.m3u8`;
    }

    // Get recording stream web URL
    getRecordingStreamWebUrl(cameraId, date, hour) {
        return `/hls/${cameraId}/recordings/${date}/${hour}/playlist.m3u8`;
    }

    // Get recording stats for specific date and hour
    async getRecordingStats(cameraId, date, hour) {
        try {
            const recordingDir = this.getRecordingDir(cameraId, date, hour);
            
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
            const cameraDir = this.getCameraDir(cameraId);
            const liveDir = this.getLiveDir(cameraId);
            const recordingsDir = this.getRecordingsBaseDir(cameraId);
            
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
            const exists = await this.hasValidRecordings(cameraId, timePoint.date, timePoint.hour);
            
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

    // Check if recording exists for specific date and hour
    async recordingExists(cameraId, date, hour) {
        const hourDir = this.getRecordingDir(cameraId, date, hour);
        
        try {
            if (!await fs.pathExists(hourDir)) {
                return false;
            }
            
            const files = await fs.readdir(hourDir);
            const hasSegments = files.some(f => f.endsWith('.ts'));
            const hasPlaylist = files.some(f => f.endsWith('.m3u8'));
            
            return hasSegments && hasPlaylist;
        } catch (error) {
            return false;
        }
    }

    // Get live stream health check
    async getLiveStreamHealth(cameraId) {
        const liveDir = this.getLiveDir(cameraId);
        const playlistPath = this.getLivePlaylistPath(cameraId);
        
        try {
            // Check if playlist exists
            if (!await fs.pathExists(playlistPath)) {
                return { healthy: false, reason: 'Playlist file missing' };
            }
            
            // Read playlist content
            const content = await fs.readFile(playlistPath, 'utf8');
            const segments = content.match(/segment\d+\.ts/g) || [];
            
            if (segments.length === 0) {
                return { healthy: false, reason: 'No segments in playlist' };
            }
            
            // Check latest segment
            const latestSegment = segments[segments.length - 1];
            const segmentPath = path.join(liveDir, latestSegment);
            
            if (!await fs.pathExists(segmentPath)) {
                return { healthy: false, reason: 'Latest segment missing' };
            }
            
            const stats = await fs.stat(segmentPath);
            const age = Date.now() - stats.mtimeMs;
            
            // If latest segment is too old (more than 10 seconds for live)
            if (age > 10000) {
                return { healthy: false, reason: 'Stream not updating' };
            }
            
            // Check segment size (at least 5KB for valid video)
            if (stats.size < 5000) {
                return { healthy: false, reason: 'Invalid segment size' };
            }
            
            return { 
                healthy: true, 
                lastSegmentAge: age,
                segmentCount: segments.length,
                lastSegmentSize: stats.size
            };
        } catch (error) {
            return { healthy: false, reason: `Health check error: ${error.message}` };
        }
    }
}

// Export a singleton instance instead of the class
module.exports = new PathUtils(); 