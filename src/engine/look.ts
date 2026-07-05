/**
 * 矢量渲染系统的宠物外观描述:物种 + 体型 + 耳/尾/头饰/颈饰 + 配色 + 特效。
 * 耳/尾/头饰/颈饰/体型这几个收藏维度已重新接回渲染(见 engine/species/generate.ts),
 * 图鉴里点亮的部件会在宠物身上真正体现出来,而不再是纯数据标签。
 * 材质/花纹/眼睛/嘴型暂未接入矢量渲染,留待后续一轮。
 */
import type { Colors } from '../gen/generator';
import { LightEffectField } from './lightEffects';
import { buildLookRig } from './species';

export interface Look {
  species: string;
  body: string;
  material: string;
  ears: string;
  tail: string;
  headwear: string;
  neckwear: string;
  colors: Colors;
  effects: string[];
}

export const BODY_SCALE: Record<string, number> = {
  body_round: 1.06,
  body_slim: 0.94,
  body_chub: 1.18,
  body_mini: 0.78,
};

export function lookFromParts(ids: Record<string, string>, effects: string[], colors: Colors): Look {
  return {
    species: ids.species ?? 'sp_cat',
    body: ids.body ?? 'body_round',
    material: ids.material ?? 'mat_fur',
    ears: ids.ears ?? 'ears_up',
    tail: ids.tail ?? 'tail_long',
    headwear: ids.headwear ?? 'head_none',
    neckwear: ids.neckwear ?? 'neck_none',
    colors,
    effects,
  };
}

/** 静态立绘(图鉴/抽卡结算用):不挂播放器,只上色 + 定格一帧光效 */
export function renderPortrait(look: Look): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pet-portrait';
  wrap.style.display = 'block';
  wrap.innerHTML = buildLookRig(look).svg;
  const svg = wrap.querySelector('svg') as SVGSVGElement;
  svg.style.width = '100%';
  svg.style.height = '100%';
  const scale = BODY_SCALE[look.body] ?? 1;
  if (scale !== 1) {
    svg.style.transform = `scale(${scale})`;
    svg.style.transformOrigin = '50% 90%';
  }

  const c = look.colors;
  const accent = c.animated && c.gradientStops ? c.gradientStops[0] : c.accent;
  const vars: Record<string, string> = {
    'c-body': c.body,
    'c-shade': c.shade,
    'c-light': c.light,
    'c-belly': c.belly,
    'c-outline': c.outline,
    'c-pattern': c.pattern,
    'c-accent': accent,
  };
  for (const [k, v] of Object.entries(vars)) svg.style.setProperty(`--${k}`, v);

  if (look.effects.length > 0) {
    const lights = new LightEffectField(svg, svg.firstElementChild as SVGElement | null);
    lights.configure(look.effects.slice(0, 2), { cx: 50, cy: 55, radius: 30, accent });
    lights.tick(400, { cx: 50, cy: 55, radius: 30, accent });
  }
  return wrap;
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
