import { invoke } from '@tauri-apps/api/core';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { emit, listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { currentMonitor, getCurrentWindow, primaryMonitor } from '@tauri-apps/api/window';

import { lookFromParts } from './engine/frames';
import type { Look } from './engine/petArt';
import { PetView, PET_FOOT_Y } from './engine/renderer';
import { DEFS, Machine, type Host, type StateName } from './fsm/machine';
import { bumpDaily, getDb, getSetting, initDb, setSetting } from './systems/db';
import {
  addCoins,
  dailyCheckin,
  getBalance,
  maybeTaskReward,
  tickIdleEarning,
  type CoinEvent,
} from './systems/currency';
import { addInteract, getActivePetMigrated, type PetRecord } from './systems/petsRepo';
import {
  applyDecayOnBoot,
  dailyLaunchBonus,
  gainBySource,
  type IntimacyGain,
} from './systems/intimacy';
import { LEVEL_UNLOCKS } from './systems/intimacyCore';
import {
  addShortMemory,
  finishCompression,
  lastCompressDate,
  markCompressed,
  pendingShortsBeforeToday,
  retrieveLongMemories,
  todayShorts,
} from './systems/memory';
import { initWindowSense, resetWorkTimer } from './systems/windowSense';
import { llmChat, llmConfigured, type ChatMsg } from './llm/client';
import {
  buildChatSystem,
  buildCompressionMsgs,
  buildNicknameMsgs,
  buildProactiveMsgs,
  parseCompression,
  PROACTIVE_FALLBACK,
  type PromptCtx,
} from './llm/prompt';
import {
  CHAT_LINES,
  FEED_FULL_LINE,
  FEED_LINES,
  GREET_LINES,
  PRIVACY_NOTE,
  pick,
} from './llm/fallbackLines';
import {
  closeMenu,
  isMenuOpen,
  openBubble,
  openMenu,
  setOverlayListener,
  showActionSign,
  showSign,
} from './ui/overlay';

interface ActiveWin {
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const win = getCurrentWindow();
const stageEl = document.getElementById('stage')!;

// ---------------------------------------------------------------- 全局状态

let pet: PetRecord;
let view: PetView;
let machine: Machine;

let scale = 1;
let sizeW = 260 * 1.25;
let sizeH = 300 * 1.25;
let mon = { x: 0, y: 0, w: 1920, h: 1080 };

let posX = 0;
let posY = 0;
let groundX = 0;
let groundY = 0;

let lastInteract = Date.now();
let dragging = false;
let overlayActive = false;
let savedPos = '';

let climbTarget: { x: number; y: number; title: string; wx: number; wy: number } | null = null;

// ---------------------------------------------------------------- 窗口移动

function applyPos(): void {
  void win.setPosition(new PhysicalPosition(Math.round(posX), Math.round(posY)));
}

function setPos(x: number, y: number): void {
  posX = x;
  posY = y;
  applyPos();
}

function clampX(x: number): number {
  return Math.min(Math.max(x, mon.x), mon.x + mon.w - sizeW);
}

function feetPhys(): number {
  return Math.round(PET_FOOT_Y * scale);
}

// ---------------------------------------------------------------- 点击穿透 hitbox

function reportHitbox(): void {
  const full = overlayActive || dragging;
  // 宠物缩小到 88px 后的包围盒(含少量余量)
  void invoke('update_hitbox', { x: 78, y: 184, w: 104, h: 102, full });
}

// ---------------------------------------------------------------- FSM Host

const host: Host = {
  setAnim: (key, fps) => view.setAnim(key, fps),
  setFlip: (dir) => view.setFlip(dir),

  moveBy(dxLogical) {
    const nx = posX + dxLogical * scale;
    const clamped = clampX(nx);
    posX = clamped;
    applyPos();
    return clamped !== nx ? 'edge' : 'ok';
  },

  async climbPrepare() {
    try {
      const info = await invoke<ActiveWin | null>('get_active_window_info');
      if (!info || !info.title) return false;
      if (info.w < sizeW * 0.8) return false;
      const targetY = Math.round(info.y) - feetPhys();
      if (targetY < mon.y - 20) return false;
      if (targetY > posY) return false;
      const targetX = clampX(Math.round(info.x + info.w / 2 - sizeW / 2));
      groundX = posX;
      groundY = posY;
      climbTarget = { x: targetX, y: targetY, title: info.title, wx: info.x, wy: info.y };
      return true;
    } catch {
      return false;
    }
  },

  climbStep(dtMs) {
    if (!climbTarget) return 'fail';
    const hStep = (240 * scale * dtMs) / 1000;
    const vStep = (300 * scale * dtMs) / 1000;
    if (Math.abs(posX - climbTarget.x) > 3) {
      const dir = climbTarget.x > posX ? 1 : -1;
      view.setFlip(dir as 1 | -1);
      posX = dir > 0 ? Math.min(posX + hStep, climbTarget.x) : Math.max(posX - hStep, climbTarget.x);
      applyPos();
      return 'moving';
    }
    if (Math.abs(posY - climbTarget.y) > 3) {
      posY = climbTarget.y > posY ? Math.min(posY + vStep, climbTarget.y) : Math.max(posY - vStep, climbTarget.y);
      applyPos();
      return 'moving';
    }
    setPos(climbTarget.x, climbTarget.y);
    return 'done';
  },

  async climbCheck() {
    if (!climbTarget) return false;
    try {
      const info = await invoke<ActiveWin | null>('get_active_window_info');
      if (!info) return false;
      return (
        info.title === climbTarget.title &&
        Math.abs(info.x - climbTarget.wx) < 8 &&
        Math.abs(info.y - climbTarget.wy) < 8
      );
    } catch {
      return false;
    }
  },

  descendStep(dtMs) {
    const vStep = (520 * scale * dtMs) / 1000;
    const hStep = (240 * scale * dtMs) / 1000;
    let arrived = true;
    if (Math.abs(posY - groundY) > 3) {
      posY = groundY > posY ? Math.min(posY + vStep, groundY) : Math.max(posY - vStep, groundY);
      arrived = false;
    }
    if (Math.abs(posX - groundX) > 3) {
      const dir = groundX > posX ? 1 : -1;
      posX = dir > 0 ? Math.min(posX + hStep, groundX) : Math.max(posX - hStep, groundX);
      arrived = false;
    }
    applyPos();
    if (arrived) {
      setPos(groundX, groundY);
      climbTarget = null;
    }
    return arrived;
  },

  rememberGround() {
    groundX = posX;
    groundY = posY;
  },

  lastInteractAt: () => lastInteract,

  intimacyLevel: () => pet?.intimacy_level ?? 1,

  onStateChange(name: StateName) {
    const airborne =
      name === 'climb_window' || name === 'sit_on_window' || name === 'jump_down' || name === 'drag_struggle';
    view.setShadowVisible(!airborne);
  },
};

// ---------------------------------------------------------------- 形态(含 Lv10 隐藏特效)

function buildLook(p: PetRecord): Look {
  const look = lookFromParts(p.parts.ids, p.parts.effects, p.parts.colors);
  if (p.intimacy_level >= 10) {
    look.effects = [...new Set([...look.effects, 'fx_orbit', 'fx_breath'])];
  }
  return look;
}

// ---------------------------------------------------------------- 亲密度表现

const NICKNAME_FALLBACK: Record<string, string[]> = {
  傲娇: ['笨蛋主人', '喂'], 粘人: ['亲爱哒', '宝'], 高冷: ['你', '主人'],
  元气: ['老大', '搭档'], 慢热: ['你呀', '主人'], 中二: ['吾之契约者', '勇者'],
  懒洋洋: ['铲屎官', '饭票'], 社恐: ['那个…你', '主人桑'],
};

async function handleGain(gain: IntimacyGain): Promise<void> {
  if (gain.gained <= 0) return;
  pet.intimacy_level = gain.state.level;
  pet.intimacy_points = gain.state.points;
  coinFloat(`+${gain.gained}❤`, 'heart');
  for (const lv of gain.leveledUp) {
    machine.interrupt('click_happy', true);
    showSign(`亲密度升到 Lv${lv}!${LEVEL_UNLOCKS[lv] ?? ''}`, 4500);
    if (lv === 7) await grantNickname();
    if (lv === 10) view.setLook(buildLook(pet)); // 隐藏特效外观
  }
}

/** Lv7:让宠物给主人起昵称并记住 */
async function grantNickname(): Promise<void> {
  let nick: string | null = null;
  const reply = await llmChat(buildNicknameMsgs(await promptCtx('')), 0.9);
  if (reply) nick = reply.replace(/["「」'『』\s]/g, '').slice(0, 6) || null;
  if (!nick) nick = pick(NICKNAME_FALLBACK[pet.personality] ?? ['主人']);
  pet.nickname_for_owner = nick;
  await getDb().execute('UPDATE pets SET nickname_for_owner = $1 WHERE id = $2', [nick, pet.id]);
  await addShortMemory(`${pet.name}给主人起了昵称「${nick}」`);
  setTimeout(() => showSign(`以后就叫你「${nick}」啦!`, 4000), 4800);
}

// ---------------------------------------------------------------- 交互

function markInteract(): void {
  lastInteract = Date.now();
}

let clickTimes: number[] = [];

async function afterDailyBump(field: 'pet_count' | 'feed_count' | 'chat_count', n: number): Promise<void> {
  const task = await maybeTaskReward(field, n);
  if (task) showSign(`每日任务「${task}」完成!+10⭐`, 3000);
}

function onPetClick(): void {
  markInteract();
  const now = Date.now();
  clickTimes = clickTimes.filter((t) => now - t < 1200);
  clickTimes.push(now);
  void addInteract(pet.id);
  void bumpDaily('pet_count').then(async (n) => {
    await afterDailyBump('pet_count', n);
    await handleGain(await gainBySource(pet.id, 'pet_count', n));
  });
  if (clickTimes.length >= 3) {
    clickTimes = [];
    machine.interrupt('click_happy');
  } else {
    machine.interrupt('petted');
  }
}

function setupInput(): void {
  let start: { sx: number; sy: number; wx: number; wy: number; id: number } | null = null;

  stageEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    closeMenu();
    start = { sx: e.screenX, sy: e.screenY, wx: posX, wy: posY, id: e.pointerId };
    stageEl.setPointerCapture(e.pointerId);
  });

  stageEl.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dpr = window.devicePixelRatio || 1;
    const dx = (e.screenX - start.sx) * dpr;
    const dy = (e.screenY - start.sy) * dpr;
    if (!dragging && Math.hypot(dx, dy) > 6 * dpr) {
      dragging = true;
      reportHitbox();
      machine.interrupt('drag_struggle', true);
    }
    if (dragging) {
      posX = Math.min(Math.max(start.wx + dx, mon.x - sizeW / 2), mon.x + mon.w - sizeW / 2);
      posY = Math.min(Math.max(start.wy + dy, mon.y - 40), mon.y + mon.h - sizeH / 2);
      applyPos();
    }
  });

  const endDrag = (): void => {
    if (!start) return;
    start = null;
    if (dragging) {
      dragging = false;
      markInteract();
      reportHitbox();
      machine.endDrag();
      void savePosition();
    } else {
      onPetClick();
    }
  };

  stageEl.addEventListener('pointerup', endDrag);
  stageEl.addEventListener('pointercancel', () => {
    start = null;
    if (dragging) {
      dragging = false;
      reportHitbox();
      machine.endDrag();
    }
  });

  stageEl.addEventListener('dblclick', () => {
    markInteract();
    openChatBubble();
  });

  stageEl.addEventListener('pointerenter', () => {
    if (dragging || isMenuOpen()) return;
    if (['sit', 'lie', 'daze'].includes(machine.current) && Math.random() < 0.6) {
      machine.interrupt('curious_look');
    }
  });

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    void openPetMenu(e.clientX, e.clientY);
  });
}

// ---------------------------------------------------------------- 功能

async function feed(): Promise<void> {
  markInteract();
  const n = await bumpDaily('feed_count');
  if (n <= 3) {
    machine.interrupt('eat', true);
    showSign(pick(FEED_LINES), 3000);
    await afterDailyBump('feed_count', n);
    await handleGain(await gainBySource(pet.id, 'feed_count', n));
    void addShortMemory(`主人喂了${pet.name}(今日第${n}次)`);
  } else {
    showSign(FEED_FULL_LINE, 3500);
  }
}

// ---------------------------------------------------------------- LLM 对话

const chatHistory: ChatMsg[] = [];

async function promptCtx(query: string): Promise<PromptCtx> {
  const memories = (await retrieveLongMemories(query)).map((m) => m.content);
  const todayLines = await todayShorts(6);
  return {
    name: pet.name,
    species: pet.species,
    personality: pet.personality,
    level: pet.intimacy_level,
    nickname: pet.nickname_for_owner,
    memories,
    todayLines,
  };
}

async function chatReply(text: string): Promise<string> {
  const ctx = await promptCtx(text);
  const messages: ChatMsg[] = [
    { role: 'system', content: buildChatSystem(ctx) },
    ...chatHistory.slice(-10),
    { role: 'user', content: text },
  ];
  const reply = await llmChat(messages);
  const finalReply = reply ?? pick(CHAT_LINES[pet.personality] ?? CHAT_LINES['元气']);
  chatHistory.push({ role: 'user', content: text }, { role: 'assistant', content: finalReply });
  if (chatHistory.length > 20) chatHistory.splice(0, chatHistory.length - 20);
  void addShortMemory(`主人说「${text.slice(0, 40)}」,${pet.name}答「${finalReply.slice(0, 40)}」`);
  return finalReply;
}

function openChatBubble(): void {
  openBubble(async (text) => {
    markInteract();
    void bumpDaily('chat_count').then(async (n) => {
      await afterDailyBump('chat_count', n);
      await handleGain(await gainBySource(pet.id, 'chat_count', n));
    });
    void addInteract(pet.id);
    machine.interrupt('petted');
    return chatReply(text);
  });
}

function speak(): void {
  markInteract();
  machine.interrupt('hold_sign', true);
  showSign(pick(GREET_LINES), 4000);
}

function testState(name: StateName): void {
  if (name === 'climb_window') {
    void host.climbPrepare().then((ok) => {
      if (ok) machine.goto('climb_window');
      else showSign('附近没有合适的窗口可以爬~', 3000);
    });
    return;
  }
  if (name === 'hold_sign') {
    speak();
    return;
  }
  machine.interrupt(name, true);
}

const STATE_LABELS: Partial<Record<StateName, string>> = {
  sit: '坐', lie: '趴', sleep: '睡觉', daze: '发呆', yawn: '打哈欠', groom: '舔毛',
  tail_chase: '追尾巴', stretch: '伸懒腰', walk: '走路', run: '跑步',
  climb_window: '爬窗户', sit_on_window: '窗上坐', jump_down: '跳下来',
  click_happy: '开心跳', petted: '摸头', hold_sign: '举牌', sulk: '生气背对',
  eat: '吃东西', play_yarn: '玩线团', curious_look: '张望', wake_startled: '惊醒',
};

async function openPanel(tab: 'gacha' | 'codex' | 'shop' | 'settings'): Promise<void> {
  const existing = await WebviewWindow.getByLabel('panel');
  if (existing) {
    await existing.setFocus();
    await emit('panel-tab', { tab });
    return;
  }
  new WebviewWindow('panel', {
    url: `panel.html#${tab}`,
    title: '星屑伙伴',
    width: 800,
    height: 580,
    center: true,
    resizable: true,
  });
}

async function openPetMenu(x: number, y: number): Promise<void> {
  const balance = await getBalance();
  const testItems = (Object.keys(DEFS) as StateName[])
    .filter((s) => s !== 'drag_struggle')
    .map((s) => ({
      label: STATE_LABELS[s] ?? s,
      action: () => testState(s),
    }));

  openMenu(x, y, [
    { label: `⭐ ${balance}`, tag: `${pet.name} Lv${pet.intimacy_level}`, disabled: true },
    'sep',
    { label: '🍖 喂食', action: () => void feed() },
    { label: '💬 聊天', action: () => openChatBubble() },
    { label: '🧶 玩线团', action: () => { markInteract(); machine.interrupt('play_yarn', true); } },
    { label: '🎬 测试动作', submenu: testItems },
    'sep',
    { label: '🎰 抽卡', action: () => void openPanel('gacha') },
    { label: '📖 图鉴', action: () => void openPanel('codex') },
    { label: '🛍️ 商店', action: () => void openPanel('shop') },
    { label: '⚙️ 设置', action: () => void openPanel('settings') },
    'sep',
    { label: '❌ 退出', action: () => void quitApp() },
  ]);
}

async function quitApp(): Promise<void> {
  await savePosition();
  await invoke('quit_app');
}

// ---------------------------------------------------------------- 货币表现

function coinFloat(text: string, cls = ''): void {
  const el = document.createElement('div');
  el.className = `coin-float ${cls}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

// ---------------------------------------------------------------- 持久化

async function savePosition(): Promise<void> {
  const v = `${Math.round(posX)},${Math.round(posY)}`;
  if (v === savedPos) return;
  savedPos = v;
  await setSetting('pet_pos', v);
}

// ---------------------------------------------------------------- 启动

// ---------------------------------------------------------------- 三期:感知回调 / 记忆压缩

function onHealthRemind(): void {
  machine.interrupt('hold_sign', true);
  showActionSign('工作满 1 小时啦!\n点我一下,起来喝口水吧 💧', 20_000, () => {
    void (async () => {
      const n = await bumpDaily('health_count');
      if (n <= 3) {
        await addCoins(20, 'health');
        await handleGain(await gainBySource(pet.id, 'health_count', n));
        showSign('好耶!补水成功,继续加油~', 3000);
        void addShortMemory('主人响应了喝水提醒,有好好休息');
      } else {
        showSign('今天已经提醒够啦,记得多喝水~', 3000);
      }
      resetWorkTimer();
    })();
  });
}

function onLateNight(): void {
  machine.interrupt('yawn', true);
  setTimeout(() => machine.interrupt('sleep'), 1200);
  showSign('夜深了…早点睡哦 🌙', 5000);
  void addShortMemory('主人深夜还在用电脑');
}

function onProactive(tag: string): void {
  void (async () => {
    const ctx = await promptCtx(tag);
    const reply = await llmChat(buildProactiveMsgs(ctx, tag), 0.9);
    const text = reply ?? pick(PROACTIVE_FALLBACK[tag] ?? ['我在这儿陪着你哦~']);
    machine.interrupt('hold_sign', true);
    showSign(text, 6000);
    void addShortMemory(`主人${tag}时,${pet.name}主动说「${text.slice(0, 30)}」`);
  })();
}

/** 每日记忆压缩:开机补跑昨日流水(LLM 不可用则跳过,次日再试) */
async function compressMemoriesIfDue(): Promise<void> {
  const today = new Date().toDateString();
  if ((await lastCompressDate()) === today) return;
  const shorts = await pendingShortsBeforeToday();
  if (shorts.length === 0) {
    await markCompressed();
    return;
  }
  if (!(await llmConfigured())) return;
  const reply = await llmChat(buildCompressionMsgs(shorts.map((s) => s.content).slice(0, 40)), 0.3);
  if (!reply) return;
  const summaries = parseCompression(reply);
  await finishCompression(summaries, shorts.map((s) => s.id));
  await markCompressed();
}

async function boot(): Promise<void> {
  await initDb();
  await applyDecayOnBoot();
  pet = await getActivePetMigrated();

  scale = await win.scaleFactor();
  const size = await win.outerSize();
  sizeW = size.width;
  sizeH = size.height;
  const m = (await currentMonitor()) ?? (await primaryMonitor());
  if (m) {
    mon = { x: m.position.x, y: m.position.y, w: m.size.width, h: m.size.height };
  }

  const saved = await getSetting('pet_pos');
  if (saved) {
    const [sx, sy] = saved.split(',').map(Number);
    if (Number.isFinite(sx) && Number.isFinite(sy)) {
      posX = Math.min(Math.max(sx, mon.x - sizeW / 2), mon.x + mon.w - sizeW / 2);
      posY = Math.min(Math.max(sy, mon.y - 40), mon.y + mon.h - sizeH / 2);
    }
  } else {
    posX = mon.x + mon.w - sizeW - Math.round(40 * scale);
    posY = mon.y + mon.h - sizeH - Math.round(60 * scale);
  }
  applyPos();
  groundX = posX;
  groundY = posY;

  view = await PetView.create(stageEl, buildLook(pet));
  machine = new Machine(host);
  machine.start();

  setOverlayListener((active) => {
    overlayActive = active;
    reportHitbox();
  });
  setupInput();
  reportHitbox();

  view.app.ticker.add((ticker) => {
    machine.tick(ticker.deltaMS);
    view.tick(ticker.deltaMS);
  });

  setInterval(() => void savePosition(), 30_000);
  window.addEventListener('beforeunload', () => void savePosition());

  // 跨窗口事件:货币动画 / 出场宠物切换
  void listen<CoinEvent>('coins-changed', (e) => {
    if (e.payload.delta > 0) {
      view.coinBurst();
      coinFloat(`+${e.payload.delta}⭐`);
    }
  });
  void listen<{ id: string }>('active-pet-changed', async () => {
    pet = await getActivePetMigrated();
    chatHistory.length = 0; // 换宠物,当前会话上下文清空(长期记忆共享)
    view.setLook(buildLook(pet));
    machine.interrupt('click_happy', true);
    showSign(`${pet.name} 登场!`, 3000);
  });

  // 挂机计时:每分钟一跳,空闲(≥30 分钟无输入)暂停
  setInterval(() => {
    void invoke<number>('get_idle_seconds')
      .then((idle) => tickIdleEarning(idle))
      .then((earned) => {
        if (earned) showSign('挂机奖励 +10⭐', 2500);
      })
      .catch(() => {});
  }, 60_000);

  // 问候 / 首次隐私说明 / 签到
  const acked = await getSetting('privacy_ack');
  machine.interrupt('hold_sign', true);
  if (!acked) {
    showSign(PRIVACY_NOTE, 12_000);
    await setSetting('privacy_ack', '1');
  } else {
    showSign(`${pet.name}(${pet.personality}):${pick(GREET_LINES)}`, 4000);
  }
  const checkin = await dailyCheckin();
  if (checkin) {
    setTimeout(() => {
      showSign(
        checkin.streak >= 7
          ? `连续签到 7 天!+${checkin.rewarded}⭐`
          : `每日签到 +30⭐(连续 ${checkin.streak} 天)`,
        3500
      );
    }, acked ? 4200 : 12_500);
  }

  // 三期:每日启动亲密度 / 记忆压缩 / 窗口感知
  const launch = await dailyLaunchBonus(pet.id);
  if (launch) await handleGain(launch);
  void compressMemoriesIfDue();

  initWindowSense({
    enabled: async () => (await getSetting('window_sense_enabled')) !== '0',
    proactiveReady: async () =>
      pet.intimacy_level >= 5 && (await getSetting('proactive_enabled')) !== '0',
    getIdleSeconds: () => invoke<number>('get_idle_seconds'),
    getActiveTitle: async () => {
      const info = await invoke<ActiveWin | null>('get_active_window_info');
      return info?.title ?? null;
    },
    onHealthRemind,
    onLateNight,
    onProactive,
  });
}

void boot();
