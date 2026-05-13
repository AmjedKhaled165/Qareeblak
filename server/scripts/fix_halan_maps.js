
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'routes', 'halan-orders.js');
let content = fs.readFileSync(filePath, 'utf8');

// Modern mapping with Arabic and archived variants
const newMap = `                    'pending': 1, 'new': 1, 'جديد': 1, 'قيد الانتظار': 1, 'تم استلام الطلب': 1,
                    'confirmed': 2, 'accepted': 2, 'processing': 2, 'assigned': 2, 'جاري التنفيذ': 2, 'تم القبول': 2, 'جاري التحضير': 2, 'تم التحضير': 2, 'accepted_by_provider': 2,
                    'completed': 3, 'ready_for_pickup': 3, 'ready': 3, 'مكتمل': 3, 'مكتملة': 3, 'arkived': 3, 'archived': 3, 'تم التجهيز': 3, 'جاهز للاستلام': 3, 'تم استلام من المطعم': 3, 'تم الاستلام من المطعم': 3,
                    'picked_up': 4, 'in_transit': 4, 'جاري التوصيل': 4, 'مع المندوب': 4,
                    'delivered': 5, 'تم التوصيل': 5, 'وصل': 5,
                    'cancelled': 0, 'rejected': 0, 'ملغي': 0, 'مرفوض': 0, 'failed': 0`;

// Regex to find the first occurrence of statusMap content
content = content.replace(/const statusMap = \{[\s\S]*?\};/, `const statusMap = {\n${newMap}\n                };`);

// Regex to find the second occurrence (inside track/:id)
// It's basically the same structure
content = content.replace(/const statusMap = \{[\s\S]*?\};/g, `const statusMap = {\n${newMap}\n                };`);

fs.writeFileSync(filePath, content);
console.log('Successfully updated statusMap in halan-orders.js');
