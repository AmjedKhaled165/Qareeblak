module.exports = {
    apps: [
        {
            name: 'qareeblak-api',
            script: './index.js',
            instances: 'max', // Utilizes all available CPU cores automatically
            exec_mode: 'cluster',
            autorestart: true,
            watch: false,
            max_memory_restart: '1G', // Gracefully restarts if memory leaks hit 1GB
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
    ]
};
