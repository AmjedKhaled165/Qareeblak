module.exports = {
    apps: [
        {
            name: 'qareeblak-api',
            script: './index.js',
            instances: 1, // مهم: استخدام instance واحد فقط لتقليل استهلاك الرامات
            exec_mode: 'fork', // وضع fork بدل cluster للحفاظ على الموارد
            autorestart: true,
            watch: false,
            max_memory_restart: '2G', // زيادة الحد إلى 2GB للتعامل مع BullMQ Workers
            // Node V8 max space (Must ALWAYS be lower than max_memory_restart to allow clean GC before PM2 SIGKILL)
            node_args: "--max-old-space-size=1536", // 1.5GB - إعطاء مساحة أكبر للتطبيق
            env: {
                NODE_ENV: 'development',
                PORT: 5000
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 5000
            },
            // Logs handling
            out_file: './logs/pm2-out.log',
            error_file: './logs/pm2-error.log',
            merge_logs: true,
            time: true
        }
        // ملاحظة: الـ Background Workers (BullMQ) بيشتغلوا داخل الـ API process
        // مش محتاجين process منفصل عشان الكود الحالي مدمج معاه
    ]
};
