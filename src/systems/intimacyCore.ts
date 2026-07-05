/** 亲密度纯逻辑(无 IO,单测覆盖):10 级 × 每级 0~100 点 */

export const MAX_LEVEL = 10;
export const POINTS_PER_LEVEL = 100;

export interface IntimacyState {
  level: number; // 1..10
  points: number; // 0..99(满级时可停在 100)
}

export interface GainResult {
  state: IntimacyState;
  /** 本次跨过的等级(如 2→4 返回 [3,4]) */
  leveledUp: number[];
}

/** 加点:溢出进位升级;满级后点数封顶 */
export function applyPoints(s: IntimacyState, delta: number): GainResult {
  let level = s.level;
  let points = s.points + delta;
  const leveledUp: number[] = [];
  while (points >= POINTS_PER_LEVEL && level < MAX_LEVEL) {
    points -= POINTS_PER_LEVEL;
    level += 1;
    leveledUp.push(level);
  }
  if (level >= MAX_LEVEL && points > POINTS_PER_LEVEL) points = POINTS_PER_LEVEL;
  if (points < 0) points = 0;
  return { state: { level, points }, leveledUp };
}

/**
 * 衰减:连续 3 天未互动起每日 -10。
 * gapDays = 距上次活跃的天数;衰减天数 = max(0, gapDays - 2)。
 * 只扣点不降级(最低到当前等级 0 点)。
 */
export function applyDecay(s: IntimacyState, gapDays: number): IntimacyState {
  const decayDays = Math.max(0, gapDays - 2);
  if (decayDays === 0) return s;
  return { level: s.level, points: Math.max(0, s.points - 10 * decayDays) };
}

/** 每日互动获取规则:来源 → [每日有效次数, 每次点数] */
export const DAILY_RULES = {
  pet_count: { times: 10, pts: 2 },
  feed_count: { times: 3, pts: 5 },
  chat_count: { times: 5, pts: 3 },
  health_count: { times: 3, pts: 5 },
} as const;

export type IntimacySource = keyof typeof DAILY_RULES;

/** 第 n 次(1-based)互动应得的点数(超过每日上限 = 0) */
export function pointsFor(source: IntimacySource, nthToday: number): number {
  const rule = DAILY_RULES[source];
  return nthToday <= rule.times ? rule.pts : 0;
}

/** 等级 → 对话语气描述(注入 LLM prompt;验收:不同等级语气可感知不同) */
export function toneForLevel(level: number): string {
  if (level <= 2) return '你们刚认识不久,你说话礼貌客气、略带拘谨,用"您/请"这类词,不会撒娇。';
  if (level <= 4) return '你们已经熟悉了,你说话自然友好,偶尔开个小玩笑,但还保持一点分寸。';
  if (level <= 6) return '你们关系很好,你说话轻松随意,经常开玩笑、用语气词,偶尔小小地撒娇。';
  if (level <= 8) return '你们非常亲密,你说话黏糊撒娇,直接表达想念和依赖,爱用叠词和颜文字。';
  return '你们是无话不谈的家人,你完全不设防,想撒娇就撒娇、想拌嘴就拌嘴,充满安全感。';
}

/** 等级解锁清单(提示文案) */
export const LEVEL_UNLOCKS: Record<number, string> = {
  3: '解锁专属撒娇动作!',
  5: '解锁主动搭话:它会看情况主动找你聊天~',
  7: '它想给你起个专属昵称!',
  10: '解锁隐藏特效外观!',
};
