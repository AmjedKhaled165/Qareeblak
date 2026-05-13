
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'routes', 'halan-orders.js');
let content = fs.readFileSync(filePath, 'utf8');

const newLogic = `                // Parent status logic:
                // 1. If ALL sub-orders are ready (3+), parent is ready (3).
                // 2. If ANY sub-order is accepted/preparing (2+), parent is confirmed/preparing (2).
                // 3. Otherwise, parent is pending (1).
                const allActiveAreReady = subOrderLevels.length > 0 && subOrderLevels.every(l => l >= 3);
                const someHaveAccepted = subOrderLevels.some(l => l >= 2);
                
                let minLevel = 1;
                if (allActiveAreReady) minLevel = 3;
                else if (someHaveAccepted) minLevel = 2;
                else minLevel = 1;

                const calculatedStatus = levelsToStatus[minLevel] || 'pending';`;

// Fixed the replace regex to match the logic I wrote in Step 544
content = content.replace(/\/\/ Parent status logic:[\s\S]*?const calculatedStatus = levelsToStatus\[minLevel\] \|\| 'pending';/, newLogic);

fs.writeFileSync(filePath, content);
console.log('Successfully updated parent status logic in halan-orders.js');
