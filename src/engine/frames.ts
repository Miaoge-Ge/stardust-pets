/** 动作帧参数表(与形态解耦):buildFrameSets(look) 为任意部件组合生成全套动作帧 */
import type { Colors } from '../gen/generator';
import { GRID } from './pixel';
import { renderFrame, type FP, type Look } from './petArt';

/** 贴图尺寸:48 基底 → 2×(96 精修)→ 2× = 192,渲染层线性缩到展示尺寸 */
export const TEX_SIZE = GRID * 4;

/** 平滑正弦序列工具:生成 n 帧 0→1→0 的呼吸曲线 */
function breathe(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (1 - Math.cos((i / n) * Math.PI * 2)) / 2);
}

function sit(over: Partial<FP> = {}): FP {
  return { pose: 'sit', ...over };
}

function buildLists(): Record<string, FP[]> {
  const lists: Record<string, FP[]> = {};

  // 8 帧正弦呼吸 + 尾巴连续摆动,待机更柔和
  const sq8 = breathe(8).map((v) => v * 0.9);
  const tw8 = breathe(8).map((v, i) => -0.4 + v * 0.9 + (i % 2) * 0.05);

  lists.sit = sq8.map((s, i) =>
    sit({ squash: s, tail: tw8[i], eye: i === 6 ? 'closed' : 'open' })
  );

  lists.lie = sq8.map((s, i) => ({
    pose: 'lie' as const,
    squash: s * 0.6,
    tail: tw8[i],
    eye: i === 6 ? 'closed' : 'half',
    mouth: 'none' as const,
  }));

  lists.sleep = [0, 0.6, 1, 0.6].map((s, i) => ({
    pose: 'curl' as const,
    squash: s,
    zzz: [1, 2, 3, 2][i],
  }));

  lists.daze = [0, 1, 1, 0].map((d, i) =>
    sit({ eye: 'half', mouth: 'none', headDy: d, tail: [0, 0.2, 0.3, 0.2][i] })
  );

  lists.yawn = (['none', 'o', 'open', 'open', 'o', 'none'] as const).map((mo, i) =>
    sit({
      mouth: mo,
      eye: (['open', 'half', 'closed', 'closed', 'half', 'open'] as const)[i],
      headDy: [0, 0, -1, -1, 0, 0][i],
    })
  );

  lists.groom = [0, 2, 0, 2, 0, 2].map((ly, i) =>
    sit({
      lick: true,
      lickY: ly,
      headDx: -1,
      headDy: 2,
      eye: ly ? 'closed' : 'half',
      tail: [0.2, 0.3, 0.2, 0.3, 0.2, 0.3][i],
    })
  );

  lists.tail_chase = [1, 0.5, -0.5, -1, -0.5, 0.5].map((t, i) => ({
    pose: 'stand' as const,
    tail: t,
    legPhase: i % 4,
    headDx: -2,
    bob: i % 2 === 0 ? 0 : -1,
    dust: i % 2 === 0,
  }));

  lists.stretch = [0.2, 0.5, 0.8, 0.5].map((t) => ({
    pose: 'stretch' as const,
    tail: t,
    eye: 'closed' as const,
  }));

  // 8 相步态:半抬腿过渡帧 + 正弦身体起伏
  const bob8 = breathe(8);
  lists.walk = [0, 1, 2, 3, 4, 5, 6, 7].map((ph) => ({
    pose: 'stand' as const,
    legPhase: ph,
    bob: -bob8[ph],
    tail: 0.2 + bob8[ph] * 0.2,
  }));

  lists.run = [0, 1, 2, 3, 4, 5, 6, 7].map((ph) => ({
    pose: 'stand' as const,
    legPhase: ph,
    bob: -1 - bob8[ph] * 1.2,
    earFlat: true,
    tail: -0.8 + bob8[ph] * 0.15,
    dust: ph % 4 === 0,
  }));

  lists.jump = [0, -1].map((b) => ({
    pose: 'jump' as const,
    bob: b,
    eye: 'open' as const,
  }));

  lists.hang = [0, 1, 2, 3].map((ph) => ({
    pose: 'hang' as const,
    legPhase: ph,
    eye: 'wide' as const,
    sweat: true,
    tail: ph % 2 === 0 ? 0.3 : -0.3,
  }));

  lists.happy = [-2, -6, -2, 0].map((b, i) => ({
    pose: 'stand' as const,
    bob: b,
    squash: [0.5, -0.5, 0.5, 1][i],
    eye: 'happy' as const,
    tail: 0.6,
  }));

  lists.petted = [1, 0, 1, 0].map((d, i) =>
    sit({ eye: 'happy', blush: true, headDy: d, tail: [0.3, 0.5, 0.3, 0.5][i] })
  );

  lists.sign = [0, -1, 0, -1].map((py, i) =>
    sit({ pawUp: true, pawY: py, mouth: (['o', 'smile', 'o', 'smile'] as const)[i], eye: 'open' })
  );

  lists.sulk = [-0.8, -0.3, 0.4, -0.3].map((t, i) => ({
    pose: 'back' as const,
    tail: t,
    angry: i % 2 === 0,
  }));

  lists.eat = [0, 3, 5, 5, 3, 0].map((hd, i) =>
    sit({
      item: 'bowl',
      headDy: hd,
      headDx: [0, 2, 4, 4, 2, 0][i],
      mouth: (['none', 'o', 'none', 'o', 'none', 'smile'] as const)[i],
      eye: hd > 3 ? 'closed' : 'open',
    })
  );

  lists.yarn = [-1, 0, 1, 0, -1, 0].map((j, i) =>
    sit({
      item: 'yarn',
      itemJitter: j,
      pawUp: true,
      pawY: [0, 2, 0, 2, 0, 2][i],
      eye: 'open',
      tail: 0.4,
    })
  );

  lists.curious = [0, -1].map((d) => sit({ headDx: 3, headDy: d, eye: 'wide', mouth: 'o' }));

  // Lv3 解锁:撒娇蹭手
  lists.snuggle = [2, 3, 2, 1].map((dx, i) =>
    sit({
      headDx: dx,
      headDy: i % 2 === 0 ? 1 : 0,
      eye: 'happy',
      blush: true,
      heart: true,
      tail: [0.4, 0.6, 0.4, 0.6][i],
    })
  );

  lists.wake = [-1, 1, -1, 1].map((dx) => sit({ headDx: dx, eye: 'wide', excl: true, mouth: 'o' }));

  return lists;
}

const LISTS = buildLists();

export function buildFrameSets(look: Look): Record<string, HTMLCanvasElement[]> {
  const out: Record<string, HTMLCanvasElement[]> = {};
  for (const [key, frames] of Object.entries(LISTS)) {
    out[key] = frames.map((fp, i) => renderFrame(look, { ...fp, frameIdx: i }));
  }
  return out;
}

/** 单帧立绘(图鉴/抽卡结算用):坐姿第 1 帧,已精修放大 */
export function drawPortrait(look: Look): HTMLCanvasElement {
  return renderFrame(look, { pose: 'sit', eye: 'open', tail: 0.3, frameIdx: 0 });
}

/** 兼容旧存档(一期占位宠物)与生成器输出 → Look */
export function lookFromParts(
  ids: Record<string, string>,
  effects: string[],
  colors: Colors
): Look {
  return {
    species: ids.species ?? 'sp_cat',
    body: ids.body ?? 'body_round',
    material: ids.material ?? 'mat_fur',
    ears: ids.ears ?? 'ears_up',
    tail: ids.tail ?? 'tail_long',
    eyes: ids.eyes ?? 'eye_round',
    mouth: ids.mouth ?? 'mouth_smile',
    pattern: ids.pattern ?? 'pat_tabby',
    headwear: ids.headwear ?? 'head_none',
    neckwear: ids.neckwear ?? 'neck_none',
    effects,
    colors,
  };
}

export const DEFAULT_COLORS: Colors = {
  body: '#f2a659',
  shade: '#cf8443',
  light: '#f8c084',
  belly: '#ffe8c8',
  outline: '#43301f',
  pattern: '#d9823b',
  accent: '#5a9fd9',
  animated: false,
};
