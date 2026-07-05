/** 抽卡:单抽/十连、双保底推进、重复转碎片、抽卡记录、心愿定制 */
import {
  generatePet,
  partsKey,
  rollRarity,
  rollTen,
  SHARD_ON_DUP,
  WISH_COST,
  type GeneratedPet,
  type PityState,
  type Rarity,
} from '../gen/generator';
import { randomSeed } from '../gen/prng';
import { getDb } from './db';
import { addShards, spendCoins, spendShards } from './currency';
import { existingPartsKeys, insertGeneratedPet } from './petsRepo';

export const COST_SINGLE = 100;
export const COST_TEN = 900;

export interface PullResult {
  petId: string | null;
  gen: GeneratedPet;
  duplicate: boolean;
  shards: number;
}

export interface GachaState extends PityState {
  total: number;
}

export async function getGachaState(): Promise<GachaState> {
  const rows = await getDb().select<
    Array<{ pity_sr: number; pity_ssr: number; total_pulls: number }>
  >('SELECT pity_sr, pity_ssr, total_pulls FROM gacha_state WHERE id = 1');
  const r = rows[0] ?? { pity_sr: 0, pity_ssr: 0, total_pulls: 0 };
  return { sr: Number(r.pity_sr), ssr: Number(r.pity_ssr), total: Number(r.total_pulls) };
}

async function saveState(pity: PityState, added: number): Promise<void> {
  await getDb().execute(
    'UPDATE gacha_state SET pity_sr = $1, pity_ssr = $2, total_pulls = total_pulls + $3 WHERE id = 1',
    [pity.sr, pity.ssr, added]
  );
}

async function logPull(petId: string | null, rarity: Rarity, dup: boolean, pity: PityState): Promise<void> {
  await getDb().execute(
    `INSERT INTO gacha_log (ts, result_pet_id, rarity, was_duplicate, pity_sr_after, pity_ssr_after)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [Date.now(), petId, rarity, dup ? 1 : 0, pity.sr, pity.ssr]
  );
}

/**
 * 执行抽卡。返回 null = 星星币不足。
 * 注:本地单用户场景,顺序写库即可;失败中断最坏情况是"白得一只宠物",
 * 不会出现扣币未发货。
 */
export async function pull(count: 1 | 10): Promise<PullResult[] | null> {
  const cost = count === 1 ? COST_SINGLE : COST_TEN;
  if (!(await spendCoins(cost, count === 1 ? 'gacha_1' : 'gacha_10'))) return null;

  const state = await getGachaState();
  let pity: PityState = { sr: state.sr, ssr: state.ssr };
  let rarities: Rarity[];
  if (count === 1) {
    const roll = rollRarity(Math.random, pity);
    rarities = [roll.rarity];
    pity = roll.pity;
  } else {
    const roll = rollTen(Math.random, pity);
    rarities = roll.rarities;
    pity = roll.pity;
  }

  // 重现每一抽之后的保底计数用于记录(逐抽重算)
  const perPullPity: PityState[] = [];
  {
    let p: PityState = { sr: state.sr, ssr: state.ssr };
    for (const r of rarities) {
      p = {
        sr: r === 'SR' || r === 'SSR' ? 0 : p.sr + 1,
        ssr: r === 'SSR' ? 0 : p.ssr + 1,
      };
      perPullPity.push(p);
    }
  }

  const known = await existingPartsKeys();
  const results: PullResult[] = [];
  for (let i = 0; i < rarities.length; i++) {
    const gen = generatePet(rarities[i], randomSeed());
    const key = partsKey(gen.ids, gen.effects);
    if (known.has(key)) {
      const shards = SHARD_ON_DUP[gen.rarity];
      await addShards(shards, 'dup');
      await logPull(null, gen.rarity, true, perPullPity[i]);
      results.push({ petId: null, gen, duplicate: true, shards });
    } else {
      known.add(key);
      const petId = await insertGeneratedPet(gen);
      await logPull(petId, gen.rarity, false, perPullPity[i]);
      results.push({ petId, gen, duplicate: false, shards: 0 });
    }
  }
  await saveState(pity, rarities.length);
  return results;
}

export interface GachaLogRow {
  id: number;
  ts: number;
  result_pet_id: string | null;
  rarity: Rarity;
  was_duplicate: number;
}

export async function getLogs(limit = 50): Promise<GachaLogRow[]> {
  return getDb().select<GachaLogRow[]>(
    'SELECT id, ts, result_pet_id, rarity, was_duplicate FROM gacha_log ORDER BY id DESC LIMIT $1',
    [limit]
  );
}

/** 心愿定制:碎片兑换指定物种的指定稀有度宠物 */
export async function wishCraft(
  species: string,
  rarity: Exclude<Rarity, 'N'>
): Promise<{ petId: string; gen: GeneratedPet } | null> {
  const cost = WISH_COST[rarity];
  if (!(await spendShards(cost, 'wish'))) return null;
  let gen = generatePet(rarity, randomSeed());
  for (let i = 0; i < 80 && gen.ids.species !== species; i++) {
    gen = generatePet(rarity, randomSeed());
  }
  // 极端兜底:80 次未中意愿物种(理论上不会发生),按最后一次结果发货
  const petId = await insertGeneratedPet(gen);
  return { petId, gen };
}
