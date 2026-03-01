/**
 * Dungeon game assets (2D Pixel Dungeon Asset Pack).
 * Embedded in app for offline use and fast first load.
 * Fallback to theme colors if an asset is missing.
 */

const ASSETS = {
  player: require('../../assets/dungeon/player.png'),
  enemy: require('../../assets/dungeon/enemy.png'),
  item: require('../../assets/dungeon/item.png'),
  exit: require('../../assets/dungeon/exit.png'),
  tileset: require('../../assets/dungeon/tileset.png'),
  arrowUp: require('../../assets/dungeon/arrow_up.png'),
  arrowDown: require('../../assets/dungeon/arrow_down.png'),
  arrowLeft: require('../../assets/dungeon/arrow_left.png'),
  arrowRight: require('../../assets/dungeon/arrow_right.png'),
};

export default ASSETS;
