const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

class DevelopmentSetup {
    constructor() {
        this.basePath = path.resolve(__dirname, '..');
        this.envPath = path.join(this.basePath, '.env');
        this.devEnvPath = path.join(this.basePath, 'env.development');
    }

    async run() {
        console.log('🚀 Starting CCTV Streaming Backend - Development Mode');
        console.log('='.repeat(60));
        
        try {
            // 1. Setup environment
            await this.setupEnvironment();
            
            // 2. Validate requirements
            await this.validateRequirements();
            
            // 3. Create directory structure
            await this.createDirectories();
            
            // 4. Start the application
            this.startApplication();
            
        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            process.exit(1);
        }
    }

    async setupEnvironment() {
        console.log('📁 Setting up development environment...');
        
        try {
            // Copy development environment file to .env
            if (await fs.pathExists(this.devEnvPath)) {
                await fs.copy(this.devEnvPath, this.envPath);
                console.log('✅ Development environment configured');
            } else {
                console.log('⚠️  Development environment file not found, creating default...');
                await this.createDefaultEnv();
            }
        } catch (error) {
            throw new Error(`Failed to setup environment: ${error.message}`);
        }
    }

    async createDefaultEnv() {
        const defaultEnv = `# CCTV Streaming Backend - Development Environment
NODE_ENV=development

# Server Configuration
PORT=3000
HOST=localhost

# Camera Configuration (Update these with your camera details)
CAMERA_IDS=102
RTSP_USER=admin
RTSP_PASSWORD=password123
RTSP_HOST=192.168.0.105
RTSP_PORT=554

# Stream Configuration
FPS=12
RETENTION_DAYS_DEV=1
RETENTION_DAYS=30

# FFmpeg Configuration
FFMPEG_PATH=ffmpeg

# Stream Quality Settings
LOW_QUALITY_WIDTH=854
LOW_QUALITY_HEIGHT=480
LOW_QUALITY_BITRATE=1000k

# Logging
LOG_LEVEL=debug
LOG_FILE_PATH=./logs

# Development specific settings
AUTO_RESTART=true
DEBUG_MODE=true
STREAM_TIMEOUT=30000`;

        await fs.writeFile(this.envPath, defaultEnv);
        console.log('✅ Default development environment created');
        console.log('⚠️  Please update .env file with your camera credentials');
    }

    async validateRequirements() {
        console.log('🔍 Validating requirements...');
        
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
            console.log('   Windows: https://ffmpeg.org/download.html#build-windows');
            console.log('   Or use chocolatey: choco install ffmpeg');
        }
    }

    checkFFmpeg() {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ['-version'], { stdio: 'pipe' });
            
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error('FFmpeg not found or not working'));
                }
            });
            
            ffmpeg.on('error', (error) => {
                reject(new Error(`FFmpeg check failed: ${error.message}`));
            });
            
            // Timeout after 5 seconds
            setTimeout(() => {
                ffmpeg.kill();
                reject(new Error('FFmpeg check timed out'));
            }, 5000);
        });
    }

    async createDirectories() {
        console.log('📂 Creating directory structure...');
        
        const directories = [
            'hls',
            'logs',
            'public'
        ];
        
        for (const dir of directories) {
            const dirPath = path.join(this.basePath, dir);
            await fs.ensureDir(dirPath);
            console.log(`✅ Created ${dir}/ directory`);
        }
    }

    startApplication() {
        console.log('🎬 Starting CCTV streaming backend...');
        console.log('='.repeat(60));
        
        // Set environment variable
        process.env.NODE_ENV = 'development';
        
        // Start the main application
        const appPath = path.join(this.basePath, 'app.js');
        const app = spawn('node', [appPath], {
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'development' }
        });
        
        app.on('close', (code) => {
            console.log(`\n📊 Application exited with code ${code}`);
        });
        
        app.on('error', (error) => {
            console.error('❌ Failed to start application:', error.message);
            process.exit(1);
        });
        
        // Handle shutdown gracefully
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down development server...');
            app.kill('SIGINT');
        });
        
        process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down development server...');
            app.kill('SIGTERM');
        });
    }
}

// Run the setup if this file is executed directly
if (require.main === module) {
    const setup = new DevelopmentSetup();
    setup.run().catch(error => {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    });
}

module.exports = DevelopmentSetup; 