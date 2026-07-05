/**
 * 部件化像素宠物绘制:
 *   drawPetFrame(look, fp) → 48×48 canvas(渲染层再经 Scale2x×2 平滑放大)
 * 物种系统:20 种,由「体格修正 + 类别(quad 四足 / bird 鸟类 / blob 软体)+ 特征开关」描述,
 * 新物种只需在 SPEC 表加一行 + 至多一个特征绘制函数。
 * 渲染次序:披风(后景) → 身体填色 → 明暗着色 → 花纹 → 材质 → 描边
 *          → 物种特征 → 五官 → 配饰 → 状态图标 → 发光特效
 */
import type { Colors } from '../gen/generator';
import { GRID, Mask, haloMask, outlineMask, paintMask, px } from './pixel';

export interface Look {
  species: string;
  body: string;
  material: string;
  ears: string;
  tail: string;
  eyes: string;
  mouth: string;
  pattern: string;
  headwear: string;
  neckwear: string;
  effects: string[];
  colors: Colors;
}

export interface FP {
  pose: 'stand' | 'sit' | 'lie' | 'curl' | 'back' | 'hang' | 'jump' | 'stretch';
  bob?: number;
  squash?: number;
  eye?: 'open' | 'closed' | 'happy' | 'half' | 'wide';
  mouth?: 'smile' | 'open' | 'o' | 'none';
  tail?: number;
  legPhase?: number;
  headDx?: number;
  headDy?: number;
  earFlat?: boolean;
  blush?: boolean;
  zzz?: number;
  excl?: boolean;
  pawUp?: boolean;
  pawY?: number;
  lick?: boolean;
  lickY?: number;
  item?: 'yarn' | 'bowl' | null;
  itemJitter?: number;
  angry?: boolean;
  dust?: boolean;
  sweat?: boolean;
  heart?: boolean;
  frameIdx?: number;
}

const UI = {
  eye: '#2b2b33',
  white: '#ffffff',
  blushC: '#f08a8a',
  yarn: '#7fb3e6',
  yarnLine: '#4a7fb5',
  bowl: '#8f6ad9',
  bowlRim: '#6f4fb5',
  food: '#a5673f',
  zzz: '#9fb7d9',
  excl: '#e8574d',
  dust: '#c9c2b8',
  sweat: '#7fb3e6',
  angryC: '#e8574d',
  gold: '#f2c14e',
  goldDark: '#b58a2a',
  gem: '#e8574d',
  beak: '#e8a13d',
  duckBeak: '#f2b035',
  frame: '#3a3a45',
  pandaDark: '#3a3540',
  antler: '#8a6437',
};

// ---------------------------------------------------------------- 物种表(20 种)

interface Spec {
  bw: number; // 身体宽度增量
  bh: number; // 身体高度增量
  hr: number; // 头半径增量
  kind: 'quad' | 'bird' | 'blob';
  muzzle?: boolean;
  beak?: boolean;
  flatBeak?: boolean;
  eyeRings?: boolean;
  mask?: boolean;
  spines?: boolean;
  shell?: boolean;
  antlers?: boolean;
  batWings?: boolean;
  horn?: boolean;
  crest?: boolean;
  tentacles?: boolean;
  floaty?: boolean;
  bigBelly?: boolean;
  spikes?: boolean;
  wingPatch?: boolean;
}

const SPEC: Record<string, Spec> = {
  sp_cat:      { bw: 0, bh: 0, hr: 0, kind: 'quad' },
  sp_dog:      { bw: 1, bh: 0, hr: 0, kind: 'quad', muzzle: true },
  sp_rabbit:   { bw: -1, bh: 1, hr: 0, kind: 'quad' },
  sp_fox:      { bw: 0, bh: 0, hr: 0, kind: 'quad', muzzle: true },
  sp_hamster:  { bw: 2, bh: -1, hr: 1, kind: 'quad' },
  sp_bird:     { bw: -1, bh: 0, hr: 0, kind: 'bird', beak: true, wingPatch: true },
  sp_duck:     { bw: 0, bh: 0, hr: 0, kind: 'bird', flatBeak: true, wingPatch: true },
  sp_hedgehog: { bw: 1, bh: -1, hr: 0, kind: 'quad', spines: true },
  sp_panda:    { bw: 2, bh: 0, hr: 1, kind: 'quad', mask: true },
  sp_penguin:  { bw: 0, bh: 2, hr: 0, kind: 'bird', beak: true, bigBelly: true },
  sp_turtle:   { bw: 2, bh: -1, hr: -1, kind: 'quad', shell: true },
  sp_owl:      { bw: 0, bh: 1, hr: 1, kind: 'bird', beak: true, eyeRings: true, wingPatch: true },
  sp_deer:     { bw: -1, bh: 1, hr: 0, kind: 'quad', antlers: true, muzzle: true },
  sp_slime:    { bw: 0, bh: 0, hr: 0, kind: 'blob' },
  sp_octopus:  { bw: 0, bh: 0, hr: 0, kind: 'blob', tentacles: true },
  sp_bat:      { bw: -1, bh: 0, hr: 1, kind: 'quad', batWings: true },
  sp_dragon:   { bw: 1, bh: 0, hr: 0, kind: 'quad', spikes: true },
  sp_ghost:    { bw: 0, bh: 1, hr: 0, kind: 'blob', floaty: true },
  sp_unicorn:  { bw: 0, bh: 1, hr: 0, kind: 'quad', horn: true, muzzle: true },
  sp_phoenix:  { bw: -1, bh: 0, hr: 0, kind: 'bird', beak: true, crest: true, wingPatch: true },
};

function specOf(look: Look): Spec {
  return SPEC[look.species] ?? SPEC.sp_cat;
}

const BODY_MOD: Record<string, { bw: number; bh: number; hr: number }> = {
  body_round: { bw: 1, bh: 0, hr: 0 },
  body_slim: { bw: -1, bh: 1, hr: 0 },
  body_chub: { bw: 2, bh: -1, hr: 0 },
  body_mini: { bw: -2, bh: -2, hr: -1 },
};

interface Anchors {
  hx: number;
  hy: number;
  hr: number;
  face: boolean;
  nx: number;
  ny: number;
  bodyCx: number;
  bodyCy: number;
}

// ---------------------------------------------------------------- 耳朵

function addEars(m: Mask, look: Look, hx: number, hy: number, hr: number, flat: boolean): void {
  const id = look.ears;
  if (id === 'ears_none') return;
  const baseY = hy - hr + 4;
  switch (id) {
    case 'ears_flop':
      m.ellipse(hx - hr - 1, hy - 2, 3, 5);
      m.ellipse(hx + hr + 1, hy - 2, 3, 5);
      return;
    case 'ears_fold': {
      const apex = hy - hr - 2;
      m.tri(hx - 7, baseY, hx - 6, apex, hx - 1, baseY - 1);
      m.tri(hx + 1, baseY - 1, hx + 6, apex, hx + 7, baseY);
      return;
    }
    case 'ears_rabbit':
      m.ellipse(hx - 4, hy - hr - 6 + (flat ? 4 : 0), 2.5, 7);
      m.ellipse(hx + 4, hy - hr - 6 + (flat ? 4 : 0), 2.5, 7);
      return;
    case 'ears_round':
      m.circle(hx - hr + 1, hy - hr + 1, 3.5);
      m.circle(hx + hr - 1, hy - hr + 1, 3.5);
      return;
    case 'ears_horn': {
      m.tri(hx - 6, hy - hr + 3, hx - 9, hy - hr - 5, hx - 3, hy - hr + 1);
      m.tri(hx + 3, hy - hr + 1, hx + 9, hy - hr - 5, hx + 6, hy - hr + 3);
      return;
    }
    case 'ears_sharp': {
      const apex = flat ? hy - hr - 2 : hy - hr - 8;
      m.tri(hx - 9, baseY + 1, hx - 5, apex, hx - 1, baseY - 2);
      m.tri(hx + 1, baseY - 2, hx + 5, apex, hx + 9, baseY + 1);
      return;
    }
    default: {
      const apex = flat ? hy - hr - 1 : hy - hr - 6;
      m.tri(hx - 7, baseY, hx - 5, apex, hx - 1, baseY - 1);
      m.tri(hx + 1, baseY - 1, hx + 5, apex, hx + 7, baseY);
    }
  }
}

function earInnerDetail(ctx: CanvasRenderingContext2D, look: Look, hx: number, hy: number, hr: number, flat: boolean): void {
  if (look.ears === 'ears_none' || flat) return;
  const c = specOf(look).mask ? UI.pandaDark : look.colors.belly;
  if (look.ears === 'ears_rabbit') {
    px(ctx, hx - 4, hy - hr - 8, c, 1, 5);
    px(ctx, hx + 4, hy - hr - 8, c, 1, 5);
  } else if (look.ears === 'ears_flop') {
    px(ctx, hx - hr - 1, hy - 2, c, 1, 2);
    px(ctx, hx + hr + 1, hy - 2, c, 1, 2);
  } else if (look.ears !== 'ears_horn') {
    px(ctx, hx - 5, hy - hr - 1, c, 1, 2);
    px(ctx, hx + 4, hy - hr - 1, c, 1, 2);
  }
}

// ---------------------------------------------------------------- 尾巴

function addTail(m: Mask, look: Look, base: [number, number], sway: number, pose: FP['pose']): Array<[number, number]> {
  const id = look.tail;
  const [bx, by] = base;
  const pts: Array<[number, number]> = [];
  if (id === 'tail_none') return pts;
  const up = pose === 'sit' || pose === 'back' ? 0.6 : 1;
  switch (id) {
    case 'tail_short':
      pts.push([bx, by], [bx - 1, by - 1]);
      break;
    case 'tail_curl':
      pts.push([bx, by], [bx - 2, by - 3 * up], [bx - 1, by - 6 * up], [bx + 1 + sway, by - 7 * up], [bx + 2 + sway, by - 5 * up]);
      break;
    case 'tail_fluffy':
      for (let i = 0; i < 4; i++) pts.push([bx - i * 2 - sway * i, by - i * 3 * up]);
      break;
    case 'tail_twin':
      for (let i = 0; i < 4; i++) {
        pts.push([bx - i * 1.5 - sway * i, by - i * 3 * up]);
        pts.push([bx - i * 0.5 + sway * i, by - i * 3.2 * up]);
      }
      break;
    case 'tail_star':
      for (let i = 0; i < 5; i++) pts.push([bx - i * 1.2 - sway * i * 0.8, by - i * 3.4 * up]);
      break;
    default:
      for (let i = 0; i < 5; i++) pts.push([bx - i * 1.3 - sway * i * 1.1, by - i * 3 * up]);
  }
  const r = id === 'tail_fluffy' ? 3 : 2;
  for (const [x, y] of pts) m.circle(x, y, r);
  return pts;
}

function tailDetail(ctx: CanvasRenderingContext2D, look: Look, pts: Array<[number, number]>): void {
  if (pts.length === 0) return;
  const tip = pts[pts.length - 1];
  if (look.tail === 'tail_fluffy') {
    px(ctx, tip[0] - 1, tip[1] - 1, look.colors.light, 3, 2);
  } else if (look.tail === 'tail_star') {
    const [tx, ty] = [Math.round(tip[0]), Math.round(tip[1])];
    px(ctx, tx, ty - 3, UI.gold);
    px(ctx, tx - 1, ty - 2, UI.gold, 3, 1);
    px(ctx, tx, ty - 1, UI.gold);
  }
}

// ---------------------------------------------------------------- 姿态轮廓

function buildSilhouette(m: Mask, look: Look, p: FP): { a: Anchors; tailPts: Array<[number, number]> } {
  const b = p.bob ?? 0;
  const q = p.squash ?? 0;
  const t = p.tail ?? 0;
  const hdx = p.headDx ?? 0;
  const hdy = p.headDy ?? 0;
  const phase = (p.legPhase ?? 1) % 4;
  const spec = specOf(look);
  const bm = BODY_MOD[look.body] ?? BODY_MOD.body_round;
  const bw = spec.bw + bm.bw;
  const bh = spec.bh + bm.bh;
  const hr = 9 + spec.hr + bm.hr;
  let tailPts: Array<[number, number]> = [];

  // —— 软体(史莱姆/章鱼/幽灵):圆顶,靠压扁/拉伸表达姿态 ——
  if (spec.kind === 'blob') {
    let rx = 12 + bw;
    let ry = 9 + bh - q;
    let cy = 45 - ry + 1;
    if (p.pose === 'lie' || p.pose === 'curl') {
      rx += 2;
      ry -= 2;
      cy = 45 - ry + 1;
    } else if (p.pose === 'hang' || p.pose === 'jump') {
      rx -= 2;
      ry += 3;
      cy = 40 - ry / 2 + b;
    } else if (p.pose === 'stand') {
      ry += phase % 2 === 0 ? -1 : 1;
      cy = 45 - ry + 1 + b;
    } else {
      cy = 45 - ry + 1 + b;
    }
    if (spec.floaty) cy -= 4 + (p.frameIdx ?? 0) % 2; // 幽灵漂浮
    m.ellipse(24, cy, rx, ry);
    if (spec.tentacles) {
      // 章鱼:底部一圈触手
      for (let i = 0; i < 4; i++) {
        const tx = 24 - rx + 4 + (i * (rx * 2 - 8)) / 3;
        m.circle(tx, Math.min(44, cy + ry - 1) + (i % 2), 2.5);
      }
    }
    m.clearBelow(45);
    if (spec.floaty) {
      // 幽灵:底缘波浪缺口
      const bottom = cy + ry - 1;
      m.subCircle(18, bottom + 2, 3);
      m.subCircle(27, bottom + 2, 3);
      m.subCircle(35, bottom + 2, 2.5);
    }
    addEars(m, look, 24, cy - 2, Math.round(ry), !!p.earFlat);
    tailPts = addTail(m, look, [24 - rx + 2, 44], t, p.pose);
    const face = p.pose !== 'back';
    return {
      a: { hx: 24 + hdx, hy: cy - 2 + hdy, hr: Math.round(ry), face, nx: 24, ny: cy + 3, bodyCx: 24, bodyCy: cy },
      tailPts,
    };
  }

  const isBird = spec.kind === 'bird';

  switch (p.pose) {
    case 'stand': {
      const hx = 32 + hdx;
      const hy = 19 + b + hdy;
      m.ellipse(21, 33 + b, 11 + bw, 7 + bh + q);
      if (spec.batWings) m.tri(7, 24 + b, 17, 21 + b, 17, 34 + b);
      if (isBird) {
        m.rect(18, 38 + b, 2, 45 - (38 + b) + 1);
        m.rect(26, 38 + b, 2, 45 - (38 + b) + 1);
      } else {
        const lifts = [
          [2, 0, 0, 2],
          [0, 0, 0, 0],
          [0, 2, 2, 0],
          [0, 0, 0, 0],
        ][phase];
        const legX = [12, 17, 26, 31];
        for (let i = 0; i < 4; i++) m.rect(legX[i], 36 + b, 3, 45 - (36 + b) - lifts[i] + 1);
      }
      m.circle(hx, hy, hr);
      addEars(m, look, hx, hy, hr, !!p.earFlat);
      tailPts = addTail(m, look, [11 - bw, 30 + b], t, p.pose);
      return { a: { hx, hy, hr, face: true, nx: hx - 3, ny: hy + hr - 2, bodyCx: 21, bodyCy: 33 + b }, tailPts };
    }
    case 'sit': {
      const hx = 26 + hdx;
      const hy = 16 + b + hdy;
      m.ellipse(21, 33 + b, 9 + bw, 11 + bh + q);
      m.circle(15, 38, 6 + bw / 2);
      if (spec.batWings) m.tri(8, 26 + b, 16, 22 + b, 16, 36 + b);
      m.rect(24, 34 + b, 3, 45 - (34 + b) + 1);
      if (p.pawUp) {
        m.circle(31, 30 + (p.pawY ?? 0), 3);
        m.rect(27, 33, 4, 3);
      } else if (p.lick) {
        m.circle(29, 24 + (p.lickY ?? 0), 3);
        m.rect(27, 27, 3, 6);
      } else {
        m.rect(28, 34 + b, 3, 45 - (34 + b) + 1);
      }
      m.circle(hx, hy, hr);
      addEars(m, look, hx, hy, hr, !!p.earFlat);
      tailPts = addTail(m, look, [13, 43], t, p.pose);
      return { a: { hx, hy, hr, face: true, nx: hx - 1, ny: hy + hr - 1, bodyCx: 21, bodyCy: 33 + b }, tailPts };
    }
    case 'lie': {
      const hx = 31 + hdx;
      const hy = 28 + b + hdy;
      m.ellipse(21, 37, 13 + bw, 6 + bh + q);
      m.circle(hx, hy, hr - 1);
      addEars(m, look, hx, hy, hr - 1, !!p.earFlat);
      m.rect(32, 41, 3, 3);
      m.rect(36, 41, 3, 3);
      tailPts = addTail(m, look, [8 - bw, 39], t, p.pose);
      return { a: { hx, hy, hr: hr - 1, face: true, nx: hx - 3, ny: hy + hr - 3, bodyCx: 21, bodyCy: 37 }, tailPts };
    }
    case 'curl': {
      const hx = 29 + hdx;
      const hy = 31 + b + hdy;
      m.circle(23, 36, 11 + bw + q * 0.5);
      m.circle(hx, hy, hr - 2);
      addEars(m, look, hx, hy, hr - 2, true);
      tailPts = addTail(m, look, [34, 42], 0.2, p.pose);
      return { a: { hx, hy, hr: hr - 2, face: true, nx: hx, ny: hy + hr - 3, bodyCx: 23, bodyCy: 36 }, tailPts };
    }
    case 'back': {
      const hx = 24 + hdx;
      const hy = 16 + b + hdy;
      m.ellipse(24, 34, 9 + bw, 10 + bh + q);
      m.circle(17, 39, 5);
      m.circle(31, 39, 5);
      m.circle(hx, hy, hr);
      addEars(m, look, hx, hy, hr, false);
      tailPts = addTail(m, look, [28, 43], t, p.pose);
      return { a: { hx, hy, hr, face: false, nx: hx, ny: hy + hr - 1, bodyCx: 24, bodyCy: 34 }, tailPts };
    }
    case 'hang': {
      const hx = 24 + hdx;
      const hy = 13 + hdy;
      m.ellipse(24, 31, 8 + bw, 11 + bh);
      const legX = [17, 21, 27, 31];
      for (let i = 0; i < 4; i++) {
        const dy = (phase + i) % 2 === 0 ? 0 : 2;
        m.rect(legX[i], 40 + dy, 2, 5);
      }
      m.circle(hx, hy, hr);
      addEars(m, look, hx, hy, hr, true);
      tailPts = addTail(m, look, [14 - bw, 36], t, p.pose);
      return { a: { hx, hy, hr, face: true, nx: hx, ny: hy + hr - 1, bodyCx: 24, bodyCy: 31 }, tailPts };
    }
    case 'jump': {
      const hx = 24 + hdx;
      const hy = 14 + b + hdy;
      m.ellipse(24, 30 + b, 8 + bw, 10 + bh);
      m.rect(18, 38 + b, 4, 3);
      m.rect(26, 38 + b, 4, 3);
      m.circle(hx, hy, hr - 1);
      addEars(m, look, hx, hy, hr - 1, true);
      tailPts = addTail(m, look, [14, 34], t, p.pose);
      return { a: { hx, hy, hr: hr - 1, face: true, nx: hx, ny: hy + hr - 2, bodyCx: 24, bodyCy: 30 + b }, tailPts };
    }
    case 'stretch': {
      const hx = 33 + hdx;
      const hy = 33 + b + hdy;
      m.circle(14, 31, 7 + bw / 2);
      m.ellipse(18, 33, 8 + bw, 5);
      m.ellipse(22, 36, 10 + bw, 5);
      m.circle(hx, hy, hr - 2);
      addEars(m, look, hx, hy, hr - 2, !!p.earFlat);
      m.rect(36, 38, 3, 8);
      m.rect(40, 38, 3, 8);
      tailPts = addTail(m, look, [9, 26], t + 0.3, p.pose);
      return { a: { hx, hy, hr: hr - 2, face: true, nx: hx - 2, ny: hy + hr - 3, bodyCx: 20, bodyCy: 34 }, tailPts };
    }
  }
}

// ---------------------------------------------------------------- 着色/花纹/材质

function shadingPass(ctx: CanvasRenderingContext2D, m: Mask, c: Colors): void {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!m.get(x, y)) continue;
      if (!m.get(x, y + 2) && !m.isEdge(x, y)) px(ctx, x, y, c.shade);
      else if (!m.get(x, y - 2) && y < 26 && !m.isEdge(x, y)) px(ctx, x, y, c.light);
    }
  }
}

function bounds(m: Mask): { minY: number; maxY: number } {
  let minY = GRID, maxY = 0;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++)
      if (m.get(x, y)) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  return { minY, maxY };
}

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function patternPass(ctx: CanvasRenderingContext2D, m: Mask, look: Look, a: Anchors): void {
  const c = look.colors;
  const id = look.pattern;
  if (id === 'pat_solid') return;
  const { minY, maxY } = bounds(m);
  const span = Math.max(1, maxY - minY);

  const mixHex = (t: number): string => (t < 0.33 ? c.body : t < 0.66 ? blend(c.body, c.pattern) : c.pattern);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!m.get(x, y) || m.isEdge(x, y)) continue;
      switch (id) {
        case 'pat_twotone':
          if (x < a.bodyCx - 2) px(ctx, x, y, c.pattern);
          break;
        case 'pat_cow':
          if (inBlob(x, y, a.bodyCx - 4, a.bodyCy - 2, 4, 3) || inBlob(x, y, a.bodyCx + 5, a.bodyCy + 3, 3, 3) || inBlob(x, y, a.hx - 3, a.hy - 4, 3, 2))
            px(ctx, x, y, c.pattern);
          break;
        case 'pat_tabby':
          if (y < a.bodyCy + 2 && ((x + (y >> 1)) % 6 < 2)) px(ctx, x, y, c.pattern);
          break;
        case 'pat_socks':
          if (y >= 41) px(ctx, x, y, c.belly);
          break;
        case 'pat_pudding':
          if (y <= minY + 7) px(ctx, x, y, c.pattern);
          break;
        case 'pat_spots':
          if (hash2(x >> 1, y >> 1) < 0.07) px(ctx, x, y, c.pattern);
          break;
        case 'pat_gradient':
          px(ctx, x, y, mixHex((y - minY) / span));
          break;
        case 'pat_tortie':
          if (hash2(x >> 2, y >> 2) < 0.45) px(ctx, x, y, hash2(1 + (x >> 2), y >> 2) < 0.5 ? c.pattern : c.shade);
          break;
        case 'pat_koi':
          px(ctx, x, y, c.belly);
          if (inBlob(x, y, a.bodyCx - 3, a.bodyCy - 1, 4, 3) || inBlob(x, y, a.hx + 2, a.hy - 3, 3, 2)) px(ctx, x, y, '#e06a4a');
          break;
        case 'pat_aurora': {
          const band = ((y + ((x >> 2) % 2)) >> 2) % 3;
          px(ctx, x, y, [c.light, c.body, c.pattern][band]);
          break;
        }
        case 'pat_nebula': {
          px(ctx, x, y, blend(c.body, c.outline));
          const h = hash2(x, y);
          if (h < 0.05) px(ctx, x, y, UI.white);
          else if (h < 0.18) px(ctx, x, y, c.pattern);
          else if (h < 0.3) px(ctx, x, y, c.light);
          break;
        }
        case 'pat_galaxy': {
          // 银河纹:深底 + 旋臂亮带 + 密集星点
          px(ctx, x, y, blend(c.outline, c.shade));
          const arm = Math.abs(((x - a.bodyCx) * 0.7 + (y - a.bodyCy) * 1.2) % 9);
          if (arm < 2) px(ctx, x, y, blend(c.light, c.pattern));
          const h = hash2(x, y);
          if (h < 0.08) px(ctx, x, y, UI.white);
          else if (h < 0.14) px(ctx, x, y, UI.gold);
          break;
        }
      }
    }
  }
}

function blend(a: string, b: string): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) + (pb >> 16)) >> 1;
  const g = (((pa >> 8) & 255) + ((pb >> 8) & 255)) >> 1;
  const bl = ((pa & 255) + (pb & 255)) >> 1;
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

function inBlob(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function materialPass(ctx: CanvasRenderingContext2D, m: Mask, look: Look, frameIdx: number): void {
  const c = look.colors;
  switch (look.material) {
    case 'mat_sleek':
      for (let i = 0; i < 6; i++) {
        const x = 16 + i;
        const y = 26 - i;
        if (m.get(x, y) && !m.isEdge(x, y)) px(ctx, x, y, c.light);
      }
      break;
    case 'mat_scales':
      for (let y = 0; y < GRID; y++)
        for (let x = 0; x < GRID; x++)
          if (m.get(x, y) && !m.isEdge(x, y) && (x + y * 2) % 5 === 0 && y > 24) px(ctx, x, y, c.shade);
      break;
    case 'mat_stardust': {
      for (let y = 0; y < GRID; y++)
        for (let x = 0; x < GRID; x++)
          if (m.get(x, y) && !m.isEdge(x, y) && hash2(x + frameIdx * 7, y) < 0.03)
            px(ctx, x, y, hash2(x, y + frameIdx) < 0.5 ? UI.white : UI.gold);
      break;
    }
    case 'mat_jelly': {
      const { minY } = bounds(m);
      for (let y = 0; y < GRID; y++)
        for (let x = 0; x < GRID; x++)
          if (m.get(x, y) && !m.isEdge(x, y) && inBlob(x, y, 19, minY + 6, 4, 3)) px(ctx, x, y, c.light);
      break;
    }
    default:
      for (let y = 0; y < GRID; y++)
        for (let x = 0; x < GRID; x++)
          if (!m.get(x, y) && m.get(x, y + 1) && hash2(x, y) < 0.22) px(ctx, x, y, c.body);
  }
}

// ---------------------------------------------------------------- 物种特征细节

function speciesDetail(ctx: CanvasRenderingContext2D, m: Mask, look: Look, a: Anchors, p: FP): void {
  const spec = specOf(look);
  const c = look.colors;
  const grounded = p.pose === 'stand' || p.pose === 'sit';

  if (spec.wingPatch && grounded) {
    const wm = new Mask();
    wm.ellipse(a.bodyCx - 3, a.bodyCy + 1, 4, 3);
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) if (wm.get(x, y) && m.get(x, y)) px(ctx, x, y, c.shade);
  }
  if (spec.bigBelly && a.face) {
    // 企鹅大白肚
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (m.get(x, y) && !m.isEdge(x, y) && inBlob(x, y, a.bodyCx + 2, a.bodyCy + 2, 6, 7))
          px(ctx, x, y, c.belly);
  }
  if (spec.spikes && grounded) {
    const top = (p.pose === 'stand' ? 26 : 24) + (p.bob ?? 0);
    for (let i = 0; i < 3; i++) {
      const sx = a.bodyCx - 5 + i * 4;
      px(ctx, sx, top - i, c.pattern, 2, 2);
      px(ctx, sx, top - i - 1, c.pattern, 1, 1);
    }
  }
  if (spec.spines && grounded) {
    // 刺猬:背部两排小刺
    const top = (p.pose === 'stand' ? 27 : 25) + (p.bob ?? 0);
    for (let i = 0; i < 5; i++) {
      const sx = a.bodyCx - 8 + i * 3;
      px(ctx, sx, top - (i % 2), c.pattern, 1, 2);
      px(ctx, sx, top - (i % 2) - 1, c.outline, 1, 1);
    }
  }
  if (spec.shell && grounded) {
    // 龟壳:身体上的大色块 + 网纹
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (m.get(x, y) && !m.isEdge(x, y) && inBlob(x, y, a.bodyCx - 1, a.bodyCy - 1, 8, 5)) {
          px(ctx, x, y, c.pattern);
          if ((x + y) % 4 === 0) px(ctx, x, y, c.shade);
        }
  }
  if (spec.antlers && a.face) {
    // 小鹿角
    const ax = a.hx;
    const ay = a.hy - a.hr;
    px(ctx, ax - 5, ay - 4, UI.antler, 1, 4);
    px(ctx, ax - 7, ay - 3, UI.antler, 2, 1);
    px(ctx, ax + 4, ay - 4, UI.antler, 1, 4);
    px(ctx, ax + 5, ay - 3, UI.antler, 2, 1);
  }
  if (spec.horn && a.face) {
    // 独角 + 鬃毛
    const ax = a.hx;
    const ay = a.hy - a.hr;
    px(ctx, ax - 1, ay - 5, UI.gold, 2, 5);
    px(ctx, ax, ay - 6, UI.goldDark, 1, 1);
    px(ctx, ax - a.hr + 1, ay + 3, c.pattern, 2, 5);
    px(ctx, ax - a.hr, ay + 6, c.pattern, 2, 4);
  }
  if (spec.crest && a.face) {
    // 凤凰头羽
    const ax = a.hx;
    const ay = a.hy - a.hr;
    px(ctx, ax - 2, ay - 4, c.accent, 1, 4);
    px(ctx, ax, ay - 5, c.pattern, 1, 5);
    px(ctx, ax + 2, ay - 3, c.accent, 1, 3);
  }
  if (spec.tentacles && grounded) {
    // 章鱼吸盘点
    for (let i = 0; i < 3; i++) px(ctx, 17 + i * 7, 43, c.belly, 1, 1);
  }
  if (spec.batWings && grounded) {
    // 蝠翼膜面
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (m.get(x, y) && x < a.bodyCx - 5 && y < a.bodyCy + 3 && !m.isEdge(x, y) && hash2(x, y) < 0.5)
          px(ctx, x, y, c.shade);
  }
}

// ---------------------------------------------------------------- 五官

function drawOpenEye(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, right: boolean): void {
  const c = look.colors;
  switch (look.eyes) {
    case 'eye_almond':
      px(ctx, x, y, UI.eye, 2, 2);
      px(ctx, x, y, UI.white);
      break;
    case 'eye_sleepy':
      px(ctx, x - 1, y, UI.eye, 3, 1);
      px(ctx, x, y + 1, UI.eye, 2, 1);
      break;
    case 'eye_catslit':
      px(ctx, x, y - 1, UI.eye, 2, 4);
      px(ctx, x, y, c.accent, 1, 2);
      px(ctx, x, y - 1, UI.white);
      break;
    case 'eye_button':
      px(ctx, x, y, UI.eye, 2, 2);
      break;
    case 'eye_star':
      px(ctx, x, y - 1, c.accent);
      px(ctx, x - 1, y, c.accent, 3, 1);
      px(ctx, x, y + 1, c.accent);
      px(ctx, x, y, UI.white);
      break;
    case 'eye_hetero':
      px(ctx, x, y, UI.eye, 2, 3);
      px(ctx, x, y + 1, right ? c.accent : c.pattern, 2, 1);
      px(ctx, x, y, UI.white);
      break;
    case 'eye_swirl':
      px(ctx, x - 1, y - 1, UI.eye, 3, 3);
      px(ctx, x, y, c.light);
      break;
    default:
      px(ctx, x, y, UI.eye, 2, 3);
      px(ctx, x, y, UI.white);
  }
}

function drawFace(ctx: CanvasRenderingContext2D, look: Look, a: Anchors, p: FP): void {
  const { hx, hy } = a;
  const c = look.colors;
  const spec = specOf(look);
  const eye = p.eye ?? 'open';
  const lx = hx - 5;
  const rx = hx + 3;
  const ey = hy - 1;

  if (spec.mask) {
    // 熊猫眼斑(画在眼睛下层)
    for (let yy = ey - 2; yy <= ey + 3; yy++)
      for (let xx = lx - 2; xx <= lx + 3; xx++) if (inBlob(xx, yy, lx + 0.5, ey + 0.5, 3, 3)) px(ctx, xx, yy, UI.pandaDark);
    for (let yy = ey - 2; yy <= ey + 3; yy++)
      for (let xx = rx - 2; xx <= rx + 3; xx++) if (inBlob(xx, yy, rx + 0.5, ey + 0.5, 3, 3)) px(ctx, xx, yy, UI.pandaDark);
  }
  if (spec.eyeRings) {
    // 猫头鹰眼环
    for (const cx0 of [lx + 0.5, rx + 0.5])
      for (let yy = ey - 3; yy <= ey + 4; yy++)
        for (let xx = cx0 - 4; xx <= cx0 + 4; xx++) {
          const d = ((xx - cx0) / 3.2) ** 2 + ((yy - ey - 0.5) / 3.2) ** 2;
          if (d <= 1 && d > 0.5) px(ctx, xx, yy, c.belly);
        }
  }

  if (eye === 'open') {
    drawOpenEye(ctx, look, lx, ey, false);
    drawOpenEye(ctx, look, rx, ey, true);
  } else if (eye === 'wide') {
    px(ctx, lx - 1, ey - 1, UI.eye, 3, 3);
    px(ctx, rx, ey - 1, UI.eye, 3, 3);
    px(ctx, lx - 1, ey - 1, UI.white);
    px(ctx, rx, ey - 1, UI.white);
  } else if (eye === 'half') {
    px(ctx, lx, ey + 1, UI.eye, 2, 2);
    px(ctx, rx, ey + 1, UI.eye, 2, 2);
  } else if (eye === 'closed') {
    px(ctx, lx - 1, ey + 1, UI.eye, 3, 1);
    px(ctx, rx, ey + 1, UI.eye, 3, 1);
  } else if (eye === 'happy') {
    px(ctx, lx - 1, ey + 1, UI.eye);
    px(ctx, lx, ey, UI.eye);
    px(ctx, lx + 1, ey + 1, UI.eye);
    px(ctx, rx - 1, ey + 1, UI.eye);
    px(ctx, rx, ey, UI.eye);
    px(ctx, rx + 1, ey + 1, UI.eye);
  }

  if (spec.beak || spec.flatBeak) {
    if (spec.flatBeak) {
      px(ctx, hx - 2, hy + 2, UI.duckBeak, 5, 2);
      px(ctx, hx - 1, hy + 4, UI.duckBeak, 3, 1);
    } else {
      px(ctx, hx - 1, hy + 2, UI.beak, 3, 1);
      px(ctx, hx, hy + 3, UI.beak, 1, 1);
    }
    if (p.mouth === 'open' || p.mouth === 'o') px(ctx, hx, hy + 5, UI.eye);
    if (p.blush) cheeks(ctx, hx, hy);
    return;
  }

  if (spec.muzzle) {
    for (let yy = hy + 2; yy <= hy + 4; yy++)
      for (let xx = hx - 3; xx <= hx + 3; xx++)
        if (inBlob(xx, yy, hx, hy + 3, 3.4, 2)) px(ctx, xx, yy, c.belly);
  }
  px(ctx, hx - 1, hy + 2, '#d9776b', 2, 1);

  const mouthState = p.mouth;
  const my = hy + 4;
  if (mouthState === 'o') {
    px(ctx, hx - 1, my, UI.eye, 2, 2);
  } else if (mouthState === 'open') {
    px(ctx, hx - 2, my, UI.eye, 4, 3);
    px(ctx, hx - 1, my + 1, '#f09090', 2, 1);
  } else if (mouthState === 'smile' || mouthState === undefined) {
    switch (look.mouth) {
      case 'mouth_w':
        px(ctx, hx - 3, my, UI.eye);
        px(ctx, hx - 2, my + 1, UI.eye);
        px(ctx, hx - 1, my, UI.eye);
        px(ctx, hx, my + 1, UI.eye);
        px(ctx, hx + 1, my, UI.eye);
        break;
      case 'mouth_flat':
        px(ctx, hx - 1, my, UI.eye, 3, 1);
        break;
      case 'mouth_fang':
        px(ctx, hx - 2, my, UI.eye);
        px(ctx, hx - 1, my + 1, UI.eye, 2, 1);
        px(ctx, hx + 1, my, UI.eye);
        px(ctx, hx + 1, my + 1, UI.white);
        break;
      default:
        px(ctx, hx - 2, my, UI.eye);
        px(ctx, hx - 1, my + 1, UI.eye, 2, 1);
        px(ctx, hx + 1, my, UI.eye);
    }
  }
  if (p.blush) cheeks(ctx, hx, hy);
}

function cheeks(ctx: CanvasRenderingContext2D, hx: number, hy: number): void {
  px(ctx, hx - 8, hy + 2, UI.blushC, 2, 1);
  px(ctx, hx + 6, hy + 2, UI.blushC, 2, 1);
}

// ---------------------------------------------------------------- 配饰

function drawHeadwear(ctx: CanvasRenderingContext2D, look: Look, a: Anchors): void {
  const { hx, hy, hr } = a;
  const c = look.colors;
  const topY = hy - hr;
  switch (look.headwear) {
    case 'head_cap': {
      const cm = new Mask();
      cm.ellipse(hx, topY + 1, hr - 2, 3);
      paintMask(ctx, cm, c.accent);
      outlineMask(ctx, cm, c.outline);
      px(ctx, hx, topY - 3, c.light, 2, 2);
      break;
    }
    case 'head_bow': {
      const bx = hx + 5;
      const by = topY + 1;
      px(ctx, bx - 4, by - 2, c.accent, 3, 4);
      px(ctx, bx + 2, by - 2, c.accent, 3, 4);
      px(ctx, bx - 1, by - 1, c.pattern, 2, 2);
      break;
    }
    case 'head_flower': {
      const fx = hx - 6;
      const fy = topY + 1;
      px(ctx, fx, fy - 2, UI.white);
      px(ctx, fx - 2, fy, UI.white);
      px(ctx, fx + 2, fy, UI.white);
      px(ctx, fx, fy + 2, UI.white);
      px(ctx, fx, fy, UI.gold);
      break;
    }
    case 'head_glasses': {
      const ey = hy - 2;
      frameRect(ctx, hx - 6, ey, 4, 4);
      frameRect(ctx, hx + 2, ey, 4, 4);
      px(ctx, hx - 2, ey + 1, UI.frame, 4, 1);
      break;
    }
    case 'head_beret': {
      const cm = new Mask();
      cm.ellipse(hx - 1, topY, hr - 1, 2.5);
      paintMask(ctx, cm, c.pattern);
      outlineMask(ctx, cm, c.outline);
      px(ctx, hx - 1, topY - 3, c.outline, 1, 2);
      break;
    }
    case 'head_monocle': {
      frameRect(ctx, hx + 2, hy - 2, 4, 4);
      px(ctx, hx + 6, hy + 2, UI.frame, 1, 3);
      break;
    }
    case 'head_crown': {
      px(ctx, hx - 3, topY - 2, UI.gold, 7, 2);
      px(ctx, hx - 3, topY - 4, UI.gold, 1, 2);
      px(ctx, hx, topY - 5, UI.gold, 1, 3);
      px(ctx, hx + 3, topY - 4, UI.gold, 1, 2);
      px(ctx, hx, topY - 1, UI.gem);
      break;
    }
    case 'head_halo': {
      const yy = topY - 5;
      px(ctx, hx - 3, yy, UI.gold, 7, 1);
      px(ctx, hx - 4, yy + 1, UI.gold, 2, 1);
      px(ctx, hx + 3, yy + 1, UI.gold, 2, 1);
      px(ctx, hx - 2, yy + 2, UI.gold, 5, 1);
      break;
    }
  }
}

function frameRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  px(ctx, x, y, UI.frame, w, 1);
  px(ctx, x, y + h - 1, UI.frame, w, 1);
  px(ctx, x, y, UI.frame, 1, h);
  px(ctx, x + w - 1, y, UI.frame, 1, h);
}

function drawNeckwear(ctx: CanvasRenderingContext2D, look: Look, a: Anchors): void {
  const { nx, ny } = a;
  const c = look.colors;
  switch (look.neckwear) {
    case 'neck_scarf':
      px(ctx, nx - 5, ny, c.accent, 11, 3);
      px(ctx, nx + 2, ny + 3, c.accent, 3, 4);
      px(ctx, nx + 2, ny + 7, c.pattern, 3, 1);
      break;
    case 'neck_bell':
      px(ctx, nx - 5, ny, c.outline, 11, 1);
      px(ctx, nx - 1, ny + 1, UI.gold, 3, 3);
      px(ctx, nx, ny + 3, UI.goldDark, 1, 1);
      break;
    case 'neck_bowtie':
      px(ctx, nx - 4, ny + 1, c.accent, 3, 3);
      px(ctx, nx + 2, ny + 1, c.accent, 3, 3);
      px(ctx, nx - 1, ny + 2, c.pattern, 2, 2);
      break;
    case 'neck_necklace':
      px(ctx, nx - 4, ny + 1, UI.gold);
      px(ctx, nx - 2, ny + 2, UI.gold);
      px(ctx, nx + 2, ny + 2, UI.gold);
      px(ctx, nx + 4, ny + 1, UI.gold);
      px(ctx, nx - 1, ny + 3, UI.gem, 2, 2);
      break;
  }
}

function drawCapeBehind(ctx: CanvasRenderingContext2D, look: Look, p: FP): void {
  if (look.neckwear !== 'neck_cape') return;
  const c = look.colors;
  const cm = new Mask();
  if (p.pose === 'stand') cm.ellipse(13, 32 + (p.bob ?? 0), 7, 9);
  else cm.ellipse(14, 33 + (p.bob ?? 0), 7, 10);
  paintMask(ctx, cm, c.pattern);
  outlineMask(ctx, cm, c.outline);
  px(ctx, 11, 30, UI.gold);
  px(ctx, 15, 35, UI.gold);
  px(ctx, 12, 38, UI.gold);
}

// ---------------------------------------------------------------- 状态图标 / 道具

function drawExtras(ctx: CanvasRenderingContext2D, a: Anchors, p: FP): void {
  if (p.zzz) {
    const spots: Array<[number, number]> = [
      [36, 14],
      [40, 9],
      [43, 4],
    ];
    for (let i = 0; i < Math.min(p.zzz, 3); i++) {
      const [x, y] = spots[i];
      px(ctx, x, y, UI.zzz, 3, 1);
      px(ctx, x + 1, y + 1, UI.zzz);
      px(ctx, x, y + 2, UI.zzz, 3, 1);
    }
  }
  if (p.excl) {
    px(ctx, a.hx + 9, a.hy - 15, UI.excl, 2, 4);
    px(ctx, a.hx + 9, a.hy - 10, UI.excl, 2, 2);
  }
  if (p.sweat) {
    px(ctx, a.hx + 11, a.hy - 3, UI.sweat, 1, 2);
    px(ctx, a.hx + 13, a.hy + 1, UI.sweat, 1, 2);
  }
  if (p.dust) {
    px(ctx, 5, 43, UI.dust, 2, 1);
    px(ctx, 8, 44, UI.dust, 1, 1);
    px(ctx, 6, 41, UI.dust, 1, 1);
  }
  if (p.angry) {
    const ax = a.hx + 11;
    const ay = a.hy - 8;
    px(ctx, ax, ay, UI.angryC, 2, 1);
    px(ctx, ax + 1, ay + 1, UI.angryC, 2, 1);
    px(ctx, ax, ay + 2, UI.angryC, 2, 1);
  }
  if (p.heart) {
    const big = (p.frameIdx ?? 0) % 2 === 0;
    const hx0 = a.hx + 10;
    const hy0 = a.hy - 12 + (big ? 0 : 1);
    px(ctx, hx0, hy0, UI.blushC);
    px(ctx, hx0 + 2, hy0, UI.blushC);
    px(ctx, hx0 - 1, hy0 + 1, UI.blushC, 5, 1);
    px(ctx, hx0, hy0 + 2, UI.blushC, 3, 1);
    px(ctx, hx0 + 1, hy0 + 3, UI.blushC);
    if (big) {
      px(ctx, a.hx - 12, a.hy - 6, UI.blushC);
      px(ctx, a.hx - 13, a.hy - 5, UI.blushC, 3, 1);
      px(ctx, a.hx - 12, a.hy - 4, UI.blushC);
    }
  }
  const j = p.itemJitter ?? 0;
  if (p.item === 'bowl') {
    px(ctx, 37, 40, UI.bowlRim, 9, 1);
    px(ctx, 37, 41, UI.bowl, 9, 3);
    px(ctx, 38, 44, UI.bowlRim, 7, 1);
    px(ctx, 39, 39, UI.food, 2, 1);
    px(ctx, 42, 38, UI.food, 2, 1);
    px(ctx, 40, 37, UI.food, 1, 1);
  } else if (p.item === 'yarn') {
    const ym = new Mask();
    ym.circle(40 + j, 41, 4);
    paintMask(ctx, ym, UI.yarn);
    outlineMask(ctx, ym, UI.yarnLine);
    px(ctx, 38 + j, 40, UI.yarnLine, 4, 1);
    px(ctx, 40 + j, 38, UI.yarnLine, 1, 4);
  }
}

// ---------------------------------------------------------------- 主入口

export function drawPetFrame(look: Look, p: FP): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext('2d')!;
  const c = look.colors;
  const spec = specOf(look);
  const frameIdx = p.frameIdx ?? 0;

  drawCapeBehind(ctx, look, p);

  const m = new Mask();
  const { a, tailPts } = buildSilhouette(m, look, p);

  const jelly = look.material === 'mat_jelly';
  paintMask(ctx, m, c.body, jelly ? 0.88 : 1);
  shadingPass(ctx, m, c);
  patternPass(ctx, m, look, a);
  materialPass(ctx, m, look, frameIdx);
  outlineMask(ctx, m, c.outline);
  tailDetail(ctx, look, tailPts);

  if (!jelly && look.pattern !== 'pat_koi' && spec.kind !== 'bird' && !spec.shell) {
    if (p.pose === 'sit') paintBelly(ctx, m, c, 23, 34 + (p.bob ?? 0), 4, 5);
    else if (p.pose === 'stand') paintBelly(ctx, m, c, 22, 37 + (p.bob ?? 0), 5, 2);
  }

  speciesDetail(ctx, m, look, a, p);

  earInnerDetail(ctx, look, a.hx, a.hy, a.hr, !!p.earFlat || p.pose === 'curl' || p.pose === 'hang' || p.pose === 'jump');

  if (a.face) {
    if (p.pose === 'curl') {
      px(ctx, a.hx - 5, a.hy, UI.eye, 3, 1);
      px(ctx, a.hx + 2, a.hy, UI.eye, 3, 1);
    } else {
      drawFace(ctx, look, a, p);
    }
  }

  if (a.face || p.pose === 'back') drawHeadwear(ctx, look, a);
  if (a.face) drawNeckwear(ctx, look, a);

  if (look.effects.includes('fx_glow')) {
    haloMask(ctx, m, c.accent, 0.5);
  }

  drawExtras(ctx, a, p);
  return canvas;
}

function paintBelly(ctx: CanvasRenderingContext2D, m: Mask, c: Colors, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      if (inBlob(x, y, cx, cy, rx, ry) && m.get(x, y) && !m.isEdge(x, y)) px(ctx, x, y, c.belly);
}
