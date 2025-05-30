const fs = require('fs-extra');
const moment = require('moment');
const config = require('./utils/config');

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
const lowStreamPath = config.getStreamPath(cameraId, 'low', currentDate, currentHour);
const highStreamPath = config.getStreamPath(cameraId, 'high', currentDate, currentHour);

console.log('📁 Directory Structure:');
console.log(`   Camera Dir: ${cameraDir} - ${fs.existsSync(cameraDir) ? '✅ EXISTS' : '❌ MISSING'}`);
console.log(`   Date Dir: ${dateDir} - ${fs.existsSync(dateDir) ? '✅ EXISTS' : '❌ MISSING'}`);
console.log('');

console.log('📺 Stream Files:');
console.log(`   Low Quality: ${lowStreamPath}`);
console.log(`   Status: ${fs.existsSync(lowStreamPath) ? '✅ EXISTS' : '❌ MISSING'}`);
if (fs.existsSync(lowStreamPath)) {
    const stats = fs.statSync(lowStreamPath);
    console.log(`   Size: ${stats.size} bytes`);
    console.log(`   Modified: ${stats.mtime}`);
    console.log(`   Age: ${Date.now() - stats.mtime.getTime()}ms ago`);
}
console.log('');

console.log(`   High Quality: ${highStreamPath}`);
console.log(`   Status: ${fs.existsSync(highStreamPath) ? '✅ EXISTS' : '❌ MISSING'}`);
if (fs.existsSync(highStreamPath)) {
    const stats = fs.statSync(highStreamPath);
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
            console.log(`   📄 ${file} (${stats.size} bytes, ${Date.now() - stats.mtime.getTime()}ms ago)`);
        });
    }
} else {
    console.log('❌ Date directory does not exist');
}

console.log('');
console.log('🌐 Expected Web URLs:');
console.log(`   Low: http://localhost:3000/hls/${cameraId}/${currentDate}/${currentHour}-low.m3u8`);
console.log(`   High: http://localhost:3000/hls/${cameraId}/${currentDate}/${currentHour}-high.m3u8`);

console.log('');
console.log('='.repeat(50)); 