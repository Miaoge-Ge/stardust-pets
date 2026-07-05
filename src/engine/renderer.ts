/**
 * 宠物视图:挂载物种 SVG rig + 粒子层 + 光效层,替代旧的 PixiJS/像素渲染。
 * 对外接口(setAnim/setFlip/setLook/tick/coinBurst/setShadowVisible)保持不变,
 * 上层 main.ts / FSM 不需要感知底层从 Pixi 换成了 SVG。
 */
import { BODY_SCALE, type Look } from './look';
import { LightEffectField } from './lightEffects';
import { ParticleField } from './particles';
import { RigPlayer } from './rig';
import { buildLookRig, getAnim } from './species';

export const VIEW_W = 260;
export const VIEW_H = 300;
export const PET_X = 130;
/** 宠物底部锚点(逻辑像素,相对窗口) */
export const PET_FOOT_Y = 278;
/** 展示框尺寸(SVG 矢量图,清晰缩放不糊) */
export const PET_SIZE = 130;

const CTX_CX = 50;
const CTX_CY = 55;
const CTX_RADIUS = 30;

export class PetView {
  private wrap: HTMLDivElement;
  private shadowEl: HTMLDivElement;
  private player!: RigPlayer;
  private particles!: ParticleField;
  private lights!: LightEffectField;
  private speciesId = 'sp_cat';
  private dir: 1 | -1 = 1;
  private currentKey = '';
  private accent = '#5a9fd9';

  static async create(container: HTMLElement, look: Look): Promise<PetView> {
    return new PetView(container, look);
  }

  private constructor(private container: HTMLElement, look: Look) {
    this.shadowEl = document.createElement('div');
    this.shadowEl.style.position = 'absolute';
    this.shadowEl.style.left = `${PET_X - 32}px`;
    this.shadowEl.style.top = `${PET_FOOT_Y - 4}px`;
    this.shadowEl.style.width = '64px';
    this.shadowEl.style.height = '14px';
    this.shadowEl.style.borderRadius = '50%';
    this.shadowEl.style.background = 'rgba(0,0,0,.2)';
    this.shadowEl.style.filter = 'blur(1px)';
    container.appendChild(this.shadowEl);

    this.wrap = document.createElement('div');
    this.wrap.style.position = 'absolute';
    this.wrap.style.left = `${PET_X - PET_SIZE / 2}px`;
    this.wrap.style.top = `${PET_FOOT_Y - PET_SIZE}px`;
    this.wrap.style.width = `${PET_SIZE}px`;
    this.wrap.style.height = `${PET_SIZE}px`;
    container.appendChild(this.wrap);

    this.setLook(look);
  }

  /** 切换出场宠物:重建 rig + 配色 + 光效 */
  setLook(look: Look): void {
    this.speciesId = look.species;
    this.player = new RigPlayer(this.wrap, buildLookRig(look));
    const svg = this.wrap.querySelector('svg') as SVGSVGElement;

    const c = look.colors;
    this.accent = c.animated && c.gradientStops ? c.gradientStops[0] : c.accent;
    this.player.setColors({
      'c-body': c.body,
      'c-shade': c.shade,
      'c-light': c.light,
      'c-belly': c.belly,
      'c-outline': c.outline,
      'c-pattern': c.pattern,
      'c-accent': this.accent,
    });
    this.player.setFlip(this.dir);
    this.player.setBodyScale(BODY_SCALE[look.body] ?? 1);

    this.particles = new ParticleField(svg);
    this.lights = new LightEffectField(svg, svg.querySelector('[data-flip-root]'));
    this.lights.configure(look.effects, { cx: CTX_CX, cy: CTX_CY, radius: CTX_RADIUS, accent: this.accent });

    const key = this.currentKey || 'sit';
    this.currentKey = '';
    this.setAnim(key, 0);
  }

  setAnim(key: string, _fps: number): void {
    if (this.currentKey === key) return;
    this.currentKey = key;
    const anim = getAnim(this.speciesId, key);
    if (anim) this.player.play(anim);
  }

  setFlip(dir: 1 | -1): void {
    this.dir = dir;
    this.player?.setFlip(dir);
  }

  setShadowVisible(v: boolean): void {
    this.shadowEl.style.display = v ? '' : 'none';
  }

  /** 获得星星币时的爆发动画 */
  coinBurst(): void {
    this.particles.burst('coin', CTX_CX, CTX_CY - 25, 5);
    this.particles.burst('star5', CTX_CX, CTX_CY - 25, 4);
  }

  tick(ms: number): void {
    this.player?.tick(ms);
    this.particles?.tick(ms);
    this.lights?.tick(performance.now(), { cx: CTX_CX, cy: CTX_CY, radius: CTX_RADIUS, accent: this.accent });
  }
}
