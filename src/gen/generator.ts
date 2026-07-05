/**
 * 形态生成核心(纯函数,无 IO):
 *   rollRarity  — 稀有度 + 双保底(SR 50 / SSR 100)
 *   generatePet — 约束过滤 → 池内加权随机 → 色板解析 → 特效分配
 * 全程由带种子的 PRNG 驱动,同一 seed 完整复现。
 */
import partsCfg from '../config/parts.json';
import { hslToHex, shade } from './colors';
import { mulberry32, pickRng, type Rng } from './prng';

export type Rarity = 'N' | 'R' | 'SR' | 'SSR';
export const RARITIES: Rarity[] = ['N', 'R', 'SR', 'SSR'];
export const RATES: Record<Rarity, number> = { N: 0.65, R: 0.25, SR: 0.085, SSR: 0.015 };
export const PITY_SR = 50;
export const PITY_SSR = 100;

const ORDER: Record<Rarity, number> = { N: 0, R: 1, SR: 2, SSR: 3 };

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
}

export interface RarityRoll {
  rarity: Rarity;
  pity: PityState;
}

/**
 * 保底规则:
 *  - 本抽计入后 ssr 计数达到 100 → 必得 SSR
 *  - 本抽计入后 sr 计数达到 50 且掷出低于 SR → 强制 SR
 *  - SR 计数在出 SR/SSR 时重置;SSR 计数仅在出 SSR 时重置
 */
export function rollRarity(rng: Rng, pity: PityState): RarityRoll {
  let rarity: Rarity;
  if (pity.ssr + 1 >= PITY_SSR) {
    rarity = 'SSR';
  } else {
    const r = rng();
    if (r < RATES.SSR) rarity = 'SSR';
    else if (r < RATES.SSR + RATES.SR) rarity = 'SR';
    else if (r < RATES.SSR + RATES.SR + RATES.R) rarity = 'R';
    else rarity = 'N';
    if (pity.sr + 1 >= PITY_SR && ORDER[rarity] < ORDER.SR) rarity = 'SR';
  }
  const next: PityState = {
    sr: ORDER[rarity] >= ORDER.SR ? 0 : pity.sr + 1,
    ssr: rarity === 'SSR' ? 0 : pity.ssr + 1,
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

function lerp(rng: Rng, [a, b]: [number, number]): number {
  return a + rng() * (b - a);
}

export function resolveColors(paletteId: string, rng: Rng): Colors {
  const def = PALETTES[paletteId];
  if (def && 'stops' in def) {
    const body = def.stops[0];
    return {
      body,
      shade: shade(body, -0.22),
      light: def.stops[1],
      belly: shade(body, 0.45),
      outline: shade(body, -0.62),
      pattern: def.stops[2],
      accent: def.stops[2],
      animated: !!def.animated,
    };
  }
  const h = def ? lerp(rng, (def as PaletteHue).hue) : lerp(rng, [18, 42]);
  const s = def ? lerp(rng, (def as PaletteHue).sat) : 70;
  const l = def ? lerp(rng, (def as PaletteHue).lit) : 62;
  const body = hslToHex(h, s, l);
  return {
    body,
    shade: shade(body, -0.2),
    light: shade(body, 0.22),
    belly: hslToHex(h + 8, Math.max(20, s - 15), Math.min(92, l + 24)),
    outline: hslToHex(h, Math.min(60, s + 5), Math.max(12, l - 45)),
    pattern: hslToHex(h + 25, s, Math.max(25, l - 22)),
    accent: hslToHex(h + 180, Math.min(85, s + 10), 62),
    animated: false,
  };
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
  if (rarity === 'SR' || rarity === 'SSR') {
    const pool = ALL_EFFECTS.filter((e) => ORDER[e.minRarity] <= ORDER[rarity]).map((e) => e.id);
    const count = rarity === 'SR' ? 1 : 2 + (rng() < 0.5 ? 1 : 0);
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

export const SHARD_ON_DUP: Record<Rarity, number> = { N: 10, R: 30, SR: 100, SSR: 300 };
export const WISH_COST: Record<Exclude<Rarity, 'N'>, number> = { R: 300, SR: 1000, SSR: 3000 };
