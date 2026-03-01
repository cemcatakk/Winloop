/**
 * Creates database if missing, then runs migration SQL files.
 * Usage: node scripts/run-migrations.js
 * Requires: .env with PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE=winloop
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const dbName = process.env.PGDATABASE || 'winloop';
const connectionStringBase = `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}`;

async function run() {
  const client = new Client({ connectionString: connectionStringBase + '/postgres' });
  try {
    await client.connect();
    const res = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    if (res.rows.length === 0) {
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database "${dbName}" created.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error('Failed to ensure database:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  const migrationClient = new Client({ connectionString: connectionStringBase + '/' + dbName });
  try {
    await migrationClient.connect();
    await migrationClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) PRIMARY KEY)
    `);
    // If users table exists, mark 001 as already run (existing DB)
    const hasUsers = await migrationClient.query(`
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'
    `);
    if (hasUsers.rows.length > 0) {
      await migrationClient.query(`INSERT INTO schema_migrations (filename) VALUES ('001_initial.sql') ON CONFLICT (filename) DO NOTHING`);
    }
    const migrationsDir = path.join(__dirname, '..', 'src', 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const done = await migrationClient.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (done.rows.length > 0) {
        console.log(`Skip (already run): ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await migrationClient.query(sql);
      await migrationClient.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      console.log(`Ran migration: ${file}`);
    }
    console.log('Migrations completed.');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

run();
