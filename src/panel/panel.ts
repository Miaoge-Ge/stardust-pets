/** 面板窗口:抽卡 / 图鉴(我的宠物·部件图鉴·成就)/ 商店 */
import { emit, listen } from '@tauri-apps/api/event';

import { drawPortrait, lookFromParts } from '../engine/frames';
import {
  ALL_EFFECTS,
  ALL_PARTS,
  DIMENSIONS,
  PITY_SR,
  PITY_SSR,
  PITY_UR,
  SERIES,
  WISH_COST,
  type Rarity,
} from '../gen/generator';
import { initDb, getSetting, setSetting } from '../systems/db';
import { addCoins, getBalance, getShards, shardsToCoins, type CoinEvent } from '../systems/currency';
import { loadLlmConfig, llmTest, saveLlmConfig } from '../llm/client';
import { getGachaState, getLogs, pull, wishCraft, type PullResult } from '../systems/gacha';
import {
  listPets,
  releasePet,
  renamePet,
  setActivePet,
  unlockedPartIds,
  type PetRecord,
} from '../systems/petsRepo';

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T =>
  document.querySelector(sel) as T;

const DIM_NAMES: Record<string, string> = {
  species: '物种', body: '体型', material: '材质', ears: '耳朵', tail: '尾巴',
  eyes: '眼睛', mouth: '嘴型', pattern: '花纹', palette: '色板',
  headwear: '头饰', neckwear: '颈饰',
};

const SPECIES_NAMES: Record<string, string> = {
  sp_cat: '猫', sp_dog: '狗', sp_rabbit: '兔', sp_fox: '狐狸', sp_hamster: '仓鼠',
  sp_bird: '小鸟', sp_duck: '小鸭', sp_hedgehog: '刺猬', sp_panda: '熊猫',
  sp_penguin: '企鹅', sp_turtle: '乌龟', sp_owl: '猫头鹰', sp_deer: '小鹿',
  sp_slime: '史莱姆', sp_octopus: '小章鱼', sp_bat: '蝙蝠', sp_dragon: '幼龙',
  sp_ghost: '小幽灵', sp_unicorn: '独角兽', sp_phoenix: '凤凰雏',
};

// ---------------------------------------------------------------- 通用

async function refreshWallet(): Promise<void> {
  $('#balance').textContent = String(await getBalance());
  $('#shards').textContent = String(await getShards());
}

function portraitCanvas(pet: PetRecord): HTMLCanvasElement {
  const look = lookFromParts(pet.parts.ids, pet.parts.effects, pet.parts.colors);
  return drawPortrait(look);
}

function switchTab(tab: string): void {
  document.querySelectorAll('header .tab').forEach((el) => {
    el.classList.toggle('active', (el as HTMLElement).dataset.tab === tab);
  });
  document.querySelectorAll('.page').forEach((el) => {
    el.classList.toggle('active', el.id === `page-${tab}`);
  });
  if (tab === 'gacha') void renderGacha();
  if (tab === 'codex') void renderCodex();
  if (tab === 'shop') void renderShop();
  if (tab === 'settings') void renderSettings();
}

// ---------------------------------------------------------------- 设置页

async function renderSettings(): Promise<void> {
  const cfg = await loadLlmConfig();
  ($('#llmUrl') as HTMLInputElement).value = cfg.url;
  ($('#llmKey') as HTMLInputElement).value = cfg.key;
  ($('#llmModel') as HTMLInputElement).value = cfg.model;
  ($('#senseToggle') as HTMLInputElement).checked =
    (await getSetting('window_sense_enabled')) !== '0';
  ($('#proactiveToggle') as HTMLInputElement).checked =
    (await getSetting('proactive_enabled')) !== '0';
}

function currentCfgFromInputs() {
  return {
    url: ($('#llmUrl') as HTMLInputElement).value.trim(),
    key: ($('#llmKey') as HTMLInputElement).value.trim(),
    model: ($('#llmModel') as HTMLInputElement).value.trim() || 'gpt-4o-mini',
  };
}

function bindSettings(): void {
  $('#llmSave').addEventListener('click', async () => {
    await saveLlmConfig(currentCfgFromInputs());
    $('#llmStatus').textContent = '已保存 ✓';
    setTimeout(() => ($('#llmStatus').textContent = ''), 2500);
  });
  $('#llmTest').addEventListener('click', async () => {
    $('#llmStatus').textContent = '测试中…';
    const cfg = currentCfgFromInputs();
    const r = await llmTest(cfg);
    $('#llmStatus').textContent = r.ok ? `连接成功 ✓(${r.detail})` : `失败:${r.detail}`;
    if (r.ok) await saveLlmConfig(cfg);
  });
  $('#senseToggle').addEventListener('change', async (e) => {
    await setSetting('window_sense_enabled', (e.target as HTMLInputElement).checked ? '1' : '0');
  });
  $('#proactiveToggle').addEventListener('change', async (e) => {
    await setSetting('proactive_enabled', (e.target as HTMLInputElement).checked ? '1' : '0');
  });
}

// ---------------------------------------------------------------- 抽卡页

async function renderPity(): Promise<void> {
  const st = await getGachaState();
  $('#pitySrText').textContent = `距保底还剩 ${PITY_SR - st.sr} 抽`;
  $('#pitySsrText').textContent = `距保底还剩 ${PITY_SSR - st.ssr} 抽`;
  $('#pityUrText').textContent = `距保底还剩 ${PITY_UR - st.ur} 抽`;
  ($('#pitySrFill') as HTMLElement).style.width = `${(st.sr / PITY_SR) * 100}%`;
  ($('#pitySsrFill') as HTMLElement).style.width = `${(st.ssr / PITY_SSR) * 100}%`;
  ($('#pityUrFill') as HTMLElement).style.width = `${(st.ur / PITY_UR) * 100}%`;
}

async function renderHistory(): Promise<void> {
  const logs = await getLogs(50);
  const box = $('#historyList');
  box.innerHTML = '';
  for (const log of logs) {
    const row = document.createElement('div');
    row.className = 'row';
    const time = new Date(log.ts).toLocaleString('zh-CN', { hour12: false });
    row.innerHTML = `<span>${time}</span><b class="${log.rarity}">${log.rarity}</b><span>${
      log.was_duplicate ? '重复→碎片' : '新伙伴'
    }</span>`;
    box.appendChild(row);
  }
}

function resultCard(r: PullResult): HTMLElement {
  const card = document.createElement('div');
  card.className = `card ${r.gen.rarity}`;
  const pet: PetRecord = {
    id: r.petId ?? '',
    name: r.gen.name,
    rarity: r.gen.rarity,
    species: r.gen.ids.species,
    parts_json: '',
    personality: r.gen.personality,
    created_at: Date.now(),
    intimacy_level: 1,
    intimacy_points: 0,
    interact_count: 0,
    nickname_for_owner: null,
    released: 0,
    parts: { seed: r.gen.seed, ids: r.gen.ids, effects: r.gen.effects, colors: r.gen.colors },
  };
  card.appendChild(portraitCanvas(pet));
  const nm = document.createElement('div');
  nm.className = 'nm';
  nm.textContent = r.duplicate ? '(重复形态)' : r.gen.name;
  const rar = document.createElement('div');
  rar.className = 'rar';
  rar.textContent = r.gen.rarity;
  card.appendChild(nm);
  card.appendChild(rar);
  if (r.duplicate) {
    const dup = document.createElement('div');
    dup.className = 'dup';
    dup.textContent = `🧩+${r.shards}`;
    card.appendChild(dup);
  }
  return card;
}

let animating = false;
let skipAnim = false;

async function playEggAnim(topRarity: Rarity): Promise<void> {
  const overlay = $('#eggOverlay');
  const egg = $('#egg');
  egg.className = `egg ${topRarity}`;
  overlay.classList.remove('hidden');
  skipAnim = false;
  const waitMs =
    topRarity === 'UR' ? 3000 : topRarity === 'SSR' ? 2200 : topRarity === 'SR' ? 1700 : 1200;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, waitMs);
    const onClick = (): void => {
      skipAnim = true;
      clearTimeout(t);
      overlay.removeEventListener('click', onClick);
      resolve();
    };
    overlay.addEventListener('click', onClick);
  });
  overlay.classList.add('hidden');
}

async function doPull(count: 1 | 10): Promise<void> {
  if (animating) return;
  animating = true;
  try {
    const results = await pull(count);
    if (!results) {
      alert('星星币不足!挂机、签到、完成每日任务可以获得星星币。');
      return;
    }
    const order: Rarity[] = ['N', 'R', 'SR', 'SSR', 'UR'];
    const top = results.reduce<Rarity>(
      (acc, r) => (order.indexOf(r.gen.rarity) > order.indexOf(acc) ? r.gen.rarity : acc),
      'N'
    );
    await playEggAnim(top);
    const box = $('#results');
    box.innerHTML = '';
    for (const r of results) {
      box.appendChild(resultCard(r));
      if (!skipAnim && results.length > 1) await new Promise((res) => setTimeout(res, 130));
    }
    await Promise.all([renderPity(), renderHistory(), refreshWallet()]);
    void emit('pets-changed', {});
  } finally {
    animating = false;
  }
}

async function renderGacha(): Promise<void> {
  await Promise.all([renderPity(), renderHistory(), refreshWallet()]);
}

// ---------------------------------------------------------------- 图鉴页

let codexSubtab = 'pets';

async function renderCodex(): Promise<void> {
  document.querySelectorAll('.subtabs .st').forEach((el) => {
    el.classList.toggle('active', (el as HTMLElement).dataset.st === codexSubtab);
  });
  $('#codex-pets').style.display = codexSubtab === 'pets' ? '' : 'none';
  $('#codex-parts').style.display = codexSubtab === 'parts' ? '' : 'none';
  $('#codex-ach').style.display = codexSubtab === 'ach' ? '' : 'none';
  if (codexSubtab === 'pets') await renderMyPets();
  if (codexSubtab === 'parts') await renderPartsCodex();
  if (codexSubtab === 'ach') await renderAchievements();
}

async function renderMyPets(): Promise<void> {
  const pets = await listPets();
  const activeId = await getSetting('active_pet_id');
  const byRar: Record<string, number> = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
  for (const p of pets) byRar[p.rarity] = (byRar[p.rarity] ?? 0) + 1;
  $('#petsProgress').textContent =
    `共 ${pets.length} 只 · N ${byRar.N} / R ${byRar.R} / SR ${byRar.SR} / SSR ${byRar.SSR} / UR ${byRar.UR}`;
  const grid = $('#petsGrid');
  grid.innerHTML = '';
  for (const p of pets) {
    const card = document.createElement('div');
    card.className = `card ${p.rarity}`;
    card.style.cursor = 'pointer';
    card.appendChild(portraitCanvas(p));
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = p.name;
    const rar = document.createElement('div');
    rar.className = 'rar';
    rar.textContent = `${p.rarity} · ${SPECIES_NAMES[p.species] ?? p.species}`;
    card.appendChild(nm);
    card.appendChild(rar);
    if (p.id === activeId) {
      const badge = document.createElement('div');
      badge.className = 'active-badge';
      badge.textContent = '出场中';
      card.appendChild(badge);
    }
    card.addEventListener('click', () => openDetail(p, p.id === activeId));
    grid.appendChild(card);
  }
}

function openDetail(p: PetRecord, isActive: boolean): void {
  const detail = $('#detail');
  detail.innerHTML = '';
  detail.classList.remove('hidden');
  const box = document.createElement('div');
  box.className = 'box';
  box.appendChild(portraitCanvas(p));

  const meta = document.createElement('div');
  meta.className = 'meta';
  const created = new Date(p.created_at).toLocaleDateString('zh-CN');
  meta.innerHTML =
    `稀有度 <b>${p.rarity}</b> · ${SPECIES_NAMES[p.species] ?? p.species} · 性格「${p.personality}」<br/>` +
    `获得于 ${created} · 亲密度 Lv${p.intimacy_level} · 互动 ${p.interact_count} 次`;
  box.appendChild(meta);

  const nameRow = document.createElement('div');
  nameRow.className = 'row';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = p.name;
  nameInput.maxLength = 12;
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '改名';
  saveBtn.addEventListener('click', async () => {
    const v = nameInput.value.trim();
    if (v && v !== p.name) {
      await renamePet(p.id, v);
      await renderMyPets();
    }
  });
  nameRow.appendChild(nameInput);
  nameRow.appendChild(saveBtn);
  box.appendChild(nameRow);

  const row = document.createElement('div');
  row.className = 'row';
  const activeBtn = document.createElement('button');
  activeBtn.className = 'primary';
  activeBtn.textContent = isActive ? '正在出场' : '设为出场';
  activeBtn.disabled = isActive;
  activeBtn.addEventListener('click', async () => {
    await setActivePet(p.id);
    await emit('active-pet-changed', { id: p.id });
    detail.classList.add('hidden');
    await renderMyPets();
  });
  const releaseBtn = document.createElement('button');
  releaseBtn.textContent = '放生换碎片';
  releaseBtn.disabled = isActive;
  releaseBtn.addEventListener('click', async () => {
    if (!confirm(`确定放生「${p.name}」吗?此操作不可撤销。`)) return;
    try {
      const shards = await releasePet(p.id);
      alert(`已放生,获得 🧩${shards} 碎片`);
      detail.classList.add('hidden');
      await Promise.all([renderMyPets(), refreshWallet()]);
      void emit('pets-changed', {});
    } catch {
      alert('出场中的宠物不能放生');
    }
  });
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.addEventListener('click', () => detail.classList.add('hidden'));
  row.appendChild(activeBtn);
  row.appendChild(releaseBtn);
  row.appendChild(closeBtn);
  box.appendChild(row);
  detail.appendChild(box);
}

async function renderPartsCodex(): Promise<void> {
  const unlocked = await unlockedPartIds();
  const allCollectibles = [...ALL_PARTS, ...ALL_EFFECTS.map((e) => ({ ...e, dimension: 'effect' }))];
  const byRar: Record<string, [number, number]> = {
    N: [0, 0], R: [0, 0], SR: [0, 0], SSR: [0, 0], UR: [0, 0],
  };
  for (const p of allCollectibles) {
    byRar[p.minRarity][1]++;
    if (unlocked.has(p.id)) byRar[p.minRarity][0]++;
  }
  const total = allCollectibles.length;
  const got = allCollectibles.filter((p) => unlocked.has(p.id)).length;
  $('#partsProgress').textContent =
    `收集进度 ${got}/${total}(${Math.round((got / total) * 100)}%) · ` +
    `N ${byRar.N[0]}/${byRar.N[1]} · R ${byRar.R[0]}/${byRar.R[1]} · ` +
    `SR ${byRar.SR[0]}/${byRar.SR[1]} · SSR ${byRar.SSR[0]}/${byRar.SSR[1]} · ` +
    `UR ${byRar.UR[0]}/${byRar.UR[1]}`;

  const blocks = $('#partsBlocks');
  blocks.innerHTML = '';
  for (const dim of [...DIMENSIONS, 'effect']) {
    const parts = allCollectibles.filter((p) => p.dimension === dim);
    if (parts.length === 0) continue;
    const block = document.createElement('div');
    block.className = 'dim-block';
    const h = document.createElement('h4');
    h.textContent = `${DIM_NAMES[dim] ?? '特效'}(${parts.filter((p) => unlocked.has(p.id)).length}/${parts.length})`;
    block.appendChild(h);
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const part of parts) {
      const chip = document.createElement('div');
      const isOn = unlocked.has(part.id);
      chip.className = `chip ${part.minRarity}${isOn ? '' : ' locked'}`;
      chip.textContent = isOn ? part.name : '???';
      chip.title = isOn ? `${part.name}(${part.minRarity})` : `未解锁(${part.minRarity})`;
      chips.appendChild(chip);
    }
    block.appendChild(chips);
    blocks.appendChild(block);
  }
}

interface Achievement {
  id: string;
  name: string;
  desc: string;
  reward: number;
  parts: string[];
}

function allAchievements(): Achievement[] {
  const list: Achievement[] = Object.entries(SERIES).map(([id, s]) => ({
    id,
    name: s.name,
    desc: `集齐:${s.parts.map((pid) => ALL_PARTS.find((p) => p.id === pid)?.name ?? pid).join('、')}`,
    reward: s.reward,
    parts: s.parts,
  }));
  const srParts = ALL_PARTS.filter((p) => p.minRarity === 'SR').map((p) => p.id);
  list.push({ id: 'ach_all_sr', name: 'SR 收藏家', desc: '集齐全部 SR 部件', reward: 1000, parts: srParts });
  const allIds = ALL_PARTS.map((p) => p.id).concat(ALL_EFFECTS.map((e) => e.id));
  list.push({ id: 'ach_all', name: '图鉴大师', desc: '点亮整本部件图鉴', reward: 5000, parts: allIds });
  return list;
}

async function renderAchievements(): Promise<void> {
  const unlocked = await unlockedPartIds();
  const box = $('#codex-ach');
  box.innerHTML = '';
  for (const ach of allAchievements()) {
    const got = ach.parts.filter((p) => unlocked.has(p)).length;
    const complete = got === ach.parts.length;
    const claimed = (await getSetting(`ach_claimed_${ach.id}`)) === '1';
    const el = document.createElement('div');
    el.className = 'ach';
    el.innerHTML = `<div class="info"><div class="t">${ach.name}</div><div class="d">${ach.desc}(${got}/${ach.parts.length})</div></div>`;
    const btn = document.createElement('button');
    if (claimed) {
      btn.textContent = '已领取';
      btn.disabled = true;
    } else if (complete) {
      btn.className = 'gold';
      btn.textContent = `领取 ⭐${ach.reward}`;
      btn.addEventListener('click', async () => {
        await setSetting(`ach_claimed_${ach.id}`, '1');
        await addCoins(ach.reward, `ach_${ach.id}`);
        await Promise.all([renderAchievements(), refreshWallet()]);
      });
    } else {
      btn.textContent = `⭐${ach.reward}`;
      btn.disabled = true;
    }
    el.appendChild(btn);
    box.appendChild(el);
  }
}

// ---------------------------------------------------------------- 商店页

function fillWishSpecies(): void {
  const rarity = ($('#wishRarity') as HTMLSelectElement).value as Rarity;
  const sel = $('#wishSpecies') as HTMLSelectElement;
  sel.innerHTML = '';
  const order = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };
  for (const p of ALL_PARTS.filter((x) => x.dimension === 'species')) {
    if (order[p.minRarity] > order[rarity]) continue;
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  }
}

async function renderShop(): Promise<void> {
  await refreshWallet();
  fillWishSpecies();
}

// ---------------------------------------------------------------- 启动

async function boot(): Promise<void> {
  await initDb();

  document.querySelectorAll('header .tab').forEach((el) => {
    el.addEventListener('click', () => switchTab((el as HTMLElement).dataset.tab!));
  });
  document.querySelectorAll('.subtabs .st').forEach((el) => {
    el.addEventListener('click', () => {
      codexSubtab = (el as HTMLElement).dataset.st!;
      void renderCodex();
    });
  });

  $('#pull1').addEventListener('click', () => void doPull(1));
  $('#pull10').addEventListener('click', () => void doPull(10));
  bindSettings();

  $('#exBtn').addEventListener('click', async () => {
    const amount = Math.floor(Number(($('#exAmount') as HTMLInputElement).value));
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (await shardsToCoins(amount)) await refreshWallet();
    else alert('碎片不足');
  });

  ($('#wishRarity') as HTMLSelectElement).addEventListener('change', fillWishSpecies);
  $('#wishBtn').addEventListener('click', async () => {
    const rarity = ($('#wishRarity') as HTMLSelectElement).value as Exclude<Rarity, 'N'>;
    const species = ($('#wishSpecies') as HTMLSelectElement).value;
    if (!species) return;
    if (!confirm(`消耗 🧩${WISH_COST[rarity]} 定制一只 ${rarity} 稀有度的宠物?`)) return;
    const result = await wishCraft(species, rarity);
    if (!result) {
      alert('碎片不足');
      return;
    }
    alert(`「${result.gen.name}」加入了你的图鉴!到「图鉴 → 我的宠物」查看`);
    await refreshWallet();
    void emit('pets-changed', {});
  });

  void listen<CoinEvent>('coins-changed', () => void refreshWallet());
  void listen<{ tab: string }>('panel-tab', (e) => switchTab(e.payload.tab));
  void listen('pets-changed', () => {
    if (document.querySelector('#page-codex.active')) void renderCodex();
  });

  const hash = (location.hash || '#gacha').slice(1);
  switchTab(['gacha', 'codex', 'shop', 'settings'].includes(hash) ? hash : 'gacha');
}

void boot();
