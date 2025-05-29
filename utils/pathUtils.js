const path = require('path');
const moment = require('moment');
const fs = require('fs-extra');
const config = require('./config');

class PathUtils {
  /**
   * Generate HLS path structure: hls/{camera_id}/{YYYY-MM-DD}/{HH-mm}.m3u8
   */
  static getHLSPath(cameraId, date = null, time = null) {
    const baseDir = config.hls.root;
    const targetDate = date || moment().format('YYYY-MM-DD');
    const targetTime = time || moment().format('HH-mm');
    
    return {
      baseDir: path.join(baseDir, cameraId),
      dateDir: path.join(baseDir, cameraId, targetDate),
      fullPath: path.join(baseDir, cameraId, targetDate, `${targetTime}.m3u8`),
      segmentDir: path.join(baseDir, cameraId, targetDate, targetTime),
      relativePath: `${cameraId}/${targetDate}/${targetTime}.m3u8`,
      playlistName: `${targetTime}.m3u8`,
      segmentPattern: path.join(baseDir, cameraId, targetDate, targetTime, 'segment_%d.ts')
    };
  }

  /**
   * Generate live stream path for current streaming
   */
  static getLiveStreamPath(cameraId, quality = 'high') {
    const baseDir = config.hls.root;
    const liveDir = path.join(baseDir, cameraId, 'live', quality);
    
    return {
      liveDir,
      playlist: path.join(liveDir, 'index.m3u8'),
      segmentPattern: path.join(liveDir, 'segment_%d.ts')
    };
  }

  /**
   * Generate recording path structure
   */
  static getRecordingPath(cameraId, date = null, hour = null) {
    const baseDir = path.join(config.hls.root, cameraId, 'recordings');
    const targetDate = date || moment().format('YYYY-MM-DD');
    const targetHour = hour || moment().format('HH');
    
    return {
      baseDir,
      dateDir: path.join(baseDir, targetDate),
      hourDir: path.join(baseDir, targetDate, targetHour),
      filename: `${targetDate}_${targetHour}.${config.recording.format}`
    };
  }

  /**
   * Create directory structure if it doesn't exist
   */
  static async ensureDirectoryExists(dirPath) {
    try {
      await fs.ensureDir(dirPath);
      return true;
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
      return false;
    }
  }

  /**
   * Get all available dates for a camera
   */
  static async getAvailableDates(cameraId) {
    try {
      const cameraDir = path.join(config.hls.root, cameraId);
      const items = await fs.readdir(cameraDir);
      
      // Filter for date directories (YYYY-MM-DD format)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const dates = items.filter(item => dateRegex.test(item));
      
      return dates.sort().reverse(); // Most recent first
    } catch (error) {
      console.error(`Failed to get available dates for camera ${cameraId}:`, error);
      return [];
    }
  }

  /**
   * Get all available times for a camera and date
   */
  static async getAvailableTimes(cameraId, date) {
    try {
      const dateDir = path.join(config.hls.root, cameraId, date);
      const items = await fs.readdir(dateDir);
      
      // Filter for time files (HH-mm.m3u8 format)
      const timeRegex = /^(\d{2}-\d{2})\.m3u8$/;
      const times = items
        .filter(item => timeRegex.test(item))
        .map(item => item.replace('.m3u8', ''))
        .sort()
        .reverse(); // Most recent first
      
      return times;
    } catch (error) {
      console.error(`Failed to get available times for camera ${cameraId} on ${date}:`, error);
      return [];
    }
  }

  /**
   * Check if a specific stream exists
   */
  static async streamExists(cameraId, date, time) {
    try {
      const hlsPath = this.getHLSPath(cameraId, date, time);
      return await fs.pathExists(hlsPath.fullPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file size in MB
   */
  static async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size / (1024 * 1024); // Convert to MB
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get directory size recursively in MB
   */
  static async getDirectorySize(dirPath) {
    try {
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
      
      return totalSize / (1024 * 1024); // Convert to MB
    } catch (error) {
      return 0;
    }
  }

  /**
   * Parse time string (HH-mm) to moment object
   */
  static parseTimeString(timeStr, date = null) {
    const targetDate = date || moment().format('YYYY-MM-DD');
    const [hours, minutes] = timeStr.split('-');
    return moment(`${targetDate} ${hours}:${minutes}`, 'YYYY-MM-DD HH:mm');
  }

  /**
   * Generate next segment time
   */
  static getNextSegmentTime(currentTime) {
    const segmentDuration = config.hls.segmentDuration;
    return moment(currentTime).add(segmentDuration, 'seconds');
  }

  /**
   * Get segments older than retention period
   */
  static async getExpiredSegments(cameraId) {
    const retentionMinutes = config.storage.retentionMinutes;
    const cutoffTime = moment().subtract(retentionMinutes, 'minutes');
    const expiredPaths = [];

    try {
      const cameraDir = path.join(config.hls.root, cameraId);
      const dates = await this.getAvailableDates(cameraId);

      for (const date of dates) {
        const times = await this.getAvailableTimes(cameraId, date);
        
        for (const time of times) {
          const segmentTime = this.parseTimeString(time, date);
          
          if (segmentTime.isBefore(cutoffTime)) {
            const hlsPath = this.getHLSPath(cameraId, date, time);
            expiredPaths.push({
              playlist: hlsPath.fullPath,
              segmentDir: hlsPath.segmentDir,
              date,
              time
            });
          }
        }
      }

      return expiredPaths;
    } catch (error) {
      console.error(`Failed to get expired segments for camera ${cameraId}:`, error);
      return [];
    }
  }
}

module.exports = PathUtils; 