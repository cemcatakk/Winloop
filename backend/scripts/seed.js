/**
 * Seed script: test data + admin user for development.
 * Run after migrations: npm run seed
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'winloop'}`;

const ADMIN_EMAIL = 'admin@winloop.test';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_DISPLAY_NAME = 'Admin';

async function seed(client) {
  console.log('Seeding...');

  // 1. Admin user (email/password; no google_id)
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  let adminId = null;
  const existing = await client.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
  if (existing.rows.length > 0) {
    adminId = existing.rows[0].id;
    await client.query('UPDATE users SET display_name = $1, password_hash = $2, updated_at = now() WHERE id = $3', [ADMIN_DISPLAY_NAME, passwordHash, adminId]);
  } else {
    const ins = await client.query(
      `INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [ADMIN_EMAIL, ADMIN_DISPLAY_NAME, passwordHash]
    );
    adminId = ins.rows[0].id;
  }
  if (adminId) {
    await client.query(
      `INSERT INTO user_settings (user_id, language) VALUES ($1, 'en') ON CONFLICT (user_id) DO NOTHING`,
      [adminId]
    );
    await client.query(
      `INSERT INTO user_points (user_id, balance) VALUES ($1, 10000) ON CONFLICT (user_id) DO NOTHING`,
      [adminId]
    );
    console.log('Admin user:', ADMIN_EMAIL, '/', ADMIN_PASSWORD);
  }

  // 2. i18n keys and translations (TR + EN)
  const i18n = [
    { key: 'app.title', tr: 'Winloop', en: 'Winloop' },
    { key: 'auth.login', tr: 'Giriş Yap', en: 'Login' },
    { key: 'auth.register', tr: 'Kayıt Ol', en: 'Register' },
    { key: 'auth.email', tr: 'E-posta', en: 'Email' },
    { key: 'auth.password', tr: 'Şifre', en: 'Password' },
    { key: 'auth.loginWithGoogle', tr: 'Google ile Giriş', en: 'Login with Google' },
    { key: 'auth.logout', tr: 'Çıkış', en: 'Logout' },
    { key: 'home.play_morning', tr: 'Sabah Oyunu', en: 'Morning Game' },
    { key: 'home.play_dungeon', tr: 'Dungeon', en: 'Dungeon' },
    { key: 'home.play_boss', tr: 'Boss Savaşı', en: 'Boss Battle' },
    { key: 'home.points', tr: 'Puan', en: 'Points' },
    { key: 'errors.invalidCredentials', tr: 'Geçersiz e-posta veya şifre', en: 'Invalid email or password' },
    { key: 'errors.network', tr: 'Bağlantı hatası', en: 'Network error' },
  ];
  for (const row of i18n) {
    const keyRes = await client.query(
      'INSERT INTO i18n_keys (key) VALUES ($1) ON CONFLICT (key) DO UPDATE SET key = $1 RETURNING id',
      [row.key]
    );
    const keyId = keyRes.rows[0].id;
    await client.query(
      `INSERT INTO i18n_translations (i18n_key_id, locale, value) VALUES ($1, 'tr', $2)
       ON CONFLICT (i18n_key_id, locale) DO UPDATE SET value = $2`,
      [keyId, row.tr]
    );
    await client.query(
      `INSERT INTO i18n_translations (i18n_key_id, locale, value) VALUES ($1, 'en', $2)
       ON CONFLICT (i18n_key_id, locale) DO UPDATE SET value = $2`,
      [keyId, row.en]
    );
  }
  console.log('i18n:', i18n.length, 'keys');

  // 3. Morning questions (Wordle-style words)
  let questionIds = [];
  const existingQ = await client.query('SELECT id FROM morning_questions WHERE type = $1 ORDER BY created_at LIMIT 30', ['wordle']);
  if (existingQ.rows.length >= 30) {
    questionIds = existingQ.rows.map((r) => r.id);
    console.log('Morning questions: using existing', questionIds.length);
  } else {
    const words = [
      'APPLE', 'BLACK', 'CHESS', 'DANCE', 'EARTH', 'FLAME', 'GLASS', 'HEART', 'IVORY', 'JELLY',
      'KNIFE', 'LEMON', 'MAGIC', 'NIGHT', 'OCEAN', 'PEARL', 'QUICK', 'RIVER', 'STORM', 'TIGER',
      'ULTRA', 'VIVID', 'WATER', 'YOUTH', 'ZEBRA', 'BEACH', 'CLOUD', 'DRAMA', 'EMBER', 'FROST',
    ];
    for (const word of words) {
      const res = await client.query(
        `INSERT INTO morning_questions (type, payload, is_active) VALUES ('wordle', $1::jsonb, true) RETURNING id`,
        [JSON.stringify({ word, hint: '' })]
      );
      questionIds.push(res.rows[0].id);
    }
    console.log('Morning questions:', questionIds.length);
  }

  // 4. Morning question sets (today + 2 more days)
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const ids = questionIds.slice(0, 5);
    await client.query(
      `INSERT INTO morning_question_sets (date, question_ids) VALUES ($1, $2::uuid[])
       ON CONFLICT (date) DO UPDATE SET question_ids = $2::uuid[]`,
      [dateStr, ids]
    );
  }
  console.log('Morning question sets: 3 days');

  // 5. Dungeon item catalog
  const items = [
    { id: 'crit_rune', name_key: 'item.crit_rune', type: 'relic', rarity: 'rare', effect_type: 'crit_chance', effect_value: { crit_bonus: 0.1 } },
    { id: 'shield_relic', name_key: 'item.shield_relic', type: 'relic', rarity: 'epic', effect_type: 'negate_debuff', effect_value: {} },
    { id: 'chaos_orb', name_key: 'item.chaos_orb', type: 'relic', rarity: 'legendary', effect_type: 'extra_slot', effect_value: {} },
    { id: 'health_stone', name_key: 'item.health_stone', type: 'consumable', rarity: 'common', effect_type: 'hp_bonus', effect_value: { hp: 20 } },
    { id: 'speed_gem', name_key: 'item.speed_gem', type: 'relic', rarity: 'common', effect_type: 'dodge_window', effect_value: { bonus: 0.1 } },
  ];
  for (const it of items) {
    await client.query(
      `INSERT INTO dungeon_item_catalog (id, name_key, type, rarity, effect_type, effect_value)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET name_key = $2, type = $3, rarity = $4, effect_type = $5, effect_value = $6`,
      [it.id, it.name_key, it.type, it.rarity, it.effect_type, JSON.stringify(it.effect_value)]
    );
  }
  console.log('Dungeon items:', items.length);

  // 6. Boss type catalog
  await client.query(
    `INSERT INTO boss_type_catalog (id, name_key, element, is_active)
     VALUES ('default', 'boss.default', NULL, true)
     ON CONFLICT (id) DO UPDATE SET name_key = 'boss.default', is_active = true`
  );
  console.log('Boss type: default');

  // 7. Action roll symbols
  const symbols = [
    { id: 'attack', name_key: 'symbol.attack', effect_type: 'damage', weight_default: 0.3 },
    { id: 'crit', name_key: 'symbol.crit', effect_type: 'damage', weight_default: 0.2 },
    { id: 'heal', name_key: 'symbol.heal', effect_type: 'heal', weight_default: 0.2 },
    { id: 'bonus', name_key: 'symbol.bonus', effect_type: 'bonus', weight_default: 0.2 },
    { id: 'debuff', name_key: 'symbol.debuff', effect_type: 'penalty', weight_default: 0.1 },
  ];
  for (const s of symbols) {
    await client.query(
      `INSERT INTO action_roll_symbols (id, name_key, effect_type, weight_default)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name_key = $2, effect_type = $3, weight_default = $4`,
      [s.id, s.name_key, s.effect_type, s.weight_default]
    );
  }
  console.log('Action roll symbols:', symbols.length);

  // 8. Boss event for today (optional: so app can show boss)
  const now = new Date();
  const start = new Date(now);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start);
  end.setHours(19, 0, 0, 0);
  await client.query(
    `INSERT INTO boss_events (date, boss_type_id, total_hp, current_hp, starts_at, ends_at)
     VALUES ($1, 'default', 100000, 100000, $2, $3)
     ON CONFLICT (date) DO NOTHING`,
    [today, start.toISOString(), end.toISOString()]
  );
  console.log('Boss event: today');

  // 9. Daily dungeon seed (so everyone plays same dungeon today)
  await client.query(
    `INSERT INTO daily_dungeon_seeds (date, seed) VALUES ($1, $2)
     ON CONFLICT (date) DO NOTHING`,
    [today, Math.floor(Math.random() * 0x7fffffff) + 1]
  );
  console.log('Daily dungeon seed: today');

  // 10. Dungeon mob catalog (for placement in generated levels)
  await client.query(
    `INSERT INTO dungeon_mob_catalog (id, name_key, hp, attack, defense, xp_value)
     VALUES ('mob_rat', 'mob.rat', 5, 1, 0, 2)
     ON CONFLICT (id) DO UPDATE SET name_key = 'mob.rat', hp = 5, attack = 1, defense = 0, xp_value = 2`
  );
  console.log('Dungeon mob: mob_rat');

  console.log('Seed completed.');
}

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await seed(client);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
