/**
 * 粒子特效库:22 种矢量粒子(SVG <symbol> 定义,<use> 实例化复用,零位图开销)。
 * 每种粒子有独立的运动模式(上浮/下落/漂移/闪烁/爆裂),供抽卡特效、货币飘字、
 * 宠物光效等场景挑选组合。
 */

export type MotionKind =
  | 'rise' | 'fall' | 'drift' | 'twinkle' | 'burst' | 'flutter' | 'zigzagFall' | 'popFall';

export interface ParticleType {
  id: string;
  /** SVG 内部图形(视为 20x20 viewBox 内的路径/形状) */
  svg: string;
  motion: MotionKind;
  defaultColor: string;
}

export const PARTICLE_TYPES: ParticleType[] = [
  { id: 'heart', motion: 'rise', defaultColor: '#f0708c',
    svg: '<path d="M10 17 C3 12 1 8 3 5 C5 2.5 8.5 3 10 6 C11.5 3 15 2.5 17 5 C19 8 17 12 10 17 Z"/>' },
  { id: 'star4', motion: 'twinkle', defaultColor: '#ffe27a',
    svg: '<path d="M10 1 L12 8 L19 10 L12 12 L10 19 L8 12 L1 10 L8 8 Z"/>' },
  { id: 'star5', motion: 'rise', defaultColor: '#ffd66b',
    svg: '<path d="M10 1 L12.5 7.5 L19.5 7.8 L14 12 L16 19 L10 15 L4 19 L6 12 L0.5 7.8 L7.5 7.5 Z"/>' },
  { id: 'bubble', motion: 'rise', defaultColor: '#8fd3ff',
    svg: '<circle cx="10" cy="10" r="7" fill-opacity="0.55"/><circle cx="7.5" cy="7" r="2" fill="#fff" fill-opacity="0.8"/>' },
  { id: 'snowflake', motion: 'fall', defaultColor: '#eaf6ff',
    svg: '<g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="10" y1="1" x2="10" y2="19"/><line x1="1" y1="10" x2="19" y2="10"/><line x1="3.5" y1="3.5" x2="16.5" y2="16.5"/><line x1="16.5" y1="3.5" x2="3.5" y2="16.5"/></g>' },
  { id: 'leaf', motion: 'zigzagFall', defaultColor: '#7ec97e',
    svg: '<path d="M10 2 C16 5 17 13 10 18 C3 13 4 5 10 2 Z"/><line x1="10" y1="4" x2="10" y2="16" stroke="#4f8f4f" stroke-width="0.8"/>' },
  { id: 'note', motion: 'rise', defaultColor: '#c79bf0',
    svg: '<circle cx="6" cy="15" r="3"/><rect x="8.3" y="3" width="1.6" height="12.5"/><path d="M9.9 3 L16 5 L16 8 L9.9 6 Z"/>' },
  { id: 'paw', motion: 'popFall', defaultColor: '#c9a37a',
    svg: '<ellipse cx="10" cy="14" rx="5.5" ry="4"/><circle cx="4.5" cy="6.5" r="2.2"/><circle cx="9" cy="4" r="2.3"/><circle cx="13.5" cy="4.5" r="2.2"/><circle cx="16.5" cy="8" r="2"/>' },
  { id: 'spark', motion: 'burst', defaultColor: '#fff2a8',
    svg: '<path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z"/>' },
  { id: 'ember', motion: 'rise', defaultColor: '#ff8a4c',
    svg: '<circle cx="10" cy="10" r="3.4"/>' },
  { id: 'petal', motion: 'fall', defaultColor: '#ffb3d1',
    svg: '<ellipse cx="10" cy="10" rx="4" ry="7" transform="rotate(20 10 10)"/>' },
  { id: 'rain', motion: 'fall', defaultColor: '#8fb8e6',
    svg: '<line x1="10" y1="2" x2="10" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
  { id: 'dust', motion: 'drift', defaultColor: '#d8d2c2',
    svg: '<circle cx="10" cy="10" r="1.6"/>' },
  { id: 'confetti', motion: 'zigzagFall', defaultColor: '#6ab7ff',
    svg: '<rect x="5" y="7" width="10" height="5" rx="1"/>' },
  { id: 'coin', motion: 'popFall', defaultColor: '#f2c14e',
    svg: '<circle cx="10" cy="10" r="7" stroke="#b58a2a" stroke-width="1.4" fill-opacity="0.95"/><text x="10" y="13.5" font-size="7" text-anchor="middle" fill="#b58a2a">$</text>' },
  { id: 'gem', motion: 'twinkle', defaultColor: '#7ef0e0',
    svg: '<path d="M4 8 L10 2 L16 8 L10 19 Z"/>' },
  { id: 'firefly', motion: 'drift', defaultColor: '#e8ff8f',
    svg: '<circle cx="10" cy="10" r="2.4"/>' },
  { id: 'ribbon', motion: 'flutter', defaultColor: '#ff9fc9',
    svg: '<path d="M2 6 C8 2 12 2 18 6 C12 9 8 9 2 6 Z"/>' },
  { id: 'bolt', motion: 'burst', defaultColor: '#fff35c',
    svg: '<path d="M11 1 L4 11 L9 11 L8 19 L16 8 L11 8 Z"/>' },
  { id: 'cloudpuff', motion: 'drift', defaultColor: '#ffffff',
    svg: '<ellipse cx="10" cy="12" rx="8" ry="4.5"/><circle cx="6" cy="9" r="4"/><circle cx="13" cy="8.5" r="4.5"/>' },
  { id: 'droplet', motion: 'fall', defaultColor: '#6fc6ff',
    svg: '<path d="M10 2 C14 8 16 11 13.5 14.5 C11 18 9 18 6.5 14.5 C4 11 6 8 10 2 Z"/>' },
  { id: 'clover', motion: 'twinkle', defaultColor: '#7ed99a',
    svg: '<circle cx="7" cy="7" r="3.4"/><circle cx="13" cy="7" r="3.4"/><circle cx="7" cy="13" r="3.4"/><circle cx="13" cy="13" r="3.4"/>' },
];

export const PARTICLE_IDS = PARTICLE_TYPES.map((p) => p.id);

/** 一次性向 <defs> 注入所有粒子 symbol(每个宿主 SVG 根只需调用一次) */
export function buildParticleDefs(): string {
  const symbols = PARTICLE_TYPES.map(
    (p) => `<symbol id="ptcl-${p.id}" viewBox="0 0 20 20">${p.svg}</symbol>`
  ).join('');
  return `<defs>${symbols}</defs>`;
}

interface LiveParticle {
  el: SVGUseElement;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  rot: number;
  vrot: number;
  scale: number;
  seed: number;
}

/** 轻量粒子播放器:挂在一个 SVG <g> 容器上,tick 驱动位置/透明度更新 */
export class ParticleField {
  private group: SVGGElement;
  private live: LiveParticle[] = [];
  private t = 0;

  constructor(svgRoot: SVGSVGElement) {
    let defs = svgRoot.querySelector('defs[data-particle-defs]');
    if (!defs) {
      const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      wrap.innerHTML = buildParticleDefs();
      defs = wrap.firstElementChild!;
      defs.setAttribute('data-particle-defs', '1');
      svgRoot.insertBefore(defs, svgRoot.firstChild);
    }
    this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.group.setAttribute('data-particle-field', '1');
    svgRoot.appendChild(this.group);
  }

  spawn(typeId: string, x: number, y: number, opts?: { color?: string; scale?: number }): void {
    const type = PARTICLE_TYPES.find((p) => p.id === typeId);
    if (!type) return;
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#ptcl-${type.id}`);
    use.setAttribute('width', '20');
    use.setAttribute('height', '20');
    use.setAttribute('color', opts?.color ?? type.defaultColor);
    (use.style as unknown as { color: string }).color = opts?.color ?? type.defaultColor;
    use.style.fill = 'currentColor';
    this.group.appendChild(use);
    const p: LiveParticle = {
      el: use, type, x, y,
      vx: (Math.random() - 0.5) * 18,
      vy: -10 - Math.random() * 12,
      life: 0,
      maxLife: 900 + Math.random() * 900,
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 90,
      scale: (opts?.scale ?? 1) * (0.5 + Math.random() * 0.5),
      seed: Math.random() * 1000,
    };
    switch (type.motion) {
      case 'fall': p.vy = 20 + Math.random() * 20; p.vx = (Math.random() - 0.5) * 8; break;
      case 'zigzagFall': p.vy = 14 + Math.random() * 10; p.vx = (Math.random() - 0.5) * 6; break;
      case 'rise': p.vy = -(18 + Math.random() * 16); p.vx = (Math.random() - 0.5) * 10; break;
      case 'drift': p.vy = (Math.random() - 0.5) * 6; p.vx = (Math.random() - 0.5) * 14; p.maxLife = 1800 + Math.random() * 1200; break;
      case 'twinkle': p.vy = -4; p.vx = 0; p.maxLife = 700 + Math.random() * 500; break;
      case 'burst': { const a = Math.random() * Math.PI * 2; const sp = 40 + Math.random() * 40; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.maxLife = 450 + Math.random() * 250; break; }
      case 'flutter': p.vy = -(6 + Math.random() * 8); p.vx = (Math.random() - 0.5) * 20; break;
      case 'popFall': p.vy = -(30 + Math.random() * 10); p.maxLife = 1100; break;
    }
    this.live.push(p);
  }

  burst(typeId: string, x: number, y: number, count: number, opts?: { color?: string; scale?: number }): void {
    for (let i = 0; i < count; i++) this.spawn(typeId, x, y, opts);
  }

  tick(ms: number): void {
    this.t += ms;
    const dt = ms / 1000;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life += ms;
      const lt = p.life / p.maxLife;
      if (lt >= 1) {
        p.el.remove();
        this.live.splice(i, 1);
        continue;
      }
      if (p.type.motion === 'drift' || p.type.motion === 'flutter') {
        p.x += Math.sin(this.t / 500 + p.seed) * 6 * dt;
      }
      if (p.type.motion === 'zigzagFall') {
        p.x += Math.sin(this.t / 220 + p.seed) * 14 * dt;
      }
      if (p.type.motion === 'burst') p.vy += 40 * dt;
      else if (p.type.motion !== 'twinkle') p.vy += (p.type.motion === 'rise' || p.type.motion === 'popFall' ? 18 : 4) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      const alpha =
        p.type.motion === 'twinkle'
          ? 0.4 + 0.6 * Math.abs(Math.sin((p.life / 260) * Math.PI + p.seed))
          : lt < 0.15
            ? lt / 0.15
            : 1 - Math.max(0, (lt - 0.7) / 0.3);
      const sc = p.scale * (p.type.motion === 'burst' ? 1 - lt * 0.4 : 1);
      p.el.setAttribute(
        'transform',
        `translate(${p.x - 10 * sc}, ${p.y - 10 * sc}) rotate(${p.rot} ${10 * sc} ${10 * sc}) scale(${sc})`
      );
      p.el.style.opacity = String(Math.max(0, Math.min(1, alpha)));
    }
  }

  clear(): void {
    for (const p of this.live) p.el.remove();
    this.live = [];
  }
}
