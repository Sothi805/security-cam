const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const config = require('./utils/config');
const { logger } = require('./utils/logger');
const streamManager = require('./utils/streamManager');
const cleanupManager = require('./utils/cleanupManager');

const app = express();

// Middleware
app.use(compression()); // Enable gzip compression
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders
}));
app.use(express.json({ limit: config.requests.jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: config.requests.urlEncodedLimit }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
});

// Import routes
const streamRoutes = require('./routes/stream');
const systemRoutes = require('./routes/system');

// Routes
app.use('/streams', streamRoutes);
app.use('/system', systemRoutes);

// Serve HLS files with proper headers
app.use('/hls', express.static(path.join(__dirname, config.hls.root), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.m3u8')) {
      res.set({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
    } else if (filePath.endsWith('.ts')) {
      res.set({
        'Content-Type': 'video/mp2t',
        'Cache-Control': `public, max-age=${config.server.cacheControlMaxAge}`,
        'Access-Control-Allow-Origin': '*'
      });
    }
  }
}));

// Serve static files (web interface)
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (also available at root)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'CCTV Streaming API',
    version: require('./package.json').version,
    description: 'Production-grade CCTV streaming API with HLS and playback support',
    endpoints: {
      live_streaming: {
        'GET /streams/live/:camera_id/:quality': 'Get live stream URL (quality: high|low)',
        'GET /streams/cameras': 'Get all cameras status',
        'POST /streams/restart/:camera_id': 'Restart specific camera',
        'POST /streams/restart': 'Restart all cameras'
      },
      playback: {
        'GET /streams/playback/:camera_id/:date/:time': 'Get playback stream (YYYY-MM-DD/HH-mm)',
        'GET /streams/available/:camera_id': 'Get available dates for camera',
        'GET /streams/available/:camera_id/:date': 'Get available times for date'
      },
      system: {
        'GET /streams/status': 'Get comprehensive system status',
        'GET /streams/health': 'Simple health check',
        'POST /streams/cleanup': 'Trigger manual cleanup'
      }
    },
    configuration: {
      cameras: config.cameras.ids,
      segment_duration: config.hls.segmentDuration,
      retention_minutes: config.storage.retentionMinutes,
      qualities: ['high (native)', 'low (480p@12fps)']
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress
  });

  res.status(err.status || 500).json({
    error: config.server.nodeEnv === 'production' ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /api - API documentation',
      'GET /health - Health check',
      'GET /streams/* - Streaming endpoints'
    ],
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    logger.info('Server closed. Exiting process.');
    process.exit(0);
  });
  
  // Force shutdown after configured timeout
  setTimeout(() => {
    logger.error(`Forced shutdown after ${config.server.gracefulShutdownTimeout}ms`);
    process.exit(1);
  }, config.server.gracefulShutdownTimeout);
};

// Start server
const server = app.listen(config.server.port, () => {
  logger.info(`CCTV Streaming API started`, {
    port: config.server.port,
    environment: config.server.nodeEnv,
    cameras: config.cameras.ids,
    version: require('./package.json').version
  });
  
  logger.info('API endpoints available:', {
    api_docs: `http://localhost:${config.server.port}/api`,
    health: `http://localhost:${config.server.port}/health`,
    cameras: `http://localhost:${config.server.port}/streams/cameras`,
    status: `http://localhost:${config.server.port}/streams/status`
  });
});

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

class CCTVStreamingApp {
    constructor() {
        this.app = express();
        this.server = null;
        this.isShuttingDown = false;
    }

    async start() {
        try {
            logger.info('🚀 Starting CCTV Streaming Backend', config.getSummary());
            
            // 1. Setup Express middleware
            this.setupMiddleware();
            
            // 2. Setup routes
            this.setupRoutes();
            
            // 3. Setup error handling
            this.setupErrorHandling();
            
            // 4. Start HTTP server
            await this.startServer();
            
            // 5. Initialize streaming
            await this.initializeStreaming();
            
            // 6. Start cleanup manager
            this.startCleanup();
            
            // 7. Setup graceful shutdown
            this.setupGracefulShutdown();
            
            logger.info('✅ CCTV Streaming Backend started successfully');
            this.logStartupInfo();
            
        } catch (error) {
            logger.error('❌ Failed to start CCTV Streaming Backend:', error);
            process.exit(1);
        }
    }

    setupMiddleware() {
        logger.debug('Setting up Express middleware');
        
        // Enable compression
        this.app.use(compression());
        
        // Enable CORS
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));
        
        // Parse JSON bodies
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Serve static files from public directory
        this.app.use(express.static(path.join(__dirname, 'public'), {
            maxAge: config.isDevelopment() ? 0 : '1d'
        }));
        
        // Serve HLS files with proper headers
        this.app.use('/hls', express.static(config.hlsPath, {
            setHeaders: (res, path) => {
                if (path.endsWith('.m3u8')) {
                    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                } else if (path.endsWith('.ts')) {
                    res.setHeader('Content-Type', 'video/mp2t');
                    res.setHeader('Cache-Control', 'public, max-age=3600');
                }
            }
        }));
        
        // Request logging
        this.app.use((req, res, next) => {
            const start = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - start;
                const logData = {
                    method: req.method,
                    url: req.url,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                };
                
                if (config.debugMode || res.statusCode >= 400) {
                    logger.info('HTTP Request', logData);
                }
            });
            
            next();
        });
    }

    setupRoutes() {
        logger.debug('Setting up routes');
        
        // API routes
        this.app.use('/api/streams', streamRoutes);
        this.app.use('/api/system', systemRoutes);
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: require('./package.json').version,
                environment: config.nodeEnv
            });
        });
        
        // Root endpoint - redirect to dashboard
        this.app.get('/', (req, res) => {
            res.redirect('/index.html');
        });
        
        // API info endpoint
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'CCTV Streaming Backend API',
                version: require('./package.json').version,
                environment: config.nodeEnv,
                endpoints: {
                    health: '/health',
                    cameras: '/api/streams/cameras',
                    live: '/api/streams/live/:cameraId/:quality',
                    playback: '/api/streams/playback/:cameraId',
                    system: '/api/system/status'
                }
            });
        });
    }

    setupErrorHandling() {
        logger.debug('Setting up error handling');
        
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Path ${req.path} not found`,
                timestamp: new Date().toISOString()
            });
        });
        
        // Global error handler
        this.app.use((error, req, res, next) => {
            logger.error('Unhandled Express error:', error);
            
            res.status(500).json({
                error: 'Internal Server Error',
                message: config.isDevelopment() ? error.message : 'Something went wrong',
                timestamp: new Date().toISOString()
            });
        });
    }

    startServer() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(config.port, config.host, (error) => {
                if (error) {
                    reject(error);
                } else {
                    logger.info(`🌐 HTTP server listening on ${config.host}:${config.port}`);
                    resolve();
                }
            });
            
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${config.port} is already in use`));
                } else {
                    reject(error);
                }
            });
        });
    }

    async initializeStreaming() {
        logger.info('🎬 Initializing streaming system');
        
        try {
            await streamManager.initializeStreams();
            logger.info('✅ Streaming system initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize streaming system:', error);
            throw error;
        }
    }

    startCleanup() {
        logger.info('🧹 Starting cleanup manager');
        
        try {
            cleanupManager.start();
            logger.info('✅ Cleanup manager started');
        } catch (error) {
            logger.error('❌ Failed to start cleanup manager:', error);
            // Don't throw - cleanup is not critical for startup
        }
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            if (this.isShuttingDown) {
                logger.warn('Shutdown already in progress, forcing exit');
                process.exit(1);
            }
            
            this.isShuttingDown = true;
            logger.info(`🛑 Received ${signal}, starting graceful shutdown`);
            
            const shutdownTimeout = setTimeout(() => {
                logger.error('❌ Graceful shutdown timed out, forcing exit');
                process.exit(1);
            }, 30000); // 30 second timeout
            
            try {
                // 1. Stop accepting new connections
                if (this.server) {
                    this.server.close(() => {
                        logger.info('✅ HTTP server closed');
                    });
                }
                
                // 2. Stop streaming
                await streamManager.shutdown();
                
                // 3. Stop cleanup manager
                cleanupManager.stop();
                
                // 4. Final log
                logger.info('✅ Graceful shutdown completed');
                
                clearTimeout(shutdownTimeout);
                process.exit(0);
                
            } catch (error) {
                logger.error('❌ Error during shutdown:', error);
                clearTimeout(shutdownTimeout);
                process.exit(1);
            }
        };
        
        // Handle different shutdown signals
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('❌ Uncaught Exception:', error);
            shutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }

    logStartupInfo() {
        const info = [
            '',
            '🎥 CCTV Streaming Backend - Ready!',
            '='.repeat(60),
            `📍 Server URL: http://${config.host}:${config.port}`,
            `📊 Dashboard: http://${config.host}:${config.port}/`,
            `🔍 Health Check: http://${config.host}:${config.port}/health`,
            `📋 API Info: http://${config.host}:${config.port}/api`,
            '',
            '📺 Stream URLs:',
            ...config.cameraIds.map(id => 
                `   Camera ${id}: http://${config.host}:${config.port}/hls/${id}/[date]/[hour]-[quality].m3u8`
            ),
            '',
            '🎛️  Available Qualities: low (480p), high (native)',
            `🗄️  Retention: ${config.retentionDays} days`,
            `🔧 Environment: ${config.nodeEnv}`,
            '='.repeat(60),
            ''
        ];
        
        info.forEach(line => console.log(line));
        
        if (config.isDevelopment()) {
            console.log('💡 Development Mode Tips:');
            console.log('   • Logs are more verbose for debugging');
            console.log('   • File watching enabled for auto-restart');
            console.log('   • Short retention period (1 day)');
            console.log('   • Test camera connections: npm run test');
            console.log('');
        }
    }
}

// Create and start the application
const cctvApp = new CCTVStreamingApp();

// Start the application if this file is run directly
if (require.main === module) {
    cctvApp.start().catch(error => {
        console.error('❌ Application startup failed:', error);
        process.exit(1);
    });
}

module.exports = cctvApp;
