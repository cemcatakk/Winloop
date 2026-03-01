-- Winloop initial schema (PostgreSQL)
-- Run after database is created.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  display_name VARCHAR(100),
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  is_penalized BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language VARCHAR(5) NOT NULL DEFAULT 'auto',
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ip_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  device_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ip_logs_ip_created ON ip_logs(ip_address, created_at DESC);

-- 2. i18n
CREATE TABLE i18n_keys (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE i18n_translations (
  id SERIAL PRIMARY KEY,
  i18n_key_id INT NOT NULL REFERENCES i18n_keys(id) ON DELETE CASCADE,
  locale VARCHAR(5) NOT NULL,
  value TEXT NOT NULL,
  UNIQUE(i18n_key_id, locale)
);

-- 3. Morning game
CREATE TABLE morning_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL,
  payload JSONB NOT NULL,
  locale VARCHAR(5),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE morning_question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  question_ids UUID[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE morning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  question_set_id UUID NOT NULL REFERENCES morning_question_sets(id) ON DELETE RESTRICT,
  score INT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  power_earned VARCHAR(50),
  UNIQUE(user_id, date)
);

-- 4. Dungeon
CREATE TABLE dungeon_item_catalog (
  id VARCHAR(50) PRIMARY KEY,
  name_key VARCHAR(100),
  type VARCHAR(20),
  rarity VARCHAR(20),
  effect_type VARCHAR(50),
  effect_value JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dungeon_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  seed BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  score INT,
  duration_seconds INT,
  hp_remaining INT,
  items_collected JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, date)
);

-- 5. Boss
CREATE TABLE boss_type_catalog (
  id VARCHAR(50) PRIMARY KEY,
  name_key VARCHAR(100),
  element VARCHAR(20),
  bonus_rule JSONB,
  resistance JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE boss_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  boss_type_id VARCHAR(50) NOT NULL REFERENCES boss_type_catalog(id) ON DELETE RESTRICT,
  total_hp BIGINT NOT NULL,
  current_hp BIGINT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE boss_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_event_id UUID NOT NULL REFERENCES boss_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hp_entered INT NOT NULL,
  total_damage_dealt BIGINT NOT NULL DEFAULT 0,
  is_revived BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(boss_event_id, user_id)
);

CREATE TABLE boss_damage_feed (
  id BIGSERIAL PRIMARY KEY,
  boss_event_id UUID NOT NULL REFERENCES boss_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  damage INT NOT NULL,
  is_crit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_boss_damage_feed_event_created ON boss_damage_feed(boss_event_id, created_at DESC);

CREATE TABLE action_roll_symbols (
  id VARCHAR(30) PRIMARY KEY,
  name_key VARCHAR(100),
  effect_type VARCHAR(30),
  weight_default NUMERIC(5,4),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 6. Points
CREATE TABLE user_points (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  source VARCHAR(50) NOT NULL,
  reference_id UUID,
  balance_after INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Ads
CREATE TABLE ad_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_type VARCHAR(30) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ad_views_user_date_type ON ad_views(user_id, date, ad_type);

-- 8. Leaderboard
CREATE TABLE leaderboard_daily (
  date DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank INT,
  score INT,
  morning_score INT,
  dungeon_score INT,
  boss_damage BIGINT,
  PRIMARY KEY (date, user_id)
);

-- 9. File storage (GUID-based serve)
CREATE TABLE file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guid VARCHAR(36) UNIQUE NOT NULL,
  original_name VARCHAR(255),
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX idx_file_uploads_guid ON file_uploads(guid);
