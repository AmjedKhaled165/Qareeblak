module.exports = {
    apps: [
        {
            name: 'qareeblak-api',
            script: './index.js',
            instances: 1, // Important: Use 1 instance to minimize RAM usage
            exec_mode: 'fork', // Use fork instead of cluster to preserve resources
            autorestart: true,
            watch: false,
            max_memory_restart: '2G', // Limit to 2GB for BullMQ Workers
            // Node V8 max space (Must ALWAYS be lower than max_memory_restart to allow clean GC before PM2 SIGKILL)
            // --expose-gc allows Guardian Watchdog to call global.gc() for forced garbage collection
            node_args: "--max-old-space-size=1536 --expose-gc",
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
        // Note: Background Workers (BullMQ) run inside the API process
        // No separate process needed as the current code is integrated
    ]
};
