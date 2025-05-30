const fs = require('fs-extra');
const moment = require('moment');
const config = require('../utils/config');

console.log('🔍 HLS File Test');
console.log('='.repeat(50));

// Test current hour file generation
const currentDate = moment().format('YYYY-MM-DD');
const currentHour = moment().format('HH-mm');
const cameraId = '102';

console.log(`📅 Current Date: ${currentDate}`);
console.log(`🕐 Current Hour: ${currentHour}`);
console.log(`📹 Testing Camera: ${cameraId}`);
console.log('');

// Check if directories exist
const cameraDir = config.getCameraDirectory(cameraId);
const dateDir = config.getStreamDirectory(cameraId, currentDate);
const streamPath = config.getStreamPath(cameraId, currentDate, currentHour);

console.log('📁 Directory Structure:');
console.log(`   Camera Dir: ${cameraDir} - ${fs.existsSync(cameraDir) ? '✅ EXISTS' : '❌ MISSING'}`);
console.log(`   Date Dir: ${dateDir} - ${fs.existsSync(dateDir) ? '✅ EXISTS' : '❌ MISSING'}`);
console.log('');

console.log('📺 Stream File:');
console.log(`   Live Stream: ${streamPath}`);
console.log(`   Status: ${fs.existsSync(streamPath) ? '✅ EXISTS' : '❌ MISSING'}`);
if (fs.existsSync(streamPath)) {
    const stats = fs.statSync(streamPath);
    console.log(`   Size: ${stats.size} bytes`);
    console.log(`   Modified: ${stats.mtime}`);
    console.log(`   Age: ${Date.now() - stats.mtime.getTime()}ms ago`);
}
console.log('');

// Check what files actually exist in the date directory
if (fs.existsSync(dateDir)) {
    console.log('📋 Files in date directory:');
    const files = fs.readdirSync(dateDir);
    if (files.length === 0) {
        console.log('   ❌ No files found');
    } else {
        files.forEach(file => {
            const filePath = `${dateDir}/${file}`;
            const stats = fs.statSync(filePath);
            const age = Date.now() - stats.mtime.getTime();
            console.log(`   📄 ${file} (${stats.size} bytes, ${age}ms ago)`);
        });
    }
} else {
    console.log('📋 Date directory does not exist');
}

console.log('');
console.log('🔍 Test completed'); 