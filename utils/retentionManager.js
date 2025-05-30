const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const schedule = require('node-schedule');
const config = require('./config');
const { logger } = require('./logger');
const { getStorageInfo } = require('./systemUtils');

class RetentionManager {
    constructor() {
        this.policies = new Map();
        this.quotaJob = null;
        this.isRunning = false;
        this.stats = {
            lastRun: null,
            totalBytesFreed: 0,
            totalFilesDeleted: 0,
            quotaViolations: 0
        };
    }

    // Initialize retention policies from config
    initPolicies() {
        for (const cameraId of config.cameraIds) {
            this.policies.set(cameraId, {
                retentionDays: config.retentionDays,
                maxStorageGB: config.maxStoragePerCamera || 50, // Default 50GB per camera
                keepMotionEvents: true,
                minMotionRetentionDays: config.minMotionRetentionDays || 7,
                quotaAction: 'delete-oldest' // or 'stop-recording'
            });
        }
    }

    // Start retention management
    start() {
        logger.info('Starting retention manager');
        this.initPolicies();

        // Run storage quota check every 15 minutes
        this.quotaJob = schedule.scheduleJob('*/15 * * * *', () => {
            this.checkStorageQuotas();
        });

        // Initial quota check after 2 minutes
        setTimeout(() => {
            this.checkStorageQuotas();
        }, 120000);

        logger.info('Retention manager started with policies:', 
            Object.fromEntries(this.policies));
    }

    // Stop retention management
    stop() {
        if (this.quotaJob) {
            this.quotaJob.cancel();
            this.quotaJob = null;
        }
        logger.info('Retention manager stopped');
    }

    // Check storage quotas for all cameras
    async checkStorageQuotas() {
        if (this.isRunning) {
            logger.debug('Storage quota check already running, skipping');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.info('Starting storage quota check');
            const storageInfo = await getStorageInfo();

            for (const [cameraId, policy] of this.policies) {
                await this.enforceCameraQuota(cameraId, policy, storageInfo);
            }

            this.stats.lastRun = new Date();
            const duration = Date.now() - startTime;
            logger.info('Storage quota check completed', {
                duration: `${duration}ms`,
                ...this.stats
            });

        } catch (error) {
            logger.error('Storage quota check failed:', error);
        } finally {
            this.isRunning = false;
        }
    }

    // Enforce storage quota for a specific camera
    async enforceCameraQuota(cameraId, policy, storageInfo) {
        const cameraDir = config.getCameraDirectory(cameraId);
        if (!await fs.pathExists(cameraDir)) return;

        const cameraSize = await this.calculateCameraStorage(cameraDir);
        const quotaGB = policy.maxStorageGB;
        const currentGB = cameraSize / (1024 * 1024 * 1024);

        if (currentGB > quotaGB) {
            logger.warn(`Camera ${cameraId} exceeds quota: ${currentGB.toFixed(2)}GB / ${quotaGB}GB`);
            this.stats.quotaViolations++;

            if (policy.quotaAction === 'delete-oldest') {
                await this.deleteOldestFootage(cameraId, cameraSize - (quotaGB * 1024 * 1024 * 1024));
            } else if (policy.quotaAction === 'stop-recording') {
                // Implement recording stop logic here
                logger.error(`Camera ${cameraId} recording stopped due to quota violation`);
            }
        }
    }

    // Calculate total storage used by a camera
    async calculateCameraStorage(cameraDir) {
        let totalSize = 0;
        const items = await fs.readdir(cameraDir);

        for (const item of items) {
            const itemPath = path.join(cameraDir, item);
            const stats = await fs.stat(itemPath);
            
            if (stats.isDirectory()) {
                totalSize += await this.calculateCameraStorage(itemPath);
            } else {
                totalSize += stats.size;
            }
        }

        return totalSize;
    }

    // Delete oldest footage until target size is reached
    async deleteOldestFootage(cameraId, bytesToFree) {
        const cameraDir = config.getCameraDirectory(cameraId);
        const policy = this.policies.get(cameraId);
        let freedBytes = 0;

        // Get all date directories
        const dateDirs = await fs.readdir(cameraDir);
        dateDirs.sort(); // Sort chronologically

        for (const dateDir of dateDirs) {
            if (freedBytes >= bytesToFree) break;

            const datePath = path.join(cameraDir, dateDir);
            const dirDate = moment(dateDir, 'YYYY-MM-DD');

            // Skip if within minimum retention period for motion events
            if (policy.keepMotionEvents && 
                dirDate.isAfter(moment().subtract(policy.minMotionRetentionDays, 'days'))) {
                continue;
            }

            // Delete the entire date directory
            const dirSize = await this.calculateCameraStorage(datePath);
            await fs.remove(datePath);

            freedBytes += dirSize;
            this.stats.totalBytesFreed += dirSize;
            this.stats.totalFilesDeleted++;

            logger.info(`Deleted old footage from ${cameraId}/${dateDir} (${(dirSize / 1024 / 1024).toFixed(2)}MB)`);
        }
    }

    // Get retention statistics
    getStats() {
        return {
            ...this.stats,
            policies: Object.fromEntries(this.policies),
            isRunning: this.isRunning
        };
    }

    // Update retention policy for a camera
    updatePolicy(cameraId, newPolicy) {
        if (!this.policies.has(cameraId)) {
            throw new Error(`Camera ${cameraId} not found`);
        }

        this.policies.set(cameraId, {
            ...this.policies.get(cameraId),
            ...newPolicy
        });

        logger.info(`Updated retention policy for camera ${cameraId}:`, newPolicy);
    }
}

module.exports = new RetentionManager(); 