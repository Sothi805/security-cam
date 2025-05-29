#!/usr/bin/env node

const CleanupManager = require('../utils/cleanupManager');
const { cleanupLogger } = require('../utils/logger');

async function runCleanup() {
  console.log('🧹 CCTV Storage Cleanup');
  console.log('========================\n');
  
  const cleanupManager = new CleanupManager();
  
  try {
    console.log('Starting cleanup process...');
    
    const startTime = Date.now();
    await cleanupManager.performCleanup();
    const duration = Date.now() - startTime;
    
    console.log(`✅ Cleanup completed in ${duration}ms`);
    
    // Get and display storage stats
    const stats = await cleanupManager.getCleanupStats();
    console.log('\n📊 Storage Status:');
    if (stats.storage && !stats.storage.error) {
      console.log(`   • Current Size: ${stats.storage.currentSize}`);
      console.log(`   • Max Size: ${stats.storage.maxSize}`);
      console.log(`   • Usage: ${stats.storage.usagePercent}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    cleanupLogger.error('Manual cleanup failed:', error);
    process.exit(1);
  }
}

// Run cleanup if called directly
if (require.main === module) {
  runCleanup();
}

module.exports = { runCleanup }; 