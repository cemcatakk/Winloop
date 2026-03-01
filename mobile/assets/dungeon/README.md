# Dungeon game assets

Source: **2D Pixel Dungeon Asset Pack** (project root folder).

Assets are **embedded in the app** so that:
- First launch loads instantly (no network).
- Game works offline.
- No backend asset service is required for core dungeon art.

Used in: `DungeonGameScreen` via `src/constants/dungeonAssets.js`.

To update: replace the `.png` files here and rebuild the app. For optional future “asset pack updates” without app release, a backend manifest + download flow can be added later.
