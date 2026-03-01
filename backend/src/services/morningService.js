/**
 * Morning (Wordle) game logic. All validation and scoring server-side.
 */

const { pool } = require('../db/client');

const MAX_ATTEMPTS = 6;

/**
 * Ensure today has a question set; create one from pool if missing.
 */
async function ensureTodaySet(dateStr) {
  const setRes = await pool.query(
    'SELECT id, question_ids FROM morning_question_sets WHERE date = $1',
    [dateStr]
  );
  if (setRes.rows.length > 0) return setRes.rows[0];
  const qRes = await pool.query(
    `SELECT id FROM morning_questions WHERE type = 'wordle' AND is_active = true ORDER BY random() LIMIT 1`
  );
  if (qRes.rows.length === 0) return null;
  const questionId = qRes.rows[0].id;
  const ins = await pool.query(
    `INSERT INTO morning_question_sets (date, question_ids) VALUES ($1, $2::uuid[]) RETURNING id, question_ids`,
    [dateStr, [questionId]]
  );
  return ins.rows[0];
}

/**
 * Get today's question set and the first Wordle question (today's word).
 * Returns questionId, wordLength, maxAttempts; optionally previous attempts for user.
 * If no set exists for today, creates one from the question pool.
 */
async function getTodayQuestion(timezoneDate, userId = null) {
  const dateStr = timezoneDate || new Date().toISOString().slice(0, 10);
  let set = await ensureTodaySet(dateStr);
  if (!set) {
    return { error: 'NO_QUESTION', message: 'No questions in pool. Run seed.' };
  }
  const questionIds = set.question_ids || [];
  if (questionIds.length === 0) {
    return { error: 'NO_QUESTION', message: 'No question for today' };
  }
  const questionId = questionIds[0];
  const qRes = await pool.query(
    'SELECT id, type, payload FROM morning_questions WHERE id = $1 AND type = $2 AND is_active = true',
    [questionId, 'wordle']
  );
  if (qRes.rows.length === 0) {
    return { error: 'NO_QUESTION', message: 'Invalid question' };
  }
  const payload = qRes.rows[0].payload || {};
  const word = (payload.word || '').toUpperCase();
  const wordLength = word.length;

  if (userId) {
    const sessionRes = await pool.query(
      'SELECT score, power_earned FROM morning_sessions WHERE user_id = $1 AND date = $2',
      [userId, dateStr]
    );
    if (sessionRes.rows.length > 0) {
      return {
        date: dateStr,
        questionId,
        alreadyPlayed: true,
        score: sessionRes.rows[0].score,
        powerEarned: sessionRes.rows[0].power_earned,
      };
    }
  }

  let previousAttempts = [];
  if (userId) {
    const attRes = await pool.query(
      `SELECT attempt_number, guess_word FROM morning_attempts
       WHERE user_id = $1 AND question_id = $2 ORDER BY attempt_number`,
      [userId, questionId]
    );
    const targetWord = word;
    for (const row of attRes.rows) {
      const result = computeGuessResult(row.guess_word.toUpperCase(), targetWord);
      previousAttempts.push({ word: row.guess_word.toUpperCase(), result });
    }
  }

  return {
    date: dateStr,
    questionSetId: set.id,
    questionId,
    wordLength,
    maxAttempts: MAX_ATTEMPTS,
    previousAttempts,
  };
}

/**
 * Wordle-style result: for each letter, 'correct' | 'wrong_position' | 'wrong'.
 */
function computeGuessResult(guess, target) {
  const len = target.length;
  const result = [];
  const targetUsed = [];
  for (let i = 0; i < len; i++) targetUsed[i] = false;

  for (let i = 0; i < guess.length; i++) {
    const g = guess[i];
    if (i < len && target[i] === g) {
      result.push({ letter: g, status: 'correct' });
      targetUsed[i] = true;
    } else {
      result.push({ letter: g, status: null });
    }
  }
  for (let i = 0; i < result.length; i++) {
    if (result[i].status !== null) continue;
    const g = result[i].letter;
    let found = -1;
    for (let j = 0; j < len; j++) {
      if (!targetUsed[j] && target[j] === g) {
        found = j;
        break;
      }
    }
    if (found >= 0) {
      targetUsed[found] = true;
      result[i].status = 'wrong_position';
    } else {
      result[i].status = 'wrong';
    }
  }
  return result;
}

/**
 * Submit a guess. Validates question is today's, attempt number, word length. Returns result + isWin + attemptsLeft.
 */
async function submitGuess(userId, questionId, word, timezoneDate) {
  const dateStr = timezoneDate || new Date().toISOString().slice(0, 10);
  const setRes = await pool.query(
    'SELECT id, question_ids FROM morning_question_sets WHERE date = $1',
    [dateStr]
  );
  if (setRes.rows.length === 0) {
    return { error: 'NO_SET' };
  }
  const questionIds = setRes.rows[0].question_ids || [];
  if (!questionIds.includes(questionId)) {
    return { error: 'INVALID_QUESTION', message: 'Question not for today' };
  }
  const qRes = await pool.query(
    'SELECT id, payload FROM morning_questions WHERE id = $1 AND is_active = true',
    [questionId]
  );
  if (qRes.rows.length === 0) {
    return { error: 'INVALID_QUESTION' };
  }
  const targetWord = (qRes.rows[0].payload?.word || '').toUpperCase();
  const guessUpper = (word || '').toUpperCase().trim();
  if (guessUpper.length !== targetWord.length) {
    return { error: 'BAD_REQUEST', message: 'Wrong word length' };
  }

  const countRes = await pool.query(
    'SELECT COUNT(*) AS c FROM morning_attempts WHERE user_id = $1 AND question_id = $2',
    [userId, questionId]
  );
  const attemptNumber = parseInt(countRes.rows[0].c, 10) + 1;
  if (attemptNumber > MAX_ATTEMPTS) {
    return { error: 'NO_ATTEMPTS_LEFT' };
  }

  const sessionCheck = await pool.query(
    'SELECT 1 FROM morning_sessions WHERE user_id = $1 AND date = $2',
    [userId, dateStr]
  );
  if (sessionCheck.rows.length > 0) {
    return { error: 'ALREADY_COMPLETED', message: 'Already played today' };
  }

  await pool.query(
    'INSERT INTO morning_attempts (user_id, question_id, attempt_number, guess_word) VALUES ($1, $2, $3, $4)',
    [userId, questionId, attemptNumber, guessUpper]
  );

  const result = computeGuessResult(guessUpper, targetWord);
  const isWin = guessUpper === targetWord;
  const attemptsLeft = MAX_ATTEMPTS - attemptNumber;

  return {
    result,
    isWin,
    attemptsLeft,
    attemptNumber,
    totalAttempts: MAX_ATTEMPTS,
  };
}

/**
 * Complete the game: create morning_session, award points and power. Server computes score.
 */
async function submitSession(userId, questionId, timezoneDate) {
  const dateStr = timezoneDate || new Date().toISOString().slice(0, 10);
  const setRes = await pool.query(
    'SELECT id, question_ids FROM morning_question_sets WHERE date = $1',
    [dateStr]
  );
  if (setRes.rows.length === 0) {
    return { error: 'NO_SET' };
  }
  const questionIds = setRes.rows[0].question_ids || [];
  if (!questionIds.includes(questionId)) {
    return { error: 'INVALID_QUESTION' };
  }

  const existing = await pool.query(
    'SELECT 1 FROM morning_sessions WHERE user_id = $1 AND date = $2',
    [userId, dateStr]
  );
  if (existing.rows.length > 0) {
    return { error: 'ALREADY_COMPLETED' };
  }

  const attRes = await pool.query(
    'SELECT attempt_number, guess_word FROM morning_attempts WHERE user_id = $1 AND question_id = $2 ORDER BY attempt_number',
    [userId, questionId]
  );
  const attempts = attRes.rows;
  const qRes = await pool.query('SELECT payload FROM morning_questions WHERE id = $1', [questionId]);
  const targetWord = (qRes.rows[0]?.payload?.word || '').toUpperCase();
  const lastGuess = attempts.length > 0 ? attempts[attempts.length - 1].guess_word.toUpperCase() : '';
  const isWin = lastGuess === targetWord;
  const attemptCount = attempts.length;

  let score = 0;
  if (isWin) {
    score = 100 + (MAX_ATTEMPTS - attemptCount) * 15;
    score = Math.min(score, 175);
  }

  const powerEarned = isWin ? 'slot_lock' : null;
  const questionSetId = setRes.rows[0].id;

  await pool.query(
    `INSERT INTO morning_sessions (user_id, date, question_set_id, score, power_earned) VALUES ($1, $2, $3, $4, $5)`,
    [userId, dateStr, questionSetId, score, powerEarned]
  );

  let pointsAdded = Math.floor(score / 10);
  const userRow = await pool.query('SELECT is_penalized FROM users WHERE id = $1', [userId]);
  if (userRow.rows[0]?.is_penalized) {
    pointsAdded = Math.floor(pointsAdded * 0.5);
  }
  if (pointsAdded > 0) {
    await pool.query(
      `UPDATE user_points SET balance = balance + $1, updated_at = now() WHERE user_id = $2`,
      [pointsAdded, userId]
    );
    await pool.query(
      `INSERT INTO point_transactions (user_id, amount, source, reference_id, balance_after)
       SELECT $1, $2, 'morning', $3, balance FROM user_points WHERE user_id = $1`,
      [userId, pointsAdded, questionSetId]
    );
  }

  return {
    success: true,
    score,
    isWin,
    powerEarned,
    pointsAdded,
  };
}

module.exports = {
  getTodayQuestion,
  submitGuess,
  submitSession,
  MAX_ATTEMPTS,
};
