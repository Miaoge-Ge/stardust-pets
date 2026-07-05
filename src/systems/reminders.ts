/**
 * 定时提醒:纯本地实现,不联网、不依赖 LLM。提醒列表存在 settings 表(JSON),
 * 每分钟检查一次到期项,到点弹桌面通知 + 宠物举牌。
 */
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { getSetting, setSetting } from './db';

export interface Reminder {
  id: number;
  dueAt: number; // epoch ms
  message: string;
}

const KEY = 'pending_reminders';

async function loadAll(): Promise<Reminder[]> {
  const raw = await getSetting(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Reminder[];
  } catch {
    return [];
  }
}

async function saveAll(list: Reminder[]): Promise<void> {
  await setSetting(KEY, JSON.stringify(list));
}

export async function addReminder(dueAt: number, message: string): Promise<Reminder> {
  const list = await loadAll();
  const reminder: Reminder = { id: Date.now() + Math.floor(Math.random() * 1000), dueAt, message };
  list.push(reminder);
  list.sort((a, b) => a.dueAt - b.dueAt);
  await saveAll(list);
  return reminder;
}

export async function listReminders(): Promise<Reminder[]> {
  return loadAll();
}

async function ensureNotifyPermission(): Promise<boolean> {
  if (await isPermissionGranted()) return true;
  const perm = await requestPermission();
  return perm === 'granted';
}

/**
 * 每分钟调用一次:检查到期提醒,弹桌面通知,触发回调(用于宠物举牌),并从列表移除。
 * 返回本次触发的提醒列表(可能为空)。
 */
export async function checkDueReminders(): Promise<Reminder[]> {
  const list = await loadAll();
  const now = Date.now();
  const due = list.filter((r) => r.dueAt <= now);
  if (due.length === 0) return [];
  const remaining = list.filter((r) => r.dueAt > now);
  await saveAll(remaining);

  if (await ensureNotifyPermission()) {
    for (const r of due) {
      sendNotification({ title: '星屑伙伴 · 定时提醒', body: r.message });
    }
  }
  return due;
}

// ---------------------------------------------------------------- 自然语言时间解析(纯本地,不需要 LLM)

const TRIGGER_RE = /提醒我|提醒|记得|remind me/i;

export interface ParsedReminder {
  dueAt: number;
  message: string;
}

/**
 * 从聊天文本中解析"提醒"意图。支持:
 *  - HH:MM(24 小时制,如 "15:30 提醒我喝水")
 *  - 中文时段+点数(如 "下午3点提醒我开会" "晚上8点半提醒我睡觉" "3点提醒我")
 *  - "N 分钟后 / N 小时后"相对时间
 * 未识别到触发词或时间时返回 null,交由上层走普通聊天/LLM 流程。
 */
export function parseReminder(text: string): ParsedReminder | null {
  if (!TRIGGER_RE.test(text)) return null;
  const now = new Date();

  // 相对时间:N 分钟后 / N 小时后
  const relMin = text.match(/(\d+)\s*分钟后/);
  const relHour = text.match(/(\d+)\s*小时后/);
  if (relMin || relHour) {
    const ms = relMin ? Number(relMin[1]) * 60_000 : Number(relHour![1]) * 3600_000;
    const dueAt = Date.now() + ms;
    const message = cleanMessage(text);
    return { dueAt, message };
  }

  // HH:MM
  const hm = text.match(/([01]?\d|2[0-3]):([0-5]\d)/);
  // 中文时段 + N点(半)
  const cn = text.match(/(上午|下午|早上|晚上|中午)?\s*(\d{1,2})\s*点\s*(半)?/);

  let hour: number | null = null;
  let minute = 0;
  if (hm) {
    hour = Number(hm[1]);
    minute = Number(hm[2]);
  } else if (cn) {
    hour = Number(cn[2]);
    minute = cn[3] ? 30 : 0;
    const period = cn[1];
    if ((period === '下午' || period === '晚上') && hour < 12) hour += 12;
    if (period === '中午' && hour < 12) hour += 12;
  }
  if (hour === null || hour > 23) return null;

  const due = new Date(now);
  due.setHours(hour, minute, 0, 0);
  if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1); // 已过今天这个点,顺延到明天

  return { dueAt: due.getTime(), message: cleanMessage(text) };
}

function cleanMessage(text: string): string {
  let m = text
    .replace(TRIGGER_RE, '')
    .replace(/([01]?\d|2[0-3]):([0-5]\d)/, '')
    .replace(/(上午|下午|早上|晚上|中午)?\s*\d{1,2}\s*点\s*半?/, '')
    .replace(/\d+\s*(分钟|小时)后/, '')
    .replace(/^[的\s,,:.]+|[的\s,,:.]+$/g, '')
    .trim();
  if (!m) m = '该做事啦';
  return m;
}
