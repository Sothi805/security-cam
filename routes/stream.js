const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const router = express.Router();

const cameraIds = ['001','102'];
let ffmpegProcesses = {};  // Store FFmpeg processes

// Function to start FFmpeg process for a camera
function startFFmpeg(id) {
  const outputDir = path.join(__dirname, '..', process.env.HLS_FOLDER, id);
  
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const rtspUrl =
    `rtsp://${process.env.RTSP_USER}:` +
    `${process.env.RTSP_PASS}@${process.env.RTSP_HOST}:` +
    `${process.env.RTSP_PORT}/Streaming/Channels/${id}`;

  const args = [
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-c', 'copy',           // Just copy the stream without transcoding
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', path.join(outputDir, 'segment_%d.ts'),
    path.join(outputDir, 'index.m3u8'),
  ];

  const ffmpeg = spawn(process.env.FFMPEG_PATH, args);
  ffmpegProcesses[id] = ffmpeg;  // Store the process

  ffmpeg.stderr.on('data', chunk => {
    const msg = chunk.toString().trim();
    if (!msg.startsWith('ffmpeg version')) console.error(`FFmpeg[${id}]:`, msg);
  });

  ffmpeg.on('close', code => {
    console.log(`FFmpeg[${id}] exited with code ${code}`);
    delete ffmpegProcesses[id];  // Remove from processes list
    
    // Attempt to restart the stream if it crashes
    if (code !== 0) {
      console.log(`Attempting to restart stream for camera ${id}...`);
      setTimeout(() => startFFmpeg(id), 5000); // Wait 5 seconds before trying to restart
    }
  });

  console.log(`Started streaming for camera ${id}`);
}

// Function to stop all FFmpeg processes
function stopAllStreams() {
  Object.keys(ffmpegProcesses).forEach(id => {
    if (ffmpegProcesses[id]) {
      ffmpegProcesses[id].kill('SIGTERM');
      console.log(`Stopped streaming for camera ${id}`);
    }
  });
  ffmpegProcesses = {};
}

// Function to start all streams
function startAllStreams() {
  cameraIds.forEach(id => startFFmpeg(id));
}

// Start all streams when the server starts
console.log('Starting all streams...');
startAllStreams();

// GET /streams/:id → { stream: '/hls/:id/index.m3u8' }
router.get('/:id', (req, res) => {
  const id = req.params.id;
  if (!cameraIds.includes(id)) {
    return res.status(404).json({ error: 'Camera not found' });
  }
  
  // Check if the stream is running
  if (!ffmpegProcesses[id]) {
    // Try to restart the stream if it's not running
    startFFmpeg(id);
  }
  
  res.json({ stream: `/hls/${id}/index.m3u8` });
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Stopping all streams...');
  stopAllStreams();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Stopping all streams...');
  stopAllStreams();
  process.exit(0);
});

module.exports = router;
