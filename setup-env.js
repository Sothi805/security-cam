#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

const ENV_FILES = {
    development: '../development.env',
    production: '../production.env'
};

function setupEnvironment(env = 'development') {
    console.log(`🔧 Setting up ${env} environment...`);
    
    const sourceFile = path.join(__dirname, ENV_FILES[env]);
    const targetFile = path.join(__dirname, '.env');
    
    if (!fs.existsSync(sourceFile)) {
        console.error(`❌ Source environment file not found: ${sourceFile}`);
        process.exit(1);
    }
    
    try {
        // Copy the environment file
        fs.copyFileSync(sourceFile, targetFile);
        console.log(`✅ Environment configured for ${env}`);
        console.log(`📁 Copied: ${sourceFile} → ${targetFile}`);
        
        // Verify the setup
        const content = fs.readFileSync(targetFile, 'utf8');
        const nodeEnv = content.match(/NODE_ENV=(.+)/)?.[1];
        
        if (nodeEnv === env) {
            console.log(`✅ Environment verification passed: NODE_ENV=${nodeEnv}`);
        } else {
            console.warn(`⚠️  Environment mismatch: Expected ${env}, got ${nodeEnv}`);
        }
        
    } catch (error) {
        console.error(`❌ Failed to setup environment:`, error.message);
        process.exit(1);
    }
}

// Get environment from command line argument
const env = process.argv[2] || 'development';

if (!ENV_FILES[env]) {
    console.error(`❌ Invalid environment: ${env}`);
    console.log(`Available environments: ${Object.keys(ENV_FILES).join(', ')}`);
    process.exit(1);
}

setupEnvironment(env); 