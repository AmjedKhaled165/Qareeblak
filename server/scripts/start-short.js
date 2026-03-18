const { spawn } = require('child_process');

const child = spawn(process.execPath, ['--max-old-space-size=4096', 'index.js'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe']
});

const seen = new Set();

function printOnce(key, line) {
    if (seen.has(key)) return;
    seen.add(key);
    console.log(line);
}

function handleLine(line) {
    const text = String(line || '').trim();
    if (!text) return;

    if (text.includes('[Ready]') && text.includes('port 5000')) {
        printOnce('ready', '✓ Backend started on port 5000');
        return;
    }
    if (text.includes('Connected to PostgreSQL database pool')) {
        printOnce('db', '✓ PostgreSQL connected');
        return;
    }
    if (text.includes('Connected to Redis')) {
        printOnce('redis', '✓ Redis connected');
        return;
    }
    if (text.includes('All migrations completed successfully')) {
        printOnce('startup-migrations', '✓ Startup migrations completed');
        return;
    }
    if (text.includes('Financial & Anti-Fraud migrations completed')) {
        printOnce('finance-migrations', '✓ Finance migrations completed');
        return;
    }

    if (text.includes('EADDRINUSE') || text.includes('address already in use')) {
        console.log('✗ Port 5000 already in use');
        return;
    }
    if (text.includes('PRODUCTION FATAL: Exiting after DB connection retries failed')) {
        console.log('✗ Database unavailable after retries');
        return;
    }
    if (text.includes('Migration Error')) {
        console.log('✗ Migration error detected');
        return;
    }
    if (text.includes('HEALING TRIGGERED: CRITICAL_MEMORY_USAGE')) {
        console.log('✗ High memory pressure detected');
        return;
    }
}

function pipeLines(stream) {
    let buf = '';
    stream.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() || '';
        lines.forEach((line) => handleLine(line));
    });
    stream.on('end', () => {
        if (buf.trim()) handleLine(buf.trim());
    });
}

pipeLines(child.stdout);
pipeLines(child.stderr);

child.on('exit', (code) => {
    if (code === 0) {
        console.log('✓ Backend stopped normally');
    } else {
        console.log(`✗ Backend exited with code ${code}`);
    }
    process.exit(code || 0);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
