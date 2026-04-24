'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
  process.exit(-1);
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error('Database query error:', { text, error: err.message });
    throw err;
  }
}

async function runMigrations() {
  console.log('Running database migrations...');

  await query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(255) PRIMARY KEY,
      ordem INTEGER,
      nome VARCHAR(500) NOT NULL,
      categoria VARCHAR(50) NOT NULL,
      subcategoria VARCHAR(100),
      preco DECIMAL(10,2) NOT NULL,
      imagem VARCHAR(500),
      descricao TEXT,
      notas TEXT,
      harmonizacao TEXT,
      destaque BOOLEAN DEFAULT false,
      produtor VARCHAR(255),
      ativo BOOLEAN DEFAULT true,

      -- Wine-specific
      uva VARCHAR(255),
      safra VARCHAR(50),
      teor VARCHAR(50),
      volume VARCHAR(50),
      regiao VARCHAR(255),
      temperatura VARCHAR(100),
      guarda VARCHAR(100),

      -- Chocolate-specific
      peso VARCHAR(50),
      cacau VARCHAR(50),
      origem VARCHAR(255),
      alcool BOOLEAN DEFAULT false,
      alergenos TEXT[],

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Create updated_at trigger function
  await query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql'
  `);

  // Create trigger for products table
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_products_updated_at'
      ) THEN
        CREATE TRIGGER update_products_updated_at
          BEFORE UPDATE ON products
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END;
    $$
  `);

  console.log('Migrations completed successfully.');
}

async function seedDefaultAdmin() {
  const bcrypt = require('bcryptjs');

  const result = await query('SELECT COUNT(*) FROM admin_users');
  const count = parseInt(result.rows[0].count, 10);

  if (count === 0) {
    const defaultEmail = 'admin@borbulhas.com.br';
    const defaultPassword = 'changeme123';
    const hash = await bcrypt.hash(defaultPassword, 12);

    await query(
      'INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)',
      [defaultEmail, hash]
    );

    console.warn('');
    console.warn('========================================================');
    console.warn('  WARNING: Default admin user created!');
    console.warn(`  Email: ${defaultEmail}`);
    console.warn(`  Password: ${defaultPassword}`);
    console.warn('  CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!');
    console.warn('========================================================');
    console.warn('');
  }
}

module.exports = { query, pool, runMigrations, seedDefaultAdmin };
