const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not configured.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

const asyncLocalStorage = new AsyncLocalStorage();

const getDbContext = () => asyncLocalStorage.getStore();

const query = async (text, params = []) => {
  const context = getDbContext();
  if (!context || !context.req || !context.req.user) {
    return pool.query(text, params);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_user_id = $1`, [context.req.user.id]);
    await client.query(`SET LOCAL app.current_user_role = $1`, [context.req.user.role]);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const runWithDBContext = (context, callback) => asyncLocalStorage.run(context, callback);

pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.message);
    return;
  }
  release();
  console.log('Connected to Supabase database');
});

module.exports = { pool, query, runWithDBContext };