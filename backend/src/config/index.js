/**
 * Central config from environment.
 * All sensitive values come from .env (user adds them).
 */

require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3100,
  apiPrefix: process.env.API_PREFIX || '/api',

  db: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT, 10) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'winloop',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'ahmetmehmet',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10,
  },

  cors: {
    origins: process.env.CORS_ORIGINS || '*',
  },
};

/** Connection string for pg client */
config.db.connectionString = process.env.DATABASE_URL ||
  `postgresql://${config.db.user}:${config.db.password}@${config.db.host}:${config.db.port}/${config.db.database}`;

module.exports = config;
