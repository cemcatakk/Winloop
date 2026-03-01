/**
 * PM2 ecosystem config for Winloop API.
 * Usage: pm2 start ecosystem.config.cjs   (from backend folder)
 *        pm2 start backend/ecosystem.config.cjs --cwd backend  (from project root)
 */
module.exports = {
  apps: [
    {
      name: 'winloop-api',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      time: true,
    },
  ],
};
