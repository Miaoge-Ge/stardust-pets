/**
 * 光效库:22 种基于 SVG 渐变/滤镜的光效预设,数据驱动,按稀有度解锁组合。
 * 每个预设是一个"构建+逐帧更新"函数对,构建时向宿主 SVG 注入渐变/滤镜定义
 * 与一个覆盖层元素,update 每帧调整其透明度/位置/色相,模拟光的呼吸/流动/闪烁。
 */

export interface LightCtx {
  root: SVGSVGElement;
  layer: SVGGElement; // 光效覆盖层容器(在角色之下或之上,由调用方决定顺序)
  cx: number;
  cy: number; // 角色中心(viewBox 坐标)
  radius: number; // 角色大致半径,光效尺寸据此缩放
  accent: string;
}

export interface LightEffect {
  id: string;
  name: string;
  build(ctx: LightCtx): SVGElement[];
  update(els: SVGElement[], ctx: LightCtx, tMs: number): void;
}

function ns(): string {
  return 'http://www.w3.org/2000/svg';
}
function el<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(ns(), tag) as SVGElementTagNameMap[K];
}
function addRadialDef(root: SVGSVGElement, id: string, stops: Array<[number, string, number?]>): void {
  if (root.querySelector(`#${id}`)) return;
  let defs = root.querySelector('defs[data-light-defs]') as SVGDefsElement | null;
  if (!defs) {
    defs = el('defs');
    defs.setAttribute('data-light-defs', '1');
    root.insertBefore(defs, root.firstChild);
  }
  const g = el('radialGradient');
  g.setAttribute('id', id);
  for (const [off, color, op] of stops) {
    const s = el('stop');
    s.setAttribute('offset', `${off * 100}%`);
    s.setAttribute('stop-color', color);
    if (op !== undefined) s.setAttribute('stop-opacity', String(op));
    g.appendChild(s);
  }
  defs.appendChild(g);
}

const TWO_PI = Math.PI * 2;

function simpleHalo(id: string, name: string, color: (ctx: LightCtx) => string, scale = 1.6): LightEffect {
  return {
    id,
    name,
    build(ctx) {
      const gradId = `grad-${id}`;
      addRadialDef(ctx.root, gradId, [
        [0, color(ctx), 0.5],
        [0.7, color(ctx), 0.18],
        [1, color(ctx), 0],
      ]);
      const c = el('circle');
      c.setAttribute('cx', String(ctx.cx));
      c.setAttribute('cy', String(ctx.cy));
      c.setAttribute('r', String(ctx.radius * scale));
      c.setAttribute('fill', `url(#${gradId})`);
      ctx.layer.appendChild(c);
      return [c];
    },
    update(els, _ctx, tMs) {
      const s = 1 + 0.08 * Math.sin(tMs / 420);
      els[0].setAttribute('transform', `scale(${s})`);
      (els[0] as SVGElement).style.transformOrigin = 'center';
      (els[0] as SVGElement).style.opacity = String(0.6 + 0.4 * Math.sin(tMs / 420));
    },
  };
}

export const LIGHT_EFFECTS: LightEffect[] = [
  simpleHalo('fx_breath', '呼吸光晕', (c) => c.accent, 1.5),
  simpleHalo('fx_holy', '圣光环', () => '#ffe9a0', 1.7),
  simpleHalo('fx_bioluminescent', '生物荧光', (c) => c.accent, 1.2),
  simpleHalo('fx_ember_glow', '余烬光', () => '#ff7a3c', 1.4),
  simpleHalo('fx_ice_shimmer', '冰晶微光', () => '#bfeaff', 1.4),
  simpleHalo('fx_frost_aura', '霜冻光环', () => '#d8f4ff', 1.8),
  simpleHalo('fx_lava_glow', '熔岩光', () => '#ff5a3c', 1.5),
  simpleHalo('fx_moonlight', '月光洒落', () => '#dfe6ff', 2.0),

  {
    id: 'fx_glow', name: '发光描边',
    build(ctx) {
      const g = el('g');
      g.setAttribute('filter', 'blur(2px)');
      g.style.filter = `drop-shadow(0 0 4px ${ctx.accent})`;
      ctx.layer.appendChild(g);
      return [g];
    },
    update(els, ctx, tMs) {
      (els[0] as SVGElement).style.filter = `drop-shadow(0 0 ${3 + Math.sin(tMs / 350) * 2}px ${ctx.accent})`;
    },
  },
  {
    id: 'fx_rim_light', name: '轮廓光',
    build(ctx) {
      const c = el('ellipse');
      c.setAttribute('cx', String(ctx.cx + ctx.radius * 0.6));
      c.setAttribute('cy', String(ctx.cy - ctx.radius * 0.5));
      c.setAttribute('rx', String(ctx.radius * 0.25));
      c.setAttribute('ry', String(ctx.radius * 0.6));
      c.setAttribute('fill', '#ffffff');
      c.style.opacity = '0.35';
      c.style.mixBlendMode = 'screen';
      ctx.layer.appendChild(c);
      return [c];
    },
    update(els, _ctx, tMs) {
      (els[0] as SVGElement).style.opacity = String(0.25 + 0.2 * Math.sin(tMs / 600));
    },
  },
  {
    id: 'fx_neon_outline', name: '霓虹描边',
    build(ctx) {
      const g = el('g');
      g.style.filter = `drop-shadow(0 0 3px ${ctx.accent}) drop-shadow(0 0 6px ${ctx.accent})`;
      ctx.layer.appendChild(g);
      return [g];
    },
    update(els, _ctx, tMs) {
      const flicker = Math.random() < 0.02 ? 0.4 : 1;
      (els[0] as SVGElement).style.opacity = String(flicker);
    },
  },
  {
    id: 'fx_chromatic_pulse', name: '色差脉冲',
    build(ctx) {
      const g = el('g');
      ctx.layer.appendChild(g);
      return [g];
    },
    update(els, _ctx, tMs) {
      const s = 1 + 0.015 * Math.sin(tMs / 200);
      (els[0] as SVGElement).style.filter =
        `drop-shadow(${2 * s}px 0 0 rgba(255,0,80,.35)) drop-shadow(${-2 * s}px 0 0 rgba(0,200,255,.35))`;
    },
  },
  {
    id: 'fx_thunder_flash', name: '雷光闪烁',
    build(ctx) {
      const r = el('rect');
      r.setAttribute('x', String(ctx.cx - ctx.radius * 2));
      r.setAttribute('y', String(ctx.cy - ctx.radius * 2));
      r.setAttribute('width', String(ctx.radius * 4));
      r.setAttribute('height', String(ctx.radius * 4));
      r.setAttribute('fill', '#ffffff');
      r.style.opacity = '0';
      r.style.mixBlendMode = 'screen';
      ctx.layer.appendChild(r);
      return [r];
    },
    update(els, _ctx, tMs) {
      const cycle = tMs % 3000;
      (els[0] as SVGElement).style.opacity = cycle < 80 ? '0.5' : cycle < 140 ? '0.15' : '0';
    },
  },
  {
    id: 'fx_shadow_vignette', name: '暗影渐晕',
    build(ctx) {
      const gradId = 'grad-fx_shadow_vignette';
      addRadialDef(ctx.root, gradId, [
        [0, '#000000', 0],
        [0.75, '#000000', 0],
        [1, '#1a0a2a', 0.45],
      ]);
      const c = el('circle');
      c.setAttribute('cx', String(ctx.cx));
      c.setAttribute('cy', String(ctx.cy));
      c.setAttribute('r', String(ctx.radius * 2.2));
      c.setAttribute('fill', `url(#${gradId})`);
      ctx.layer.appendChild(c);
      return [c];
    },
    update() {},
  },
  {
    id: 'fx_sunbeam', name: '日光束',
    build(ctx) {
      const g = el('g');
      g.style.opacity = '0.3';
      g.style.mixBlendMode = 'screen';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TWO_PI;
        const beam = el('rect');
        beam.setAttribute('x', String(-ctx.radius * 0.08));
        beam.setAttribute('y', String(-ctx.radius * 2.2));
        beam.setAttribute('width', String(ctx.radius * 0.16));
        beam.setAttribute('height', String(ctx.radius * 2.2));
        beam.setAttribute('fill', '#fff2b0');
        beam.setAttribute('transform', `translate(${ctx.cx} ${ctx.cy}) rotate(${(a * 180) / Math.PI})`);
        g.appendChild(beam);
      }
      ctx.layer.appendChild(g);
      return [g];
    },
    update(els, _ctx, tMs) {
      (els[0] as SVGElement).setAttribute('transform', `rotate(${tMs / 60} ${_ctx.cx} ${_ctx.cy})`);
    },
  },
  {
    id: 'fx_prism_rays', name: '棱镜光线',
    build(ctx) {
      const g = el('g');
      g.style.opacity = '0.4';
      g.style.mixBlendMode = 'screen';
      const colors = ['#ff9de2', '#9dfcff', '#fff59d', '#b3ffb3'];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TWO_PI;
        const beam = el('rect');
        beam.setAttribute('x', String(-ctx.radius * 0.05));
        beam.setAttribute('y', String(-ctx.radius * 2));
        beam.setAttribute('width', String(ctx.radius * 0.1));
        beam.setAttribute('height', String(ctx.radius * 2));
        beam.setAttribute('fill', colors[i % colors.length]);
        beam.setAttribute('transform', `translate(${ctx.cx} ${ctx.cy}) rotate(${(a * 180) / Math.PI})`);
        g.appendChild(beam);
      }
      ctx.layer.appendChild(g);
      return [g];
    },
    update(els, ctx, tMs) {
      (els[0] as SVGElement).setAttribute('transform', `rotate(${-tMs / 90} ${ctx.cx} ${ctx.cy})`);
    },
  },
  {
    id: 'fx_aurora_ribbon', name: '极光丝带',
    build(ctx) {
      const p = el('path');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', ctx.accent);
      p.setAttribute('stroke-width', String(ctx.radius * 0.3));
      p.setAttribute('stroke-linecap', 'round');
      p.style.opacity = '0.35';
      p.style.mixBlendMode = 'screen';
      ctx.layer.appendChild(p);
      return [p];
    },
    update(els, ctx, tMs) {
      const w = ctx.radius * 1.8;
      const y0 = ctx.cy - ctx.radius * 1.3;
      const wob = Math.sin(tMs / 500) * ctx.radius * 0.3;
      const d = `M ${ctx.cx - w} ${y0} Q ${ctx.cx} ${y0 - ctx.radius * 0.5 + wob} ${ctx.cx + w} ${y0}`;
      els[0].setAttribute('d', d);
    },
  },
  {
    id: 'fx_starlight_sparkle', name: '星光点缀',
    build(ctx) {
      const pts: SVGElement[] = [];
      for (let i = 0; i < 5; i++) {
        const s = el('circle');
        s.setAttribute('r', '1.4');
        s.setAttribute('fill', '#ffffff');
        ctx.layer.appendChild(s);
        pts.push(s);
      }
      return pts;
    },
    update(els, ctx, tMs) {
      els.forEach((s, i) => {
        const a = (i / els.length) * TWO_PI + tMs / 1400;
        const r = ctx.radius * (0.9 + 0.3 * ((i * 37) % 5) / 5);
        s.setAttribute('cx', String(ctx.cx + Math.cos(a) * r));
        s.setAttribute('cy', String(ctx.cy + Math.sin(a * 1.3) * r * 0.6));
        (s as SVGElement).style.opacity = String(0.3 + 0.7 * Math.abs(Math.sin(tMs / 300 + i)));
      });
    },
  },
  {
    id: 'fx_comet_trail', name: '彗星尾迹',
    build(ctx) {
      const g = el('g');
      g.style.opacity = '0.5';
      const tail = el('path');
      tail.setAttribute('fill', ctx.accent);
      g.appendChild(tail);
      ctx.layer.appendChild(g);
      return [g, tail];
    },
    update(els, ctx, tMs) {
      const tail = els[1];
      const sway = Math.sin(tMs / 260) * ctx.radius * 0.15;
      tail.setAttribute(
        'd',
        `M ${ctx.cx - sway} ${ctx.cy + ctx.radius} L ${ctx.cx + ctx.radius * 0.2} ${ctx.cy + ctx.radius * 1.9} L ${ctx.cx - ctx.radius * 0.2} ${ctx.cy + ctx.radius * 1.9} Z`
      );
    },
  },
  {
    id: 'fx_orbit', name: '星星环绕',
    build(ctx) {
      const stars: SVGElement[] = [];
      for (let i = 0; i < 3; i++) {
        const s = el('path');
        s.setAttribute(
          'd',
          'M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z'
        );
        s.setAttribute('fill', '#ffd66b');
        ctx.layer.appendChild(s);
        stars.push(s);
      }
      return stars;
    },
    update(els, ctx, tMs) {
      els.forEach((s, i) => {
        const a = tMs / 700 + (i * TWO_PI) / els.length;
        const x = ctx.cx + Math.cos(a) * ctx.radius * 1.5;
        const y = ctx.cy - ctx.radius * 0.5 + Math.sin(a) * ctx.radius * 0.6;
        s.setAttribute('transform', `translate(${x} ${y})`);
        (s as SVGElement).style.opacity = String(0.65 + 0.35 * Math.sin(a * 2));
      });
    },
  },
  {
    id: 'fx_cloud', name: '脚下云朵',
    build(ctx) {
      const g = el('g');
      g.setAttribute('fill', '#ffffff');
      g.style.opacity = '0.85';
      const parts: Array<[number, number, number]> = [
        [0, 0, 1], [-0.55, 0.08, 0.6], [0.55, 0.05, 0.65],
      ];
      for (const [dx, dy, s] of parts) {
        const e2 = el('ellipse');
        e2.setAttribute('cx', String(ctx.cx + dx * ctx.radius));
        e2.setAttribute('cy', String(ctx.cy + ctx.radius * 1.15 + dy * ctx.radius));
        e2.setAttribute('rx', String(ctx.radius * 0.5 * s));
        e2.setAttribute('ry', String(ctx.radius * 0.25 * s));
        g.appendChild(e2);
      }
      ctx.layer.appendChild(g);
      return [g];
    },
    update(els, ctx, tMs) {
      els[0].setAttribute('transform', `translate(0 ${Math.sin(tMs / 500) * 2})`);
    },
  },
  {
    id: 'fx_sparkle', name: '萤光星尘',
    build(ctx) {
      const pts: SVGElement[] = [];
      for (let i = 0; i < 6; i++) {
        const s = el('circle');
        s.setAttribute('r', '1.1');
        s.setAttribute('fill', i % 2 === 0 ? '#ffe9a8' : '#d9c8ff');
        ctx.layer.appendChild(s);
        pts.push(s);
      }
      return pts;
    },
    update(els, ctx, tMs) {
      els.forEach((s, i) => {
        const seed = i * 91.7;
        const life = (tMs / 1400 + i / els.length) % 1;
        const x = ctx.cx + Math.sin(seed) * ctx.radius * 1.4;
        const yTop = ctx.cy - ctx.radius * 1.8;
        const yBot = ctx.cy + ctx.radius * 0.4;
        s.setAttribute('cx', String(x));
        s.setAttribute('cy', String(yBot + (yTop - yBot) * life));
        (s as SVGElement).style.opacity = String(Math.sin(life * Math.PI));
      });
    },
  },
  {
    id: 'fx_rainbow', name: '虹光流转',
    build(ctx) {
      const gradId = 'grad-fx_rainbow';
      if (!ctx.root.querySelector(`#${gradId}`)) {
        let defs = ctx.root.querySelector('defs[data-light-defs]') as SVGDefsElement | null;
        if (!defs) {
          defs = el('defs');
          defs.setAttribute('data-light-defs', '1');
          ctx.root.insertBefore(defs, ctx.root.firstChild);
        }
        const g = el('radialGradient');
        g.setAttribute('id', gradId);
        for (const [off, color] of [[0, '#fff'], [1, '#fff']] as Array<[number, string]>) {
          const s = el('stop');
          s.setAttribute('offset', `${off * 100}%`);
          s.setAttribute('stop-color', color);
          g.appendChild(s);
        }
        defs.appendChild(g);
      }
      const c = el('circle');
      c.setAttribute('cx', String(ctx.cx));
      c.setAttribute('cy', String(ctx.cy));
      c.setAttribute('r', String(ctx.radius * 1.6));
      c.setAttribute('fill', `url(#${gradId})`);
      c.style.mixBlendMode = 'screen';
      ctx.layer.appendChild(c);
      return [c];
    },
    update(els, ctx, tMs) {
      const hue = (tMs / 30) % 360;
      const grad = ctx.root.querySelector('#grad-fx_rainbow');
      if (grad) {
        const stops = grad.querySelectorAll('stop');
        stops[0]?.setAttribute('stop-color', `hsl(${hue}, 85%, 70%)`);
        stops[0]?.setAttribute('stop-opacity', '0.5');
        stops[1]?.setAttribute('stop-color', `hsl(${hue}, 85%, 70%)`);
        stops[1]?.setAttribute('stop-opacity', '0');
      }
    },
  },
];

export const LIGHT_EFFECT_IDS = LIGHT_EFFECTS.map((e) => e.id);

export class LightEffectField {
  private layer: SVGGElement;
  private active: Array<{ effect: LightEffect; els: SVGElement[] }> = [];

  constructor(private root: SVGSVGElement, insertBeforeChar: SVGElement | null) {
    this.layer = el('g');
    this.layer.setAttribute('data-light-layer', '1');
    if (insertBeforeChar) root.insertBefore(this.layer, insertBeforeChar);
    else root.appendChild(this.layer);
  }

  configure(effectIds: string[], ctx: Omit<LightCtx, 'root' | 'layer'>): void {
    this.clear();
    for (const id of effectIds) {
      const effect = LIGHT_EFFECTS.find((e) => e.id === id);
      if (!effect) continue;
      const els = effect.build({ root: this.root, layer: this.layer, ...ctx });
      this.active.push({ effect, els });
    }
  }

  tick(tMs: number, ctx: Omit<LightCtx, 'root' | 'layer'>): void {
    for (const a of this.active) a.effect.update(a.els, { root: this.root, layer: this.layer, ...ctx }, tMs);
  }

  clear(): void {
    this.layer.innerHTML = '';
    this.active = [];
  }
}
