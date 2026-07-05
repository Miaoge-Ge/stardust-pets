/**
 * 窗口上下文感知(隐私:仅读活动窗口标题,本地匹配场景标签;
 * 调 LLM 主动搭话时只发送标签,原始标题不出内存)。
 *  - 连续活跃 ≥60 分钟 → 健康提醒(空闲 ≥5 分钟视为休息,计时清零)
 *  - 23:00~05:00 → 困倦提醒(30 分钟冷却)
 *  - Lv5+ 主动搭话:标题变化 → 场景标签,30 分钟冷却、每日 ≤5 次
 */

const SCENES: Array<{ tag: string; keys: string[] }> = [
  { tag: '在写代码', keys: ['visual studio', 'vs code', 'vscode', 'intellij', 'pycharm', 'webstorm', 'terminal', 'powershell', 'github', '.ts', '.py', '.rs', 'cargo'] },
  { tag: '在写文档', keys: ['word', 'docs', 'notion', 'obsidian', 'wps', '论文', '.md', 'typora', '语雀'] },
  { tag: '在开会', keys: ['zoom', 'teams', '腾讯会议', 'meet', 'webex'] },
  { tag: '在看视频', keys: ['bilibili', 'youtube', '爱奇艺', '优酷', 'netflix', '腾讯视频', '哔哩哔哩'] },
  { tag: '在打游戏', keys: ['steam', '原神', 'league', 'minecraft', 'dota', 'valorant', '崩坏'] },
  { tag: '在网购', keys: ['淘宝', '京东', 'taobao', 'jd.com', '拼多多', 'amazon'] },
  { tag: '在聊天', keys: ['微信', 'wechat', 'qq', 'telegram', 'discord', 'slack'] },
];

export function matchScene(title: string): string | null {
  const t = title.toLowerCase();
  for (const s of SCENES) {
    if (s.keys.some((k) => t.includes(k))) return s.tag;
  }
  return null;
}

export interface SenseDeps {
  enabled(): Promise<boolean>;
  proactiveReady(): Promise<boolean>; // Lv5+ 且开关开启
  getIdleSeconds(): Promise<number>;
  getActiveTitle(): Promise<string | null>;
  onHealthRemind(): void;
  onLateNight(): void;
  onProactive(tag: string): void;
}

const TICK_MS = 30_000;
const WORK_LIMIT_MS = 60 * 60_000;
const REMIND_COOLDOWN_MS = 30 * 60_000;
const LATE_COOLDOWN_MS = 30 * 60_000;
const PROACTIVE_COOLDOWN_MS = 30 * 60_000;
const PROACTIVE_DAILY_MAX = 5;

let workMs = 0;
let lastRemindAt = 0;
let lastLateAt = 0;
let lastProactiveAt = 0;
let proactiveDate = '';
let proactiveCount = 0;
let lastTag: string | null = null;

/** 健康任务完成后调用:重新累计工作时长 */
export function resetWorkTimer(): void {
  workMs = 0;
}

export function initWindowSense(deps: SenseDeps): void {
  setInterval(() => void tick(deps), TICK_MS);
}

async function tick(deps: SenseDeps): Promise<void> {
  try {
    if (!(await deps.enabled())) return;
    const now = Date.now();
    const idle = await deps.getIdleSeconds();

    // 连续工作累计
    if (idle < 300) workMs += TICK_MS;
    else workMs = 0;
    if (workMs >= WORK_LIMIT_MS && now - lastRemindAt > REMIND_COOLDOWN_MS) {
      lastRemindAt = now;
      deps.onHealthRemind();
    }

    // 深夜困倦
    const hour = new Date().getHours();
    if ((hour >= 23 || hour < 5) && idle < 300 && now - lastLateAt > LATE_COOLDOWN_MS) {
      lastLateAt = now;
      deps.onLateNight();
    }

    // 主动搭话
    if (now - lastProactiveAt > PROACTIVE_COOLDOWN_MS && (await deps.proactiveReady())) {
      const dateStr = new Date().toDateString();
      if (dateStr !== proactiveDate) {
        proactiveDate = dateStr;
        proactiveCount = 0;
      }
      if (proactiveCount < PROACTIVE_DAILY_MAX) {
        const title = await deps.getActiveTitle();
        const tag = title ? matchScene(title) : null;
        if (tag && tag !== lastTag) {
          lastTag = tag;
          lastProactiveAt = now;
          proactiveCount++;
          deps.onProactive(tag);
        }
      }
    }
  } catch {
    // 感知失败静默跳过,下个周期重试
  }
}
