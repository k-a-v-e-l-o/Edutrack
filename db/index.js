const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    return;
  }
  release();
  console.log('✅ Connected to Supabase database');
});

module.exports = pool;