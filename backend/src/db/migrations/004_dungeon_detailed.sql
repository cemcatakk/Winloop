-- Dungeon: daily seed, run state, moves, level-up choices (rogue-like).
-- All dungeon data stored for replay/analytics; timezone-aware.

-- One seed per calendar day; everyone plays the same dungeon that day.
CREATE TABLE IF NOT EXISTS daily_dungeon_seeds (
  date DATE PRIMARY KEY,
  seed BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Run state and timezone at entry/exit
ALTER TABLE dungeon_runs ADD COLUMN IF NOT EXISTS started_at_timezone VARCHAR(20);
ALTER TABLE dungeon_runs ADD COLUMN IF NOT EXISTS completed_at_timezone VARCHAR(20);
ALTER TABLE dungeon_runs ADD COLUMN IF NOT EXISTS state JSONB;
-- state: { currentLevel, position: {r,c}, hp, maxHp, attack, defense, inventory: [{itemId, count}], ... }

-- Every move/action in the dungeon (replay-friendly format).
CREATE TABLE IF NOT EXISTS dungeon_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES dungeon_runs(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  from_row INT NOT NULL,
  from_col INT NOT NULL,
  to_row INT NOT NULL,
  to_col INT NOT NULL,
  action_type VARCHAR(20) NOT NULL,
  target_type VARCHAR(20),
  target_id VARCHAR(50),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_timezone VARCHAR(20)
);
CREATE INDEX idx_dungeon_moves_run_step ON dungeon_moves(run_id, step_index);

-- Rogue-like level-up choices: which cards offered, which selected, how long.
CREATE TABLE IF NOT EXISTS dungeon_level_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES dungeon_runs(id) ON DELETE CASCADE,
  level_index INT NOT NULL,
  choices_offered JSONB NOT NULL,
  choice_selected VARCHAR(50) NOT NULL,
  time_to_choose_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_timezone VARCHAR(20)
);
CREATE INDEX idx_dungeon_level_choices_run ON dungeon_level_choices(run_id, level_index);

-- Mob types for placement (catalog, server-driven).
CREATE TABLE IF NOT EXISTS dungeon_mob_catalog (
  id VARCHAR(50) PRIMARY KEY,
  name_key VARCHAR(100),
  hp INT NOT NULL,
  attack INT NOT NULL,
  defense INT NOT NULL DEFAULT 0,
  xp_value INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
