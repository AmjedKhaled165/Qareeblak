// Route Verification Script
console.log('🔍 Verifying server routes...\n');

try {
    // Test loading routes
    console.log('1. Loading notifications routes...');
    const notificationsRoutes = require('./routes/notifications');
    console.log('   ✅ Notifications routes loaded successfully');
    
    console.log('\n2. Checking route registration...');
    const express = require('express');
    const testApp = express();
    testApp.use('/api/notifications', notificationsRoutes);
    console.log('   ✅ Route registration successful');
    
    console.log('\n3. Available notification routes:');
    notificationsRoutes.stack.forEach(layer => {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
            console.log(`   ${methods} /api/notifications${layer.route.path}`);
        }
    });
    
    console.log('\n✨ All route verifications passed!');
    console.log('\n📝 To start the server properly:');
    console.log('   cd server');
    console.log('   npm run dev   (for development with auto-reload)');
    console.log('   OR');
    console.log('   npm start     (for production mode)');
    
} catch (error) {
    console.error('\n❌ Route verification failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
}
