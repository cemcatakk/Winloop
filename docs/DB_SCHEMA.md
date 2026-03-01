# Winloop — Veritabanı Şeması (PostgreSQL)

**Not:** Tüm oyun verileri (sorular, itemler, boss tanımları, dil metinleri) **sunucuda** tutulur; uygulama bu verilere API ile erişir. Uygulama içinde statik veri yok.

---

## 1. Kimlik ve Kullanıcı

### `users`
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID PK | |
| google_id | VARCHAR(255) UNIQUE NOT NULL | Google OAuth sub |
| email | VARCHAR(255) | |
| display_name | VARCHAR(100) | |
| avatar_url | VARCHAR(500) | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| last_login_at | TIMESTAMPTZ | |
| is_penalized | BOOLEAN DEFAULT false | Çoklu hesap tespiti sonrası puan penaltısı |

### `user_settings`
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| user_id | UUID PK, FK → users | |
| language | VARCHAR(5) DEFAULT 'auto' | 'tr' | 'en' | 'auto' (cihaz diline göre) |
| sound_enabled | BOOLEAN DEFAULT true | |
| notifications_enabled | BOOLEAN DEFAULT true | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `ip_logs`
Çoklu hesap tespiti için; her giriş veya önemli aksiyonda IP kaydı.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | BIGSERIAL PK | |
| user_id | UUID FK → users | |
| ip_address | INET NOT NULL | |
| device_id | VARCHAR(255) | Opsiyonel; ileride |
| created_at | TIMESTAMPTZ | |

**İndeks:** `(ip_address, created_at)` — aynı IP’den kaç hesap kullanılmış sorgulama.

---

## 2. Dil ve İçerik (Sunucu Tarafı)

### `i18n_keys`
Metin anahtarları; uygulama key ile ister, dil'e göre çeviri döner.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| key | VARCHAR(100) UNIQUE NOT NULL | örn. 'home.play_morning' |
| created_at | TIMESTAMPTZ | |

### `i18n_translations`
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| i18n_key_id | INT FK → i18n_keys | |
| locale | VARCHAR(5) NOT NULL | 'tr' | 'en' |
| value | TEXT NOT NULL | |
| UNIQUE(i18n_key_id, locale) | | |

---

## 3. Sabah Oyunu (Wordle Benzeri)

### `morning_question_sets`
Günlük kullanılacak set (seed veya tarih ile seçilir).

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID PK | |
| date | DATE UNIQUE NOT NULL | Sunucu günü (timezone sabit) |
| question_ids | UUID[] NOT NULL | O günkü soru ID'leri sırayla |
| created_at | TIMESTAMPTZ | |

### `morning_questions`
Sorular sunucuda; uygulama API ile çeker.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID PK | |
| type | VARCHAR(20) NOT NULL | 'wordle' | 'quiz' (ileride) |
| payload | JSONB NOT NULL | Wordle: { "word": "...", "hint": "..." }; Quiz: { "question", "options", "correct" } |
| locale | VARCHAR(5) | Soru diline özel (opsiyonel; yoksa tüm dillerde aynı) |
| is_active | BOOLEAN DEFAULT true | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `morning_sessions`
Kullanıcının sabah oyunu oturumu ve skoru.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| date | DATE NOT NULL | |
| question_set_id | UUID FK → morning_question_sets | |
| score | INT NOT NULL | |
| completed_at | TIMESTAMPTZ | |
| power_earned | VARCHAR(50) | 'slot_lock' | 'damage_boost' vb. (yarın kullanılacak) |
| UNIQUE(user_id, date) | | |

---

## 4. Dungeon

### `dungeon_item_catalog`
Tüm item/relic tanımları sunucuda; uygulama listeyi API ile alır.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | VARCHAR(50) PK | 'crit_rune', 'shield_relic', 'chaos_orb', 'health_stone', 'speed_gem' |
| name_key | VARCHAR(100) | i18n key |
| type | VARCHAR(20) | 'relic' | 'consumable' |
| rarity | VARCHAR(20) | 'common' | 'rare' | 'epic' | 'legendary' |
| effect_type | VARCHAR(50) | Boss’ta kullanım: 'crit_chance' | 'negate_debuff' | 'extra_slot' | 'hp_bonus' | 'dodge_window' |
| effect_value | JSONB | Sayısal veya koşul; örn. {"crit_bonus": 0.1} |
| is_active | BOOLEAN DEFAULT true | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**MVP item önerileri (senin adına belirlenenler):**
- **crit_rune** — Boss’ta crit şansı artar (effect_value: { "crit_bonus": 0.10 })
- **shield_relic** — Boss’ta tek negatif efekti ignore eder
- **chaos_orb** — Boss’ta ekstra 1 aksiyon slot’u
- **health_stone** — Dungeon/Boss başlangıç HP bonusu
- **speed_gem** — Dungeon’da süre bonusu veya dodge penceresi genişliği

### `dungeon_runs`
Günlük dungeon koşusu; seed sunucudan.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| date | DATE NOT NULL | |
| seed | BIGINT NOT NULL | Sunucu üretir; tekrarlanabilir harita |
| status | VARCHAR(20) | 'in_progress' | 'completed' | 'failed' |
| score | INT | |
| duration_seconds | INT | |
| hp_remaining | INT | Boss’a girerken kalan can |
| items_collected | JSONB | [{ "item_id": "crit_rune", "count": 1 }, ...] |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| UNIQUE(user_id, date) | | |

---

## 5. Boss

### `boss_type_catalog`
Boss tipleri; element, 2x bonus koşulu vb. ileride eklenebilir.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | VARCHAR(50) PK | 'default' | 'fire_lord' (ileride) |
| name_key | VARCHAR(100) | i18n |
| element | VARCHAR(20) | NULL | 'fire' | 'ice' | 'chaos' (ileride) |
| bonus_rule | JSONB | İleride: 2x bonus koşulu vb.; örn. {"double_on_pattern": "CRIT_CRIT_BONUS"} |
| resistance | JSONB | {"debuff": 0.1} — hasar azaltma oranları |
| is_active | BOOLEAN DEFAULT true | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `boss_events`
Günlük boss instance; katılan sayısına göre HP hesaplanır.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID PK | |
| date | DATE NOT NULL | |
| boss_type_id | VARCHAR(50) FK → boss_type_catalog | |
| total_hp | BIGINT NOT NULL | Katılımcı sayısı * formül |
| current_hp | BIGINT NOT NULL | Canlı güncellenir |
| starts_at | TIMESTAMPTZ | |
| ends_at | TIMESTAMPTZ | |
| UNIQUE(date) | | |

### `boss_participants`
Kim katıldı, dungeon’dan ne getirdi.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID PK | |
| boss_event_id | UUID FK → boss_events | |
| user_id | UUID FK → users | |
| hp_entered | INT NOT NULL | Dungeon’dan kalan can |
| total_damage_dealt | BIGINT DEFAULT 0 | |
| is_revived | BOOLEAN DEFAULT false | Reklamla revive kullandı mı |
| joined_at | TIMESTAMPTZ | |

**UNIQUE(boss_event_id, user_id)**

### `boss_damage_feed`
Real-time feed için; WebSocket/SSE ile son N kayıt push edilir.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | BIGSERIAL PK | |
| boss_event_id | UUID FK → boss_events | |
| user_id | UUID FK → users | |
| damage | INT NOT NULL | |
| is_crit | BOOLEAN DEFAULT false | |
| created_at | TIMESTAMPTZ | |

**İndeks:** `(boss_event_id, created_at DESC)` — son feed sorguları.

### `action_roll_symbols`
Action Roll / kart sembolleri katalog (sunucudan döner).

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | VARCHAR(30) PK | 'attack' | 'crit' | 'heal' | 'bonus' | 'debuff' |
| name_key | VARCHAR(100) | i18n |
| effect_type | VARCHAR(30) | 'damage' | 'heal' | 'bonus' | 'penalty' |
| weight_default | NUMERIC(5,4) | RNG ağırlığı (0–1) |
| is_active | BOOLEAN DEFAULT true | |

---

## 6. Puan ve Ödül

### `user_points`
Bakiye ve hareketler; penaltı uygulanan kullanıcıda kazançlar azaltılarak yazılır.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| user_id | UUID PK FK → users | |
| balance | INT NOT NULL DEFAULT 0 | Güncel puan |
| updated_at | TIMESTAMPTZ | |

### `point_transactions`
Denetim ve geçmiş için.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| amount | INT NOT NULL | + kazanç, - harcama |
| source | VARCHAR(50) | 'morning' | 'dungeon' | 'boss' | 'penalty' | 'shop' |
| reference_id | UUID | İlgili session/event ID |
| balance_after | INT | İşlem sonrası bakiye |
| created_at | TIMESTAMPTZ | |

---

## 7. Reklam ve Limitler

### `ad_views`
Rewarded ad kullanımı (revive, heal vb.); limit kontrolü.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| ad_type | VARCHAR(30) | 'revive' | 'heal' | 'reroll' | 'double_reward' |
| date | DATE NOT NULL | |
| created_at | TIMESTAMPTZ | |

**İndeks:** `(user_id, date, ad_type)` — günlük ad_type başına 1 vb. kural için.

---

## 8. Leaderboard

Günlük/haftalık skorlar; materialized view veya günlük snapshot tablosu kullanılabilir.

### `leaderboard_daily`
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| date | DATE PK | |
| user_id | UUID PK FK → users | |
| rank | INT | |
| score | INT | Birleşik veya mod bazlı skor |
| morning_score | INT | |
| dungeon_score | INT | |
| boss_damage | BIGINT | |

---

## 9. Genel Notlar

- **Timezone:** `date` alanları sunucu timezone (örn. UTC) veya kullanıcı timezone’a göre “gün” kuralına göre tutulmalı; karar dokümante edilmeli.
- **Soft delete:** İstersen `deleted_at` eklenebilir; MVP’de gerek yok.
- **Migrations:** Şema değişiklikleri migration (örn. node-pg-migrate, Knex migrations) ile yönetilmeli.
- **Tüm oyun verileri sunucudan:** Sorular, item katalogları, boss tipleri, i18n, action roll sembolleri API ile sağlanır; uygulama sadece cache (opsiyonel) ve sunucu yanıtına güvenir.
