const https = require('https');

https.get('https://api.qareeblak.com/api/providers', (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data.substring(0, 100)));
}).on('error', console.error);
