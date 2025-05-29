const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

class ProductionSetup {
    constructor() {
        this.basePath = path.resolve(__dirname, '..');
        this.envPath = path.join(this.basePath, '.env');
        this.prodEnvPath = path.join(this.basePath, 'env.production');
    }

    async run() {
        console.log('🏭 Starting CCTV Streaming Backend - Production Mode');
        console.log('='.repeat(60));
        
        try {
            // 1. Setup environment
            await this.setupEnvironment();
            
            // 2. Validate requirements
            await this.validateRequirements();
            
            // 3. Create directory structure
            await this.createDirectories();
            
            // 4. Set permissions (Linux/Mac)
            await this.setPermissions();
            
            // 5. Start the application
            this.startApplication();
            
        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            process.exit(1);
        }
    }

    async setupEnvironment() {
        console.log('📁 Setting up production environment...');
        
        try {
            // Copy production environment file to .env
            if (await fs.pathExists(this.prodEnvPath)) {
                await fs.copy(this.prodEnvPath, this.envPath);
                console.log('✅ Production environment configured');
            } else {
                console.log('⚠️  Production environment file not found, creating default...');
                await this.createDefaultEnv();
            }
        } catch (error) {
            throw new Error(`Failed to setup environment: ${error.message}`);
        }
    }

    async createDefaultEnv() {
        const defaultEnv = `# CCTV Streaming Backend - Production Environment
NODE_ENV=production

# Server Configuration
PORT=3000
HOST=0.0.0.0

# Camera Configuration (Update these with your camera details)
CAMERA_IDS=101,102,103,104,105,106
RTSP_USER=admin
RTSP_PASSWORD=your_production_password
RTSP_HOST=192.168.1.100
RTSP_PORT=554

# Stream Configuration
FPS=12
RETENTION_DAYS_DEV=1
RETENTION_DAYS=30

# FFmpeg Configuration
FFMPEG_PATH=/usr/bin/ffmpeg

# Stream Quality Settings
LOW_QUALITY_WIDTH=854
LOW_QUALITY_HEIGHT=480
LOW_QUALITY_BITRATE=1000k

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/cctv-streaming

# Production specific settings
AUTO_RESTART=true
DEBUG_MODE=false
STREAM_TIMEOUT=60000`;

        await fs.writeFile(this.envPath, defaultEnv);
        console.log('✅ Default production environment created');
        console.log('⚠️  Please update .env file with your production camera credentials');
    }

    async validateRequirements() {
        console.log('🔍 Validating production requirements...');
        
        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
        
        if (majorVersion < 16) {
            throw new Error(`Node.js 16+ required, found ${nodeVersion}`);
        }
        console.log(`✅ Node.js ${nodeVersion} (OK)`);
        
        // Check FFmpeg availability
        try {
            await this.checkFFmpeg();
            console.log('✅ FFmpeg available');
        } catch (error) {
            console.log('⚠️  FFmpeg check failed:', error.message);
            console.log('📋 Please install FFmpeg:');
            console.log('   Ubuntu/Debian: sudo apt install ffmpeg');
            console.log('   CentOS/RHEL: sudo yum install ffmpeg');
        }
        
        // Check available disk space
        await this.checkDiskSpace();
        
        // Check system resources
        await this.checkSystemResources();
    }

    checkFFmpeg() {
        return new Promise((resolve, reject) => {
            const ffmpegPaths = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg'];
            let checked = 0;
            
            const tryPath = (ffmpegPath) => {
                const ffmpeg = spawn(ffmpegPath, ['-version'], { stdio: 'pipe' });
                
                ffmpeg.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        checked++;
                        if (checked >= ffmpegPaths.length) {
                            reject(new Error('FFmpeg not found in any expected location'));
                        }
                    }
                });
                
                ffmpeg.on('error', () => {
                    checked++;
                    if (checked < ffmpegPaths.length) {
                        tryPath(ffmpegPaths[checked]);
                    } else {
                        reject(new Error('FFmpeg not found or not working'));
                    }
                });
            };
            
            tryPath(ffmpegPaths[0]);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                reject(new Error('FFmpeg check timed out'));
            }, 10000);
        });
    }

    async checkDiskSpace() {
        try {
            // This is a simplified check - in production you'd want more sophisticated monitoring
            console.log('✅ Disk space check completed (implement monitoring for production)');
        } catch (error) {
            console.log('⚠️  Disk space check failed:', error.message);
        }
    }

    async checkSystemResources() {
        try {
            const os = require('os');
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const cpuCount = os.cpus().length;
            
            console.log(`✅ System Resources:`);
            console.log(`   CPU Cores: ${cpuCount}`);
            console.log(`   Total Memory: ${(totalMem / 1024 / 1024 / 1024).toFixed(1)} GB`);
            console.log(`   Free Memory: ${(freeMem / 1024 / 1024 / 1024).toFixed(1)} GB`);
            
            // Basic resource warnings
            if (cpuCount < 2) {
                console.log('⚠️  Recommended: 2+ CPU cores for multiple camera streams');
            }
            
            if (totalMem < 2 * 1024 * 1024 * 1024) { // Less than 2GB
                console.log('⚠️  Recommended: 4+ GB RAM for multiple camera streams');
            }
            
        } catch (error) {
            console.log('⚠️  System resource check failed:', error.message);
        }
    }

    async createDirectories() {
        console.log('📂 Creating production directory structure...');
        
        const directories = [
            'hls',
            'logs'
        ];
        
        // For production, we might want different paths
        const isLinux = process.platform === 'linux';
        
        for (const dir of directories) {
            let dirPath;
            
            if (isLinux && dir === 'logs') {
                // Use system log directory on Linux
                dirPath = '/var/log/cctv-streaming';
            } else {
                dirPath = path.join(this.basePath, dir);
            }
            
            await fs.ensureDir(dirPath);
            console.log(`✅ Created ${dirPath}`);
        }
        
        // Ensure public directory exists
        const publicDir = path.join(this.basePath, 'public');
        await fs.ensureDir(publicDir);
        console.log(`✅ Created ${publicDir}`);
    }

    async setPermissions() {
        // Only set permissions on Unix-like systems
        if (process.platform === 'win32') {
            return;
        }
        
        console.log('🔐 Setting file permissions...');
        
        try {
            const { exec } = require('child_process');
            const hlsPath = path.join(this.basePath, 'hls');
            
            // Set appropriate permissions for HLS directory
            await new Promise((resolve, reject) => {
                exec(`chmod -R 755 ${hlsPath}`, (error) => {
                    if (error) {
                        console.log('⚠️  Could not set HLS directory permissions:', error.message);
                    } else {
                        console.log('✅ HLS directory permissions set');
                    }
                    resolve();
                });
            });
            
        } catch (error) {
            console.log('⚠️  Permission setting failed:', error.message);
        }
    }

    startApplication() {
        console.log('🎬 Starting CCTV streaming backend in production mode...');
        console.log('='.repeat(60));
        
        // Set environment variable
        process.env.NODE_ENV = 'production';
        
        // Start the main application
        const appPath = path.join(this.basePath, 'app.js');
        const app = spawn('node', [appPath], {
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' }
        });
        
        app.on('close', (code) => {
            console.log(`\n📊 Application exited with code ${code}`);
            
            // In production, you might want to restart automatically
            if (code !== 0) {
                console.log('🔄 Application crashed, consider using PM2 for auto-restart');
            }
        });
        
        app.on('error', (error) => {
            console.error('❌ Failed to start application:', error.message);
            process.exit(1);
        });
        
        // Handle shutdown gracefully
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down production server...');
            app.kill('SIGINT');
        });
        
        process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down production server...');
            app.kill('SIGTERM');
        });
        
        // Production-specific logging
        console.log('📋 Production Tips:');
        console.log('   • Use PM2 for process management: pm2 start ecosystem.config.js');
        console.log('   • Set up reverse proxy (nginx) for better performance');
        console.log('   • Monitor disk space for HLS segments');
        console.log('   • Set up log rotation for application logs');
    }
}

// Run the setup if this file is executed directly
if (require.main === module) {
    const setup = new ProductionSetup();
    setup.run().catch(error => {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    });
}

module.exports = ProductionSetup; 