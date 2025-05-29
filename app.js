const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const config = require('./utils/config');
const { logger } = require('./utils/logger');

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

module.exports = app;
