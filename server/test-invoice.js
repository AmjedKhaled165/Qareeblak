require('dotenv').config();
const { sendOrderInvoice } = require('./routes/whatsapp');

console.log("Starting manual test for sendOrderInvoice(9)...");

sendOrderInvoice(9).then(res => {
    console.log("RESULT:", JSON.stringify(res, null, 2));
    process.exit(0);
}).catch(err => {
    console.error("CRASH:", err);
    process.exit(1);
});
