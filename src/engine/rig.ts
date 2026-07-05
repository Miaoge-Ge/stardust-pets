/**
 * SVG 矢量骨骼动画引擎(替代旧的像素 canvas 合成方案)。
 * 每个物种是一份手绘贝塞尔曲线 SVG 模板(具名 <g data-part> 分组),
 * 动作是对具名分组施加的关键帧变换序列,播放器逐帧插值设置 CSS transform。
 * 颜色通过 CSS 自定义属性统一换色,同一模板不同宠物换色零成本。
 */

export interface PartTransform {
  rotate?: number; // 度
  tx?: number; // 逻辑像素
  ty?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface Keyframe {
  t: number; // 0..1
  parts: Record<string, PartTransform>;
}

export interface RigAnim {
  keyframes: Keyframe[];
  durationMs: number;
  loop: boolean;
  /** 播放一次后是否需要通知播放器(用于非循环动作播完自动回待机) */
  once?: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpTransform(a: PartTransform, b: PartTransform, t: number): PartTransform {
  return {
    rotate: lerp(a.rotate ?? 0, b.rotate ?? 0, t),
    tx: lerp(a.tx ?? 0, b.tx ?? 0, t),
    ty: lerp(a.ty ?? 0, b.ty ?? 0, t),
    scaleX: lerp(a.scaleX ?? 1, b.scaleX ?? 1, t),
    scaleY: lerp(a.scaleY ?? 1, b.scaleY ?? 1, t),
  };
}

function easeInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

/** 在指定时间点(0..1 归一化)求所有分组的插值变换 */
function sampleAnim(anim: RigAnim, tNorm: number): Record<string, PartTransform> {
  const kfs = anim.keyframes;
  if (kfs.length === 0) return {};
  if (kfs.length === 1) return kfs[0].parts;
  let i = 0;
  while (i < kfs.length - 1 && kfs[i + 1].t < tNorm) i++;
  const a = kfs[i];
  const b = kfs[Math.min(i + 1, kfs.length - 1)];
  const span = Math.max(1e-6, b.t - a.t);
  const localT = easeInOut(Math.min(1, Math.max(0, (tNorm - a.t) / span)));
  const partIds = new Set([...Object.keys(a.parts), ...Object.keys(b.parts)]);
  const out: Record<string, PartTransform> = {};
  for (const id of partIds) {
    out[id] = lerpTransform(a.parts[id] ?? {}, b.parts[id] ?? {}, localT);
  }
  return out;
}

function transformCss(t: PartTransform): string {
  const parts: string[] = [];
  if (t.tx || t.ty) parts.push(`translate(${t.tx ?? 0}px, ${t.ty ?? 0}px)`);
  if (t.rotate) parts.push(`rotate(${t.rotate}deg)`);
  if ((t.scaleX ?? 1) !== 1 || (t.scaleY ?? 1) !== 1) {
    parts.push(`scale(${t.scaleX ?? 1}, ${t.scaleY ?? 1})`);
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export interface SpeciesRig {
  /** 内联 SVG 字符串,根节点必须是 <svg>,具名分组用 data-part 标识 */
  svg: string;
  /** 每个分组的旋转/缩放锚点(SVG viewBox 坐标系),用于设置 transform-origin */
  origins: Record<string, [number, number]>;
  /** 该物种的专属动作(在通用动作之外) */
  animations: Record<string, RigAnim>;
}

/** 挂载一个物种 rig 到容器,返回播放器句柄 */
export class RigPlayer {
  private root: SVGSVGElement;
  private parts: Map<string, SVGGElement> = new Map();
  private current: RigAnim | null = null;
  private startTime = 0;
  private elapsed = 0;
  private onceDone = false;
  private flipG: SVGGElement;

  constructor(container: HTMLElement, rig: SpeciesRig) {
    container.innerHTML = rig.svg;
    const svgEl = container.querySelector('svg') as SVGSVGElement;
    this.root = svgEl;
    // 包一层用于左右翻转(walk/run 转向),内部分组不受影响
    let flip = svgEl.querySelector('g[data-flip-root]') as SVGGElement | null;
    if (!flip) {
      flip = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      flip.setAttribute('data-flip-root', '1');
      while (svgEl.firstChild) flip.appendChild(svgEl.firstChild);
      svgEl.appendChild(flip);
    }
    this.flipG = flip;
    // 关键:不设置 transform-origin 时 scaleX(-1) 会绕 viewBox 左上角(0,0)翻转,
    // 把整只宠物甩到 x<0 的可视区域外而被裁剪掉(=看起来"消失")。
    // 显式绕 viewBox 水平中点 + 脚底线翻转/缩放,翻转后仍落在原可视范围内,
    // 体型缩放(见 setBodyScale)也绕脚底线进行,缩放时脚不会离地悬空。
    const vb = svgEl.viewBox.baseVal;
    const midX = vb && vb.width > 0 ? vb.x + vb.width / 2 : 50;
    const groundY = vb && vb.height > 0 ? vb.y + vb.height * 0.94 : 90;
    flip.style.transformBox = 'view-box';
    flip.style.transformOrigin = `${midX}px ${groundY}px`;
    for (const [id, origin] of Object.entries(rig.origins)) {
      const g = svgEl.querySelector(`[data-part="${id}"]`) as SVGGElement | null;
      if (!g) continue;
      g.style.transformBox = 'fill-box';
      g.style.transformOrigin = `${origin[0]}px ${origin[1]}px`;
      this.parts.set(id, g);
    }
  }

  private dir: 1 | -1 = 1;
  private bodyScale = 1;

  setFlip(dir: 1 | -1): void {
    this.dir = dir;
    this.applyTransform();
  }

  /** 体型收藏维度(迷你/矮胖等):整体缩放,绕脚底线进行,缩放后仍站在原地面上 */
  setBodyScale(scale: number): void {
    this.bodyScale = scale;
    this.applyTransform();
  }

  private applyTransform(): void {
    const sx = this.dir === -1 ? -this.bodyScale : this.bodyScale;
    this.flipG.style.transform = `scale(${sx}, ${this.bodyScale})`;
  }

  setColors(vars: Record<string, string>): void {
    for (const [k, v] of Object.entries(vars)) this.root.style.setProperty(`--${k}`, v);
  }

  play(anim: RigAnim): void {
    this.current = anim;
    this.startTime = 0;
    this.elapsed = 0;
    this.onceDone = false;
  }

  /** 每帧调用;deltaMs 为距上次调用的毫秒数 */
  tick(deltaMs: number): boolean {
    if (!this.current) return true;
    this.elapsed += deltaMs;
    let tNorm = this.elapsed / this.current.durationMs;
    let finished = false;
    if (tNorm >= 1) {
      if (this.current.loop) {
        tNorm %= 1;
      } else {
        tNorm = 1;
        finished = !this.onceDone;
        this.onceDone = true;
      }
    }
    const sample = sampleAnim(this.current, tNorm);
    for (const [id, t] of Object.entries(sample)) {
      const el = this.parts.get(id);
      if (el) el.style.transform = transformCss(t);
    }
    return finished;
  }

  destroy(): void {
    this.parts.clear();
  }
}
