const { pool } = require('./index');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔧 Setting up database...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✅ Database schema created successfully');
    console.log('\n📋 Default credentials:');
    console.log('  Admin:   admin / admin123');
    console.log('  Student: alice / student123');
    console.log('  Student: bob / student123');
    console.log('  Student: charlie / student123\n');
  } catch (err) {
    console.error('❌ Database setup failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

module.exports = setupDatabase;
