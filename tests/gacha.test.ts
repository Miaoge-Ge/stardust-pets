import { describe, expect, it } from 'vitest';
import {
  PITY_SR,
  PITY_SSR,
  RATES,
  rollRarity,
  rollTen,
  type PityState,
  type Rarity,
} from '../src/gen/generator';
import { mulberry32 } from '../src/gen/prng';

const zero: PityState = { sr: 0, ssr: 0 };

/** 恒返回指定值的 rng */
const fixed = (v: number) => () => v;
/** 永远掷出 N 的 rng(0.999 落在 N 区间) */
const alwaysN = fixed(0.999);

describe('保底边界', () => {
  it('第 49 抽不触发 SR 保底,第 50 抽必得 ≥SR', () => {
    let pity: PityState = zero;
    for (let i = 1; i <= 49; i++) {
      const r = rollRarity(alwaysN, pity);
      expect(r.rarity).toBe('N');
      pity = r.pity;
    }
    expect(pity.sr).toBe(49);
    const r50 = rollRarity(alwaysN, pity);
    expect(r50.rarity).toBe('SR');
    expect(r50.pity.sr).toBe(0); // 出货重置
  });

  it('第 100 抽必得 SSR;SR 出货不重置 SSR 计数', () => {
    let pity: PityState = zero;
    for (let i = 1; i <= 99; i++) {
      pity = rollRarity(alwaysN, pity).pity;
    }
    expect(pity.ssr).toBe(99);
    const r100 = rollRarity(alwaysN, pity);
    expect(r100.rarity).toBe('SSR');
    expect(r100.pity.ssr).toBe(0);
    expect(r100.pity.sr).toBe(0); // SSR 同时重置 SR 计数
  });

  it('SR 保底途中出 SR 不影响 SSR 计数推进', () => {
    // 抽出 SR(rng 落在 SR 区间)
    const srRoll = rollRarity(fixed(RATES.SSR + 0.001), { sr: 10, ssr: 60 });
    expect(srRoll.rarity).toBe('SR');
    expect(srRoll.pity.sr).toBe(0);
    expect(srRoll.pity.ssr).toBe(61); // SSR 计数继续 +1
  });

  it('自然掷出 SSR 同时重置双计数', () => {
    const r = rollRarity(fixed(0.001), { sr: 30, ssr: 70 });
    expect(r.rarity).toBe('SSR');
    expect(r.pity).toEqual({ sr: 0, ssr: 0 });
  });

  it('十连:前 9 抽全 N 时第 10 抽强制 ≥R', () => {
    const { rarities } = rollTen(alwaysN, zero);
    expect(rarities.slice(0, 9).every((r) => r === 'N')).toBe(true);
    expect(rarities[9]).not.toBe('N');
  });

  it('十连跨保底:pity 从 45 开始,第 5 抽命中 SR 保底', () => {
    const { rarities, pity } = rollTen(alwaysN, { sr: 45, ssr: 0 });
    expect(rarities[4]).toBe('SR'); // 累计第 50 抽
    expect(pity.sr).toBe(5); // 保底后重新累计 5 抽
    expect(pity.ssr).toBe(10);
  });
});

describe('蒙特卡洛:10000 抽 × 10 轮出率偏差 < 1%', () => {
  it('无保底干预时符合配置概率', () => {
    // 每抽重置 pity,以排除保底对基础概率的影响
    for (let round = 0; round < 10; round++) {
      const rng = mulberry32(1234 + round);
      const counts: Record<Rarity, number> = { N: 0, R: 0, SR: 0, SSR: 0 };
      const total = 10000;
      for (let i = 0; i < total; i++) {
        counts[rollRarity(rng, zero).rarity]++;
      }
      for (const rarity of ['N', 'R', 'SR', 'SSR'] as Rarity[]) {
        const actual = counts[rarity] / total;
        expect(Math.abs(actual - RATES[rarity])).toBeLessThan(0.01);
      }
    }
  });

  it('连续抽取(保底生效)时:SSR 有效出率 ≥ 配置值且偏差 < 1%', () => {
    const rng = mulberry32(42);
    const counts: Record<Rarity, number> = { N: 0, R: 0, SR: 0, SSR: 0 };
    let pity: PityState = zero;
    const total = 100_000;
    let maxSrGap = 0;
    let maxSsrGap = 0;
    let srGap = 0;
    let ssrGap = 0;
    for (let i = 0; i < total; i++) {
      const r = rollRarity(rng, pity);
      pity = r.pity;
      counts[r.rarity]++;
      srGap = r.rarity === 'SR' || r.rarity === 'SSR' ? 0 : srGap + 1;
      ssrGap = r.rarity === 'SSR' ? 0 : ssrGap + 1;
      maxSrGap = Math.max(maxSrGap, srGap);
      maxSsrGap = Math.max(maxSsrGap, ssrGap);
    }
    // 保底硬约束:间隔永不超过 50 / 100
    expect(maxSrGap).toBeLessThan(PITY_SR);
    expect(maxSsrGap).toBeLessThan(PITY_SSR);
    // 有效出率不低于基础值,且仍在 1% 偏差带内
    expect(counts.SSR / total).toBeGreaterThanOrEqual(RATES.SSR);
    expect(Math.abs(counts.SSR / total - RATES.SSR)).toBeLessThan(0.01);
    expect(Math.abs(counts.SR / total - RATES.SR)).toBeLessThan(0.01);
  });
});
