require('dotenv').config();
const config = require('./utils/config');

console.log('='.repeat(60));
console.log('RTSP URL Verification Test');
console.log('='.repeat(60));
console.log('');
console.log('Testing URL generation...');
console.log('Config RTSP URL:', config.getRtspUrl('102'));
console.log('Expected VLC URL: rtsp://admin:***@192.168.0.105:554/Streaming/Channels/102');
console.log('');

// Test URL generation
const testCameraId = '102';
const generated = config.getRtspUrl(testCameraId);
const expected = `rtsp://${process.env.RTSP_USER}:${encodeURIComponent(process.env.RTSP_PASS)}@${process.env.RTSP_HOST}:${process.env.RTSP_PORT}/Streaming/Channels/${testCameraId}`;

console.log('Generated:', generated);
console.log('Expected: ', expected);
console.log('Match:', generated === expected);

// Test path generation
console.log('\nTesting path generation...');
console.log('Components check:');
console.log('- RTSP User:', config.rtspUser);
console.log('- RTSP Password (raw):', config.rtspPassword);
console.log('- RTSP Password (encoded):', encodeURIComponent(config.rtspPassword));
console.log('- RTSP Host:', config.rtspHost);
console.log('- RTSP Port:', config.rtspPort);
console.log('='.repeat(60)); 