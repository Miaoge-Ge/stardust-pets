/** 亲密度持久化层:读写 pets 表 + 启动衰减 + 每日启动奖励 */
import { getDb, getSetting, setSetting, today } from './db';
import {
  applyDecay,
  applyPoints,
  pointsFor,
  type IntimacySource,
  type IntimacyState,
} from './intimacyCore';

export interface IntimacyGain {
  gained: number;
  state: IntimacyState;
  leveledUp: number[];
}

export async function getIntimacy(petId: string): Promise<IntimacyState> {
  const rows = await getDb().select<Array<{ intimacy_level: number; intimacy_points: number }>>(
    'SELECT intimacy_level, intimacy_points FROM pets WHERE id = $1',
    [petId]
  );
  if (rows.length === 0) return { level: 1, points: 0 };
  return { level: Number(rows[0].intimacy_level), points: Number(rows[0].intimacy_points) };
}

async function save(petId: string, s: IntimacyState): Promise<void> {
  await getDb().execute(
    'UPDATE pets SET intimacy_level = $1, intimacy_points = $2 WHERE id = $3',
    [s.level, s.points, petId]
  );
}

/** 按来源加点(nthToday 为今日第几次,超上限自动 0 分) */
export async function gainBySource(
  petId: string,
  source: IntimacySource,
  nthToday: number
): Promise<IntimacyGain> {
  const pts = pointsFor(source, nthToday);
  return gainRaw(petId, pts);
}

export async function gainRaw(petId: string, pts: number): Promise<IntimacyGain> {
  const cur = await getIntimacy(petId);
  if (pts <= 0) return { gained: 0, state: cur, leveledUp: [] };
  const r = applyPoints(cur, pts);
  await save(petId, r.state);
  return { gained: pts, state: r.state, leveledUp: r.leveledUp };
}

/**
 * 启动时衰减:按距上次打开的天数,对所有未放生宠物扣点(不降级)。
 * 互动只发生在应用打开时,故以"上次打开日期"作为未互动天数依据。
 */
export async function applyDecayOnBoot(): Promise<void> {
  const last = await getSetting('last_seen_date');
  const t = today();
  if (last && last !== t) {
    const gapDays = Math.round(
      (new Date(t).getTime() - new Date(last).getTime()) / 86400_000
    );
    if (gapDays >= 3) {
      const dbx = getDb();
      const pets = await dbx.select<Array<{ id: string; intimacy_level: number; intimacy_points: number }>>(
        'SELECT id, intimacy_level, intimacy_points FROM pets WHERE released = 0'
      );
      for (const p of pets) {
        const decayed = applyDecay(
          { level: Number(p.intimacy_level), points: Number(p.intimacy_points) },
          gapDays
        );
        await save(p.id, decayed);
      }
    }
  }
  await setSetting('last_seen_date', t);
}

/** 每日首次启动 +5(返回 true = 今天发放了) */
export async function dailyLaunchBonus(petId: string): Promise<IntimacyGain | null> {
  const key = 'launch_intimacy_date';
  const last = await getSetting(key);
  const t = today();
  if (last === t) return null;
  await setSetting(key, t);
  return gainRaw(petId, 5);
}
