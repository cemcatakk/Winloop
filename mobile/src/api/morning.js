import * as api from './index';

export async function getToday() {
  const { data, ok } = await api.get('morning/today');
  if (!ok) {
    const msg = data.message || data.error || 'Failed to load';
    throw new Error(msg === 'No question set for today' ? 'No question for today. Try again.' : msg);
  }
  return data;
}

export async function submitGuess(questionId, word) {
  if (!api.getAuthToken()) throw new Error('Not logged in');
  const { data, ok } = await api.post('morning/guess', { questionId, word });
  if (!ok) throw new Error(data.message || data.error || 'Guess failed');
  return data;
}

export async function submitSession(questionId) {
  if (!api.getAuthToken()) throw new Error('Not logged in');
  const { data, ok } = await api.post('morning/submit', { questionId });
  if (!ok) throw new Error(data.error || 'Submit failed');
  return data;
}
