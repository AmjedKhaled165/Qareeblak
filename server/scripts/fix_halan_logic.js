
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'routes', 'halan-orders.js');
let content = fs.readFileSync(filePath, 'utf8');

const newLogic = `                // Parent status logic:
                // 1. If ALL sub-orders are ready (3+), parent is ready (3).
                // 2. If ALL sub-orders have accepted (2+), parent is confirmed/preparing (2).
                // 3. Otherwise, parent is pending (1).
                const allActiveAreReady = subOrderLevels.length > 0 && subOrderLevels.every(l => l >= 3);
                const allHaveAccepted = subOrderLevels.length > 0 && subOrderLevels.every(l => l >= 2);
                
                let minLevel = 1;
                if (allActiveAreReady) minLevel = 3;
                else if (allHaveAccepted) minLevel = 2;
                else minLevel = 1;

                const calculatedStatus = levelsToStatus[minLevel] || 'pending';`;

content = content.replace(/\/\/ Parent status is the MINIMUM of all active sub-orders[\s\S]*?const calculatedStatus = levelsToStatus\[minLevel\] \|\| 'pending';/, newLogic);

fs.writeFileSync(filePath, content);
console.log('Successfully updated parent status logic in halan-orders.js');
