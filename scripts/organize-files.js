const fs = require('fs-extra');
const path = require('path');

async function organizeFiles() {
    // Create necessary directories
    await fs.ensureDir('tests');
    await fs.ensureDir('logs');

    // Move test files to tests directory
    const testFiles = [
        'test.m3u8',
        'test0.ts',
        'test-url.js',
        'test-hls-files.js',
        'test-camera-connection.bat'
    ];

    for (const file of testFiles) {
        if (fs.existsSync(file)) {
            await fs.move(file, path.join('tests', file), { overwrite: true });
            console.log(`Moved ${file} to tests directory`);
        }
    }

    // Move log files to logs directory
    const logFiles = [
        'stream_test.log',
        'test_rtsp.log'
    ];

    for (const file of logFiles) {
        if (fs.existsSync(file)) {
            await fs.move(file, path.join('logs', file), { overwrite: true });
            console.log(`Moved ${file} to logs directory`);
        }
    }

    // Remove development.env and production.env from git tracking
    const envFiles = ['development.env', 'production.env'];
    for (const file of envFiles) {
        if (fs.existsSync(file)) {
            console.log(`Please move ${file} to a secure location and create a new one based on .env.example`);
        }
    }
}

organizeFiles().catch(console.error); 