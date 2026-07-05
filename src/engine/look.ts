/**
 * 新矢量渲染系统的宠物外观描述:物种 + 配色 + 特效。
 * 收藏部件(耳/尾/花纹/头饰/颈饰/材质)的具体 id 仍保存在存档里供图鉴/成就使用,
 * 但视觉呈现由物种 rig 决定;把它们接回矢量渲染是后续一轮的工作。
 */
import type { Colors } from '../gen/generator';
import { LightEffectField } from './lightEffects';
import { getSpeciesRig } from './species';

export interface Look {
  species: string;
  colors: Colors;
  effects: string[];
}

export function lookFromParts(ids: Record<string, string>, effects: string[], colors: Colors): Look {
  return {
    species: ids.species ?? 'sp_cat',
    colors,
    effects,
  };
}

/** 静态立绘(图鉴/抽卡结算用):不挂播放器,只上色 + 定格一帧光效 */
export function renderPortrait(look: Look): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pet-portrait';
  wrap.style.display = 'block';
  wrap.innerHTML = getSpeciesRig(look.species).svg;
  const svg = wrap.querySelector('svg') as SVGSVGElement;
  svg.style.width = '100%';
  svg.style.height = '100%';

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
