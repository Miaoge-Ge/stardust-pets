/**
 * 记忆系统:
 *  - 短期:owner_memory(type='short'),当日互动/对话流水
 *  - 长期:owner_memory(type='long'),每日由 LLM 压缩生成,importance 1~5
 *  - 检索:字符 bigram 重合 + 重要度 + 新近度打分取 Top5(本地零成本)
 * 记忆归属主人:所有宠物共享。
 */
import { getDb, getSetting, setSetting, today } from './db';

export interface MemoryRow {
  id: number;
  type: 'short' | 'long';
  content: string;
  importance: number;
  created_at: number;
}

export async function addShortMemory(content: string): Promise<void> {
  await getDb().execute(
    "INSERT INTO owner_memory (type, content, importance, created_at) VALUES ('short', $1, 2, $2)",
    [content.slice(0, 200), Date.now()]
  );
}

export async function addLongMemory(content: string, importance: number): Promise<void> {
  await getDb().execute(
    "INSERT INTO owner_memory (type, content, importance, created_at) VALUES ('long', $1, $2, $3)",
    [content.slice(0, 200), Math.min(5, Math.max(1, importance)), Date.now()]
  );
}

/** 今日短期记忆(注入对话 prompt 的"今天发生的事") */
export async function todayShorts(limit = 12): Promise<string[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await getDb().select<MemoryRow[]>(
    "SELECT * FROM owner_memory WHERE type = 'short' AND created_at >= $1 ORDER BY id DESC LIMIT $2",
    [start.getTime(), limit]
  );
  return rows.reverse().map((r) => r.content);
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  const t = s.replace(/\s/g, '');
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

/** 检索相关长期记忆:重合度 + 重要度 + 新近度 */
export async function retrieveLongMemories(query: string, topN = 5): Promise<MemoryRow[]> {
  const rows = await getDb().select<MemoryRow[]>(
    "SELECT * FROM owner_memory WHERE type = 'long' ORDER BY id DESC LIMIT 200"
  );
  if (rows.length === 0) return [];
  const qb = bigrams(query);
  const now = Date.now();
  const scored = rows.map((r) => {
    const mb = bigrams(r.content);
    let overlap = 0;
    for (const b of qb) if (mb.has(b)) overlap++;
    const ageDays = (now - r.created_at) / 86400_000;
    const recency = Math.max(0, 2 - ageDays / 15);
    return { r, score: overlap * 1.5 + r.importance * 0.8 + recency };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, topN).filter((s) => s.score > 0.5).map((s) => s.r);
  if (picked.length > 0) {
    const ids = picked.map((p) => p.id).join(',');
    await getDb().execute(`UPDATE owner_memory SET last_referenced_at = ${Date.now()} WHERE id IN (${ids})`);
  }
  return picked;
}

/** 待压缩的历史短期记忆(今天之前的) */
export async function pendingShortsBeforeToday(): Promise<MemoryRow[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return getDb().select<MemoryRow[]>(
    "SELECT * FROM owner_memory WHERE type = 'short' AND created_at < $1 ORDER BY id ASC LIMIT 100",
    [start.getTime()]
  );
}

/** 压缩完成:写入长期记忆、删除已压缩短期、超量淘汰 */
export async function finishCompression(
  summaries: Array<{ content: string; importance: number }>,
  consumedIds: number[]
): Promise<void> {
  for (const s of summaries.slice(0, 3)) {
    await addLongMemory(s.content, s.importance);
  }
  if (consumedIds.length > 0) {
    await getDb().execute(
      `DELETE FROM owner_memory WHERE id IN (${consumedIds.join(',')})`
    );
  }
  // 长期记忆超过 200 条:按 重要度×时间衰减 淘汰最弱的
  const rows = await getDb().select<MemoryRow[]>(
    "SELECT * FROM owner_memory WHERE type = 'long'"
  );
  if (rows.length > 200) {
    const now = Date.now();
    const scored = rows
      .map((r) => ({ id: r.id, w: r.importance * Math.exp(-(now - r.created_at) / (60 * 86400_000)) }))
      .sort((a, b) => a.w - b.w);
    const drop = scored.slice(0, rows.length - 200).map((s) => s.id);
    await getDb().execute(`DELETE FROM owner_memory WHERE id IN (${drop.join(',')})`);
  }
}

export async function lastCompressDate(): Promise<string | null> {
  return getSetting('last_compress_date');
}

export async function markCompressed(): Promise<void> {
  await setSetting('last_compress_date', today());
}
