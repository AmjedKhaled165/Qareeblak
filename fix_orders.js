const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://Qareeblak:Q%40r33bL%40k_StR0ng_%2126@qareeblak-serverdb.postgres.database.azure.com:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
async function query() {
  const res = await pool.query("SELECT id, source, courier_id, supervisor_id FROM delivery_orders ORDER BY id DESC LIMIT 5;");
  console.log(res.rows);
  pool.end();
}
query().catch(console.error);
