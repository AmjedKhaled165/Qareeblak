const fs = require('fs');
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');

const filePath = path.join(__dirname, 'server', 'routes', 'halan-orders.js');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the first orphan "// Update Order (Edit)" comment around line 512
let orphanStart = -1;
let realRouteStart = -1;

for (let i = 500; i < 600 && i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('// Update Order (Edit)') && orphanStart === -1) {
        orphanStart = i;
        console.log(`Found orphan comment at line ${i + 1}: "${line.substring(0, 50)}..."`);
    }
    if (line.includes('router.put(') && orphanStart !== -1) {
        realRouteStart = i;
        console.log(`Found real route at line ${i + 1}: "${line.substring(0, 50)}..."`);
        break;
    }
}

if (orphanStart !== -1 && realRouteStart !== -1) {
    console.log(`\nRemoving orphan code from line ${orphanStart + 1} to ${realRouteStart}`);
    // Keep everything before orphanStart, then add the real route onwards
    const newLines = [
        ...lines.slice(0, orphanStart),
        '// Update Order (Edit)',
        ...lines.slice(realRouteStart)
    ];
    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log('Fixed halan-orders.js!');
} else {
    console.log('Could not find orphan code markers');
    console.log(`orphanStart: ${orphanStart}, realRouteStart: ${realRouteStart}`);
}
