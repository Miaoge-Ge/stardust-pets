import { describe, expect, it } from 'vitest';
import {
  applyDecay,
  applyPoints,
  pointsFor,
  toneForLevel,
  MAX_LEVEL,
} from '../src/systems/intimacyCore';

describe('亲密度:加点与升级', () => {
  it('普通加点不升级', () => {
    const r = applyPoints({ level: 1, points: 50 }, 5);
    expect(r.state).toEqual({ level: 1, points: 55 });
    expect(r.leveledUp).toEqual([]);
  });

  it('溢出进位升级,余点保留', () => {
    const r = applyPoints({ level: 2, points: 98 }, 5);
    expect(r.state).toEqual({ level: 3, points: 3 });
    expect(r.leveledUp).toEqual([3]);
  });

  it('一次大额加点可连升多级', () => {
    const r = applyPoints({ level: 1, points: 0 }, 250);
    expect(r.state.level).toBe(3);
    expect(r.state.points).toBe(50);
    expect(r.leveledUp).toEqual([2, 3]);
  });

  it('满级封顶不再进位', () => {
    const r = applyPoints({ level: MAX_LEVEL, points: 95 }, 50);
    expect(r.state.level).toBe(MAX_LEVEL);
    expect(r.state.points).toBeLessThanOrEqual(100);
    expect(r.leveledUp).toEqual([]);
  });
});

describe('亲密度:衰减', () => {
  it('离开 1~2 天不衰减', () => {
    expect(applyDecay({ level: 5, points: 40 }, 1)).toEqual({ level: 5, points: 40 });
    expect(applyDecay({ level: 5, points: 40 }, 2)).toEqual({ level: 5, points: 40 });
  });

  it('第 3 天起每日 -10', () => {
    expect(applyDecay({ level: 5, points: 40 }, 3)).toEqual({ level: 5, points: 30 });
    expect(applyDecay({ level: 5, points: 40 }, 5)).toEqual({ level: 5, points: 10 });
  });

  it('只扣到本级 0 点,不降级', () => {
    const r = applyDecay({ level: 5, points: 25 }, 30);
    expect(r).toEqual({ level: 5, points: 0 });
  });
});

describe('亲密度:每日上限', () => {
  it('摸头前 10 次 +2,第 11 次 0', () => {
    expect(pointsFor('pet_count', 1)).toBe(2);
    expect(pointsFor('pet_count', 10)).toBe(2);
    expect(pointsFor('pet_count', 11)).toBe(0);
  });

  it('喂食 3 次上限、聊天 5 次上限、健康 3 次上限', () => {
    expect(pointsFor('feed_count', 3)).toBe(5);
    expect(pointsFor('feed_count', 4)).toBe(0);
    expect(pointsFor('chat_count', 5)).toBe(3);
    expect(pointsFor('chat_count', 6)).toBe(0);
    expect(pointsFor('health_count', 3)).toBe(5);
    expect(pointsFor('health_count', 4)).toBe(0);
  });
});

describe('亲密度:语气注入', () => {
  it('不同等级段语气描述可感知不同(验收项)', () => {
    const tones = [1, 3, 5, 7, 10].map(toneForLevel);
    expect(new Set(tones).size).toBe(5);
    expect(tones[0]).toContain('客气');
    expect(tones[4]).toContain('家人');
  });
});
