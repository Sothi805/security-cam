#!/usr/bin/env node

const config = require('../utils/config');
const ConfigValidator = require('../utils/config-validator');

console.log('🔍 CCTV System Configuration Validation');
console.log('==========================================\n');

// Create validator instance
const validator = new ConfigValidator(config);

// Run validation
console.log('📋 Validating configuration...\n');
const result = validator.validate();
validator.validateFileSystem();

// Display results
if (result.errors.length > 0) {
    console.log('❌ CONFIGURATION ERRORS:');
    result.errors.forEach(error => console.log(`   • ${error}`));
    console.log();
}

if (result.warnings.length > 0) {
    console.log('⚠️  CONFIGURATION WARNINGS:');
    result.warnings.forEach(warning => console.log(`   • ${warning}`));
    console.log();
}

if (result.isValid && result.warnings.length === 0) {
    console.log('✅ Configuration is valid with no warnings!\n');
} else if (result.isValid) {
    console.log('✅ Configuration is valid (with warnings above)\n');
} else {
    console.log('❌ Configuration has errors that must be fixed\n');
}

// Display configuration summary
console.log('📊 CONFIGURATION SUMMARY:');
console.log('=========================');
const summary = validator.generateSummary();

console.log(`Environment: ${summary.environment}`);
console.log(`Cameras: ${summary.cameras}`);
console.log(`Video Quality: ${summary.videoQuality}`);
console.log(`\n💾 Storage Estimates:`);
console.log(`   Per Camera/Day: ${summary.estimatedStorage.perCameraPerDay}`);
console.log(`   Total/Day: ${summary.estimatedStorage.totalPerDay}`);
console.log(`   Retention: ${summary.estimatedStorage.retentionDays} days`);
console.log(`   Total Needed: ${summary.estimatedStorage.totalNeeded}`);
console.log(`   Storage Limit: ${summary.storageLimit}`);

// Check if estimated storage exceeds limit
const estimatedGB = parseFloat(summary.estimatedStorage.totalNeeded);
const limitGB = parseFloat(summary.storageLimit);
if (estimatedGB > limitGB) {
    console.log(`\n⚠️  WARNING: Estimated storage (${summary.estimatedStorage.totalNeeded}) exceeds limit (${summary.storageLimit})`);
    console.log('   Consider reducing retention time or increasing storage limit.');
}

console.log('\n🎯 UNIT REFERENCE:');
console.log('==================');
console.log('Time: seconds (s), minutes (min), hours (h), days (d)');
console.log('Size: bytes (B), kilobytes (KB), megabytes (MB), gigabytes (GB)');
console.log('Video: pixels (px), frames per second (fps), bitrate (k/M)');
console.log('Memory: megabytes (MB), gigabytes (GB)');

console.log('\n📚 For detailed configuration info, see:');
console.log('   ./CONFIGURATION.md');

// Exit with appropriate code
process.exit(result.isValid ? 0 : 1); 