const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const cron = require('node-cron');
const config = require('./config');
const PathUtils = require('./pathUtils');
const { cleanupLogger, systemLogger } = require('./logger');

class CleanupManager {
  constructor() {
    this.cleanupJob = null;
    this.isRunning = false;
  }

  /**
   * Start automatic cleanup scheduling
   */
  start() {
    if (this.cleanupJob) {
      cleanupLogger.warn('Cleanup manager is already running');
      return;
    }

    // Run cleanup every X minutes based on config
    const intervalMinutes = config.storage.cleanupIntervalMinutes;
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    this.cleanupJob = cron.schedule(cronExpression, async () => {
      await this.performCleanup();
    }, {
      scheduled: false
    });

    this.cleanupJob.start();
    cleanupLogger.info(`Cleanup manager started with ${intervalMinutes} minute intervals`);

    // Run initial cleanup
    setTimeout(() => this.performCleanup(), config.storage.initialCleanupDelaySeconds * 1000);
  }

  /**
   * Stop automatic cleanup
   */
  stop() {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
      cleanupLogger.info('Cleanup manager stopped');
    }
  }

  /**
   * Perform comprehensive cleanup
   */
  async performCleanup() {
    if (this.isRunning) {
      cleanupLogger.warn('Cleanup already in progress, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      cleanupLogger.info('Starting cleanup process');
      
      const results = {
        cameras: config.cameras.ids.length,
        totalFilesRemoved: 0,
        totalSpaceFreed: 0,
        errors: []
      };

      // Clean up each camera
      for (const cameraId of config.cameras.ids) {
        try {
          const cameraResult = await this.cleanupCamera(cameraId);
          results.totalFilesRemoved += cameraResult.filesRemoved;
          results.totalSpaceFreed += cameraResult.spaceFreed;
        } catch (error) {
          const errorMsg = `Failed to cleanup camera ${cameraId}: ${error.message}`;
          results.errors.push(errorMsg);
          cleanupLogger.error(errorMsg, error);
        }
      }

      // Additional cleanup tasks
      await this.cleanupLogs();
      await this.cleanupTempFiles();

      const duration = Date.now() - startTime;
      cleanupLogger.info('Cleanup completed', {
        duration: `${duration}ms`,
        filesRemoved: results.totalFilesRemoved,
        spaceFreed: `${results.totalSpaceFreed.toFixed(2)} MB`,
        errors: results.errors.length
      });

      // Log storage status
      await this.logStorageStatus();

    } catch (error) {
      cleanupLogger.error('Cleanup process failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up segments for a specific camera
   */
  async cleanupCamera(cameraId) {
    const result = {
      filesRemoved: 0,
      spaceFreed: 0
    };

    cleanupLogger.debug(`Cleaning up camera ${cameraId}`);
    
    try {
      // Get expired segments
      const expiredSegments = await PathUtils.getExpiredSegments(cameraId);
      
      for (const segment of expiredSegments) {
        try {
          // Calculate size before deletion
          const playlistSize = await PathUtils.getFileSize(segment.playlist);
          const segmentDirSize = await PathUtils.getDirectorySize(segment.segmentDir);
          
          // Remove playlist file
          if (await fs.pathExists(segment.playlist)) {
            await fs.remove(segment.playlist);
            result.filesRemoved++;
            cleanupLogger.debug(`Removed playlist: ${segment.playlist}`);
          }

          // Remove segment directory and all its contents
          if (await fs.pathExists(segment.segmentDir)) {
            await fs.remove(segment.segmentDir);
            result.filesRemoved++;
            cleanupLogger.debug(`Removed segment directory: ${segment.segmentDir}`);
          }

          result.spaceFreed += playlistSize + segmentDirSize;

        } catch (error) {
          cleanupLogger.error(`Failed to remove segment ${segment.playlist}:`, error);
        }
      }

      // Clean up empty date directories
      await this.cleanupEmptyDirectories(cameraId);

    } catch (error) {
      cleanupLogger.error(`Camera cleanup failed for ${cameraId}:`, error);
      throw error;
    }

    if (result.filesRemoved > 0) {
      cleanupLogger.info(`Camera ${cameraId} cleanup completed`, {
        filesRemoved: result.filesRemoved,
        spaceFreed: `${result.spaceFreed.toFixed(2)} MB`
      });
    }

    return result;
  }

  /**
   * Remove empty date directories
   */
  async cleanupEmptyDirectories(cameraId) {
    try {
      const cameraDir = path.join(config.hls.root, cameraId);
      const dates = await PathUtils.getAvailableDates(cameraId);

      for (const date of dates) {
        const dateDir = path.join(cameraDir, date);
        
        try {
          const items = await fs.readdir(dateDir);
          const nonEmptyItems = [];

          // Check each item in the date directory
          for (const item of items) {
            const itemPath = path.join(dateDir, item);
            const stats = await fs.stat(itemPath);

            if (stats.isDirectory()) {
              // Check if directory has any files
              const dirItems = await fs.readdir(itemPath);
              if (dirItems.length > 0) {
                nonEmptyItems.push(item);
              } else {
                // Remove empty directory
                await fs.remove(itemPath);
                cleanupLogger.debug(`Removed empty directory: ${itemPath}`);
              }
            } else {
              // Check if file is a valid playlist with recent activity
              const fileAge = Date.now() - stats.mtime.getTime();
              const retentionMs = config.storage.retentionMinutes * 60 * 1000;
              
              if (fileAge < retentionMs) {
                nonEmptyItems.push(item);
              }
            }
          }

          // If no non-empty items remain, remove the date directory
          if (nonEmptyItems.length === 0) {
            await fs.remove(dateDir);
            cleanupLogger.debug(`Removed empty date directory: ${dateDir}`);
          }

        } catch (error) {
          cleanupLogger.debug(`Could not process date directory ${dateDir}:`, error.message);
        }
      }
    } catch (error) {
      cleanupLogger.error(`Failed to cleanup empty directories for camera ${cameraId}:`, error);
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupLogs() {
    try {
      const logsDir = path.join(__dirname, '..', 'logs');
      const retentionDays = config.monitoring.logRetentionDays;
      const cutoffDate = moment().subtract(retentionDays, 'days');

      if (await fs.pathExists(logsDir)) {
        const logFiles = await fs.readdir(logsDir);
        
        for (const file of logFiles) {
          const filePath = path.join(logsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile() && moment(stats.mtime).isBefore(cutoffDate)) {
            await fs.remove(filePath);
            cleanupLogger.debug(`Removed old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      cleanupLogger.error('Failed to cleanup logs:', error);
    }
  }

  /**
   * Clean up temporary files and orphaned segments
   */
  async cleanupTempFiles() {
    try {
      const hlsRoot = config.hls.root;
      
      if (await fs.pathExists(hlsRoot)) {
        // Find and remove orphaned .tmp files
        await this.removeOrphanedFiles(hlsRoot, '.tmp');
        
        // Find and remove very old segment files that might be orphaned
        await this.removeOldOrphanedSegments(hlsRoot);
      }
    } catch (error) {
      cleanupLogger.error('Failed to cleanup temp files:', error);
    }
  }

  /**
   * Remove orphaned files with specific extension
   */
  async removeOrphanedFiles(rootDir, extension) {
    const maxAgeMs = config.storage.orphanedFileMaxAgeHours * 60 * 60 * 1000;
    
    const walk = async (dir) => {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await walk(itemPath);
        } else if (item.endsWith(extension)) {
          // Remove files older than configured age
          const fileAge = Date.now() - stats.mtime.getTime();
          if (fileAge > maxAgeMs) {
            await fs.remove(itemPath);
            cleanupLogger.debug(`Removed orphaned file: ${itemPath}`);
          }
        }
      }
    };

    await walk(rootDir);
  }

  /**
   * Remove old orphaned segment files
   */
  async removeOldOrphanedSegments(rootDir) {
    const maxAge = config.storage.retentionMinutes * 60 * 1000 + 
                   (config.storage.orphanedFileMaxAgeHours * 60 * 60 * 1000); // retention + buffer
    
    const walk = async (dir) => {
      try {
        const items = await fs.readdir(dir);
        
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stats = await fs.stat(itemPath);
          
          if (stats.isDirectory()) {
            await walk(itemPath);
          } else if (item.endsWith('.ts')) {
            const fileAge = Date.now() - stats.mtime.getTime();
            if (fileAge > maxAge) {
              await fs.remove(itemPath);
              cleanupLogger.debug(`Removed orphaned segment: ${itemPath}`);
            }
          }
        }
      } catch (error) {
        // Ignore errors for non-existent directories
      }
    };

    await walk(rootDir);
  }

  /**
   * Log current storage status
   */
  async logStorageStatus() {
    try {
      const totalSize = await PathUtils.getDirectorySize(config.hls.root);
      const maxSize = config.storage.maxStorageGB * 1024; // Convert GB to MB
      const usagePercent = (totalSize / maxSize) * 100;

      systemLogger.info('Storage status', {
        totalSize: `${totalSize.toFixed(2)} MB`,
        maxSize: `${maxSize.toFixed(0)} MB`,
        usagePercent: `${usagePercent.toFixed(1)}%`
      });

      // Warning if storage is getting full
      if (usagePercent > config.storage.warningThreshold) {
        systemLogger.warn(`Storage usage is high: ${usagePercent.toFixed(1)}%`);
      }

      // Emergency cleanup if storage is critical
      if (usagePercent > config.storage.emergencyCleanupThreshold) {
        systemLogger.error(`Storage usage critical: ${usagePercent.toFixed(1)}%. Performing emergency cleanup.`);
        await this.performEmergencyCleanup();
      }

    } catch (error) {
      systemLogger.error('Failed to log storage status:', error);
    }
  }

  /**
   * Perform emergency cleanup when storage is critical
   */
  async performEmergencyCleanup() {
    try {
      cleanupLogger.warn('Performing emergency cleanup');
      
      // Reduce retention period temporarily to 50% of configured value
      const originalRetention = config.storage.retentionMinutes;
      config.storage.retentionMinutes = Math.floor(originalRetention * 0.5);
      
      // Perform aggressive cleanup
      await this.performCleanup();
      
      // Restore original retention period
      config.storage.retentionMinutes = originalRetention;
      
      cleanupLogger.info('Emergency cleanup completed');
    } catch (error) {
      cleanupLogger.error('Emergency cleanup failed:', error);
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    const stats = {
      nextCleanup: this.cleanupJob ? this.cleanupJob.getStatus() : null,
      isRunning: this.isRunning,
      retentionMinutes: config.storage.retentionMinutes,
      cleanupInterval: config.storage.cleanupIntervalMinutes,
      storageLimit: config.storage.maxStorageGB
    };

    try {
      const currentSize = await PathUtils.getDirectorySize(config.hls.root);
      const maxSize = config.storage.maxStorageGB * 1024;
      
      stats.storage = {
        currentSize: `${currentSize.toFixed(2)} MB`,
        maxSize: `${maxSize.toFixed(0)} MB`,
        usagePercent: `${((currentSize / maxSize) * 100).toFixed(1)}%`
      };
    } catch (error) {
      stats.storage = { error: error.message };
    }

    return stats;
  }

  /**
   * Manual cleanup trigger
   */
  async triggerManualCleanup() {
    if (this.isRunning) {
      throw new Error('Cleanup is already running');
    }
    
    cleanupLogger.info('Manual cleanup triggered');
    await this.performCleanup();
  }
}

module.exports = CleanupManager; 