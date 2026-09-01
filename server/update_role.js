const { Pool } = require('pg'); 
const pool = new Pool({ connectionString: 'postgresql://Qareeblak:Q%40r33bL%40k_StR0ng_%2126@qareeblak-serverdb.postgres.database.azure.com:5432/postgres?sslmode=require' }); 
pool.query("UPDATE users SET user_type = 'partner_owner' WHERE id = 61")
.then(res => { console.log('Updated Amjed to partner_owner', res.rowCount); process.exit(0); })
.catch(e => { console.error(e); process.exit(1); })
