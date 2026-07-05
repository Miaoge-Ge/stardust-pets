import { describe, expect, it } from 'vitest';
import {
  PITY_SR,
  PITY_SSR,
  PITY_UR,
  RATES,
  rollRarity,
  rollTen,
  type PityState,
  type Rarity,
} from '../src/gen/generator';
import { mulberry32 } from '../src/gen/prng';

const zero: PityState = { sr: 0, ssr: 0, ur: 0 };

/** 恒返回指定值的 rng */
const fixed = (v: number) => () => v;
/** 永远掷出 N 的 rng(0.999 落在 N 区间) */
const alwaysN = fixed(0.999);

describe('三重保底边界', () => {
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
    expect(r50.pity.sr).toBe(0);
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
    expect(r100.pity.ur).toBe(100); // UR 计数继续推进
  });

  it('第 200 抽必得 UR,且三计数全部重置', () => {
    let pity: PityState = zero;
    for (let i = 1; i <= 199; i++) {
      pity = rollRarity(alwaysN, pity).pity;
    }
    expect(pity.ur).toBe(199);
    const r200 = rollRarity(alwaysN, pity);
    expect(r200.rarity).toBe('UR');
    expect(r200.pity).toEqual({ sr: 0, ssr: 0, ur: 0 });
  });

  it('自然掷出 UR:重置全部计数', () => {
    const r = rollRarity(fixed(0.001), { sr: 30, ssr: 70, ur: 150 });
    expect(r.rarity).toBe('UR');
    expect(r.pity).toEqual({ sr: 0, ssr: 0, ur: 0 });
  });

  it('自然掷出 SSR:重置 SR/SSR,UR 计数继续', () => {
    const r = rollRarity(fixed(RATES.UR + 0.001), { sr: 30, ssr: 70, ur: 150 });
    expect(r.rarity).toBe('SSR');
    expect(r.pity).toEqual({ sr: 0, ssr: 0, ur: 151 });
  });

  it('SR 出货只重置 SR 计数', () => {
    const r = rollRarity(fixed(RATES.UR + RATES.SSR + 0.001), { sr: 10, ssr: 60, ur: 120 });
    expect(r.rarity).toBe('SR');
    expect(r.pity).toEqual({ sr: 0, ssr: 61, ur: 121 });
  });

  it('十连:前 9 抽全 N 时第 10 抽强制 ≥R', () => {
    const { rarities } = rollTen(alwaysN, zero);
    expect(rarities.slice(0, 9).every((r) => r === 'N')).toBe(true);
    expect(rarities[9]).not.toBe('N');
  });

  it('十连跨保底:pity 从 45 开始,第 5 抽命中 SR 保底', () => {
    const { rarities, pity } = rollTen(alwaysN, { sr: 45, ssr: 0, ur: 0 });
    expect(rarities[4]).toBe('SR');
    expect(pity.sr).toBe(5);
    expect(pity.ssr).toBe(10);
    expect(pity.ur).toBe(10);
  });
});

describe('蒙特卡洛:10000 抽 × 10 轮出率偏差 < 1%', () => {
  it('无保底干预时符合配置概率(五档)', () => {
    for (let round = 0; round < 10; round++) {
      const rng = mulberry32(1234 + round);
      const counts: Record<Rarity, number> = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
      const total = 10000;
      for (let i = 0; i < total; i++) {
        counts[rollRarity(rng, zero).rarity]++;
      }
      for (const rarity of ['N', 'R', 'SR', 'SSR', 'UR'] as Rarity[]) {
        const actual = counts[rarity] / total;
        expect(Math.abs(actual - RATES[rarity])).toBeLessThan(0.01);
      }
    }
  });

  it('连续抽取(保底生效):间隔硬约束 + 有效出率不低于基础值', () => {
    const rng = mulberry32(42);
    const counts: Record<Rarity, number> = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
    let pity: PityState = zero;
    const total = 100_000;
    let srGap = 0, ssrGap = 0, urGap = 0;
    let maxSrGap = 0, maxSsrGap = 0, maxUrGap = 0;
    const geSR: Rarity[] = ['SR', 'SSR', 'UR'];
    const geSSR: Rarity[] = ['SSR', 'UR'];
    for (let i = 0; i < total; i++) {
      const r = rollRarity(rng, pity);
      pity = r.pity;
      counts[r.rarity]++;
      srGap = geSR.includes(r.rarity) ? 0 : srGap + 1;
      ssrGap = geSSR.includes(r.rarity) ? 0 : ssrGap + 1;
      urGap = r.rarity === 'UR' ? 0 : urGap + 1;
      maxSrGap = Math.max(maxSrGap, srGap);
      maxSsrGap = Math.max(maxSsrGap, ssrGap);
      maxUrGap = Math.max(maxUrGap, urGap);
    }
    expect(maxSrGap).toBeLessThan(PITY_SR);
    expect(maxSsrGap).toBeLessThan(PITY_SSR);
    expect(maxUrGap).toBeLessThan(PITY_UR);
    expect(Math.abs(counts.SR / total - RATES.SR)).toBeLessThan(0.01);
    expect(Math.abs(counts.SSR / total - RATES.SSR)).toBeLessThan(0.01);
    expect(Math.abs(counts.UR / total - RATES.UR)).toBeLessThan(0.01);
  });
});
