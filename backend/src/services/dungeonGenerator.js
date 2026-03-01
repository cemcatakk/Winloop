/**
 * Seed-based dungeon map generator (Minecraft-style deterministic).
 * Same seed + levelIndex always produces the same layout.
 * Cell types: floor, wall, entrance, exit, enemy, item.
 */

const WIDTH = 9;
const HEIGHT = 9;
const CELL_TYPES = {
  FLOOR: 'floor',
  WALL: 'wall',
  ENTRANCE: 'entrance',
  EXIT: 'exit',
  ENEMY: 'enemy',
  ITEM: 'item',
};

/** Simple seeded PRNG (mulberry32). */
function createRng(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate one level layout for a given seed and level index.
 * @param {number} seed - Daily seed (bigint or number).
 * @param {number} levelIndex - 0-based level (0 = first level).
 * @returns {{ width, height, cells, entrance, exit, entities }}
 */
function generateLevel(seed, levelIndex = 0) {
  const s = Number(BigInt(seed) % BigInt(0x7fffffff)) + levelIndex * 31;
  const rng = createRng(s);

  const cells = [];
  for (let r = 0; r < HEIGHT; r++) {
    for (let c = 0; c < WIDTH; c++) {
      const val = rng();
      let type = CELL_TYPES.FLOOR;
      if (val < 0.2) type = CELL_TYPES.WALL;
      cells.push({ r, c, type });
    }
  }

  const floorCells = cells.filter((cell) => cell.type === CELL_TYPES.FLOOR);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const entrance = floorCells[Math.floor(rng() * Math.min(5, floorCells.length))];
  let exitPool = floorCells.filter((f) => f.r !== entrance.r || f.c !== entrance.c);
  const exit = exitPool[Math.floor(rng() * Math.min(5, exitPool.length))];
  entrance.type = CELL_TYPES.ENTRANCE;
  exit.type = CELL_TYPES.EXIT;

  const entities = [];
  const forEnemy = floorCells.filter(
    (f) => f.type === CELL_TYPES.FLOOR && (f.r !== entrance.r || f.c !== entrance.c) && (f.r !== exit.r || f.c !== exit.c)
  );
  const enemyCount = Math.min(2 + levelIndex, Math.max(1, Math.floor(forEnemy.length * 0.15)));
  for (let i = 0; i < enemyCount && forEnemy.length > 0; i++) {
    const idx = Math.floor(rng() * forEnemy.length);
    const cell = forEnemy.splice(idx, 1)[0];
    cell.type = CELL_TYPES.ENEMY;
    entities.push({ r: cell.r, c: cell.c, type: 'enemy', id: 'mob_rat', hp: 5, maxHp: 5, attack: 1, defense: 0, xpValue: 10, rarity: 'common', nameKey: 'mob.rat' });
  }

  const forItem = floorCells.filter((f) => f.type === CELL_TYPES.FLOOR);
  const itemCount = Math.min(1 + levelIndex, Math.max(0, Math.floor(forItem.length * 0.08)));
  for (let i = 0; i < itemCount && forItem.length > 0; i++) {
    const idx = Math.floor(rng() * forItem.length);
    const cell = forItem.splice(idx, 1)[0];
    if (cell.type === CELL_TYPES.FLOOR) {
      cell.type = CELL_TYPES.ITEM;
      entities.push({ r: cell.r, c: cell.c, type: 'item', id: 'health_stone', rarity: 'common', nameKey: 'item.health_stone' });
    }
  }

  return {
    width: WIDTH,
    height: HEIGHT,
    cells,
    entrance: { r: entrance.r, c: entrance.c },
    exit: { r: exit.r, c: exit.c },
    entities,
  };
}

module.exports = {
  generateLevel,
  CELL_TYPES,
  WIDTH,
  HEIGHT,
};
