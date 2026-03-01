/**
 * Dungeon API: daily seed, start run, get state, move, action, level-up choice.
 * All actions require auth; timezone sent by client is stored.
 */

const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const dungeonService = require('../services/dungeonService');

const router = express.Router();

function dateStr(req) {
  return req.query.date || req.body.date || new Date().toISOString().slice(0, 10);
}

function tz(req) {
  return req.body.clientTimezone || req.query.clientTimezone || req.headers['x-client-timezone'] || null;
}

/** GET /dungeon/daily/seed — get or create daily seed (no auth required to read) */
router.get('/daily/seed', (req, res, next) => {
  dungeonService.getDailySeed(dateStr(req))
    .then((data) => res.json(data))
    .catch(next);
});

/** POST /dungeon/start — start or resume run */
router.post('/start', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const data = await dungeonService.startRun(userId, dateStr(req), tz(req));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** GET /dungeon/state — get current run state and level */
router.get('/state', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const data = await dungeonService.getRunState(userId, dateStr(req));
    if (data.error) {
      const status = data.error === 'NO_RUN' ? 404 : 400;
      return res.status(status).json({ error: data.error, message: data.message });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** POST /dungeon/move — move to adjacent cell */
router.post('/move', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { runId, toR, toC } = req.body || {};
    if (runId == null || toR == null || toC == null) {
      return res.status(400).json({ error: 'Bad request', message: 'runId, toR, toC required' });
    }
    const data = await dungeonService.move(userId, runId, parseInt(toR, 10), parseInt(toC, 10), tz(req));
    if (data.error) {
      return res.status(400).json({ error: data.error, message: data.message });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** POST /dungeon/action — attack, pickup, open */
router.post('/action', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { runId, actionType, targetR, targetC } = req.body || {};
    if (!runId || !actionType || targetR == null || targetC == null) {
      return res.status(400).json({ error: 'Bad request', message: 'runId, actionType, targetR, targetC required' });
    }
    const data = await dungeonService.action(
      userId,
      runId,
      actionType,
      parseInt(targetR, 10),
      parseInt(targetC, 10),
      tz(req)
    );
    if (data.error) {
      return res.status(400).json({ error: data.error, message: data.message });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** POST /dungeon/use-item — use item from inventory by index */
router.post('/use-item', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { runId, inventoryIndex } = req.body || {};
    if (runId == null || inventoryIndex == null) {
      return res.status(400).json({ error: 'Bad request', message: 'runId and inventoryIndex required' });
    }
    const data = await dungeonService.useItem(userId, runId, parseInt(inventoryIndex, 10));
    if (data.error) {
      return res.status(400).json({ error: data.error, message: data.message });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** POST /dungeon/level-up-choice — submit character level-up card choice (after killing enemy) */
router.post('/level-up-choice', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { runId, choiceId } = req.body || {};
    if (!runId || !choiceId) {
      return res.status(400).json({ error: 'Bad request', message: 'runId and choiceId required' });
    }
    const data = await dungeonService.submitLevelUpChoice(runId, userId, choiceId);
    if (data.error) {
      return res.status(400).json({ error: data.error, message: data.message });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** POST /dungeon/level-choice — submit floor-complete choice (legacy; exit no longer shows cards) */
router.post('/level-choice', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { runId, levelIndex, choiceSelected, timeToChooseMs, choicesOffered } = req.body || {};
    if (runId == null || levelIndex == null || !choiceSelected) {
      return res.status(400).json({ error: 'Bad request', message: 'runId, levelIndex, choiceSelected required' });
    }
    const data = await dungeonService.submitLevelChoice(
      runId,
      userId,
      parseInt(levelIndex, 10),
      choiceSelected,
      timeToChooseMs != null ? parseInt(timeToChooseMs, 10) : null,
      choicesOffered || [],
      tz(req)
    );
    if (data.error) {
      return res.status(400).json({ error: data.error, message: data.message });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
