const config = require('./utils/config');

module.exports = {
  apps: [{
    name: 'cctv-streaming-api',
    script: 'app.js',
    
    // Process Management
    instances: config.pm2.instances,
    exec_mode: 'fork', // Fork mode for better process isolation
    
    // Auto-restart Configuration
    autorestart: true,
    watch: false, // Disable file watching in production
    max_memory_restart: config.pm2.maxMemoryRestart,
    max_restarts: config.pm2.maxRestarts,
    min_uptime: config.pm2.minUptime,
    restart_delay: config.pm2.restartDelay,
    
    // Environment
    env: {
      NODE_ENV: 'development',
      PORT: config.server.port
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: config.server.port
    },
    
    // Logging
    log_file: './logs/pm2-combined.log',
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Process Monitoring
    time: true, // Add timestamps to logs
    ignore_watch: ['node_modules', 'logs', 'hls'], // Ignore these directories
    
    // Performance Monitoring
    pmx: true,
    
    // Advanced Options
    kill_timeout: config.pm2.killTimeout,
    listen_timeout: config.pm2.listenTimeout,
    
    // Source control
    source_map_support: false,
    
    // Additional PM2+ monitoring (if using PM2 Plus)
    monitoring: false,
    
    // Custom startup script
    node_args: [`--max-old-space-size=${config.pm2.nodeMaxOldSpaceSize}`],
    
    // Health check (if using PM2 health check module)
    health_check_url: `http://localhost:${config.server.port}/health`,
    health_check_grace_period: config.pm2.healthCheckGracePeriod
  }],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'cctv',
      host: '192.168.1.100', // Your server IP
      ref: 'origin/main',
      repo: 'git@github.com:your-username/cctv-streaming.git',
      path: '/var/www/cctv-streaming',
      'post-deploy': 'npm install && npm run setup && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
}; 