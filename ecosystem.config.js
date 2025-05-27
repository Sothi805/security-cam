module.exports = {
  apps: [{
    name: 'cctv-streaming-api',
    script: 'app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '7G',
    exp_backoff_restart_delay: 100,
    env: {
      NODE_ENV: 'production',
      FFMPEG_PATH: '/usr/bin/ffmpeg'  // Linux FFmpeg path
    },
    error_file: '/var/log/cctv-api/err.log',
    out_file: '/var/log/cctv-api/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
}; 