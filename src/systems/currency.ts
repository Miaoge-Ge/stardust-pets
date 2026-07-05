/**
 * 星星币 / 碎片:
 *  - 所有变动写 currency_log(来源、数额),余额可由 SUM 校验
 *  - 变动后广播 tauri 事件,宠物窗口播放头顶星星动画,面板窗口刷新余额
 */
import { emit } from '@tauri-apps/api/event';
import { getDb, getSetting, setSetting, today } from './db';

export interface CoinEvent {
  delta: number;
  balance: number;
  shards: number;
  source: string;
}

export async function getBalance(): Promise<number> {
  const rows = await getDb().select<Array<{ balance: number }>>(
    'SELECT balance FROM currency WHERE id = 1'
  );
  return rows.length > 0 ? Number(rows[0].balance) : 0;
}

export async function getShards(): Promise<number> {
  const rows = await getDb().select<Array<{ shards: number }>>(
    'SELECT shards FROM currency WHERE id = 1'
  );
  return rows.length > 0 ? Number(rows[0].shards) : 0;
}

async function broadcast(delta: number, source: string): Promise<void> {
  const payload: CoinEvent = {
    delta,
    balance: await getBalance(),
    shards: await getShards(),
    source,
  };
  void emit('coins-changed', payload);
}

export async function addCoins(delta: number, source: string): Promise<void> {
  const dbx = getDb();
  await dbx.execute('UPDATE currency SET balance = balance + $1, updated_at = $2 WHERE id = 1', [
    delta,
    Date.now(),
  ]);
  await dbx.execute('INSERT INTO currency_log (delta, source, created_at) VALUES ($1, $2, $3)', [
    delta,
    source,
    Date.now(),
  ]);
  await broadcast(delta, source);
}

/** 余额不足返回 false,不产生任何变动 */
export async function spendCoins(amount: number, source: string): Promise<boolean> {
  const balance = await getBalance();
  if (balance < amount) return false;
  await addCoins(-amount, source);
  return true;
}

export async function addShards(delta: number, source: string): Promise<void> {
  await getDb().execute('UPDATE currency SET shards = shards + $1, updated_at = $2 WHERE id = 1', [
    delta,
    Date.now(),
  ]);
  await broadcast(0, source);
}

export async function spendShards(amount: number, source: string): Promise<boolean> {
  const shards = await getShards();
  if (shards < amount) return false;
  await addShards(-amount, source);
  return true;
}

/** 碎片 1:1 兑换星星币 */
export async function shardsToCoins(amount: number): Promise<boolean> {
  if (!(await spendShards(amount, 'exchange'))) return false;
  await addCoins(amount, 'exchange');
  return true;
}

// ---------------------------------------------------------------- 每日签到

export interface CheckinResult {
  rewarded: number;
  streak: number;
}

/** 每日启动签到:+30;连续第 7 天额外 +100 并重置连击 */
export async function dailyCheckin(): Promise<CheckinResult | null> {
  const dbx = getDb();
  const date = today();
  await dbx.execute('INSERT INTO daily_stats (date) VALUES ($1) ON CONFLICT(date) DO NOTHING', [
    date,
  ]);
  const rows = await dbx.select<Array<{ checkin_done: number }>>(
    'SELECT checkin_done FROM daily_stats WHERE date = $1',
    [date]
  );
  if (rows.length > 0 && Number(rows[0].checkin_done) === 1) return null;

  const lastDate = await getSetting('last_checkin_date');
  const lastStreak = Number((await getSetting('checkin_streak')) ?? '0');
  const yesterday = new Date(Date.now() - 86400_000);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const streak = lastDate === yStr ? lastStreak + 1 : 1;

  let reward = 30;
  let newStreak = streak;
  if (streak >= 7) {
    reward += 100;
    newStreak = 0; // 第 7 天领大奖后重新累计
  }
  await dbx.execute('UPDATE daily_stats SET checkin_done = 1, checkin_streak = $1 WHERE date = $2', [
    streak,
    date,
  ]);
  await setSetting('last_checkin_date', date);
  await setSetting('checkin_streak', String(newStreak));
  await addCoins(reward, 'checkin');
  return { rewarded: reward, streak };
}

// ---------------------------------------------------------------- 每日互动任务

const TASK_TARGETS: Record<string, number> = { pet_count: 5, feed_count: 1, chat_count: 1 };
const TASK_NAMES: Record<string, string> = {
  pet_count: '摸头 5 次',
  feed_count: '喂食 1 次',
  chat_count: '聊天 1 次',
};

/**
 * 在计数 +1 后调用:恰好达到目标时发放 +10(每次 bump 只 +1,天然只触发一次)。
 * 返回任务名(用于提示),未触发返回 null。
 */
export async function maybeTaskReward(field: string, newCount: number): Promise<string | null> {
  const target = TASK_TARGETS[field];
  if (!target || newCount !== target) return null;
  await addCoins(10, `task_${field}`);
  return TASK_NAMES[field];
}

// ---------------------------------------------------------------- 挂机计时

/**
 * 每分钟由宠物窗口调用一次;空闲(≥30 分钟无键鼠)时不累计。
 * 满 60 活跃分钟 → +10,进度持久化,崩溃不丢。
 */
export async function tickIdleEarning(idleSeconds: number): Promise<boolean> {
  if (idleSeconds >= 30 * 60) return false;
  const progress = Number((await getSetting('active_minutes')) ?? '0') + 1;
  if (progress >= 60) {
    await setSetting('active_minutes', '0');
    await addCoins(10, 'idle');
    return true;
  }
  await setSetting('active_minutes', String(progress));
  return false;
}
