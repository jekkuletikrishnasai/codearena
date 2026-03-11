const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Only log once — pool.on('connect') fires per-connection, not per-pool
let loggedConnection = false;
pool.on('connect', () => {
  if (!loggedConnection) {
    loggedConnection = true;
    console.log('✅ Connected to PostgreSQL database');
  }
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

const query = (text, params) => pool.query(text, params);

// Safe getClient with auto-release guard (prevents connection leaks)
const getClient = async () => {
  const client = await pool.connect();
  const originalRelease = client.release.bind(client);
  const timeout = setTimeout(() => {
    console.error('⚠️  DB client leaked — auto-releasing after 30s');
    originalRelease();
  }, 30000);
  client.release = () => {
    clearTimeout(timeout);
    client.release = originalRelease; // prevent double-release
    originalRelease();
  };
  return client;
};

module.exports = { query, getClient, pool };