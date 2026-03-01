/**
 * Pixel-dungeon style: top-down grid, turn-based.
 * Movement: D-pad + Action button. Tile tap: tooltip. Inventory: tap to use.
 * EXP bar; exit cell labeled; enemy AI runs after each turn.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import * as dungeonApi from '../api/dungeon';
import { theme } from '../theme';
import ASSETS from '../constants/dungeonAssets';

function playLevelUpFeedback() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (_) {}
}

const CELL_SIZE = Math.min(36, (Dimensions.get('window').width - theme.spacing.lg * 2 - 18) / 9);
const GRID_GAP = 2;

const ITEM_ICONS = {
  health_stone: { bg: theme.colors.dungeonItem, shape: 'circle' },
  crit_rune: { bg: '#a855f7', shape: 'circle' },
  shield_relic: { bg: '#3b82f6', shape: 'circle' },
};
function getItemIcon(itemId) {
  return ITEM_ICONS[itemId] || { bg: theme.colors.textSecondary, shape: 'circle' };
}

const cellImgSize = { w: CELL_SIZE * 0.85, h: CELL_SIZE * 0.85 };

function Cell({ cell, entity, isPlayer, onPress }) {
  let bg = theme.colors.dungeonFloor;
  if (cell.type === 'wall') bg = theme.colors.dungeonWall;
  else if (cell.type === 'entrance') bg = theme.colors.dungeonEntrance;
  else if (cell.type === 'exit') bg = theme.colors.dungeonExit;
  else if (entity?.type === 'enemy') bg = theme.colors.dungeonEnemy;
  else if (entity?.type === 'item') bg = theme.colors.dungeonItem;

  return (
    <TouchableOpacity
      style={[styles.cell, { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: bg }]}
      onPress={onPress}
      disabled={cell.type === 'wall'}
    >
      {cell.type === 'exit' && (
        <>
          <Image source={ASSETS.exit} style={[styles.cellAsset, cellImgSize]} resizeMode="contain" />
          <Text style={styles.exitLabel} numberOfLines={1}>EXIT</Text>
        </>
      )}
      {isPlayer && (
        <Image source={ASSETS.player} style={[styles.cellAsset, { width: CELL_SIZE * 0.7, height: CELL_SIZE * 0.7 }]} resizeMode="contain" />
      )}
      {!isPlayer && entity?.type === 'enemy' && (
        <Image source={ASSETS.enemy} style={[styles.cellAsset, { width: CELL_SIZE * 0.65, height: CELL_SIZE * 0.65 }]} resizeMode="contain" />
      )}
      {!isPlayer && entity?.type === 'item' && (
        <Image source={ASSETS.item} style={[styles.cellAsset, { width: CELL_SIZE * 0.55, height: CELL_SIZE * 0.55 }]} resizeMode="contain" />
      )}
    </TouchableOpacity>
  );
}

export default function DungeonGameScreen({ navigation }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runId, setRunId] = useState(null);
  const [state, setState] = useState(null);
  const [level, setLevel] = useState(null);
  const [actionPending, setActionPending] = useState(false);
  const [levelChoiceModal, setLevelChoiceModal] = useState({
    visible: false,
    choices: [],
    type: null,
    levelIndex: 0,
    choiceShownAt: 0,
  });
  const [tooltip, setTooltip] = useState({ visible: false, cell: null, entity: null });

  const dateStr = new Date().toISOString().slice(0, 10);

  const loadRun = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError('Please log in to play.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const stateRes = await dungeonApi.getState(dateStr);
      if (stateRes.error === 'NO_RUN') {
        const startRes = await dungeonApi.startRun(dateStr);
        setRunId(startRes.runId);
        setState(startRes.state);
        setLevel(startRes.level);
      } else {
        setRunId(stateRes.runId);
        setState(stateRes.state);
        setLevel(stateRes.level);
      }
    } catch (e) {
      setError(e.message || 'Failed to load dungeon');
    } finally {
      setLoading(false);
    }
  }, [token, dateStr]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  const getEntityAt = (r, c) => (level?.entities || []).find((e) => e.r === r && e.c === c);
  const isPlayerAt = (r, c) => state?.position && state.position.r === r && state.position.c === c;

  const H = level?.height ?? 9;
  const W = level?.width ?? 9;

  const getCellInFront = () => {
    const pos = state?.position;
    if (!pos) return null;
    const f = state.facing || 's';
    let r = pos.r, c = pos.c;
    if (f === 'n') r--; else if (f === 's') r++; else if (f === 'w') c--; else if (f === 'e') c++;
    if (r < 0 || r >= H || c < 0 || c >= W) return null;
    return { r, c };
  };

  const getAdjacent = (dR, dC) => {
    const pos = state?.position;
    if (!pos) return { disabled: true };
    const toR = pos.r + dR;
    const toC = pos.c + dC;
    if (toR < 0 || toR >= H || toC < 0 || toC >= W) return { disabled: true, toR, toC };
    const cell = level?.cells?.find((ce) => ce.r === toR && ce.c === toC);
    const entity = getEntityAt(toR, toC);
    if (cell?.type === 'wall') return { disabled: true, toR, toC, cell, entity };
    if (cell?.type === 'exit') return { disabled: false, canMove: true, toR, toC, cell, entity };
    if (entity?.type === 'enemy') return { disabled: false, canAttack: true, toR, toC, cell, entity };
    if (entity?.type === 'item') return { disabled: false, canPickup: true, toR, toC, cell, entity };
    return { disabled: false, canMove: true, toR, toC, cell, entity };
  };

  const syncAfterAction = useCallback(async () => {
    try {
      const stateRes = await dungeonApi.getState(dateStr);
      if (stateRes.error === 'NO_RUN') return;
      setState(stateRes.state);
      setLevel(stateRes.level);
    } catch (_) {}
  }, [dateStr]);

  const handleMoveDir = async (dR, dC) => {
    const adj = getAdjacent(dR, dC);
    if (!runId || actionPending || adj.disabled || !adj.canMove) return;
    setActionPending(true);
    setTooltip({ visible: false });
    try {
      const res = await dungeonApi.move(runId, adj.toR, adj.toC);
      setState(res.state);
      setLevel(res.level);
      await syncAfterAction();
    } catch (e) {
      Alert.alert('Error', e.message);
      await syncAfterAction();
    } finally {
      setActionPending(false);
    }
  };

  const performAction = async (targetR, targetC, actionType) => {
    if (!runId || actionPending) return;
    setActionPending(true);
    setTooltip({ visible: false });
    try {
      const res = await dungeonApi.action(runId, actionType, targetR, targetC);
      setState(res.state);
      setLevel(res.level);
      await syncAfterAction();
      if (res.levelUp && res.choices && res.choices.length > 0) {
        playLevelUpFeedback();
        setLevelChoiceModal({
          visible: true,
          choices: res.choices,
          type: 'levelUp',
          choiceShownAt: Date.now(),
        });
      }
    } catch (e) {
      if (e.message?.includes('already taken') || e.message?.includes('NOT_ITEM')) {
        await syncAfterAction();
      }
      Alert.alert('Error', e.message);
    } finally {
      setActionPending(false);
    }
  };

  const handleDirAction = async (dR, dC) => {
    const adj = getAdjacent(dR, dC);
    if (adj.disabled || !runId || actionPending) return;
    if (adj.canAttack) {
      await performAction(adj.toR, adj.toC, 'attack');
      return;
    }
    if (adj.canPickup) {
      await performAction(adj.toR, adj.toC, 'pickup');
      return;
    }
    if (adj.canMove) {
      await handleMoveDir(dR, dC);
    }
  };

  const handleAction = async () => {
    const front = getCellInFront();
    if (!runId || actionPending) return;
    const frontEntity = front ? getEntityAt(front.r, front.c) : null;
    if (frontEntity?.type === 'enemy') {
      await performAction(front.r, front.c, 'attack');
      return;
    }
    if (frontEntity?.type === 'item') {
      await performAction(front.r, front.c, 'pickup');
      return;
    }
    const dirs = [{ dR: -1, dC: 0 }, { dR: 1, dC: 0 }, { dR: 0, dC: -1 }, { dR: 0, dC: 1 }];
    for (const { dR, dC } of dirs) {
      const adj = getAdjacent(dR, dC);
      if (adj.canAttack) {
        await performAction(adj.toR, adj.toC, 'attack');
        return;
      }
      if (adj.canPickup) {
        await performAction(adj.toR, adj.toC, 'pickup');
        return;
      }
    }
  };

  const adjN = getAdjacent(-1, 0);
  const adjS = getAdjacent(1, 0);
  const adjW = getAdjacent(0, -1);
  const adjE = getAdjacent(0, 1);
  const actionLabel = (() => {
    const front = getCellInFront();
    const e = front ? getEntityAt(front.r, front.c) : null;
    if (e?.type === 'enemy') return 'Attack';
    if (e?.type === 'item') return 'Pick up';
    const dirs = [{ dR: -1, dC: 0 }, { dR: 1, dC: 0 }, { dR: 0, dC: -1 }, { dR: 0, dC: 1 }];
    for (const { dR, dC } of dirs) {
      const adj = getAdjacent(dR, dC);
      if (adj.canAttack) return 'Attack';
      if (adj.canPickup) return 'Pick up';
    }
    return 'Action';
  })();
  const actionEnabled = (() => {
    const front = getCellInFront();
    const e = front ? getEntityAt(front.r, front.c) : null;
    if (e?.type === 'enemy' || e?.type === 'item') return true;
    const dirs = [{ dR: -1, dC: 0 }, { dR: 1, dC: 0 }, { dR: 0, dC: -1 }, { dR: 0, dC: 1 }];
    return dirs.some(({ dR, dC }) => getAdjacent(dR, dC).canAttack || getAdjacent(dR, dC).canPickup);
  })();

  const handleCellPress = (r, c) => {
    const cell = level?.cells?.find((ce) => ce.r === r && ce.c === c);
    const entity = getEntityAt(r, c);
    setTooltip({
      visible: true,
      cell: cell || { r, c, type: 'wall' },
      entity: entity || null,
    });
  };

  const handleUseItem = async (index) => {
    if (!runId || actionPending) return;
    setActionPending(true);
    try {
      const res = await dungeonApi.useItem(runId, index);
      setState(res.state);
      setLevel(res.level);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setActionPending(false);
    }
  };

  const handleLevelChoice = async (choiceId) => {
    const { type } = levelChoiceModal;
    if (!runId || actionPending) return;
    setActionPending(true);
    try {
      if (type === 'levelUp') {
        const res = await dungeonApi.submitLevelUpChoice(runId, choiceId);
        setState(res.state);
        setLevel(res.level);
      } else {
        const { choices, levelIndex, choiceShownAt } = levelChoiceModal;
        const timeToChooseMs = Math.max(0, Date.now() - choiceShownAt);
        const res = await dungeonApi.submitLevelChoice(runId, levelIndex, choiceId, timeToChooseMs, choices);
        setState(res.state);
        setLevel(res.level);
      }
      setLevelChoiceModal((m) => ({ ...m, visible: false }));
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setActionPending(false);
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
        <TouchableOpacity style={styles.retryButton} onPress={loadRun}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state?.hp <= 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.gameOverTitle}>You died</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!level || !state) return null;

  const rows = [];
  for (let r = 0; r < level.height; r++) {
    const rowCells = [];
    for (let c = 0; c < level.width; c++) {
      const cell = level.cells.find((ce) => ce.r === r && ce.c === c);
      const entity = getEntityAt(r, c);
      rowCells.push(
        <Cell
          key={`${r}-${c}`}
          cell={cell || { r, c, type: 'wall' }}
          entity={entity}
          isPlayer={isPlayerAt(r, c)}
          onPress={() => handleCellPress(r, c)}
        />
      );
    }
    rows.push(<View key={r} style={styles.row}>{rowCells}</View>);
  }

  const expPct = Math.min(100, ((state.exp ?? 0) / (state.expToNextLevel || 20)) * 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dungeon</Text>
      <Text style={styles.subtitle}>D-pad: move. Action: interact with cell in front. Tap tile: info.</Text>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>HP</Text>
          <Text style={styles.statValue}>{state.hp ?? 0}/{state.maxHp ?? 20}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>LVL</Text>
          <Text style={styles.statValue}>{state.characterLevel ?? 1}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>EXP</Text>
          <Text style={styles.statValue}>{state.exp ?? 0}/{state.expToNextLevel ?? 20}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>ATK</Text>
          <Text style={styles.statValue}>{state.attack ?? 0}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>DEF</Text>
          <Text style={styles.statValue}>{state.defense ?? 0}</Text>
        </View>
      </View>

      <View style={styles.expBarWrap}>
        <View style={[styles.expBarFill, { width: `${expPct}%` }]} />
      </View>

      <View style={styles.gridContainer}>{rows}</View>

      <View style={styles.controlsRow}>
        <View style={styles.dpad}>
          <TouchableOpacity
            style={[styles.dpadUp, adjN.disabled && styles.dpadDisabled]}
            onPress={() => handleDirAction(-1, 0)}
            disabled={actionPending || adjN.disabled}
          >
            {adjN.canAttack || adjN.canPickup ? (
              <Text style={styles.dpadIcon}>{adjN.canAttack ? '⚔' : '✦'}</Text>
            ) : (
              <Image source={ASSETS.arrowUp} style={styles.dpadArrow} resizeMode="contain" />
            )}
          </TouchableOpacity>
          <View style={styles.dpadMid}>
            <TouchableOpacity
              style={[styles.dpadLeft, adjW.disabled && styles.dpadDisabled]}
              onPress={() => handleDirAction(0, -1)}
              disabled={actionPending || adjW.disabled}
            >
              {adjW.canAttack || adjW.canPickup ? (
                <Text style={styles.dpadIcon}>{adjW.canAttack ? '⚔' : '✦'}</Text>
              ) : (
                <Image source={ASSETS.arrowLeft} style={styles.dpadArrow} resizeMode="contain" />
              )}
            </TouchableOpacity>
            <View style={styles.dpadCenter} />
            <TouchableOpacity
              style={[styles.dpadRight, adjE.disabled && styles.dpadDisabled]}
              onPress={() => handleDirAction(0, 1)}
              disabled={actionPending || adjE.disabled}
            >
              {adjE.canAttack || adjE.canPickup ? (
                <Text style={styles.dpadIcon}>{adjE.canAttack ? '⚔' : '✦'}</Text>
              ) : (
                <Image source={ASSETS.arrowRight} style={styles.dpadArrow} resizeMode="contain" />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.dpadDown, adjS.disabled && styles.dpadDisabled]}
            onPress={() => handleDirAction(1, 0)}
            disabled={actionPending || adjS.disabled}
          >
            {adjS.canAttack || adjS.canPickup ? (
              <Text style={styles.dpadIcon}>{adjS.canAttack ? '⚔' : '✦'}</Text>
            ) : (
              <Image source={ASSETS.arrowDown} style={styles.dpadArrow} resizeMode="contain" />
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            actionPending && styles.actionBtnDisabled,
            actionEnabled && styles.actionBtnHighlight,
          ]}
          onPress={handleAction}
          disabled={actionPending || !actionEnabled}
        >
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>

      {(state.inventory || []).length > 0 && (
        <View style={styles.inventory}>
          <Text style={styles.inventoryTitle}>Inventory (tap to use)</Text>
          <View style={styles.inventoryRow}>
            {(state.inventory || []).map((it, i) => {
              const icon = getItemIcon(it.itemId);
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.inventorySlot}
                  onPress={() => handleUseItem(i)}
                  disabled={actionPending}
                >
                  <Image source={ASSETS.item} style={styles.inventoryIconImg} resizeMode="contain" />
                  <Text style={styles.inventoryItemName}>{it.itemId}</Text>
                  <Text style={styles.inventoryItemCount}>x{it.count || 1}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <Modal visible={tooltip.visible} transparent animationType="fade">
        <TouchableOpacity style={styles.tooltipOverlay} activeOpacity={1} onPress={() => setTooltip({ visible: false })}>
          <View style={styles.tooltipCard}>
            {tooltip.cell && (
              <>
                <Text style={styles.tooltipTitle}>Tile: {tooltip.cell.type}</Text>
                {tooltip.entity && (
                  <>
                    <Text style={styles.tooltipSubtitle}>Entity: {tooltip.entity.type}</Text>
                    <Text style={styles.tooltipText}>ID: {tooltip.entity.id}</Text>
                    {tooltip.entity.rarity && <Text style={styles.tooltipText}>Rarity: {tooltip.entity.rarity}</Text>}
                    {tooltip.entity.hp != null && <Text style={styles.tooltipText}>HP: {tooltip.entity.hp}/{tooltip.entity.maxHp ?? tooltip.entity.hp}</Text>}
                    {tooltip.entity.attack != null && <Text style={styles.tooltipText}>ATK: {tooltip.entity.attack}</Text>}
                    {tooltip.entity.defense != null && <Text style={styles.tooltipText}>DEF: {tooltip.entity.defense}</Text>}
                  </>
                )}
                <Text style={styles.tooltipTap}>Tap outside to close</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={levelChoiceModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{levelChoiceModal.type === 'levelUp' ? 'Level up!' : 'Choose bonus'}</Text>
            <Text style={styles.modalSubtitle}>Choose a card:</Text>
            <View style={styles.choiceRow}>
              {(levelChoiceModal.choices || []).map((choice) => (
                <TouchableOpacity
                  key={choice.id}
                  style={styles.choiceCard}
                  onPress={() => handleLevelChoice(choice.id)}
                  disabled={actionPending}
                >
                  <View style={[styles.choiceIcon, { backgroundColor: theme.colors.primary }]} />
                  <Text style={styles.choiceEffect}>{choice.effect}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  statBox: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    minWidth: 52,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, color: theme.colors.textSecondary },
  statValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  expBarWrap: { height: 6, backgroundColor: theme.colors.border, borderRadius: 3, marginBottom: theme.spacing.md, overflow: 'hidden' },
  expBarFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 3 },
  gridContainer: { alignSelf: 'center', marginBottom: theme.spacing.md },
  row: { flexDirection: 'row', marginBottom: GRID_GAP },
  cell: { marginRight: GRID_GAP, justifyContent: 'center', alignItems: 'center' },
  cellAsset: { maxWidth: '100%', maxHeight: '100%' },
  exitLabel: { fontSize: 8, fontWeight: '700', color: '#fff', position: 'absolute', bottom: 0 },
  playerShape: {},
  enemyShape: {},
  itemShape: {},
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xl, marginBottom: theme.spacing.lg },
  dpad: { width: 100, height: 100 },
  dpadUp: { position: 'absolute', left: 35, top: 0, width: 30, height: 30, backgroundColor: theme.colors.surface, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  dpadDown: { position: 'absolute', left: 35, bottom: 0, width: 30, height: 30, backgroundColor: theme.colors.surface, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  dpadMid: { position: 'absolute', top: 35, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5 },
  dpadLeft: { width: 30, height: 30, backgroundColor: theme.colors.surface, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  dpadCenter: { width: 30, height: 30 },
  dpadRight: { width: 30, height: 30, backgroundColor: theme.colors.surface, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  dpadDisabled: { opacity: 0.4 },
  dpadIcon: { fontSize: 14, color: theme.colors.text },
  dpadArrow: { width: 20, height: 20 },
  actionBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnHighlight: { borderWidth: 2, borderColor: '#fff' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  inventory: { backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.md },
  inventoryTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  inventoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  inventorySlot: { alignItems: 'center', padding: theme.spacing.sm, backgroundColor: theme.colors.background, borderRadius: theme.radius.sm, minWidth: 72 },
  inventoryIcon: { width: 32, height: 32, borderRadius: 16, marginBottom: 4 },
  inventoryIconImg: { width: 32, height: 32, marginBottom: 4 },
  inventoryItemName: { fontSize: 11, color: theme.colors.text },
  inventoryItemCount: { fontSize: 10, color: theme.colors.textSecondary },
  tooltipOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  tooltipCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.lg, minWidth: 200 },
  tooltipTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  tooltipSubtitle: { fontSize: 14, color: theme.colors.primary, marginBottom: 4 },
  tooltipText: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 },
  tooltipTap: { fontSize: 11, color: theme.colors.placeholder, marginTop: 8 },
  gameOverTitle: { fontSize: 24, fontWeight: '700', color: theme.colors.error, marginBottom: theme.spacing.lg },
  errorText: { color: theme.colors.error, marginBottom: theme.spacing.md, textAlign: 'center' },
  retryButton: { padding: theme.spacing.md, backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  backButton: { padding: theme.spacing.md, backgroundColor: theme.colors.textSecondary, borderRadius: theme.radius.md, alignItems: 'center' },
  backButtonText: { color: '#fff', fontWeight: '600' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.xl, minWidth: 280 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, textAlign: 'center', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg },
  choiceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  choiceCard: { flex: 1, backgroundColor: theme.colors.background, borderRadius: theme.radius.md, padding: theme.spacing.md, alignItems: 'center', borderWidth: 2, borderColor: theme.colors.border },
  choiceIcon: { width: 40, height: 40, borderRadius: 20, marginBottom: theme.spacing.sm },
  choiceEffect: { fontSize: 12, fontWeight: '600', color: theme.colors.text, textAlign: 'center' },
});
