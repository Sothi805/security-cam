const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const schedule = require('node-schedule');
const config = require('./config');
const pathUtils = require('./pathUtils');
const { logger } = require('./logger');

class CleanupManager {
    constructor() {
        this.cleanupJob = null;
        this.isRunning = false;
    }

    // Start the cleanup scheduler
    start() {
        logger.info('Starting cleanup manager');
        
        // Run cleanup every hour at minute 5 (5 minutes after rotation)
        this.cleanupJob = schedule.scheduleJob('5 * * * *', () => {
            this.runCleanup();
        });
        
        // Run initial cleanup after 1 minute
        setTimeout(() => {
            this.runCleanup();
        }, 60000);
        
        logger.info(`Cleanup scheduled every hour (retention: ${config.retentionDays} days)`);
    }

    // Stop the cleanup scheduler
    stop() {
        if (this.cleanupJob) {
            this.cleanupJob.cancel();
            this.cleanupJob = null;
        }
        logger.info('Cleanup manager stopped');
    }

    // Run cleanup process
    async runCleanup() {
        if (this.isRunning) {
            logger.debug('Cleanup already running, skipping');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        
        try {
            logger.info('Starting cleanup process');
            
            const stats = {
                totalDirsChecked: 0,
                totalFilesDeleted: 0,
                totalDirsDeleted: 0,
                totalBytesFreed: 0,
                cameraStats: {}
            };

            // Clean up each camera
            for (const cameraId of config.cameraIds) {
                // First validate and fix directory structure
                const validation = await pathUtils.validateStructure(cameraId);
                if (!validation.valid) {
                    logger.warn(`Invalid directory structure for camera ${cameraId}:`, validation.errors);
                    await pathUtils.ensureCameraStructure(cameraId);
                }

                // Clean up old recordings
                const cameraStats = await this.cleanupCamera(cameraId);
                stats.cameraStats[cameraId] = cameraStats;
                stats.totalDirsChecked += cameraStats.dirsChecked;
                stats.totalFilesDeleted += cameraStats.filesDeleted;
                stats.totalDirsDeleted += cameraStats.dirsDeleted;
                stats.totalBytesFreed += cameraStats.bytesFreed;

                // Clean up empty directories
                await pathUtils.cleanupEmptyDirs(cameraId);
            }

            const duration = Date.now() - startTime;
            logger.info('Cleanup completed', {
                duration: `${duration}ms`,
                ...stats
            });

        } catch (error) {
            logger.error('Cleanup process failed:', error);
        } finally {
            this.isRunning = false;
        }
    }

    // Clean up segments for a specific camera
    async cleanupCamera(cameraId) {
        const recordingsDir = pathUtils.getRecordingsBaseDir(cameraId);
        const stats = {
            dirsChecked: 0,
            filesDeleted: 0,
            dirsDeleted: 0,
            bytesFreed: 0
        };

        if (!await fs.pathExists(recordingsDir)) {
            return stats;
        }

        const dates = await fs.readdir(recordingsDir);
        
        for (const date of dates) {
            if (!pathUtils.isValidDate(date)) {
                logger.debug(`Skipping invalid date directory: ${date}`);
                continue;
            }

            const dateDir = path.join(recordingsDir, date);
            const itemStats = await fs.stat(dateDir);
            
            if (itemStats.isDirectory()) {
                stats.dirsChecked++;
                const itemDate = moment(date, 'YYYY-MM-DD');
                
                if (itemDate.isValid()) {
                    const daysDiff = moment().diff(itemDate, 'days');
                    
                    if (daysDiff >= config.retentionDays) {
                        logger.info(`Deleting old recordings for camera ${cameraId}, date: ${date}`);
                        const deletedStats = await this.deleteRecursively(dateDir);
                        stats.filesDeleted += deletedStats.filesDeleted;
                        stats.dirsDeleted += deletedStats.dirsDeleted;
                        stats.bytesFreed += deletedStats.bytesFreed;
                    } else {
                        // For current dates, clean up old segments
                        const hourStats = await this.cleanupDateDirectory(cameraId, date, dateDir);
                        stats.filesDeleted += hourStats.filesDeleted;
                        stats.bytesFreed += hourStats.bytesFreed;
                    }
                }
            }
        }

        return stats;
    }

    // Clean up segments within a date directory
    async cleanupDateDirectory(cameraId, dateDir, datePath) {
        const stats = {
            filesDeleted: 0,
            bytesFreed: 0
        };

        try {
            const hours = await fs.readdir(datePath);
            const now = moment();
            const dirDate = moment(dateDir, 'YYYY-MM-DD');
            
            for (const hour of hours) {
                if (!pathUtils.isValidHour(hour)) continue;
                
                const hourDir = path.join(datePath, hour);
                const files = await fs.readdir(hourDir);
                
                for (const file of files) {
                    if (!this.isValidSegmentFile(file)) {
                        // Remove invalid files
                        const filePath = path.join(hourDir, file);
                        await fs.remove(filePath);
                        stats.filesDeleted++;
                        continue;
                    }

                    const filePath = path.join(hourDir, file);
                    const fileStat = await fs.stat(filePath);
                    
                    // For current date, keep files from last few hours
                    if (dirDate.isSame(now, 'day')) {
                        const fileHour = parseInt(hour);
                        const currentHour = parseInt(now.format('HH'));
                        const hourDiff = currentHour - fileHour;
                        
                        // Keep files from last 6 hours
                        if (hourDiff < 6) {
                            continue;
                        }
                    }
                    
                    // Delete segments older than retention period
                    const fileAge = now.diff(moment(fileStat.mtime), 'days');
                    if (fileAge >= config.retentionDays) {
                        stats.bytesFreed += fileStat.size;
                        await fs.remove(filePath);
                        stats.filesDeleted++;
                    }
                }
            }
        } catch (error) {
            logger.error(`Failed to cleanup date directory ${cameraId}/${dateDir}:`, error);
        }

        return stats;
    }

    // Recursively delete directory and count stats
    async deleteRecursively(dirPath) {
        const stats = {
            filesDeleted: 0,
            dirsDeleted: 0,
            bytesFreed: 0
        };

        try {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const itemStats = await fs.stat(itemPath);
                
                if (itemStats.isDirectory()) {
                    const subStats = await this.deleteRecursively(itemPath);
                    stats.filesDeleted += subStats.filesDeleted;
                    stats.dirsDeleted += subStats.dirsDeleted;
                    stats.bytesFreed += subStats.bytesFreed;
                } else {
                    stats.bytesFreed += itemStats.size;
                    await fs.remove(itemPath);
                    stats.filesDeleted++;
                }
            }
            
            await fs.remove(dirPath);
            stats.dirsDeleted++;
            
        } catch (error) {
            logger.error(`Failed to delete directory ${dirPath}:`, error);
        }

        return stats;
    }

    // Check if file matches expected segment patterns
    isValidSegmentFile(filename) {
        const patterns = [
            /^\d{2}\.ts$/,      // Recording segments: 00.ts, 01.ts, etc.
            /^playlist\.m3u8$/  // Recording playlist
        ];
        
        return patterns.some(pattern => pattern.test(filename));
    }

    // Force cleanup all old files beyond retention
    async forceCleanup() {
        logger.info('Starting force cleanup');
        await this.runCleanup();
    }

    // Get cleanup statistics
    async getCleanupStats() {
        const stats = {
            totalSize: 0,
            cameraStats: {},
            oldestSegment: null,
            newestSegment: null
        };

        try {
            for (const cameraId of config.cameraIds) {
                const cameraStats = await this.getCameraStats(cameraId);
                stats.cameraStats[cameraId] = cameraStats;
                stats.totalSize += cameraStats.totalSize;
                
                if (cameraStats.oldestSegment) {
                    if (!stats.oldestSegment || cameraStats.oldestSegment < stats.oldestSegment) {
                        stats.oldestSegment = cameraStats.oldestSegment;
                    }
                }
                
                if (cameraStats.newestSegment) {
                    if (!stats.newestSegment || cameraStats.newestSegment > stats.newestSegment) {
                        stats.newestSegment = cameraStats.newestSegment;
                    }
                }
            }

        } catch (error) {
            logger.error('Failed to get cleanup stats:', error);
        }

        return stats;
    }

    // Get statistics for a specific camera
    async getCameraStats(cameraId) {
        const stats = {
            totalSize: 0,
            fileCount: 0,
            dateCount: 0,
            oldestSegment: null,
            newestSegment: null
        };

        try {
            const cameraDir = pathUtils.getCameraDir(cameraId);
            
            if (!await fs.pathExists(cameraDir)) {
                return stats;
            }

            const dateDirs = await fs.readdir(cameraDir);
            
            for (const dateDir of dateDirs) {
                const datePath = path.join(cameraDir, dateDir);
                const dateStat = await fs.stat(datePath);
                
                if (!dateStat.isDirectory()) {
                    continue;
                }

                stats.dateCount++;
                
                const files = await fs.readdir(datePath);
                
                for (const file of files) {
                    const filePath = path.join(datePath, file);
                    const fileStat = await fs.stat(filePath);
                    
                    if (fileStat.isFile()) {
                        stats.fileCount++;
                        stats.totalSize += fileStat.size;
                        
                        const fileTime = moment(fileStat.mtime);
                        
                        if (!stats.oldestSegment || fileTime.isBefore(stats.oldestSegment)) {
                            stats.oldestSegment = fileTime.toISOString();
                        }
                        
                        if (!stats.newestSegment || fileTime.isAfter(stats.newestSegment)) {
                            stats.newestSegment = fileTime.toISOString();
                        }
                    }
                }
            }

        } catch (error) {
            logger.error(`Failed to get stats for camera ${cameraId}:`, error);
        }

        return stats;
    }

    // Get available storage space information
    async getStorageInfo() {
        try {
            const hlsPath = config.paths.hls;
            const stats = await fs.stat(hlsPath);
            
            // This is a simplified storage check - in production you might want
            // to use a more sophisticated method to get disk usage
            return {
                hlsPath,
                accessible: true,
                lastCheck: moment().toISOString()
            };
            
        } catch (error) {
            logger.error('Failed to get storage info:', error);
            return {
                hlsPath: config.paths.hls,
                accessible: false,
                error: error.message,
                lastCheck: moment().toISOString()
            };
        }
    }

    // Clean up orphaned files (files that don't match expected patterns)
    async cleanupOrphanedFiles() {
        logger.info('Starting orphaned files cleanup');
        
        const stats = {
            orphanedFiles: 0,
            bytesFreed: 0
        };

        try {
            for (const cameraId of config.cameraIds) {
                const cameraDir = pathUtils.getCameraDir(cameraId);
                
                if (!await fs.pathExists(cameraDir)) {
                    continue;
                }

                const cameraStats = await this.cleanupOrphanedInCamera(cameraDir);
                stats.orphanedFiles += cameraStats.orphanedFiles;
                stats.bytesFreed += cameraStats.bytesFreed;
            }

            logger.info('Orphaned files cleanup completed', stats);

        } catch (error) {
            logger.error('Orphaned files cleanup failed:', error);
        }

        return stats;
    }

    // Clean orphaned files in a camera directory
    async cleanupOrphanedInCamera(cameraDir) {
        const stats = {
            orphanedFiles: 0,
            bytesFreed: 0
        };

        const walkDir = async (dir) => {
            const items = await fs.readdir(dir);
            
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const itemStat = await fs.stat(itemPath);
                
                if (itemStat.isDirectory()) {
                    // Check if directory name matches expected date format
                    if (!moment(item, 'YYYY-MM-DD', true).isValid()) {
                        // Orphaned directory
                        const dirStats = await this.deleteDirectory(itemPath);
                        stats.orphanedFiles += dirStats.filesDeleted;
                        stats.bytesFreed += dirStats.bytesFreed;
                        logger.debug(`Removed orphaned directory: ${itemPath}`);
                    } else {
                        await walkDir(itemPath);
                    }
                } else {
                    // Check if file matches expected patterns
                    if (!this.isValidSegmentFile(item)) {
                        stats.orphanedFiles++;
                        stats.bytesFreed += itemStat.size;
                        await fs.remove(itemPath);
                        logger.debug(`Removed orphaned file: ${itemPath}`);
                    }
                }
            }
        };

        await walkDir(cameraDir);
        return stats;
    }

    // Delete entire directory and return stats
    async deleteDirectory(dirPath) {
        const stats = {
            filesDeleted: 0,
            bytesFreed: 0
        };

        try {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const itemStat = await fs.stat(itemPath);
                
                if (itemStat.isFile()) {
                    stats.filesDeleted++;
                    stats.bytesFreed += itemStat.size;
                } else if (itemStat.isDirectory()) {
                    const subStats = await this.deleteDirectory(itemPath);
                    stats.filesDeleted += subStats.filesDeleted;
                    stats.bytesFreed += subStats.bytesFreed;
                }
            }
            
            await fs.remove(dirPath);
            
        } catch (error) {
            logger.error(`Failed to delete directory ${dirPath}:`, error);
        }

        return stats;
    }
}

module.exports = new CleanupManager(); 