const config = require('./utils/config');

console.log('='.repeat(60));
console.log('RTSP URL Verification Test');
console.log('='.repeat(60));
console.log('');
console.log('Generated RTSP URL:', config.getRtspUrl('102'));
console.log('Expected VLC URL:   rtsp://admin:iME%401012@192.168.0.105:554/Streaming/Channels/102');
console.log('');

const generated = config.getRtspUrl('102');
const expected = 'rtsp://admin:iME%401012@192.168.0.105:554/Streaming/Channels/102';

if (generated === expected) {
    console.log('✅ PERFECT MATCH! URLs are identical.');
} else {
    console.log('❌ URLs do not match!');
    console.log('');
    console.log('Differences:');
    console.log('Generated:', generated);
    console.log('Expected: ', expected);
}

console.log('');
console.log('Components check:');
console.log('- RTSP User:', config.rtspUser);
console.log('- RTSP Password (raw):', config.rtspPassword);
console.log('- RTSP Password (encoded):', encodeURIComponent(config.rtspPassword));
console.log('- RTSP Host:', config.rtspHost);
console.log('- RTSP Port:', config.rtspPort);
console.log('='.repeat(60)); 