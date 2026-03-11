module.exports = {
    apps: [
        {
            name: 'qareeblak-api',
            script: './index.js',
            instances: 1, // مهم: استخدام instance واحد فقط لتقليل استهلاك الرامات
            exec_mode: 'fork', // وضع fork بدل cluster للحفاظ على الموارد
            autorestart: true,
            watch: false,
            max_memory_restart: '1G', // Gracefully restarts if memory leaks hit 1024MB
            // Node V8 max space (Must ALWAYS be lower than max_memory_restart to allow clean GC before PM2 SIGKILL)
            node_args: "--max-old-space-size=800",
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
        },
        // Dedicated worker process for Background Jobs (e.g., BullMQ)
        // Keeps the API layer responsive by offloading heavy background tasks
        {
            name: 'qareeblak-worker',
            script: './utils/queues.js', // Or a dedicated worker entry point if existing
            instances: 1, // Usually 1 is enough for background, scale if needed
            exec_mode: 'fork', // Workers don't need cluster mode usually
            autorestart: true,
            watch: false,
            env_production: {
                NODE_ENV: 'production',
            },
            out_file: './logs/worker-out.log',
            error_file: './logs/worker-error.log',
            merge_logs: true,
        }
    ]
};
