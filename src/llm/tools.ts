/**
 * 对话工具:天气/新闻/定时提醒。全部本地关键词识别触发,不依赖 LLM
 * (即使没配置 API Key 或断网,这三个工具依然可用)。
 */
import { invoke } from '@tauri-apps/api/core';
import { addReminder, parseReminder } from '../systems/reminders';

export interface ToolResult {
  handled: boolean;
  reply?: string;
}

const WEATHER_RE = /(.*?)(天气|weather)/i;
const NEWS_RE = /新闻|头条|news/i;

async function handleWeather(text: string, defaultCity: string): Promise<string> {
  const m = text.match(WEATHER_RE);
  let city = (m?.[1] ?? '').replace(/[的今天明天现在查询查一下看看]/g, '').trim();
  if (!city) city = defaultCity;
  try {
    const line = await invoke<string>('fetch_weather', { city });
    return `☁️ ${line}`;
  } catch {
    return `呜…没查到「${city}」的天气,换个城市名试试?`;
  }
}

async function handleNews(): Promise<string> {
  try {
    const titles = await invoke<string[]>('fetch_news');
    return `📰 今日头条:\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  } catch {
    return '呜…新闻没查到,可能是网络不太好~';
  }
}

async function handleRemind(text: string): Promise<string> {
  const parsed = parseReminder(text);
  if (!parsed) return '你想让我提醒你什么时候做什么呀?比如"下午3点提醒我喝水"~';
  await addReminder(parsed.dueAt, parsed.message);
  const due = new Date(parsed.dueAt);
  const hh = String(due.getHours()).padStart(2, '0');
  const mm = String(due.getMinutes()).padStart(2, '0');
  return `⏰ 记下啦!${hh}:${mm} 提醒你「${parsed.message}」`;
}

/** 依次尝试:定时提醒 → 天气 → 新闻。命中即处理并返回 handled=true,不再走 LLM。 */
export async function tryHandleTool(text: string, defaultCity: string): Promise<ToolResult> {
  if (/提醒我|提醒|记得|remind me/i.test(text)) {
    return { handled: true, reply: await handleRemind(text) };
  }
  if (WEATHER_RE.test(text)) {
    return { handled: true, reply: await handleWeather(text, defaultCity) };
  }
  if (NEWS_RE.test(text)) {
    return { handled: true, reply: await handleNews() };
  }
  return { handled: false };
}
