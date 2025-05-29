const winston = require('winston');
const path = require('path');
const config = require('./config');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = config.logsPath || path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logLevel || 'info',
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    
    // General log file
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Stream-specific log file
    new winston.transports.File({
      filename: path.join(logsDir, 'streams.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true
    })
  ]
});

// Stream logger for FFmpeg processes
const streamLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'streams.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true
    })
  ]
});

// System logger for monitoring and health checks
const systemLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'system.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true
    })
  ]
});

// Cleanup logger for storage management
const cleanupLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'cleanup.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true
    })
  ]
});

module.exports = {
  logger,
  streamLogger,
  systemLogger,
  cleanupLogger
}; 