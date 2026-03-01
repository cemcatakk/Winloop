import * as api from './index';

function tz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (_) {
    return '';
  }
}

export async function getDailySeed(dateStr) {
  const { data, ok } = await api.get(`dungeon/daily/seed?date=${dateStr || new Date().toISOString().slice(0, 10)}`);
  if (!ok) throw new Error(data.message || data.error || 'Failed to get daily seed');
  return data;
}

export async function startRun(dateStr) {
  const { data, ok } = await api.post('dungeon/start', {
    date: dateStr || new Date().toISOString().slice(0, 10),
    clientTimezone: tz(),
  });
  if (!ok) throw new Error(data.message || data.error || 'Failed to start run');
  return data;
}

export async function getState(dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const { data, ok } = await api.get(`dungeon/state?date=${date}`);
  if (!ok && data.error !== 'NO_RUN') throw new Error(data.message || data.error || 'Failed to get state');
  return data;
}

export async function move(runId, toR, toC) {
  const { data, ok } = await api.post('dungeon/move', {
    runId,
    toR,
    toC,
    clientTimezone: tz(),
  });
  if (!ok) throw new Error(data.message || data.error || 'Move failed');
  return data;
}

export async function action(runId, actionType, targetR, targetC) {
  const { data, ok } = await api.post('dungeon/action', {
    runId,
    actionType,
    targetR,
    targetC,
    clientTimezone: tz(),
  });
  if (!ok) throw new Error(data.message || data.error || 'Action failed');
  return data;
}

export async function useItem(runId, inventoryIndex) {
  const { data, ok } = await api.post('dungeon/use-item', { runId, inventoryIndex });
  if (!ok) throw new Error(data.message || data.error || 'Use item failed');
  return data;
}

export async function submitLevelChoice(runId, levelIndex, choiceSelected, timeToChooseMs, choicesOffered) {
  const { data, ok } = await api.post('dungeon/level-choice', {
    runId,
    levelIndex,
    choiceSelected,
    timeToChooseMs,
    choicesOffered,
    clientTimezone: tz(),
  });
  if (!ok) throw new Error(data.message || data.error || 'Choice failed');
  return data;
}

export async function submitLevelUpChoice(runId, choiceId) {
  const { data, ok } = await api.post('dungeon/level-up-choice', { runId, choiceId });
  if (!ok) throw new Error(data.message || data.error || 'Level-up choice failed');
  return data;
}
