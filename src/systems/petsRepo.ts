/** 宠物仓库:档案 CRUD、出场切换、放生、部件图鉴解锁、旧存档迁移 */
import {
  generatePet,
  PERSONALITIES,
  SHARD_ON_DUP,
  partsKey,
  type GeneratedPet,
  type Rarity,
} from '../gen/generator';
import { newId, randomSeed } from '../gen/prng';
import { getDb, getSetting, setSetting, type PetRow } from './db';
import { addShards } from './currency';

export interface PetParts {
  seed: number;
  ids: Record<string, string>;
  effects: string[];
  colors: GeneratedPet['colors'];
}

export interface PetRecord extends PetRow {
  parts: PetParts;
}

export function parsePet(row: PetRow): PetRecord {
  return { ...row, parts: JSON.parse(row.parts_json) as PetParts };
}

export async function listPets(): Promise<PetRecord[]> {
  const rows = await getDb().select<PetRow[]>(
    'SELECT * FROM pets WHERE released = 0 ORDER BY created_at ASC'
  );
  return rows.map(parsePet);
}

export async function getPet(id: string): Promise<PetRecord | null> {
  const rows = await getDb().select<PetRow[]>('SELECT * FROM pets WHERE id = $1', [id]);
  return rows.length > 0 ? parsePet(rows[0]) : null;
}

/** 写入一只生成宠物,并点亮其部件图鉴 */
export async function insertGeneratedPet(gen: GeneratedPet): Promise<string> {
  const id = newId('pet');
  const parts: PetParts = { seed: gen.seed, ids: gen.ids, effects: gen.effects, colors: gen.colors };
  await getDb().execute(
    `INSERT INTO pets (id, name, rarity, species, parts_json, personality, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, gen.name, gen.rarity, gen.ids.species, JSON.stringify(parts), gen.personality, Date.now()]
  );
  await unlockParts([...Object.values(gen.ids), ...gen.effects], id);
  return id;
}

export async function unlockParts(partIds: string[], petId: string): Promise<void> {
  const dbx = getDb();
  for (const pid of partIds) {
    await dbx.execute(
      'INSERT OR IGNORE INTO unlocked_parts (part_id, first_pet_id, unlocked_at) VALUES ($1, $2, $3)',
      [pid, petId, Date.now()]
    );
  }
}

export async function unlockedPartIds(): Promise<Set<string>> {
  const rows = await getDb().select<Array<{ part_id: string }>>('SELECT part_id FROM unlocked_parts');
  return new Set(rows.map((r) => r.part_id));
}

export async function renamePet(id: string, name: string): Promise<void> {
  await getDb().execute('UPDATE pets SET name = $1 WHERE id = $2', [name.slice(0, 12), id]);
}

export async function addInteract(petId: string): Promise<void> {
  await getDb().execute('UPDATE pets SET interact_count = interact_count + 1 WHERE id = $1', [
    petId,
  ]);
}

/** 放生:返还与重复相同的碎片;出场中的宠物不可放生 */
export async function releasePet(id: string): Promise<number> {
  const pet = await getPet(id);
  if (!pet) return 0;
  const active = await getSetting('active_pet_id');
  if (active === id) throw new Error('active');
  await getDb().execute('UPDATE pets SET released = 1 WHERE id = $1', [id]);
  const shards = SHARD_ON_DUP[pet.rarity as Rarity] ?? 10;
  await addShards(shards, 'release');
  return shards;
}

export async function setActivePet(id: string): Promise<void> {
  await setSetting('active_pet_id', id);
}

/** 现有全部形态 key(重复判定用) */
export async function existingPartsKeys(): Promise<Set<string>> {
  const pets = await listPets();
  return new Set(pets.map((p) => partsKey(p.parts.ids, p.parts.effects)));
}

/**
 * 取出场宠物;兼容一期占位存档:parts_json 无 ids 字段时,
 * 原地迁移为一只正式生成的 N 级宠物(保留名字/性格/亲密度)。
 */
export async function getActivePetMigrated(): Promise<PetRecord> {
  const dbx = getDb();
  const activeId = await getSetting('active_pet_id');
  let row: PetRow | null = null;
  if (activeId) {
    const rows = await dbx.select<PetRow[]>('SELECT * FROM pets WHERE id = $1 AND released = 0', [
      activeId,
    ]);
    row = rows[0] ?? null;
  }
  if (!row) {
    const rows = await dbx.select<PetRow[]>('SELECT * FROM pets WHERE released = 0 LIMIT 1');
    row = rows[0] ?? null;
  }
  if (!row) {
    // 全新用户:送一只 N 级默认宠物
    const gen = generatePet('N', randomSeed());
    gen.name = '小星';
    const id = await insertGeneratedPet(gen);
    await setSetting('active_pet_id', id);
    return (await getPet(id))!;
  }

  const raw = JSON.parse(row.parts_json) as Partial<PetParts> & { placeholder?: boolean };
  if (!raw.ids) {
    const gen = generatePet('N', randomSeed());
    const parts: PetParts = {
      seed: gen.seed,
      ids: gen.ids,
      effects: gen.effects,
      colors: gen.colors,
    };
    await dbx.execute('UPDATE pets SET parts_json = $1, species = $2 WHERE id = $3', [
      JSON.stringify(parts),
      gen.ids.species,
      row.id,
    ]);
    await unlockParts(Object.values(gen.ids), row.id);
    row = { ...row, parts_json: JSON.stringify(parts), species: gen.ids.species };
  }
  if (!row.personality || !PERSONALITIES.includes(row.personality)) {
    row = { ...row, personality: PERSONALITIES[0] };
  }
  await setSetting('active_pet_id', row.id);
  return parsePet(row);
}
