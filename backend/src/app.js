/**
 * Express app: security, CORS, routes.
 * All game endpoints must validate and verify actions server-side.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const morningRouter = require('./routes/morning');
const dungeonRouter = require('./routes/dungeon');
const filesRouter = require('./routes/files');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const corsOrigins = config.cors.origins === '*' ? '*' : config.cors.origins.split(',').map((o) => o.trim());
app.use(cors({ origin: corsOrigins }));

app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
});
app.use(config.apiPrefix, limiter);

app.use(`${config.apiPrefix}/health`, healthRouter);
app.use(`${config.apiPrefix}/auth`, authRouter);
app.use(`${config.apiPrefix}/morning`, morningRouter);
app.use(`${config.apiPrefix}/dungeon`, dungeonRouter);
app.use(`${config.apiPrefix}/files`, filesRouter);

app.get('/', (req, res) => {
  res.json({ name: 'winloop-api', version: '1.0.0', prefix: config.apiPrefix });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: config.env === 'production' ? 'Internal server error' : err.message,
  });
});

module.exports = app;
