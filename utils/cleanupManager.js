const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const schedule = require('node-schedule');
const config = require('./config');
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
                const cameraStats = await this.cleanupCamera(cameraId);
                stats.cameraStats[cameraId] = cameraStats;
                stats.totalDirsChecked += cameraStats.dirsChecked;
                stats.totalFilesDeleted += cameraStats.filesDeleted;
                stats.totalDirsDeleted += cameraStats.dirsDeleted;
                stats.totalBytesFreed += cameraStats.bytesFreed;
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
        const stats = {
            dirsChecked: 0,
            filesDeleted: 0,
            dirsDeleted: 0,
            bytesFreed: 0
        };

        try {
            const cameraDir = config.getCameraDirectory(cameraId);
            
            if (!await fs.pathExists(cameraDir)) {
                return stats;
            }

            logger.debug(`Cleaning up camera ${cameraId}`);

            // Get cutoff date for retention
            const cutoffDate = moment().subtract(config.retentionDays, 'days');
            
            // Get all date directories
            const dateDirs = await fs.readdir(cameraDir);
            
            for (const dateDir of dateDirs) {
                const datePath = path.join(cameraDir, dateDir);
                const stat = await fs.stat(datePath);
                
                if (!stat.isDirectory()) {
                    continue;
                }

                stats.dirsChecked++;

                // Check if date directory is old enough to delete
                const dirDate = moment(dateDir, 'YYYY-MM-DD');
                
                if (!dirDate.isValid()) {
                    logger.warn(`Invalid date directory found: ${dateDir}`);
                    continue;
                }

                if (dirDate.isBefore(cutoffDate)) {
                    // Delete entire date directory
                    const dirStats = await this.deleteDirectory(datePath);
                    stats.filesDeleted += dirStats.filesDeleted;
                    stats.dirsDeleted += 1;
                    stats.bytesFreed += dirStats.bytesFreed;
                    
                    logger.debug(`Deleted old date directory: ${cameraId}/${dateDir}`);
                } else {
                    // Clean up old segments within the date directory
                    const segmentStats = await this.cleanupDateDirectory(cameraId, dateDir, datePath);
                    stats.filesDeleted += segmentStats.filesDeleted;
                    stats.bytesFreed += segmentStats.bytesFreed;
                }
            }

            // Clean up empty camera directory if needed
            const remainingItems = await fs.readdir(cameraDir);
            if (remainingItems.length === 0) {
                await fs.remove(cameraDir);
                stats.dirsDeleted++;
                logger.debug(`Removed empty camera directory: ${cameraId}`);
            }

        } catch (error) {
            logger.error(`Failed to cleanup camera ${cameraId}:`, error);
        }

        return stats;
    }

    // Clean up segments within a date directory (for partial day cleanup)
    async cleanupDateDirectory(cameraId, dateDir, datePath) {
        const stats = {
            filesDeleted: 0,
            bytesFreed: 0
        };

        try {
            const files = await fs.readdir(datePath);
            const now = moment();
            const dirDate = moment(dateDir, 'YYYY-MM-DD');
            
            for (const file of files) {
                const filePath = path.join(datePath, file);
                const fileStat = await fs.stat(filePath);
                
                if (fileStat.isFile() && (file.endsWith('.m3u8') || file.endsWith('.ts'))) {
                    // For current date, keep files from last few hours
                    if (dirDate.isSame(now, 'day')) {
                        const fileHour = this.extractHourFromFilename(file);
                        if (fileHour) {
                            const fileTime = dirDate.clone().add(fileHour.hour, 'hours').add(fileHour.minute, 'minutes');
                            const ageHours = now.diff(fileTime, 'hours');
                            
                            // Keep files from last 2 hours to ensure current streams are not affected
                            if (ageHours < 2) {
                                continue;
                            }
                        }
                    }
                    
                    // Check if file is too old based on more granular rules
                    const fileAge = now.diff(moment(fileStat.mtime), 'hours');
                    
                    // Delete segments older than retention + safety margin
                    if (fileAge > (config.retentionDays * 24 + 6)) {
                        stats.bytesFreed += fileStat.size;
                        await fs.remove(filePath);
                        stats.filesDeleted++;
                        
                        logger.debug(`Deleted old segment: ${cameraId}/${dateDir}/${file}`);
                    }
                }
            }

        } catch (error) {
            logger.error(`Failed to cleanup date directory ${cameraId}/${dateDir}:`, error);
        }

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

    // Extract hour and minute from filename (HH-mm format)
    extractHourFromFilename(filename) {
        const match = filename.match(/^(\d{2})-(\d{2})/);
        if (match) {
            return {
                hour: parseInt(match[1]),
                minute: parseInt(match[2])
            };
        }
        return null;
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
            const cameraDir = config.getCameraDirectory(cameraId);
            
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
            const hlsPath = config.hlsPath;
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
                hlsPath: config.hlsPath,
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
                const cameraDir = config.getCameraDirectory(cameraId);
                
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

    // Check if file matches expected segment patterns
    isValidSegmentFile(filename) {
        // Valid patterns: HH-mm-low.m3u8, HH-mm-high.m3u8, HH-mm-low_XXX.ts, HH-mm-high_XXX.ts
        const patterns = [
            /^\d{2}-\d{2}-(low|high)\.m3u8$/,
            /^\d{2}-\d{2}-(low|high)_\d{3}\.ts$/
        ];
        
        return patterns.some(pattern => pattern.test(filename));
    }
}

module.exports = new CleanupManager(); 