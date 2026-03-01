/**
 * Dungeon run: daily seed, start run, move, action (attack/open/pickup), level-up choices.
 * All state and moves stored in DB; timezone and timestamps recorded.
 */

const { pool } = require('../db/client');
const { generateLevel } = require('./dungeonGenerator');

const DEFAULT_HP = 20;
const DEFAULT_ATTACK = 3;
const DEFAULT_DEFENSE = 0;
const EXP_PER_KILL = 10;
const EXP_TO_NEXT_BASE = 20;
const MOVE_COST = 1.0;
const ATTACK_COST = 0.5;
const PICKUP_COST = 1.0;
const USE_ITEM_COST = 1.0;

const LEVEL_UP_CARDS = [
  { id: 'hp_5', nameKey: 'level_choice.hp_5', effect: '+5 Max HP' },
  { id: 'atk_2', nameKey: 'level_choice.atk_2', effect: '+2 Attack' },
  { id: 'def_1', nameKey: 'level_choice.def_1', effect: '+1 Defense' },
  { id: 'hp_3', nameKey: 'level_choice.hp_3', effect: '+3 Max HP' },
  { id: 'atk_1', nameKey: 'level_choice.atk_1', effect: '+1 Attack' },
  { id: 'def_2', nameKey: 'level_choice.def_2', effect: '+2 Defense' },
  { id: 'speed_move', nameKey: 'level_choice.speed_move', effect: '+0.25 Move Speed' },
  { id: 'speed_attack', nameKey: 'level_choice.speed_attack', effect: '+0.5 Attack Speed' },
  { id: 'hp_2_atk_1', nameKey: 'level_choice.hp_2_atk_1', effect: '+2 HP, +1 ATK' },
  { id: 'hp_1_def_2', nameKey: 'level_choice.hp_1_def_2', effect: '+1 HP, +2 DEF' },
];

function getRandomLevelUpChoices(n) {
  const shuffled = [...LEVEL_UP_CARDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

const ENEMY_TEMPLATES = {
  mob_rat: { type: 'enemy', id: 'mob_rat', hp: 5, maxHp: 5, attack: 1, defense: 0, speed: 1, xpValue: 10, rarity: 'common', nameKey: 'mob.rat' },
};

function getEnemyTemplate(id) {
  return ENEMY_TEMPLATES[id] ? { ...ENEMY_TEMPLATES[id] } : { type: 'enemy', id, attack: 1, defense: 0, speed: 1 };
}

async function getOrCreateDailySeed(dateStr) {
  const res = await pool.query(
    'SELECT seed FROM daily_dungeon_seeds WHERE date = $1',
    [dateStr]
  );
  if (res.rows.length > 0) return res.rows[0].seed;
  const seed = Math.floor(Math.random() * 0x7fffffff) + 1;
  await pool.query(
    'INSERT INTO daily_dungeon_seeds (date, seed) VALUES ($1, $2) ON CONFLICT (date) DO NOTHING',
    [dateStr, seed]
  );
  const check = await pool.query('SELECT seed FROM daily_dungeon_seeds WHERE date = $1', [dateStr]);
  return check.rows[0].seed;
}

async function getDailySeed(dateStr) {
  const seed = await getOrCreateDailySeed(dateStr);
  return { seed, date: dateStr };
}

function initEnemyPositionsFromLevel(level) {
  return (level.entities || []).filter((e) => e.type === 'enemy').map((e) => ({ r: e.r, c: e.c, id: e.id }));
}

async function startRun(userId, dateStr, clientTimezone) {
  const seed = await getOrCreateDailySeed(dateStr);
  const level0 = generateLevel(seed, 0);
  const state = {
    currentLevel: 0,
    position: { r: level0.entrance.r, c: level0.entrance.c },
    facing: 's',
    hp: DEFAULT_HP,
    maxHp: DEFAULT_HP,
    attack: DEFAULT_ATTACK,
    defense: DEFAULT_DEFENSE,
    moveSpeed: 1,
    attackSpeed: 2,
    exp: 0,
    expToNextLevel: EXP_TO_NEXT_BASE,
    characterLevel: 1,
    inventory: [],
    levelSeed: seed,
    enemyPositions: { 0: initEnemyPositionsFromLevel(level0) },
    roundTimeUsed: 0,
  };
  const ins = await pool.query(
    `INSERT INTO dungeon_runs (user_id, date, seed, status, started_at_timezone, state)
     VALUES ($1, $2, $3, 'in_progress', $4, $5)
     ON CONFLICT (user_id, date) DO UPDATE SET
       status = 'in_progress',
       started_at = now(),
       started_at_timezone = EXCLUDED.started_at_timezone,
       state = EXCLUDED.state,
       completed_at = NULL,
       completed_at_timezone = NULL
     RETURNING id, seed, state, started_at`,
    [userId, dateStr, seed, clientTimezone || null, JSON.stringify(state)]
  );
  const row = ins.rows[0];
  const state0 = typeof row.state === 'object' ? row.state : JSON.parse(row.state || '{}');
  let level0Out = generateLevel(Number(row.seed), 0);
  level0Out = applyRemovedToLevel(level0Out, state0);
  level0Out = mergeEnemyPositions(level0Out, state0);
  return {
    runId: row.id,
    seed: Number(row.seed),
    state: state0,
    level: level0Out,
    startedAt: row.started_at,
  };
}

function applyRemovedToLevel(level, state) {
  const levelIdx = state.currentLevel ?? 0;
  const removed = (state.removedEntities || {})[levelIdx] || [];
  const picked = (state.pickedItems || {})[levelIdx] || [];
  const removedSet = new Set(removed.map(({ r, c }) => `${r},${c}`));
  picked.forEach(({ r, c }) => removedSet.add(`${r},${c}`));
  level.entities = level.entities.filter((e) => !removedSet.has(`${e.r},${e.c}`));
  level.cells.forEach((cell) => {
    if (removedSet.has(`${cell.r},${cell.c}`) && (cell.type === 'enemy' || cell.type === 'item')) cell.type = 'floor';
  });
  return level;
}

function mergeEnemyPositions(level, state) {
  const levelIdx = Number(state.currentLevel ?? 0);
  const positions = (state.enemyPositions || {})[levelIdx] || [];
  const nonEnemies = (level.entities || []).filter((e) => e.type !== 'enemy');
  const enemies = positions.map((p) => ({ ...getEnemyTemplate(p.id), r: Number(p.r), c: Number(p.c) }));
  level.entities = [...nonEnemies, ...enemies];
  return level;
}

function runEnemyTurn(state, level, timeElapsed = 1.0) {
  const pos = state.position || {};
  const pr = pos.r;
  const pc = pos.c;
  if (pr == null || pc == null) return;
  const levelIdx = state.currentLevel ?? 0;
  const enemies = (state.enemyPositions || {})[levelIdx] || [];
  const occupied = new Set([`${pr},${pc}`]);
  enemies.forEach((e) => occupied.add(`${e.r},${e.c}`));

  for (const enemy of enemies) {
    const template = getEnemyTemplate(enemy.id);
    const speed = template.speed ?? 1;
    const numActions = Math.max(1, Math.round(speed * timeElapsed));
    for (let a = 0; a < numActions; a++) {
      const adj = Math.abs(enemy.r - pr) + Math.abs(enemy.c - pc) === 1;
      if (adj) {
        const dmg = Math.max(1, (template.attack ?? 1) - (state.defense || 0));
        state.hp = Math.max(0, (state.hp || 0) - dmg);
        break;
      }
      const dr = pr - enemy.r;
      const dc = pc - enemy.c;
      let nr = enemy.r;
      let nc = enemy.c;
      if (Math.abs(dr) >= Math.abs(dc) && dr !== 0) nr += dr > 0 ? 1 : -1;
      else if (dc !== 0) nc += dc > 0 ? 1 : -1;
      const key = `${nr},${nc}`;
      if (!occupied.has(key)) {
        const cell = level.cells.find((ce) => ce.r === nr && ce.c === nc);
        const notWall = cell && cell.type !== 'wall';
        const notExit = cell && cell.type !== 'exit';
        const notPlayer = nr !== pr || nc !== pc;
        if (notWall && notExit && notPlayer) {
          occupied.delete(`${enemy.r},${enemy.c}`);
          enemy.r = nr;
          enemy.c = nc;
          occupied.add(key);
        }
      }
    }
  }
}

async function getRunState(userId, dateStr) {
  const res = await pool.query(
    `SELECT id, seed, status, state, started_at, completed_at FROM dungeon_runs
     WHERE user_id = $1 AND date = $2`,
    [userId, dateStr]
  );
  if (res.rows.length === 0) return { error: 'NO_RUN', message: 'No run for this date' };
  const row = res.rows[0];
  const state = typeof row.state === 'object' ? row.state : JSON.parse(row.state || '{}');
  const levelIndex = state.currentLevel ?? 0;
  let level = generateLevel(Number(row.seed), levelIndex);
  level = applyRemovedToLevel(level, state);
  level = mergeEnemyPositions(level, state);
  return {
    runId: row.id,
    seed: Number(row.seed),
    status: row.status,
    state,
    level,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

async function recordMove(runId, userId, fromR, fromC, toR, toC, actionType, targetType, targetId, payload, clientTimezone) {
  const stepRes = await pool.query(
    'SELECT COALESCE(MAX(step_index), -1) + 1 AS next_step FROM dungeon_moves WHERE run_id = $1',
    [runId]
  );
  const stepIndex = stepRes.rows[0].next_step;
  await pool.query(
    `INSERT INTO dungeon_moves (run_id, step_index, from_row, from_col, to_row, to_col, action_type, target_type, target_id, payload, client_timezone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [runId, stepIndex, fromR, fromC, toR, toC, actionType, targetType || null, targetId || null, payload ? JSON.stringify(payload) : null, clientTimezone || null]
  );
  return stepIndex;
}

async function move(userId, runId, toR, toC, clientTimezone) {
  const runRes = await pool.query(
    'SELECT id, user_id, seed, state, status FROM dungeon_runs WHERE id = $1 AND user_id = $2',
    [runId, userId]
  );
  if (runRes.rows.length === 0) return { error: 'NOT_FOUND', message: 'Run not found' };
  const run = runRes.rows[0];
  if (run.status !== 'in_progress') return { error: 'RUN_ENDED', message: 'Run already completed or failed' };

  const state = typeof run.state === 'object' ? run.state : JSON.parse(run.state || '{}');
  const { r: fromR, c: fromC } = state.position || {};
  let level = generateLevel(Number(run.seed), state.currentLevel ?? 0);
  level = applyRemovedToLevel(level, state);
  const cell = level.cells.find((ce) => ce.r === toR && ce.c === toC);
  if (!cell) return { error: 'INVALID_CELL', message: 'Cell out of bounds' };
  if (cell.type === 'wall') return { error: 'BLOCKED', message: 'Cannot move into wall' };

  const entity = level.entities.find((e) => e.r === toR && e.c === toC);
  if (cell.type !== 'exit' && entity) {
    if (entity.type === 'enemy') return { error: 'USE_ACTION', message: 'Use attack action on enemy' };
    if (entity.type === 'item') return { error: 'USE_ACTION', message: 'Use pickup action on item' };
  }

  if (cell.type === 'exit') {
    state.currentLevel = (state.currentLevel ?? 0) + 1;
    const nextLevel = generateLevel(Number(run.seed), state.currentLevel);
    state.position = { r: nextLevel.entrance.r, c: nextLevel.entrance.c };
    state.removedEntities = state.removedEntities || {};
    state.pickedItems = state.pickedItems || {};
    state.enemyPositions = state.enemyPositions || {};
    state.removedEntities[state.currentLevel] = [];
    state.pickedItems[state.currentLevel] = [];
    state.enemyPositions[state.currentLevel] = initEnemyPositionsFromLevel(nextLevel);
    await pool.query('UPDATE dungeon_runs SET state = $1 WHERE id = $2', [JSON.stringify(state), runId]);
    await recordMove(runId, userId, fromR, fromC, toR, toC, 'exit', null, null, null, clientTimezone);
    let levelForEnemies = applyRemovedToLevel(nextLevel, state);
    mergeEnemyPositions(levelForEnemies, state);
    runEnemyTurn(state, levelForEnemies, MOVE_COST);
    if (state.hp <= 0) {
      await pool.query("UPDATE dungeon_runs SET status = 'failed', completed_at = now(), completed_at_timezone = $1, state = $2 WHERE id = $3", [clientTimezone || null, JSON.stringify(state), runId]);
    } else {
      await pool.query('UPDATE dungeon_runs SET state = $1 WHERE id = $2', [JSON.stringify(state), runId]);
    }
    const outLevel = applyRemovedToLevel(generateLevel(Number(run.seed), state.currentLevel), state);
    mergeEnemyPositions(outLevel, state);
    return { state, level: outLevel, action: 'move', nextFloor: true };
  }

  const dr = toR - fromR;
  const dc = toC - fromC;
  if (dr === -1) state.facing = 'n';
  else if (dr === 1) state.facing = 's';
  else if (dc === -1) state.facing = 'w';
  else if (dc === 1) state.facing = 'e';
  state.position = { r: toR, c: toC };
  state.roundTimeUsed = (state.roundTimeUsed || 0) + MOVE_COST;
  await pool.query('UPDATE dungeon_runs SET state = $1 WHERE id = $2', [JSON.stringify(state), runId]);
  await recordMove(runId, userId, fromR, fromC, toR, toC, 'move', null, null, null, clientTimezone);

  let nextLevel = generateLevel(Number(run.seed), state.currentLevel ?? 0);
  nextLevel = applyRemovedToLevel(nextLevel, state);
  mergeEnemyPositions(nextLevel, state);
  runEnemyTurn(state, nextLevel, state.roundTimeUsed);
  state.roundTimeUsed = 0;
  if (state.hp <= 0) {
    await pool.query("UPDATE dungeon_runs SET status = 'failed', completed_at = now(), completed_at_timezone = $1, state = $2 WHERE id = $3", [clientTimezone || null, JSON.stringify(state), runId]);
  } else {
    await pool.query('UPDATE dungeon_runs SET state = $1 WHERE id = $2', [JSON.stringify(state), runId]);
  }
  mergeEnemyPositions(nextLevel, state);
  return { state, level: nextLevel, action: 'move' };
}

async function action(userId, runId, actionType, targetR, targetC, clientTimezone) {
  const runRes = await pool.query(
    'SELECT id, user_id, seed, state, status FROM dungeon_runs WHERE id = $1 AND user_id = $2',
    [runId, userId]
  );
  if (runRes.rows.length === 0) return { error: 'NOT_FOUND', message: 'Run not found' };
  const run = runRes.rows[0];
  if (run.status !== 'in_progress') return { error: 'RUN_ENDED', message: 'Run already completed or failed' };

  const state = typeof run.state === 'object' ? run.state : JSON.parse(run.state || '{}');
  const { r: fromR, c: fromC } = state.position || {};
  const levelIdx = state.currentLevel ?? 0;
  let level = generateLevel(Number(run.seed), levelIdx);
  level = applyRemovedToLevel(level, state);
  level = mergeEnemyPositions(level, state);

  const tR = Number(targetR);
  const tC = Number(targetC);
  let entity = level.entities.find((e) => Number(e.r) === tR && Number(e.c) === tC);
  if (!entity && actionType === 'attack') {
    const positions = (state.enemyPositions || {})[levelIdx] || [];
    const atCell = positions.find((p) => Number(p.r) === tR && Number(p.c) === tC);
    if (atCell) entity = { ...getEnemyTemplate(atCell.id), r: atCell.r, c: atCell.c };
  }
  const cell = level.cells.find((ce) => ce.r === tR && ce.c === tC);
  if (!cell) return { error: 'INVALID_CELL', message: 'Target out of bounds' };

  const adj = Math.abs(fromR - tR) + Math.abs(fromC - tC) === 1;
  if (!adj) return { error: 'NOT_ADJACENT', message: 'Target must be adjacent' };

  function setFacingTowardTarget() {
    const dr = tR - fromR;
    const dc = tC - fromC;
    if (dr === -1) state.facing = 'n';
    else if (dr === 1) state.facing = 's';
    else if (dc === -1) state.facing = 'w';
    else if (dc === 1) state.facing = 'e';
  }

  if (actionType === 'attack') {
    if (!entity || entity.type !== 'enemy') return { error: 'NOT_ENEMY', message: 'No enemy there' };
    const damage = Math.max(1, (state.attack || DEFAULT_ATTACK) - (entity.defense || 0));
    await recordMove(runId, userId, fromR, fromC, fromR, fromC, 'attack', 'enemy', entity.id, { damage }, clientTimezone);
    state.removedEntities = state.removedEntities || {};
    const levelIdx = state.currentLevel ?? 0;
    state.removedEntities[levelIdx] = state.removedEntities[levelIdx] || [];
    setFacingTowardTarget();
    state.removedEntities[levelIdx].push({ r: tR, c: tC });
    state.enemyPositions = state.enemyPositions || {};
    state.enemyPositions[levelIdx] = (state.enemyPositions[levelIdx] || []).filter((e) => Number(e.r) !== tR || Number(e.c) !== tC);
    state.exp = (state.exp || 0) + (entity.xpValue ?? EXP_PER_KILL);
    let levelUpChoices = null;
    while (state.exp >= (state.expToNextLevel || EXP_TO_NEXT_BASE)) {
      state.exp -= state.expToNextLevel || EXP_TO_NEXT_BASE;
      state.characterLevel = (state.characterLevel || 1) + 1;
      state.expToNextLevel = Math.floor((state.expToNextLevel || EXP_TO_NEXT_BASE) * 1.3);
      levelUpChoices = getRandomLevelUpChoices(3);
      state.pendingLevelUp = { choices: levelUpChoices };
      break;
    }
    level = applyRemovedToLevel(level, state);
    mergeEnemyPositions(level, state);
    state.roundTimeUsed = (state.roundTimeUsed || 0) + ATTACK_COST;
    if (state.roundTimeUsed >= 1.0) {
      runEnemyTurn(state, level, state.roundTimeUsed);
      state.roundTimeUsed = 0;
    }
    if (state.hp <= 0) {
      await pool.query("UPDATE dungeon_runs SET status = 'failed', completed_at = now(), completed_at_timezone = $1, state = $2 WHERE id = $3", [clientTimezone || null, JSON.stringify(state), runId]);
    } else {
      await pool.query('UPDATE dungeon_runs SET state = $1 WHERE id = $2', [JSON.stringify(state), runId]);
    }
    mergeEnemyPositions(level, state);
    const out = { state, level, action: 'attack', damage, killed: true, expGain: entity.xpValue ?? EXP_PER_KILL };
    if (levelUpChoices) {
      out.levelUp = true;
      out.choices = levelUpChoices;
    }
    if ((state.roundTimeUsed || 0) > 0) out.roundTimeRemaining = 1.0 - state.roundTimeUsed;
    return out;
  }

  if (actionType === 'pickup') {
    if (!entity || entity.type !== 'item') return { error: 'NOT_ITEM', message: 'Item already taken or not here' };
    setFacingTowardTarget();
    state.inventory = state.inventory || [];
    state.inventory.push({ itemId: entity.id, count: 1 });
    state.pickedItems = state.pickedItems || {};
    const levelIdx = state.currentLevel ?? 0;
    state.pickedItems[levelIdx] = state.pickedItems[levelIdx] || [];
    state.pickedItems[levelIdx].push({ r: tR, c: tC });
    await recordMove(runId, userId, fromR, fromC, fromR, fromC, 'pickup', 'item', entity.id, null, clientTimezone);
    level = applyRemovedToLevel(level, state);
    mergeEnemyPositions(level, state);
    state.roundTimeUsed = (state.roundTimeUsed || 0) + PICKUP_COST;
    runEnemyTurn(state, level, state.roundTimeUsed);
    state.roundTimeUsed = 0;
    if (state.hp <= 0) {
      await pool.query("UPDATE dungeon_runs SET status = 'failed', completed_at = now(), completed_at_timezone = $1, state = $2 WHERE id = $3", [clientTimezone || null, JSON.stringify(state), runId]);
    } else {
      await pool.query('UPDATE dungeon_runs SET state = $1 WHERE id = $2', [JSON.stringify(state), runId]);
    }
    mergeEnemyPositions(level, state);
    return { state, level, action: 'pickup', itemId: entity.id };
  }

  return { error: 'UNKNOWN_ACTION', message: 'Unknown action type' };
}

function applyLevelUpChoice(state, choiceId) {
  if (choiceId === 'hp_5') {
    state.maxHp = (state.maxHp || DEFAULT_HP) + 5;
    state.hp = Math.min((state.hp ?? state.maxHp) + 5, state.maxHp);
  } else if (choiceId === 'atk_2') {
    state.attack = (state.attack || DEFAULT_ATTACK) + 2;
  } else if (choiceId === 'def_1') {
    state.defense = (state.defense || DEFAULT_DEFENSE) + 1;
  } else if (choiceId === 'hp_3') {
    state.maxHp = (state.maxHp || DEFAULT_HP) + 3;
    state.hp = Math.min((state.hp ?? state.maxHp) + 3, state.maxHp);
  } else if (choiceId === 'atk_1') {
    state.attack = (state.attack || DEFAULT_ATTACK) + 1;
  } else if (choiceId === 'def_2') {
    state.defense = (state.defense || DEFAULT_DEFENSE) + 2;
  } else if (choiceId === 'speed_move') {
    state.moveSpeed = (state.moveSpeed ?? 1) + 0.25;
  } else if (choiceId === 'speed_attack') {
    state.attackSpeed = (state.attackSpeed ?? 2) + 0.5;
  } else if (choiceId === 'hp_2_atk_1') {
    state.maxHp = (state.maxHp || DEFAULT_HP) + 2;
    state.hp = Math.min((state.hp ?? state.maxHp) + 2, state.maxHp);
    state.attack = (state.attack || DEFAULT_ATTACK) + 1;
  } else if (choiceId === 'hp_1_def_2') {
    state.maxHp = (state.maxHp || DEFAULT_HP) + 1;
    state.hp = Math.min((state.hp ?? state.maxHp) + 1, state.maxHp);
    state.defense = (state.defense || DEFAULT_DEFENSE) + 2;
  }
}

function applyLevelChoice(state, choiceId) {
  applyLevelUpChoice(state, choiceId);
}

async function submitLevelChoice(runId, userId, levelIndex, choiceSelected, timeToChooseMs, choicesOffered, clientTimezone) {
  const runRes = await pool.query(
    'SELECT id, user_id, seed, state, status FROM dungeon_runs WHERE id = $1 AND user_id = $2',
    [runId, userId]
  );
  if (runRes.rows.length === 0) return { error: 'NOT_FOUND', message: 'Run not found' };
  const run = runRes.rows[0];
  const state = typeof run.state === 'object' ? run.state : JSON.parse(run.state || '{}');
  applyLevelChoice(state, choiceSelected);
  state.currentLevel = levelIndex + 1;
  const nextLevel = generateLevel(Number(run.seed), state.currentLevel);
  state.position = { r: nextLevel.entrance.r, c: nextLevel.entrance.c };
  state.removedEntities = state.removedEntities || {};
  state.pickedItems = state.pickedItems || {};
  await pool.query('UPDATE dungeon_runs SET state = $1 WHERE id = $2', [JSON.stringify(state), runId]);
  await pool.query(
    `INSERT INTO dungeon_level_choices (run_id, level_index, choices_offered, choice_selected, time_to_choose_ms, client_timezone)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [runId, levelIndex, JSON.stringify(choicesOffered || []), choiceSelected, timeToChooseMs || null, clientTimezone || null]
  );
  const level = applyRemovedToLevel(nextLevel, state);
  return { state, level };
}

async function useItem(userId, runId, inventoryIndex) {
  const runRes = await pool.query(
    'SELECT id, user_id, seed, state, status FROM dungeon_runs WHERE id = $1 AND user_id = $2',
    [runId, userId]
  );
  if (runRes.rows.length === 0) return { error: 'NOT_FOUND', message: 'Run not found' };
  const run = runRes.rows[0];
  if (run.status !== 'in_progress') return { error: 'RUN_ENDED', message: 'Run already completed or failed' };

  const state = typeof run.state === 'object' ? run.state : JSON.parse(run.state || '{}');
  const inv = state.inventory || [];
  const item = inv[inventoryIndex];
  if (!item) return { error: 'INVALID_INDEX', message: 'No item at that slot' };

  if (item.itemId === 'health_stone') {
    state.hp = Math.min(state.maxHp, (state.hp || 0) + 20);
    inv.splice(inventoryIndex, 1);
  } else {
    return { error: 'UNKNOWN_ITEM', message: 'Item cannot be used' };
  }

  const levelIndex = state.currentLevel ?? 0;
  let level = generateLevel(Number(run.seed), levelIndex);
  level = applyRemovedToLevel(level, state);
  mergeEnemyPositions(level, state);
  state.roundTimeUsed = (state.roundTimeUsed || 0) + USE_ITEM_COST;
  runEnemyTurn(state, level, state.roundTimeUsed);
  state.roundTimeUsed = 0;
  if (state.hp <= 0) {
    await pool.query("UPDATE dungeon_runs SET status = 'failed', state = $1 WHERE id = $2", [JSON.stringify(state), runId]);
  } else {
    await pool.query('UPDATE dungeon_runs SET state = $1 WHERE id = $2', [JSON.stringify(state), runId]);
  }
  mergeEnemyPositions(level, state);
  return { state, level, action: 'use_item', itemId: item.itemId };
}

async function submitLevelUpChoice(runId, userId, choiceId) {
  const runRes = await pool.query(
    'SELECT id, user_id, seed, state, status FROM dungeon_runs WHERE id = $1 AND user_id = $2',
    [runId, userId]
  );
  if (runRes.rows.length === 0) return { error: 'NOT_FOUND', message: 'Run not found' };
  const run = runRes.rows[0];
  const state = typeof run.state === 'object' ? run.state : JSON.parse(run.state || '{}');
  if (!state.pendingLevelUp || !state.pendingLevelUp.choices) {
    return { error: 'NO_PENDING', message: 'No level-up choice pending' };
  }
  const valid = state.pendingLevelUp.choices.some((c) => c.id === choiceId);
  if (!valid) return { error: 'INVALID_CHOICE', message: 'Invalid choice' };
  applyLevelUpChoice(state, choiceId);
  delete state.pendingLevelUp;
  await pool.query('UPDATE dungeon_runs SET state = $1 WHERE id = $2', [JSON.stringify(state), runId]);
  const levelIndex = state.currentLevel ?? 0;
  let level = generateLevel(Number(run.seed), levelIndex);
  level = applyRemovedToLevel(level, state);
  level = mergeEnemyPositions(level, state);
  return { state, level };
}

module.exports = {
  getDailySeed,
  startRun,
  getRunState,
  move,
  action,
  submitLevelChoice,
  submitLevelUpChoice,
  useItem,
  generateLevel,
};
