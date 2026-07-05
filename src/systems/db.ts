import Database from '@tauri-apps/plugin-sql';

let db: Database;

export interface PetRow {
  id: string;
  name: string;
  rarity: string;
  species: string;
  parts_json: string;
  personality: string;
  created_at: number;
  intimacy_level: number;
  intimacy_points: number;
  interact_count: number;
  nickname_for_owner: string | null;
  released: number;
}

export async function initDb(): Promise<void> {
  db = await Database.load('sqlite:stardust.db');
}

export function getDb(): Database {
  return db;
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select<Array<{ value: string }>>(
    'SELECT value FROM settings WHERE key = $1',
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $2`,
    [key, value]
  );
}

export type DailyField = 'feed_count' | 'chat_count' | 'pet_count' | 'health_count';

export function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 今日字段 +1,返回自增后的值(用于每日上限/任务判断) */
export async function bumpDaily(field: DailyField): Promise<number> {
  const date = today();
  await db.execute('INSERT INTO daily_stats (date) VALUES ($1) ON CONFLICT(date) DO NOTHING', [
    date,
  ]);
  await db.execute(`UPDATE daily_stats SET ${field} = COALESCE(${field}, 0) + 1 WHERE date = $1`, [
    date,
  ]);
  const rows = await db.select<Array<Record<string, number>>>(
    `SELECT ${field} AS v FROM daily_stats WHERE date = $1`,
    [date]
  );
  return rows.length > 0 ? Number(rows[0].v) : 0;
}

export async function getDailyRow(): Promise<Record<string, number | string> | null> {
  const rows = await db.select<Array<Record<string, number | string>>>(
    'SELECT * FROM daily_stats WHERE date = $1',
    [today()]
  );
  return rows.length > 0 ? rows[0] : null;
}
