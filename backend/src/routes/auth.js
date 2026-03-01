/**
 * Auth: register (email/password), login (email/password), google (idToken).
 * Returns JWT. All validations server-side.
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const config = require('../config');
const { pool } = require('../db/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const googleClient = config.google?.clientId ? new OAuth2Client(config.google.clientId) : null;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/** POST /auth/register — email, password, displayName */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Bad request', message: 'email and password required' });
    }
    const emailTrim = email.trim().toLowerCase();
    if (emailTrim.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Bad request', message: 'Invalid email or password length' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [emailTrim]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Conflict', message: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const name = (displayName && typeof displayName === 'string') ? displayName.trim().slice(0, 100) : emailTrim.split('@')[0];
    const insert = await pool.query(
      `INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, display_name`,
      [emailTrim, name, passwordHash]
    );
    const user = insert.rows[0];
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);
    await pool.query('INSERT INTO user_points (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING', [user.id]);
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    next(err);
  }
});

/** POST /auth/login — email, password */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Bad request', message: 'email and password required' });
    }
    const emailTrim = email.trim().toLowerCase();
    const row = await pool.query(
      'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
      [emailTrim]
    );
    if (row.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
    }
    const user = row.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Use Google login for this account' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
    }
    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    next(err);
  }
});

/** POST /auth/google — idToken from Google Sign-In */
router.post('/google', async (req, res, next) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken || !googleClient) {
      return res.status(400).json({ error: 'Bad request', message: 'idToken required and Google client must be configured' });
    }
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = (payload.email || '').trim().toLowerCase();
    const displayName = payload.name || payload.email?.split('@')[0] || 'User';
    let row = await pool.query(
      'SELECT id, email, display_name FROM users WHERE google_id = $1',
      [googleId]
    );
    if (row.rows.length === 0 && email) {
      row = await pool.query('SELECT id, email, display_name FROM users WHERE email = $1', [email]);
    }
    let user;
    if (row.rows.length > 0) {
      user = row.rows[0];
      await pool.query(
        'UPDATE users SET google_id = $1, display_name = $2, last_login_at = now(), updated_at = now() WHERE id = $3',
        [googleId, displayName, user.id]
      );
    } else {
      const ins = await pool.query(
        `INSERT INTO users (google_id, email, display_name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, email, display_name`,
        [googleId, email || null, displayName, payload.picture || null]
      );
      user = ins.rows[0];
      await pool.query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);
      await pool.query('INSERT INTO user_points (user_id, balance) VALUES ($1, 0)', [user.id]);
    }
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    if (err.message && err.message.includes('Token')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid Google token' });
    }
    next(err);
  }
});

/** GET /auth/me — current user (requires Bearer token) */
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const r = await pool.query(
      'SELECT id, email, display_name, avatar_url, last_login_at FROM users WHERE id = $1',
      [req.user.sub]
    );
    if (r.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
    }
    const u = r.rows[0];
    res.json({ user: { id: u.id, email: u.email, displayName: u.display_name, avatarUrl: u.avatar_url, lastLoginAt: u.last_login_at } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
