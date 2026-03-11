const { pool } = require('./index');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function runMigrations(client) {
  console.log('🔄 Running migrations...');

  // Migration: add compilation_error to test_case_results status constraint
  try {
    await client.query(`
      ALTER TABLE test_case_results
        DROP CONSTRAINT IF EXISTS test_case_results_status_check;
    `);
    await client.query(`
      ALTER TABLE test_case_results
        ADD CONSTRAINT test_case_results_status_check
        CHECK (status IN ('passed', 'failed', 'time_limit_exceeded', 'runtime_error', 'compilation_error'));
    `);
    console.log('✅ Migration: test_case_results status constraint updated');
  } catch (err) {
    console.error('⚠️  Migration warning (may already be applied):', err.message);
  }
}

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔧 Setting up database...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✅ Database schema created successfully');

    // Run migrations for existing databases
    await runMigrations(client);

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

setupDatabase();
