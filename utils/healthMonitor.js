const os = require('os');
const EventEmitter = require('events');
const config = require('./config');
const { logger } = require('./logger');
const { getSystemMetrics, getStorageInfo } = require('./systemUtils');

class HealthMonitor extends EventEmitter {
    constructor() {
        super();
        this.metrics = {
            cpu: [],
            memory: [],
            storage: [],
            streams: new Map(),
            lastUpdate: null
        };
        this.alerts = [];
        this.checkInterval = null;
        this.metricsMaxLength = 360; // Keep 1 hour of data at 10s intervals
    }

    start() {
        logger.info('Starting health monitor');
        
        // Check system health every 10 seconds
        this.checkInterval = setInterval(() => {
            this.checkHealth();
        }, 10000);
        
        // Initial check
        this.checkHealth();
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        logger.info('Health monitor stopped');
    }

    async checkHealth() {
        try {
            // Get current metrics
            const systemMetrics = await getSystemMetrics();
            const storageInfo = await getStorageInfo();
            
            // Update metrics history
            this.updateMetrics(systemMetrics, storageInfo);
            
            // Check for issues
            this.checkSystemLoad(systemMetrics);
            this.checkMemoryUsage(systemMetrics);
            this.checkStorageSpace(storageInfo);
            
            // Emit health status
            this.emit('health.update', this.getStatus());
            
        } catch (error) {
            logger.error('Health check failed:', error);
            this.addAlert('system', 'error', 'Health check failed: ' + error.message);
        }
    }

    updateMetrics(systemMetrics, storageInfo) {
        // Update CPU metrics
        this.metrics.cpu.push({
            timestamp: Date.now(),
            loadAverage: systemMetrics.cpu.loadAverage,
            cores: systemMetrics.cpu.cores
        });

        // Update memory metrics
        this.metrics.memory.push({
            timestamp: Date.now(),
            used: systemMetrics.memory.used,
            total: systemMetrics.memory.total,
            percentage: systemMetrics.memory.usedPercent
        });

        // Update storage metrics
        if (storageInfo) {
            this.metrics.storage.push({
                timestamp: Date.now(),
                used: storageInfo.used,
                total: storageInfo.total,
                percentage: storageInfo.usedPercent
            });
        }

        // Trim old metrics
        this.metrics.cpu = this.metrics.cpu.slice(-this.metricsMaxLength);
        this.metrics.memory = this.metrics.memory.slice(-this.metricsMaxLength);
        this.metrics.storage = this.metrics.storage.slice(-this.metricsMaxLength);
        
        this.metrics.lastUpdate = Date.now();
    }

    checkSystemLoad(metrics) {
        const loadAvg = metrics.cpu.loadAverage;
        const cores = metrics.cpu.cores;
        const loadPerCore = loadAvg / cores;

        if (loadPerCore > 0.8) {
            this.addAlert('cpu', 'warning', `High CPU load: ${loadPerCore.toFixed(2)} per core`);
        }
        if (loadPerCore > 0.95) {
            this.addAlert('cpu', 'error', `Critical CPU load: ${loadPerCore.toFixed(2)} per core`);
        }
    }

    checkMemoryUsage(metrics) {
        const usedPercent = parseFloat(metrics.memory.usedPercent);

        if (usedPercent > 85) {
            this.addAlert('memory', 'warning', `High memory usage: ${usedPercent}%`);
        }
        if (usedPercent > 95) {
            this.addAlert('memory', 'error', `Critical memory usage: ${usedPercent}%`);
        }
    }

    checkStorageSpace(storageInfo) {
        if (!storageInfo) return;

        const usedPercent = parseFloat(storageInfo.usedPercent);

        if (usedPercent > 85) {
            this.addAlert('storage', 'warning', `High storage usage: ${usedPercent}%`);
        }
        if (usedPercent > 95) {
            this.addAlert('storage', 'error', `Critical storage usage: ${usedPercent}%`);
        }
    }

    addAlert(type, severity, message) {
        const alert = {
            id: Date.now(),
            type,
            severity,
            message,
            timestamp: new Date().toISOString()
        };

        this.alerts.unshift(alert);
        this.alerts = this.alerts.slice(0, 100); // Keep last 100 alerts
        
        this.emit('health.alert', alert);
        
        if (severity === 'error') {
            logger.error(`Health alert: ${message}`);
        } else {
            logger.warn(`Health alert: ${message}`);
        }
    }

    updateStreamHealth(streamId, status) {
        this.metrics.streams.set(streamId, {
            status,
            lastUpdate: Date.now()
        });
    }

    getStatus() {
        const latestCpu = this.metrics.cpu[this.metrics.cpu.length - 1] || {};
        const latestMemory = this.metrics.memory[this.metrics.memory.length - 1] || {};
        const latestStorage = this.metrics.storage[this.metrics.storage.length - 1] || {};

        return {
            status: this.calculateOverallStatus(),
            lastUpdate: this.metrics.lastUpdate,
            metrics: {
                cpu: latestCpu,
                memory: latestMemory,
                storage: latestStorage
            },
            streams: Array.from(this.metrics.streams.entries()).map(([id, data]) => ({
                id,
                ...data
            })),
            alerts: this.alerts.slice(0, 10) // Last 10 alerts
        };
    }

    calculateOverallStatus() {
        const hasErrorAlerts = this.alerts.some(alert => 
            alert.severity === 'error' && 
            (Date.now() - new Date(alert.timestamp).getTime()) < 300000 // Last 5 minutes
        );

        const hasWarningAlerts = this.alerts.some(alert => 
            alert.severity === 'warning' && 
            (Date.now() - new Date(alert.timestamp).getTime()) < 300000 // Last 5 minutes
        );

        if (hasErrorAlerts) return 'error';
        if (hasWarningAlerts) return 'warning';
        return 'healthy';
    }

    getMetricsHistory() {
        return {
            cpu: this.metrics.cpu,
            memory: this.metrics.memory,
            storage: this.metrics.storage
        };
    }

    clearAlerts() {
        this.alerts = [];
        this.emit('health.alerts.cleared');
    }
}

module.exports = new HealthMonitor(); 