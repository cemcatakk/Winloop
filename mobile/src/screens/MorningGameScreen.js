import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as morningApi from '../api/morning';
import { theme } from '../theme';

const CELL_SIZE = 44;

function Row({ word, result, wordLength }) {
  const letters = word ? word.split('') : [];
  while (letters.length < wordLength) letters.push('');
  return (
    <View style={styles.row}>
      {letters.map((letter, i) => {
        const status = result && result[i] ? result[i].status : null;
        const bg =
          status === 'correct'
            ? theme.colors.wordleCorrect
            : status === 'wrong_position'
            ? theme.colors.wordleWrongPosition
            : status === 'wrong'
            ? theme.colors.wordleWrong
            : theme.colors.surface;
        const textColor = status ? '#fff' : theme.colors.text;
        return (
          <View key={i} style={[styles.cell, { backgroundColor: bg, borderColor: theme.colors.border }]}>
            <Text style={[styles.cellText, { color: textColor }]}>{letter}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function MorningGameScreen({ navigation }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gameOver, setGameOver] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);

  const wordLength = info?.wordLength || 5;
  const maxAttempts = info?.maxAttempts || 6;

  const loadToday = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError('Please log in to play.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await morningApi.getToday();
      setInfo(data);
      setAttempts(data.previousAttempts || []);
      setCurrentWord('');
    } catch (e) {
      setError(e.message || 'Failed to load. Check connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  if (info?.alreadyPlayed) {
    return (
      <View style={styles.centered}>
        <Text style={styles.gameOverTitle}>You already played today!</Text>
        <Text style={styles.scoreText}>Score: {info.score}</Text>
        {info.powerEarned && <Text style={styles.powerText}>Power: {info.powerEarned}</Text>}
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSubmitGuess = async () => {
    const w = currentWord.trim().toUpperCase();
    if (w.length !== wordLength || !info?.questionId || submitting) return;
    setSubmitting(true);
    try {
      const result = await morningApi.submitGuess(info.questionId, w);
      setAttempts((prev) => [...prev, { word: w, result: result.result }]);
      setCurrentWord('');
      if (result.isWin) {
        const submit = await morningApi.submitSession(info.questionId);
        setSubmitResult(submit);
        setGameOver('win');
      } else if (result.attemptsLeft <= 0) {
        const submit = await morningApi.submitSession(info.questionId);
        setSubmitResult(submit);
        setGameOver('lose');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadToday}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (gameOver) {
    return (
      <View style={styles.centered}>
        <Text style={styles.gameOverTitle}>{gameOver === 'win' ? 'You won!' : 'Out of attempts'}</Text>
        {submitResult && (
          <>
            <Text style={styles.scoreText}>Score: {submitResult.score}</Text>
            {submitResult.pointsAdded > 0 && (
              <Text style={styles.pointsText}>+{submitResult.pointsAdded} points</Text>
            )}
            {submitResult.powerEarned && (
              <Text style={styles.powerText}>Power earned: {submitResult.powerEarned}</Text>
            )}
          </>
        )}
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canSubmit = currentWord.length === wordLength && !submitting;
  const rows = [];
  for (let i = 0; i < maxAttempts; i++) {
    if (i < attempts.length) {
      rows.push(<Row key={i} word={attempts[i].word} result={attempts[i].result} wordLength={wordLength} />);
    } else if (i === attempts.length) {
      rows.push(
        <Row key={i} word={currentWord.padEnd(wordLength).slice(0, wordLength)} result={null} wordLength={wordLength} />
      );
    } else {
      rows.push(<Row key={i} word="" result={null} wordLength={wordLength} />);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <Text style={styles.title}>Morning Word</Text>
      <Text style={styles.subtitle}>Guess the {wordLength}-letter word. {maxAttempts - attempts.length} tries left.</Text>

      <View style={styles.grid}>{rows}</View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={currentWord}
          onChangeText={(t) => setCurrentWord(t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, wordLength))}
          placeholder={Array(wordLength).fill('?').join('')}
          placeholderTextColor={theme.colors.placeholder}
          maxLength={wordLength}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!submitting}
        />
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmitGuess}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Check</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  grid: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    marginHorizontal: 2,
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    fontSize: 20,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  gameOverTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  scoreText: {
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: 4,
  },
  pointsText: {
    fontSize: 16,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  powerText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
