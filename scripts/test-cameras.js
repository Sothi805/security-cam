const { spawn } = require('child_process');
const config = require('../utils/config');
const { logger } = require('../utils/logger');

class CameraTest {
    constructor() {
        this.results = [];
    }

    async run() {
        console.log('🔍 CCTV Camera Test Suite');
        console.log('='.repeat(50));
        
        try {
            // Test environment
            await this.testEnvironment();
            
            // Test FFmpeg
            await this.testFFmpeg();
            
            // Test cameras
            await this.testCameras();
            
            // Show results
            this.showResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }

    async testEnvironment() {
        console.log('📋 Testing environment configuration...');
        
        try {
            const summary = config.getSummary();
            
            console.log(`✅ Environment: ${summary.environment}`);
            console.log(`✅ Server: ${summary.server.host}:${summary.server.port}`);
            console.log(`✅ Camera IDs: ${summary.cameras.join(', ')}`);
            console.log(`✅ Retention: ${summary.retention}`);
            console.log(`✅ Qualities: ${summary.qualities.join(', ')}`);
            
            this.results.push({
                test: 'Environment',
                status: 'pass',
                message: 'Configuration loaded successfully'
            });
            
        } catch (error) {
            console.log('❌ Environment configuration failed:', error.message);
            this.results.push({
                test: 'Environment',
                status: 'fail',
                message: error.message
            });
        }
    }

    async testFFmpeg() {
        console.log('\n🎬 Testing FFmpeg...');
        
        try {
            await this.checkFFmpegVersion();
            await this.checkFFmpegCodecs();
            
            this.results.push({
                test: 'FFmpeg',
                status: 'pass',
                message: 'FFmpeg is working correctly'
            });
            
        } catch (error) {
            console.log('❌ FFmpeg test failed:', error.message);
            this.results.push({
                test: 'FFmpeg',
                status: 'fail',
                message: error.message
            });
        }
    }

    checkFFmpegVersion() {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn(config.ffmpegPath, ['-version'], { stdio: 'pipe' });
            let output = '';
            
            ffmpeg.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    const versionMatch = output.match(/ffmpeg version (\S+)/);
                    if (versionMatch) {
                        console.log(`✅ FFmpeg version: ${versionMatch[1]}`);
                        resolve();
                    } else {
                        reject(new Error('Could not parse FFmpeg version'));
                    }
                } else {
                    reject(new Error('FFmpeg not found or not working'));
                }
            });
            
            ffmpeg.on('error', (error) => {
                reject(new Error(`FFmpeg error: ${error.message}`));
            });
            
            setTimeout(() => {
                ffmpeg.kill();
                reject(new Error('FFmpeg version check timed out'));
            }, 10000);
        });
    }

    checkFFmpegCodecs() {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn(config.ffmpegPath, ['-codecs'], { stdio: 'pipe' });
            let output = '';
            
            ffmpeg.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    const hasH264 = output.includes('libx264');
                    const hasAAC = output.includes('aac');
                    
                    if (hasH264 && hasAAC) {
                        console.log('✅ Required codecs available (H.264, AAC)');
                        resolve();
                    } else {
                        const missing = [];
                        if (!hasH264) missing.push('H.264/libx264');
                        if (!hasAAC) missing.push('AAC');
                        reject(new Error(`Missing codecs: ${missing.join(', ')}`));
                    }
                } else {
                    reject(new Error('Could not check FFmpeg codecs'));
                }
            });
            
            ffmpeg.on('error', (error) => {
                reject(new Error(`FFmpeg codec check error: ${error.message}`));
            });
            
            setTimeout(() => {
                ffmpeg.kill();
                reject(new Error('FFmpeg codec check timed out'));
            }, 10000);
        });
    }

    async testCameras() {
        console.log('\n📹 Testing camera connections...');
        
        const results = await Promise.allSettled(
            config.cameraIds.map(cameraId => this.testCamera(cameraId))
        );
        
        let passCount = 0;
        for (let i = 0; i < results.length; i++) {
            const cameraId = config.cameraIds[i];
            const result = results[i];
            
            if (result.status === 'fulfilled') {
                console.log(`✅ Camera ${cameraId}: Connected`);
                passCount++;
                this.results.push({
                    test: `Camera ${cameraId}`,
                    status: 'pass',
                    message: 'Connection successful'
                });
            } else {
                console.log(`❌ Camera ${cameraId}: ${result.reason.message}`);
                this.results.push({
                    test: `Camera ${cameraId}`,
                    status: 'fail',
                    message: result.reason.message
                });
            }
        }
        
        console.log(`\n📊 Camera Results: ${passCount}/${config.cameraIds.length} cameras accessible`);
    }

    testCamera(cameraId) {
        return new Promise((resolve, reject) => {
            const rtspUrl = config.getRtspUrl(cameraId);
            
            // Test connection by trying to get stream info
            const ffprobe = spawn('ffprobe', [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_streams',
                '-rtsp_transport', 'tcp',
                '-user_agent', 'LibVLC/3.0.0',  // Critical for Hikvision compatibility
                '-timeout', '10000000',  // 10 seconds
                rtspUrl
            ], { stdio: 'pipe' });
            
            let output = '';
            let errorOutput = '';
            
            ffprobe.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            ffprobe.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            ffprobe.on('close', (code) => {
                if (code === 0) {
                    try {
                        const streamInfo = JSON.parse(output);
                        if (streamInfo.streams && streamInfo.streams.length > 0) {
                            const videoStream = streamInfo.streams.find(s => s.codec_type === 'video');
                            if (videoStream) {
                                resolve({
                                    cameraId,
                                    resolution: `${videoStream.width}x${videoStream.height}`,
                                    codec: videoStream.codec_name,
                                    fps: eval(videoStream.r_frame_rate) // Convert fraction to decimal
                                });
                            } else {
                                reject(new Error('No video stream found'));
                            }
                        } else {
                            reject(new Error('No streams found'));
                        }
                    } catch (error) {
                        reject(new Error('Could not parse stream information'));
                    }
                } else {
                    // Parse common error messages
                    if (errorOutput.includes('Connection refused')) {
                        reject(new Error('Connection refused - check camera IP/port'));
                    } else if (errorOutput.includes('unauthorized') || errorOutput.includes('401')) {
                        reject(new Error('Authentication failed - check username/password'));
                    } else if (errorOutput.includes('timeout') || errorOutput.includes('timed out')) {
                        reject(new Error('Connection timeout - camera not responding'));
                    } else if (errorOutput.includes('No route to host')) {
                        reject(new Error('No route to host - check network connectivity'));
                    } else {
                        reject(new Error('Connection failed - unknown error'));
                    }
                }
            });
            
            ffprobe.on('error', (error) => {
                reject(new Error(`FFprobe error: ${error.message}`));
            });
            
            // Timeout after 15 seconds
            setTimeout(() => {
                ffprobe.kill();
                reject(new Error('Connection test timed out'));
            }, 15000);
        });
    }

    showResults() {
        console.log('\n📋 Test Results Summary');
        console.log('='.repeat(50));
        
        let passed = 0;
        let failed = 0;
        
        for (const result of this.results) {
            const icon = result.status === 'pass' ? '✅' : '❌';
            console.log(`${icon} ${result.test}: ${result.message}`);
            
            if (result.status === 'pass') {
                passed++;
            } else {
                failed++;
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`📊 Total: ${passed} passed, ${failed} failed`);
        
        if (failed === 0) {
            console.log('\n🎉 All tests passed! Your CCTV system is ready to go.');
        } else {
            console.log('\n⚠️  Some tests failed. Please fix the issues before running the system.');
            
            // Provide helpful tips
            if (this.results.some(r => r.test.startsWith('Camera') && r.status === 'fail')) {
                console.log('\n💡 Camera Connection Tips:');
                console.log('   • Verify camera IP address and port');
                console.log('   • Check RTSP username and password');
                console.log('   • Ensure camera is powered on and network accessible');
                console.log('   • Test RTSP URL in VLC media player');
            }
            
            if (this.results.some(r => r.test === 'FFmpeg' && r.status === 'fail')) {
                console.log('\n💡 FFmpeg Installation Tips:');
                console.log('   • Download from: https://ffmpeg.org/download.html');
                console.log('   • Ensure FFmpeg is in your system PATH');
                console.log('   • Update FFMPEG_PATH in your .env file if needed');
            }
        }
        
        process.exit(failed > 0 ? 1 : 0);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    const test = new CameraTest();
    test.run().catch(error => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = CameraTest;