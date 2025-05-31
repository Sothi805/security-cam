const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

// Test configuration
const cameraId = '102';
const rtspUrl = 'rtsp://admin:iME%401012@192.168.0.105:554/Streaming/Channels/102';

// Create test directories
const testDir = path.join(__dirname, 'test-output');
const liveDir = path.join(testDir, 'live');
fs.ensureDirSync(liveDir);

console.log('🧪 Testing native quality FFmpeg command...');
console.log(`📁 Output directory: ${liveDir}`);

// Native quality live stream command (no re-encoding)
const args = [
    '-y',  // Overwrite output files
    '-rtsp_transport', 'tcp',
    '-user_agent', 'SecurityCam/1.0',
    
    // Input options
    '-analyzeduration', '10000000',  // 10 seconds
    '-probesize', '10000000',
    '-i', rtspUrl,
    
    // Input buffer and sync options
    '-fflags', '+genpts+igndts+nobuffer',
    '-flags', 'low_delay',
    '-strict', 'experimental',
    '-avoid_negative_ts', 'make_zero',
    '-max_delay', '5000000',
    '-rtbufsize', '256M',
    
    // Native quality - just copy streams
    '-c', 'copy',
    '-tag:v', 'hvc1',  // Proper HEVC tag for compatibility
    '-map', '0',
    
    // HLS output for live streaming
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+append_list+omit_endlist+independent_segments',
    '-hls_segment_type', 'mpegts',
    '-hls_allow_cache', '0',
    '-hls_segment_filename', path.join(liveDir, 'segment%d.ts'),
    path.join(liveDir, 'live.m3u8')
];

console.log('\n📺 Starting FFmpeg test...');
console.log('Command:', 'ffmpeg', args.join(' '));

const ffmpegProcess = spawn('ffmpeg', args, {
    stdio: ['ignore', 'pipe', 'pipe']
});

ffmpegProcess.stdout.on('data', (data) => {
    console.log(`[STDOUT] ${data.toString().trim()}`);
});

ffmpegProcess.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
        console.log(`[FFMPEG] ${message}`);
    }
});

ffmpegProcess.on('close', (code) => {
    console.log(`\n🔚 FFmpeg process exited with code: ${code}`);
    if (code === 0) {
        console.log('✅ Test completed successfully!');
    } else {
        console.log('❌ Test failed with error code:', code);
    }
});

ffmpegProcess.on('error', (error) => {
    console.error('❌ FFmpeg error:', error.message);
});

// Stop test after 30 seconds
setTimeout(() => {
    console.log('\n⏰ Test timeout - stopping FFmpeg...');
    ffmpegProcess.kill('SIGTERM');
}, 30000);

console.log('\n💡 This test will run for 30 seconds to verify the command works.');
console.log('Check the test-output/live directory for generated files.'); 