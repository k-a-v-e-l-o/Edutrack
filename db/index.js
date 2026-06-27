const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.message);
    return;
  }
  release();
  console.log('Connected to Supabase database');
});

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };