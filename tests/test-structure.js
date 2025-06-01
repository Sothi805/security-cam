const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const config = require('../utils/config');
const pathUtils = require('../utils/pathUtils');

async function testDirectoryStructure() {
    console.log('🧪 Testing directory structure...\n');

    const cameraId = '102';  // Test camera ID
    const now = moment();
    const date = now.format('YYYY-MM-DD');
    const hour = now.format('HH');

    // Test base directories
    console.log('📁 Checking base directories:');
    const cameraDir = pathUtils.getCameraDir(cameraId);
    const liveDir = pathUtils.getLiveDir(cameraId);
    const recordingsDir = pathUtils.getRecordingsBaseDir(cameraId);

    await fs.ensureDir(cameraDir);
    await fs.ensureDir(liveDir);
    await fs.ensureDir(recordingsDir);

    console.log(`✅ Camera directory: ${cameraDir}`);
    console.log(`✅ Live directory: ${liveDir}`);
    console.log(`✅ Recordings directory: ${recordingsDir}`);

    // Test current date/hour directories
    console.log('\n📁 Checking current date/hour directories:');
    const currentDateDir = path.join(recordingsDir, date);
    const currentHourDir = path.join(currentDateDir, hour);

    await fs.ensureDir(currentDateDir);
    await fs.ensureDir(currentHourDir);

    console.log(`✅ Current date directory: ${currentDateDir}`);
    console.log(`✅ Current hour directory: ${currentHourDir}`);

    // Test playlist paths
    console.log('\n📄 Checking playlist paths:');
    const livePlaylist = pathUtils.getLivePlaylistPath(cameraId);
    const recordingPlaylist = pathUtils.getRecordingPlaylistPath(cameraId, date, hour);

    console.log(`✅ Live playlist path: ${livePlaylist}`);
    console.log(`✅ Recording playlist path: ${recordingPlaylist}`);

    // Test segment patterns
    console.log('\n🎬 Checking segment patterns:');
    const liveSegmentPattern = pathUtils.getLiveSegmentPattern(cameraId);
    const recordingSegmentPattern = pathUtils.getRecordingSegmentPattern(cameraId, date, hour);

    console.log(`✅ Live segment pattern: ${liveSegmentPattern}`);
    console.log(`✅ Recording segment pattern: ${recordingSegmentPattern}`);

    // Test structure validation
    console.log('\n🔍 Validating directory structure:');
    const validation = await pathUtils.validateStructure(cameraId);

    if (validation.valid) {
        console.log('✅ Directory structure is valid');
    } else {
        console.log('❌ Directory structure validation failed:');
        validation.errors.forEach(error => console.log(`   - ${error}`));
    }

    // Test cleanup
    console.log('\n🧹 Testing cleanup of empty directories:');
    await pathUtils.cleanupEmptyDirs(cameraId);
    console.log('✅ Empty directory cleanup completed');

    // Test web URLs
    console.log('\n🌐 Testing stream URLs:');
    const liveStreamUrl = pathUtils.getLiveStreamWebUrl(cameraId);
    const recordingStreamUrl = pathUtils.getRecordingStreamWebUrl(cameraId, date, hour);

    console.log(`✅ Live stream URL: ${liveStreamUrl}`);
    console.log(`✅ Recording stream URL: ${recordingStreamUrl}`);

    // Create test files
    console.log('\n📝 Creating test files:');
    
    // Live stream files
    await fs.writeFile(livePlaylist, '#EXTM3U\n#EXT-X-VERSION:3\n');
    await fs.writeFile(path.join(liveDir, 'segment0.ts'), 'test');
    console.log('✅ Created test live stream files');

    // Recording files
    await fs.writeFile(recordingPlaylist, '#EXTM3U\n#EXT-X-VERSION:3\n');
    await fs.writeFile(path.join(currentHourDir, '00.ts'), 'test');
    console.log('✅ Created test recording files');

    // Final structure check
    console.log('\n📊 Final directory structure:');
    await printDirectoryStructure(config.hlsPath);
}

async function printDirectoryStructure(dir, prefix = '') {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
        const itemPath = path.join(dir, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
            console.log(`${prefix}📁 ${item}/`);
            await printDirectoryStructure(itemPath, prefix + '   ');
        } else {
            console.log(`${prefix}📄 ${item}`);
        }
    }
}

// Run tests
testDirectoryStructure().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 