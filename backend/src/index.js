/**
 * Winloop API entry point.
 * Load .env from backend folder; start server.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = require('./config');
const app = require('./app');

app.listen(config.port, () => {
  console.log(`Winloop API listening on port ${config.port} (${config.env})`);
  console.log(`Base path: ${config.apiPrefix}`);
});
