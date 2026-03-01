/**
 * Morning game (Wordle) API. All validation server-side.
 */

const express = require('express');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const morningService = require('../services/morningService');

const router = express.Router();

/** GET /morning/today — today's question (questionId, wordLength, maxAttempts). If auth, previousAttempts. */
router.get('/today', optionalAuth, async (req, res, next) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const userId = req.user?.sub || null;
    const data = await morningService.getTodayQuestion(dateStr, userId);
    if (data.error) {
      const status = data.error === 'NO_SET' || data.error === 'NO_QUESTION' ? 404 : 400;
      return res.status(status).json({ error: data.error, message: data.message });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** POST /morning/guess — submit a guess (auth required). */
router.post('/guess', authMiddleware, async (req, res, next) => {
  try {
    const { questionId, word } = req.body || {};
    if (!questionId || !word || typeof word !== 'string') {
      return res.status(400).json({ error: 'Bad request', message: 'questionId and word required' });
    }
    const dateStr = req.query.date || req.body.date || new Date().toISOString().slice(0, 10);
    const result = await morningService.submitGuess(req.user.sub, questionId, word.trim(), dateStr);
    if (result.error) {
      const status = result.error === 'NO_SET' || result.error === 'INVALID_QUESTION' ? 400
        : result.error === 'ALREADY_COMPLETED' ? 409
        : result.error === 'NO_ATTEMPTS_LEFT' ? 409
        : 400;
      return res.status(status).json({ error: result.error, message: result.message });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /morning/submit — complete game and get score + points (auth required). */
router.post('/submit', authMiddleware, async (req, res, next) => {
  try {
    const { questionId } = req.body || {};
    if (!questionId) {
      return res.status(400).json({ error: 'Bad request', message: 'questionId required' });
    }
    const dateStr = req.query.date || req.body.date || new Date().toISOString().slice(0, 10);
    const result = await morningService.submitSession(req.user.sub, questionId, dateStr);
    if (result.error) {
      const status = result.error === 'ALREADY_COMPLETED' ? 409 : 400;
      return res.status(status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
