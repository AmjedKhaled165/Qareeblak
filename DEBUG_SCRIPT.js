// Quick Debug Script for Order Tracking
// Paste this in the browser console (F12) to debug

console.log("=== Order Tracking Debug Script ===");

// Check current URL
const url = new URL(window.location.href);
const orderId = url.pathname.split('/').pop();
console.log("📍 Current URL:", window.location.href);
console.log("📍 Order ID from URL:", orderId);

// Check auth tokens
const halan_token = localStorage.getItem('halan_token');
const qareeblak_token = localStorage.getItem('qareeblak_token');
console.log("🔑 Halan Token:", halan_token ? "✅ Present" : "❌ Missing");
console.log("🔑 Qareeblak Token:", qareeblak_token ? "✅ Present" : "❌ Missing");
console.log("🔑 Active Token:", (halan_token || qareeblak_token) ? "✅ Available" : "❌ No Token!");

// Check API base URL
const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
console.log("🌐 API Base URL:", apiBase);

// Manual API call test
async function testBookingAPI() {
    const token = halan_token || qareeblak_token;
    const endpoint = `/bookings/${orderId}`;
    const url = `${apiBase}/${endpoint}`.replace(/\/+/g, '/').replace(/:\//g, '://');
    
    console.log("\n=== Testing API Call ===");
    console.log("📡 Endpoint:", endpoint);
    console.log("📡 Full URL:", url);
    
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("❌ Non-JSON response:", text.substring(0, 200));
            return;
        }
        
        console.log("✅ Status:", response.status, response.statusText);
        console.log("✅ Response:", data);
        
        if (response.ok && data) {
            console.log("\n=== Order Data ===");
            console.log("ID:", data.id);
            console.log("Source:", data.source);
            console.log("Channel:", data.channel);
            console.log("Provider:", data.providerName);
            console.log("Status:", data.status);
            console.log("User ID:", data.userId);
        }
    } catch (error) {
        console.error("❌ Fetch Error:", error);
    }
}

// Run test
testBookingAPI();
