const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const { logger } = require('./logger');

// Get storage information for the system
async function getStorageInfo() {
    try {
        const hlsPath = config.hlsPath;
        const stats = await fs.statfs(hlsPath);
        
        const total = stats.blocks * stats.bsize;
        const free = stats.bfree * stats.bsize;
        const used = total - free;
        
        return {
            total,
            free,
            used,
            usedPercent: ((used / total) * 100).toFixed(2),
            path: hlsPath
        };
    } catch (error) {
        logger.error('Failed to get storage info:', error);
        // Return a dummy object with 0 values to prevent crashes
        return {
            total: 0,
            free: 0,
            used: 0,
            usedPercent: "0",
            path: config.hlsPath
        };
    }
}

// Get system resource usage
async function getSystemMetrics() {
    const cpuUsage = os.loadavg()[0];
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
        cpu: {
            loadAverage: cpuUsage,
            cores: os.cpus().length
        },
        memory: {
            total: totalMem,
            free: freeMem,
            used: usedMem,
            usedPercent: (usedMem / totalMem * 100).toFixed(2)
        },
        uptime: os.uptime()
    };
}

// Calculate directory size recursively
async function calculateDirSize(dirPath) {
    let size = 0;
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
            size += await calculateDirSize(itemPath);
        } else {
            size += stats.size;
        }
    }
    
    return size;
}

// Format bytes to human readable format
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

module.exports = {
    getStorageInfo,
    getSystemMetrics,
    calculateDirSize,
    formatBytes
}; 