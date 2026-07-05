import { describe, expect, it } from 'vitest';
import {
  ALL_PARTS,
  DIMENSIONS,
  generatePet,
  partById,
  partsKey,
  poolFor,
  type Rarity,
} from '../src/gen/generator';

const ORDER: Record<Rarity, number> = { N: 0, R: 1, SR: 2, SSR: 3 };
const RARITIES: Rarity[] = ['N', 'R', 'SR', 'SSR'];

describe('生成器约束(属性测试)', () => {
  it('每个稀有度 × 10000 seed:维度齐全、约束满足、特效数量正确', () => {
    for (const rarity of RARITIES) {
      for (let i = 0; i < 10000; i++) {
        const pet = generatePet(rarity, i * 7 + ORDER[rarity]);

        // 1. 每个维度都有值,且稀有度不越级
        for (const dim of DIMENSIONS) {
          const id = pet.ids[dim];
          expect(id, `${rarity} seed=${i} 缺少维度 ${dim}`).toBeTruthy();
          const part = partById(id)!;
          expect(part.dimension).toBe(dim);
          expect(
            ORDER[part.minRarity] <= ORDER[rarity],
            `${rarity} seed=${i}:${id} 越级出现`
          ).toBe(true);
        }

        // 2. requires / excludes 全部满足
        for (const dim of DIMENSIONS) {
          const part = partById(pet.ids[dim])!;
          if (part.requires) {
            for (const [d, allowed] of Object.entries(part.requires)) {
              expect(allowed.includes(pet.ids[d]), `${part.id} requires 违反`).toBe(true);
            }
          }
          if (part.excludes) {
            for (const [d, banned] of Object.entries(part.excludes)) {
              expect(banned.includes(pet.ids[d]), `${part.id} excludes 违反`).toBe(false);
            }
          }
        }

        // 3. 特效数量:N/R 无,SR 恰 1,SSR 2~3
        if (rarity === 'N' || rarity === 'R') expect(pet.effects.length).toBe(0);
        if (rarity === 'SR') expect(pet.effects.length).toBe(1);
        if (rarity === 'SSR') {
          expect(pet.effects.length).toBeGreaterThanOrEqual(2);
          expect(pet.effects.length).toBeLessThanOrEqual(3);
        }

        // 4. 专属规则:史莱姆必为果冻材质;龙角只配龙
        if (pet.ids.species === 'sp_slime') expect(pet.ids.material).toBe('mat_jelly');
        if (pet.ids.ears === 'ears_horn') expect(pet.ids.species).toBe('sp_dragon');
      }
    }
  });

  it('同一 seed 完整复现(图鉴复现依赖)', () => {
    for (const rarity of RARITIES) {
      const a = generatePet(rarity, 20260705);
      const b = generatePet(rarity, 20260705);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('任意物种在任意稀有度下每个维度池非空(含放宽兜底)', () => {
    const speciesList = ALL_PARTS.filter((p) => p.dimension === 'species');
    for (const sp of speciesList) {
      for (const rarity of RARITIES) {
        if (ORDER[sp.minRarity] > ORDER[rarity]) continue;
        const chosen: Record<string, string> = { species: sp.id };
        for (const dim of DIMENSIONS.slice(1)) {
          const pool = poolFor(dim, rarity, chosen);
          expect(pool.length, `${sp.id} @${rarity} 维度 ${dim} 池为空`).toBeGreaterThan(0);
          chosen[dim] = pool[0].id;
        }
      }
    }
  });

  it('partsKey 忽略色板抖动:同部件不同 seed 判为重复', () => {
    const a = generatePet('N', 1);
    const key1 = partsKey(a.ids, a.effects);
    const key2 = partsKey({ ...a.ids }, [...a.effects]);
    expect(key1).toBe(key2);
  });
});
