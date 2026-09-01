require('dotenv').config({ path: './server/.env.production' });
const obf = require('./server/utils/obfuscate');
console.log('ID:', obf.decodeEntityId('user', 'LclI52kudq0lRDBtfLETOg'));
