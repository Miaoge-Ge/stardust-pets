-- Stardust Pets schema v1 (full schema from DESIGN.md §11; phase 1 uses a
-- subset, later phases fill in the rest without another migration).

CREATE TABLE IF NOT EXISTS pets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('N','R','SR','SSR')),
  species TEXT NOT NULL,
  parts_json TEXT NOT NULL,
  personality TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  intimacy_level INTEGER NOT NULL DEFAULT 1,
  intimacy_points INTEGER NOT NULL DEFAULT 0,
  interact_count INTEGER NOT NULL DEFAULT 0,
  nickname_for_owner TEXT,
  released INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS owner_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('short','long')),
  content TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 3,
  created_at INTEGER NOT NULL,
  last_referenced_at INTEGER
);

CREATE TABLE IF NOT EXISTS currency (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  balance INTEGER NOT NULL DEFAULT 0,
  shards INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS currency_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delta INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gacha_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pity_sr INTEGER NOT NULL DEFAULT 0,
  pity_ssr INTEGER NOT NULL DEFAULT 0,
  total_pulls INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gacha_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  result_pet_id TEXT,
  rarity TEXT NOT NULL,
  was_duplicate INTEGER NOT NULL DEFAULT 0,
  pity_sr_after INTEGER NOT NULL,
  pity_ssr_after INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  pet_count INTEGER DEFAULT 0,
  feed_count INTEGER DEFAULT 0,
  chat_count INTEGER DEFAULT 0,
  health_count INTEGER DEFAULT 0,
  checkin_done INTEGER DEFAULT 0,
  checkin_streak INTEGER DEFAULT 0,
  idle_minutes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS unlocked_parts (
  part_id TEXT PRIMARY KEY,
  first_pet_id TEXT,
  unlocked_at INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO currency (id, balance, shards, updated_at) VALUES (1, 0, 0, 0);
INSERT OR IGNORE INTO gacha_state (id, pity_sr, pity_ssr, total_pulls) VALUES (1, 0, 0, 0);
