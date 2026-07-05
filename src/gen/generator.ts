/**
 * 形态生成核心(纯函数,无 IO):
 *   rollRarity  — 稀有度 + 双保底(SR 50 / SSR 100)
 *   generatePet — 约束过滤 → 池内加权随机 → 色板解析 → 特效分配
 * 全程由带种子的 PRNG 驱动,同一 seed 完整复现。
 */
import partsCfg from '../config/parts.json';
import { randomCreatureColors } from './colors';
import { mulberry32, pickRng, type Rng } from './prng';

export type Rarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR';
export const RARITIES: Rarity[] = ['N', 'R', 'SR', 'SSR', 'UR'];
export const RATES: Record<Rarity, number> = {
  N: 0.58,
  R: 0.27,
  SR: 0.1,
  SSR: 0.042,
  UR: 0.008,
};
export const PITY_SR = 50;
export const PITY_SSR = 100;
export const PITY_UR = 200;

const ORDER: Record<Rarity, number> = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };

export interface PartDef {
  id: string;
  dimension: string;
  name: string;
  minRarity: Rarity;
  requires?: Record<string, string[]>;
  excludes?: Record<string, string[]>;
}

export interface Colors {
  body: string;
  shade: string;
  light: string;
  belly: string;
  outline: string;
  pattern: string;
  accent: string;
  animated: boolean;
  gradientStops?: string[];
}

export interface GeneratedPet {
  seed: number;
  rarity: Rarity;
  ids: Record<string, string>;
  effects: string[];
  colors: Colors;
  personality: string;
  name: string;
}

export const DIMENSIONS: string[] = partsCfg.dimensions;
export const ALL_PARTS: PartDef[] = partsCfg.parts as PartDef[];
export const ALL_EFFECTS = partsCfg.effects as Array<{ id: string; name: string; minRarity: Rarity }>;
export const SERIES = partsCfg.series as Record<
  string,
  { name: string; parts: string[]; reward: number }
>;

const BY_DIM = new Map<string, PartDef[]>();
for (const dim of DIMENSIONS) BY_DIM.set(dim, []);
for (const p of ALL_PARTS) BY_DIM.get(p.dimension)?.push(p);

export function partById(id: string): PartDef | undefined {
  return ALL_PARTS.find((p) => p.id === id);
}

// ---------------------------------------------------------------- 稀有度 + 保底

export interface PityState {
  sr: number;
  ssr: number;
  ur: number;
}

export interface RarityRoll {
  rarity: Rarity;
  pity: PityState;
}

/**
 * 三重保底:
 *  - 本抽计入后 ur 计数达到 200 → 必得 UR
 *  - 本抽计入后 ssr 计数达到 100 → 必得 SSR
 *  - 本抽计入后 sr 计数达到 50 且掷出低于 SR → 强制 SR
 *  - SR 计数在出 ≥SR 时重置;SSR 计数在出 ≥SSR 时重置;UR 计数仅在出 UR 时重置
 */
export function rollRarity(rng: Rng, pity: PityState): RarityRoll {
  let rarity: Rarity;
  if (pity.ur + 1 >= PITY_UR) {
    rarity = 'UR';
  } else if (pity.ssr + 1 >= PITY_SSR) {
    rarity = 'SSR';
  } else {
    const r = rng();
    if (r < RATES.UR) rarity = 'UR';
    else if (r < RATES.UR + RATES.SSR) rarity = 'SSR';
    else if (r < RATES.UR + RATES.SSR + RATES.SR) rarity = 'SR';
    else if (r < RATES.UR + RATES.SSR + RATES.SR + RATES.R) rarity = 'R';
    else rarity = 'N';
    if (pity.sr + 1 >= PITY_SR && ORDER[rarity] < ORDER.SR) rarity = 'SR';
  }
  const next: PityState = {
    sr: ORDER[rarity] >= ORDER.SR ? 0 : pity.sr + 1,
    ssr: ORDER[rarity] >= ORDER.SSR ? 0 : pity.ssr + 1,
    ur: rarity === 'UR' ? 0 : pity.ur + 1,
  };
  return { rarity, pity: next };
}

/** 十连:逐抽推进保底;若前 9 抽全 N,第 10 抽强制 ≥R */
export function rollTen(rng: Rng, pity: PityState): { rarities: Rarity[]; pity: PityState } {
  const rarities: Rarity[] = [];
  let p = pity;
  for (let i = 0; i < 10; i++) {
    const roll = rollRarity(rng, p);
    let rarity = roll.rarity;
    p = roll.pity;
    if (i === 9 && rarity === 'N' && rarities.every((x) => x === 'N')) {
      rarity = 'R';
      // 强制 R 不影响保底计数(R 不重置任何计数,计数已 +1)
    }
    rarities.push(rarity);
  }
  return { rarities, pity: p };
}

// ---------------------------------------------------------------- 部件选取

function satisfied(part: PartDef, chosen: Record<string, string>): boolean {
  if (part.requires) {
    for (const [dim, ids] of Object.entries(part.requires)) {
      if (chosen[dim] !== undefined && !ids.includes(chosen[dim])) return false;
    }
  }
  if (part.excludes) {
    for (const [dim, ids] of Object.entries(part.excludes)) {
      if (chosen[dim] !== undefined && ids.includes(chosen[dim])) return false;
    }
  }
  return true;
}

/** 约束过滤后的可用池;为空时逐级放宽(保证任何组合都能生成) */
export function poolFor(dim: string, rarity: Rarity, chosen: Record<string, string>): PartDef[] {
  const parts = BY_DIM.get(dim) ?? [];
  let pool = parts.filter((p) => ORDER[p.minRarity] <= ORDER[rarity] && satisfied(p, chosen));
  if (pool.length === 0) {
    // 放宽稀有度限制但保留约束(如:slime 在任何稀有度下 material 只能是 jelly)
    pool = parts.filter((p) => satisfied(p, chosen));
  }
  return pool;
}

function pickWeighted(rng: Rng, pool: PartDef[], rarity: Rarity): PartDef {
  // 恰好等于本次稀有度的部件权重 ×3:让 SSR 看起来"像 SSR"
  const weights = pool.map((p) => (p.minRarity === rarity ? 3 : 1));
  let total = 0;
  for (const w of weights) total += w;
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ---------------------------------------------------------------- 色板解析

interface PaletteHue {
  hue: [number, number];
  sat: [number, number];
  lit: [number, number];
}
interface PaletteStops {
  stops: string[];
  animated?: boolean;
}

const PALETTES = partsCfg.palettes as unknown as Record<string, PaletteHue | PaletteStops>;

/**
 * 配色:色相/明度/饱和度完全随机(不再受限于该 palette id 预设的固定色相区间),
 * palette 维度仍作为图鉴收集标签保留;仅当该 palette 被标记 animated(极光/暮光/星云/
 * 鎏金/棱镜/炎阳等高稀有度专属)时才叠加流光渐变加成。
 */
export function resolveColors(paletteId: string, rng: Rng): Colors {
  const def = PALETTES[paletteId];
  const animatedBonus = !!(def && 'stops' in def && def.animated);
  return randomCreatureColors(rng, animatedBonus);
}

// ---------------------------------------------------------------- 整只生成

export const PERSONALITIES = ['傲娇', '粘人', '高冷', '元气', '慢热', '中二', '懒洋洋', '社恐'];

const NAMES = [
  '糯米', '布丁', '雪球', '煤球', '毛毛', '年糕', '汤圆', '芝麻',
  '泡芙', '团子', '奶酪', '豆包', '麻薯', '果冻', '曲奇', '铜锣',
];

export function generatePet(rarity: Rarity, seed: number): GeneratedPet {
  const rng = mulberry32(seed);
  const ids: Record<string, string> = {};
  for (const dim of DIMENSIONS) {
    const pool = poolFor(dim, rarity, ids);
    ids[dim] = pickWeighted(rng, pool, rarity).id;
  }

  const effects: string[] = [];
  const effectCount: Partial<Record<Rarity, number>> = { SR: 1, SSR: 2, UR: 3 };
  const count = effectCount[rarity] ?? 0;
  if (count > 0) {
    const pool = ALL_EFFECTS.filter((e) => ORDER[e.minRarity] <= ORDER[rarity]).map((e) => e.id);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    effects.push(...shuffled.slice(0, Math.min(count, shuffled.length)));
  }

  const colors = resolveColors(ids.palette, rng);
  const personality = pickRng(rng, PERSONALITIES);
  const name = pickRng(rng, NAMES);
  return { seed, rarity, ids, effects, colors, personality, name };
}

/** 重复判定 key:离散部件全同(忽略色板抖动)= 重复 → 转碎片 */
export function partsKey(ids: Record<string, string>, effects: string[]): string {
  return DIMENSIONS.map((d) => ids[d]).join('|') + '#' + [...effects].sort().join(',');
}

export const SHARD_ON_DUP: Record<Rarity, number> = { N: 10, R: 30, SR: 100, SSR: 300, UR: 800 };
export const WISH_COST: Record<Exclude<Rarity, 'N'>, number> = {
  R: 300,
  SR: 1000,
  SSR: 3000,
  UR: 8000,
};
