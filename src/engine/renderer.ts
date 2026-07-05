import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { buildFrameSets, TEX_SIZE } from './frames';
import type { Look } from './petArt';

export const VIEW_W = 260;
export const VIEW_H = 300;
/** 宠物在窗口内的固定位置(逻辑像素):底部居中 */
export const PET_X = 130;
export const PET_FOOT_Y = 282;
/** 展示尺寸:88px(原 144px 的 ~60%);贴图 192px 线性缩小,精细无马赛克 */
export const PET_SIZE = 88;
const K = PET_SIZE / TEX_SIZE;

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

/** SR/SSR/UR 渲染层特效 + 货币星星爆发 */
class EffectLayer {
  back = new Container();
  front = new Container();
  private orbitStars: Graphics[] = [];
  private breathHalo: Graphics | null = null;
  private rainbowHalo: Graphics | null = null;
  private cloud: Graphics | null = null;
  private particles: Particle[] = [];
  private orbitAngle = 0;
  private breathT = 0;
  private hueT = 0;
  private trailAcc = 0;
  private sparkleAcc = 0;
  private trailOn = false;
  private sparkleOn = false;
  moving = false;

  configure(effects: string[], accent: number): void {
    this.back.removeChildren();
    this.front.removeChildren();
    this.orbitStars = [];
    this.breathHalo = null;
    this.rainbowHalo = null;
    this.cloud = null;
    this.trailOn = effects.includes('fx_trail');
    this.sparkleOn = effects.includes('fx_sparkle');

    if (effects.includes('fx_breath')) {
      const g = new Graphics();
      g.circle(0, 0, 42).fill({ color: accent, alpha: 0.16 });
      g.position.set(PET_X, PET_FOOT_Y - 42);
      this.breathHalo = g;
      this.back.addChild(g);
    }
    if (effects.includes('fx_rainbow')) {
      const g = new Graphics();
      g.circle(0, 0, 46).fill({ color: 0xffffff, alpha: 0.14 });
      g.position.set(PET_X, PET_FOOT_Y - 44);
      this.rainbowHalo = g;
      this.back.addChild(g);
    }
    if (effects.includes('fx_cloud')) {
      const g = new Graphics();
      g.ellipse(0, 0, 24, 7).fill({ color: 0xffffff, alpha: 0.85 });
      g.ellipse(-13, 2, 10, 5).fill({ color: 0xffffff, alpha: 0.8 });
      g.ellipse(13, 2, 10, 5).fill({ color: 0xffffff, alpha: 0.8 });
      g.position.set(PET_X, PET_FOOT_Y + 4);
      this.cloud = g;
      this.back.addChild(g);
    }
    if (effects.includes('fx_orbit')) {
      for (let i = 0; i < 3; i++) {
        const s = new Graphics();
        s.star(0, 0, 4, 4.5, 2.2).fill({ color: 0xffd66b });
        this.front.addChild(s);
        this.orbitStars.push(s);
      }
    }
  }

  burst(count: number): void {
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      g.star(0, 0, 5, 4.5, 2.2).fill({ color: 0xffd66b });
      g.position.set(PET_X + (Math.random() - 0.5) * 30, PET_FOOT_Y - 85);
      const p: Particle = {
        g,
        vx: (Math.random() - 0.5) * 55,
        vy: -55 - Math.random() * 45,
        life: 0,
        maxLife: 900 + Math.random() * 400,
      };
      this.front.addChild(g);
      this.particles.push(p);
    }
  }

  private spawnMote(color: number, x: number, y: number, vy: number, life: number): void {
    const g = new Graphics();
    g.star(0, 0, 4, 3, 1.4).fill({ color });
    g.position.set(x, y);
    this.particles.push({ g, vx: (Math.random() - 0.5) * 18, vy, life: 0, maxLife: life });
    this.front.addChild(g);
  }

  tick(ms: number): void {
    this.orbitAngle += ms * 0.0016;
    for (let i = 0; i < this.orbitStars.length; i++) {
      const a = this.orbitAngle + (i * Math.PI * 2) / 3;
      const s = this.orbitStars[i];
      s.position.set(PET_X + Math.cos(a) * 40, PET_FOOT_Y - 46 + Math.sin(a) * 18);
      s.alpha = 0.65 + 0.35 * Math.sin(a * 2);
    }
    if (this.breathHalo) {
      this.breathT += ms * 0.0012;
      this.breathHalo.alpha = 0.55 + 0.45 * Math.sin(this.breathT);
      const sc = 1 + 0.06 * Math.sin(this.breathT);
      this.breathHalo.scale.set(sc);
    }
    if (this.rainbowHalo) {
      // 虹光流转:HSL 色环循环
      this.hueT += ms * 0.00025;
      const h = (this.hueT % 1) * 360;
      this.rainbowHalo.tint = hueToRgb(h);
      this.rainbowHalo.alpha = 0.75 + 0.25 * Math.sin(this.hueT * 8);
    }
    if (this.cloud) {
      this.cloud.position.y = PET_FOOT_Y + 4 + Math.sin(this.orbitAngle * 1.4) * 2;
    }
    if (this.trailOn && this.moving) {
      this.trailAcc += ms;
      if (this.trailAcc > 130) {
        this.trailAcc = 0;
        this.spawnMote(
          0xbfe3ff,
          PET_X + (Math.random() - 0.5) * 34,
          PET_FOOT_Y - 6 - Math.random() * 28,
          -14,
          700
        );
      }
    }
    if (this.sparkleOn) {
      this.sparkleAcc += ms;
      if (this.sparkleAcc > 550) {
        this.sparkleAcc = 0;
        this.spawnMote(
          Math.random() < 0.5 ? 0xffe9a8 : 0xd9c8ff,
          PET_X + (Math.random() - 0.5) * 70,
          PET_FOOT_Y - 10 - Math.random() * 70,
          -8,
          1400
        );
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += ms;
      p.g.position.x += (p.vx * ms) / 1000;
      p.g.position.y += (p.vy * ms) / 1000;
      p.vy += (60 * ms) / 1000;
      p.g.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        p.g.destroy();
        this.particles.splice(i, 1);
      }
    }
  }
}

function hueToRgb(h: number): number {
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (1 - Math.max(-1, Math.min(1, Math.min(k - 3, 9 - k)))) * 0.5 + 127.5);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

export class PetView {
  app: Application;
  sprite!: Sprite;
  shadow!: Graphics;
  effects = new EffectLayer();
  sets: Record<string, Texture[]> = {};
  key = 'sit';
  fps = 5;
  dir: 1 | -1 = 1;
  private acc = 0;
  private idx = 0;

  static async create(container: HTMLElement, look: Look): Promise<PetView> {
    const app = new Application();
    await app.init({
      width: VIEW_W,
      height: VIEW_H,
      backgroundAlpha: 0,
      antialias: false,
    });
    // 动作帧率最高 10fps,渲染循环压到 30fps 以控制空闲 CPU 占用
    app.ticker.maxFPS = 30;
    container.appendChild(app.canvas);
    return new PetView(app, look);
  }

  private constructor(app: Application, look: Look) {
    this.app = app;

    app.stage.addChild(this.effects.back);

    this.shadow = new Graphics();
    this.shadow.ellipse(0, 0, 23, 5).fill({ color: 0x000000, alpha: 0.18 });
    this.shadow.position.set(PET_X, PET_FOOT_Y + 3);
    app.stage.addChild(this.shadow);

    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5, 1);
    this.sprite.position.set(PET_X, PET_FOOT_Y);
    this.sprite.scale.set(K);
    app.stage.addChild(this.sprite);

    app.stage.addChild(this.effects.front);

    this.setLook(look);
  }

  /** 切换出场宠物:重建全套贴图 + 特效 */
  setLook(look: Look): void {
    const old = this.sets;
    const canvases = buildFrameSets(look);
    const sets: Record<string, Texture[]> = {};
    for (const [k, arr] of Object.entries(canvases)) {
      sets[k] = arr.map((cv) => {
        const t = Texture.from(cv);
        // 贴图为 4× 平滑放大,线性采样缩小 → 精细边缘
        t.source.scaleMode = 'linear';
        return t;
      });
    }
    this.sets = sets;
    this.idx = 0;
    this.acc = 0;
    this.sprite.texture = this.sets[this.key]?.[0] ?? this.sets.sit[0];
    const accent = parseInt(look.colors.accent.slice(1), 16);
    this.effects.configure(look.effects, Number.isFinite(accent) ? accent : 0xffd66b);
    for (const arr of Object.values(old)) for (const t of arr) t.destroy(true);
  }

  setAnim(key: string, fps: number): void {
    if (!this.sets[key]) key = 'sit';
    if (this.key === key) {
      this.fps = fps;
      return;
    }
    this.key = key;
    this.fps = fps;
    this.idx = 0;
    this.acc = 0;
    this.sprite.texture = this.sets[key][0];
    this.effects.moving = key === 'walk' || key === 'run' || key === 'jump';
  }

  setFlip(dir: 1 | -1): void {
    this.dir = dir;
    this.sprite.scale.x = K * dir;
  }

  setShadowVisible(v: boolean): void {
    this.shadow.visible = v;
  }

  /** 获得星星币时的爆发动画 */
  coinBurst(): void {
    this.effects.burst(8);
  }

  tick(ms: number): void {
    const frames = this.sets[this.key];
    if (frames && frames.length > 0) {
      this.acc += ms;
      const frameMs = 1000 / this.fps;
      while (this.acc >= frameMs) {
        this.acc -= frameMs;
        this.idx = (this.idx + 1) % frames.length;
      }
      this.sprite.texture = frames[this.idx];
    }
    this.effects.tick(ms);
  }
}
