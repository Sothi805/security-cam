const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const healthMonitor = require('../utils/healthMonitor');
const { getSystemMetrics, getStorageInfo, formatBytes } = require('../utils/systemUtils');
const config = require('../utils/config');
const { logger } = require('../utils/logger');
const os = require('os');
const diskusage = require('diskusage');

const execAsync = promisify(exec);

// Helper function to get CPU usage
async function getCpuUsage() {
    try {
        const startMeasure = os.cpus().map(cpu => ({
            idle: cpu.times.idle,
            total: Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0)
        }));

        await new Promise(resolve => setTimeout(resolve, 100));

        const endMeasure = os.cpus().map(cpu => ({
            idle: cpu.times.idle,
            total: Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0)
        }));

        const cpuUsage = startMeasure.map((start, i) => {
            const end = endMeasure[i];
            const idleDiff = end.idle - start.idle;
            const totalDiff = end.total - start.total;
            const usagePercent = 100 - (100 * idleDiff / totalDiff);
            return Math.max(0, Math.min(100, usagePercent));
        });

        return cpuUsage.reduce((acc, usage) => acc + usage, 0) / cpuUsage.length;
    } catch (error) {
        logger.warn('Failed to get CPU usage:', error.message);
        return 0;
    }
}

// Helper function to get memory usage
function getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercent = (used / total) * 100;
    
    return {
        total: formatBytes(total),
        used: formatBytes(used),
        free: formatBytes(free),
        percent: Math.round(usagePercent)
    };
}

// Helper function to get disk usage
async function getDiskUsage() {
    try {
        const rootPath = path.parse(process.cwd()).root;
        const usage = await diskusage.check(rootPath);
        const total = usage.total;
        const free = usage.free;
        const used = total - free;
        const usagePercent = (used / total) * 100;
        
        return {
            total: formatBytes(total),
            used: formatBytes(used),
            free: formatBytes(free),
            percent: Math.round(usagePercent)
        };
    } catch (error) {
        logger.warn('Failed to get disk usage:', error.message);
        return {
            total: '0',
            used: '0',
            free: '0',
            percent: 0
        };
    }
}

// Helper function to count FFmpeg processes
async function countFFmpegProcesses() {
    try {
        const { stdout } = await execAsync('tasklist | find /i "ffmpeg" /c');
        return parseInt(stdout.trim()) || 0;
    } catch (error) {
        logger.warn('Failed to count FFmpeg processes:', error.message);
        return 0;
    }
}

/**
 * GET /metrics
 * Get system metrics including CPU, memory, disk usage, and FFmpeg processes
 */
router.get('/metrics', async (req, res) => {
    try {
        const [cpuUsage, diskUsage, ffmpegCount] = await Promise.all([
            getCpuUsage(),
            getDiskUsage(),
            countFFmpegProcesses()
        ]);

        const memoryUsage = getMemoryUsage();

        const metrics = {
            cpu: {
                percent: Math.round(cpuUsage),
                cores: os.cpus().length
            },
            memory: memoryUsage,
            disk: diskUsage,
            ffmpeg: {
                count: ffmpegCount,
                active: ffmpegCount > 0
            },
            timestamp: new Date().toISOString()
        };

        res.json(metrics);
    } catch (error) {
        logger.error('Error getting system metrics:', error);
        res.status(500).json({
            error: 'Failed to get system metrics',
            message: error.message
        });
    }
});

/**
 * GET /info
 * Get system information
 */
router.get('/info', (req, res) => {
    try {
        const info = {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            uptime: Math.round(os.uptime()),
            nodeVersion: process.version,
            totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
            cpuCount: os.cpus().length,
            loadAverage: os.loadavg(),
            timestamp: new Date().toISOString()
        };

        res.json(info);
    } catch (error) {
        logger.error('Error getting system info:', error);
        res.status(500).json({
            error: 'Failed to get system info',
            message: error.message
        });
    }
});

/**
 * GET /health
 * Get detailed health check
 */
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: require('../package.json').version,
            environment: config.nodeEnv,
            cameras: config.cameraIds.length,
            checks: {
                ffmpeg: false,
                hls_directory: false,
                config_valid: false
            }
        };

        // Check FFmpeg availability
        try {
            await execAsync(`${config.ffmpegPath} -version`);
            health.checks.ffmpeg = true;
        } catch (error) {
            health.checks.ffmpeg = false;
        }

        // Check HLS directory
        try {
            await fs.promises.access(config.hlsPath, fs.constants.R_OK | fs.constants.W_OK);
            health.checks.hls_directory = true;
        } catch (error) {
            health.checks.hls_directory = false;
        }

        // Check config validity
        health.checks.config_valid = config.cameraIds.length > 0 && 
                                     config.rtspUser && 
                                     config.rtspPassword &&
                                     config.rtspHost;

        // Set overall status
        const allChecksPass = Object.values(health.checks).every(check => check);
        health.status = allChecksPass ? 'healthy' : 'degraded';

        res.json(health);
    } catch (error) {
        logger.error('Error getting health status:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Process information endpoint
router.get('/processes', async (req, res) => {
    try {
        const processes = {
            node: {
                pid: process.pid,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            },
            ffmpeg: { count: 0, processes: [] }
        };

        // Get detailed FFmpeg process info
        if (process.platform === 'linux' || process.platform === 'darwin') {
            try {
                const psResult = await execAsync('ps aux | grep ffmpeg | grep -v grep');
                const lines = psResult.stdout.trim().split('\n').filter(line => line);
                processes.ffmpeg.count = lines.length;
                processes.ffmpeg.processes = lines.map(line => {
                    const parts = line.trim().split(/\s+/);
                    return {
                        pid: parts[1],
                        cpu: parts[2],
                        memory: parts[3],
                        command: parts.slice(10).join(' ')
                    };
                });
            } catch (error) {
                // No FFmpeg processes running
            }
        }

        res.json(processes);
    } catch (error) {
        console.error('Failed to get process information:', error);
        res.status(500).json({ error: 'Failed to get process information' });
    }
});

// Get metrics history
router.get('/metrics/history', (req, res) => {
    try {
        const history = healthMonitor.getMetricsHistory();
        res.json(history);
    } catch (error) {
        logger.error('Failed to get metrics history:', error);
        res.status(500).json({ error: 'Failed to get metrics history' });
    }
});

// Get active alerts
router.get('/alerts', (req, res) => {
    try {
        const alerts = healthMonitor.alerts;
        res.json(alerts);
    } catch (error) {
        logger.error('Failed to get alerts:', error);
        res.status(500).json({ error: 'Failed to get alerts' });
    }
});

// Clear all alerts
router.delete('/alerts', (req, res) => {
    try {
        healthMonitor.clearAlerts();
        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to clear alerts:', error);
        res.status(500).json({ error: 'Failed to clear alerts' });
    }
});

// Get system configuration
router.get('/config', (req, res) => {
    try {
        res.json(config.getSummary());
    } catch (error) {
        logger.error('Failed to get system config:', error);
        res.status(500).json({ error: 'Failed to get system config' });
    }
});

module.exports = router; 