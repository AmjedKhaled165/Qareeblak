const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://Qareeblak:Q%40r33bL%40k_StR0ng_%2126@qareeblak-serverdb.postgres.database.azure.com:5432/postgres?sslmode=require'
});

const sql = `
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    category VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

pool.query(sql)
    .then(res => console.log('requests table created/verified'))
    .catch(err => console.error('Error:', err.message))
    .finally(() => pool.end());
