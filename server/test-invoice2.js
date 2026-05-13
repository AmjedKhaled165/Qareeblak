require('dotenv').config();
process.env.EVOLUTION_API_KEY = "B03332C322B9-4DC7-8ACB-52AC13AE6E8A";

const { sendOrderInvoice } = require('./routes/whatsapp');

console.log("Starting manual test for sendOrderInvoice(9) with NEW KEY...");

sendOrderInvoice(9).then(res => {
    console.log("RESULT:", JSON.stringify(res, null, 2));
    process.exit(0);
}).catch(err => {
    console.error("CRASH:", err);
    process.exit(1);
});
