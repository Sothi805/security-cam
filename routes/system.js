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

const execAsync = promisify(exec);

// System metrics endpoint
router.get('/metrics', async (req, res) => {
    try {
        const [metrics, storage] = await Promise.all([
            getSystemMetrics(),
            getStorageInfo()
        ]);

        res.json({
            timestamp: Date.now(),
            system: {
                ...metrics,
                memory: {
                    ...metrics.memory,
                    totalFormatted: formatBytes(metrics.memory.total),
                    usedFormatted: formatBytes(metrics.memory.used),
                    freeFormatted: formatBytes(metrics.memory.free)
                }
            },
            storage: storage ? {
                ...storage,
                totalFormatted: formatBytes(storage.total),
                usedFormatted: formatBytes(storage.used),
                freeFormatted: formatBytes(storage.free)
            } : null
        });
    } catch (error) {
        logger.error('Failed to get system metrics:', error);
        res.status(500).json({ error: 'Failed to get system metrics' });
    }
});

async function collectSystemMetrics() {
    const metrics = {
        cpu: { usage: 0 },
        memory: { usage: 0 },
        disk: { usage: 0 },
        processes: { ffmpeg: 0 },
        timestamp: new Date().toISOString()
    };

    try {
        // Get CPU usage
        if (process.platform === 'linux' || process.platform === 'darwin') {
            const cpuResult = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
            metrics.cpu.usage = parseFloat(cpuResult.stdout.trim()) || 0;
        } else if (process.platform === 'win32') {
            const cpuResult = await execAsync('wmic cpu get loadpercentage /value');
            const match = cpuResult.stdout.match(/LoadPercentage=(\d+)/);
            metrics.cpu.usage = match ? parseInt(match[1]) : 0;
        }
    } catch (error) {
        console.warn('Failed to get CPU usage:', error.message);
    }

    try {
        // Get Memory usage
        if (process.platform === 'linux' || process.platform === 'darwin') {
            const memResult = await execAsync("free | grep Mem | awk '{printf(\"%.1f\", $3/$2 * 100.0)}'");
            metrics.memory.usage = parseFloat(memResult.stdout.trim()) || 0;
        } else if (process.platform === 'win32') {
            const memResult = await execAsync('wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value');
            const total = memResult.stdout.match(/TotalVisibleMemorySize=(\d+)/);
            const free = memResult.stdout.match(/FreePhysicalMemory=(\d+)/);
            if (total && free) {
                const totalMem = parseInt(total[1]);
                const freeMem = parseInt(free[1]);
                const usedMem = totalMem - freeMem;
                metrics.memory.usage = (usedMem / totalMem) * 100;
            }
        }
    } catch (error) {
        console.warn('Failed to get memory usage:', error.message);
    }

    try {
        // Get Disk usage for HLS directory
        const hlsPath = process.env.HLS_ROOT || 'hls';
        const resolvedPath = path.resolve(hlsPath);
        
        if (process.platform === 'linux' || process.platform === 'darwin') {
            const diskResult = await execAsync(`df "${resolvedPath}" | tail -1 | awk '{print $5}' | sed 's/%//'`);
            metrics.disk.usage = parseFloat(diskResult.stdout.trim()) || 0;
        } else if (process.platform === 'win32') {
            const drive = path.parse(resolvedPath).root;
            if (drive) {
                const diskResult = await execAsync(`wmic logicaldisk where caption="${drive.replace('\\', '')}" get size,freespace /value`);
                const freeMatch = diskResult.stdout.match(/FreeSpace=(\d+)/);
                const sizeMatch = diskResult.stdout.match(/Size=(\d+)/);
                if (freeMatch && sizeMatch) {
                    const free = parseInt(freeMatch[1]);
                    const total = parseInt(sizeMatch[1]);
                    const used = total - free;
                    metrics.disk.usage = (used / total) * 100;
                }
            }
        }
    } catch (error) {
        console.warn('Failed to get disk usage:', error.message);
    }

    try {
        // Count FFmpeg processes
        if (process.platform === 'linux' || process.platform === 'darwin') {
            const ffmpegResult = await execAsync('pgrep -c ffmpeg || echo 0');
            metrics.processes.ffmpeg = parseInt(ffmpegResult.stdout.trim()) || 0;
        } else if (process.platform === 'win32') {
            const ffmpegResult = await execAsync('tasklist /FI "IMAGENAME eq ffmpeg.exe" /FO CSV | find /C "ffmpeg.exe"');
            metrics.processes.ffmpeg = parseInt(ffmpegResult.stdout.trim()) || 0;
        }
    } catch (error) {
        console.warn('Failed to count FFmpeg processes:', error.message);
    }

    // Add Node.js process info
    const memUsage = process.memoryUsage();
    metrics.node = {
        memory: {
            rss: Math.round(memUsage.rss / 1024 / 1024), // MB
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            external: Math.round(memUsage.external / 1024 / 1024) // MB
        },
        uptime: Math.round(process.uptime()), // seconds
        pid: process.pid,
        version: process.version
    };

    return metrics;
}

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        const status = healthMonitor.getStatus();
        res.json(status);
    } catch (error) {
        logger.error('Failed to get health status:', error);
        res.status(500).json({ error: 'Failed to get health status' });
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