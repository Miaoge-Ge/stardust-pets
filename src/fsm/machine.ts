/**
 * 有限状态机:纯逻辑,不依赖渲染/窗口实现。
 * 所有环境操作通过 Host 接口注入(由 main.ts 实现),便于单元测试。
 */

export type StateName =
  | 'sit' | 'lie' | 'sleep' | 'daze' | 'yawn' | 'groom' | 'tail_chase' | 'stretch'
  | 'walk' | 'run' | 'climb_window' | 'sit_on_window' | 'jump_down'
  | 'drag_struggle' | 'click_happy' | 'petted' | 'hold_sign' | 'sulk'
  | 'eat' | 'play_yarn' | 'curious_look' | 'wake_startled' | 'snuggle';

export interface StateDef {
  anim: string;
  fps: number;
  minMs: number;
  maxMs: number;
  interruptible: boolean;
  idleWeight?: number;
}

export const DEFS: Record<StateName, StateDef> = {
  sit:          { anim: 'sit',     fps: 6,  minMs: 4000,  maxMs: 8000,  interruptible: true, idleWeight: 3 },
  lie:          { anim: 'lie',     fps: 5,  minMs: 5000,  maxMs: 10000, interruptible: true, idleWeight: 2.5 },
  sleep:        { anim: 'sleep',   fps: 3,  minMs: 12000, maxMs: 25000, interruptible: true, idleWeight: 1.5 },
  daze:         { anim: 'daze',    fps: 3,  minMs: 3000,  maxMs: 6000,  interruptible: true, idleWeight: 1.5 },
  yawn:         { anim: 'yawn',    fps: 6,  minMs: 1000,  maxMs: 1000,  interruptible: false, idleWeight: 1 },
  groom:        { anim: 'groom',   fps: 5,  minMs: 3000,  maxMs: 6000,  interruptible: true, idleWeight: 1.5 },
  tail_chase:   { anim: 'tail_chase', fps: 8, minMs: 2500, maxMs: 4000, interruptible: true, idleWeight: 1 },
  stretch:      { anim: 'stretch', fps: 5,  minMs: 900,   maxMs: 900,   interruptible: false, idleWeight: 1 },
  walk:         { anim: 'walk',    fps: 10, minMs: 2000,  maxMs: 5000,  interruptible: true },
  run:          { anim: 'run',     fps: 14, minMs: 1200,  maxMs: 2800,  interruptible: true },
  climb_window: { anim: 'jump',    fps: 6,  minMs: 12000, maxMs: 12000, interruptible: false },
  sit_on_window:{ anim: 'sit',     fps: 5,  minMs: 10000, maxMs: 25000, interruptible: true },
  jump_down:    { anim: 'jump',    fps: 8,  minMs: 8000,  maxMs: 8000,  interruptible: false },
  drag_struggle:{ anim: 'hang',    fps: 8,  minMs: 600000, maxMs: 600000, interruptible: false },
  click_happy:  { anim: 'happy',   fps: 8,  minMs: 900,   maxMs: 900,   interruptible: false },
  petted:       { anim: 'petted',  fps: 6,  minMs: 1300,  maxMs: 1300,  interruptible: false },
  hold_sign:    { anim: 'sign',    fps: 4,  minMs: 4000,  maxMs: 8000,  interruptible: true },
  sulk:         { anim: 'sulk',    fps: 4,  minMs: 6000,  maxMs: 10000, interruptible: true },
  eat:          { anim: 'eat',     fps: 6,  minMs: 3000,  maxMs: 3000,  interruptible: false },
  play_yarn:    { anim: 'yarn',    fps: 6,  minMs: 3500,  maxMs: 5000,  interruptible: true },
  curious_look: { anim: 'curious', fps: 4,  minMs: 1500,  maxMs: 1500,  interruptible: true },
  wake_startled:{ anim: 'wake',    fps: 10, minMs: 700,   maxMs: 700,   interruptible: false },
  snuggle:      { anim: 'snuggle', fps: 5,  minMs: 2500,  maxMs: 4000,  interruptible: true },
};

const IDLE_POOL: Array<[StateName, number]> = (
  Object.entries(DEFS) as Array<[StateName, StateDef]>
)
  .filter(([, d]) => d.idleWeight)
  .map(([n, d]) => [n, d.idleWeight!]);

export interface Host {
  setAnim(key: string, fps: number): void;
  setFlip(dir: 1 | -1): void;
  /** 水平移动窗口(逻辑 px),返回是否撞到屏幕边缘 */
  moveBy(dxLogical: number): 'ok' | 'edge';
  /** 准备攀爬:获取活动窗口目标,false = 没有合适目标 */
  climbPrepare(): Promise<boolean>;
  /** 向攀爬目标推进一步 */
  climbStep(dtMs: number): 'moving' | 'done' | 'fail';
  /** 目标窗口是否还在原位 */
  climbCheck(): Promise<boolean>;
  /** 向地面位置回落一步,true = 到达 */
  descendStep(dtMs: number): boolean;
  /** 拖拽结束后记录新地面位置 */
  rememberGround(): void;
  lastInteractAt(): number;
  /** 当前出场宠物亲密度等级(Lv3 解锁撒娇动作) */
  intimacyLevel(): number;
  onStateChange?(name: StateName): void;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class Machine {
  current: StateName = 'sit';
  private elapsed = 0;
  private duration = 0;
  private queued: StateName | null = null;
  private walkDir: 1 | -1 = 1;
  private lastClimbAt = 0;
  private lastSulkAt = 0;
  private checkTimer = 0;
  private deciding = false;
  private turnPauseMs = 0;

  /** 移动速度包络:起步加速、停步减速(自然的匀加/减速而非瞬时启停) */
  private moveEnvelope(): number {
    const ramp = 350;
    const inFactor = Math.min(1, this.elapsed / ramp);
    const outFactor = Math.min(1, Math.max(0, (this.duration - this.elapsed) / ramp));
    return 0.15 + 0.85 * Math.min(inFactor, outFactor) ** 1.4;
  }

  constructor(private host: Host) {}

  start(): void {
    this.goto('sit');
  }

  goto(name: StateName): void {
    const def = DEFS[name];
    this.current = name;
    this.elapsed = 0;
    this.duration = rand(def.minMs, def.maxMs);
    this.deciding = false;
    this.host.setAnim(def.anim, def.fps);
    this.host.onStateChange?.(name);
    if (name === 'walk' || name === 'run') {
      this.walkDir = Math.random() < 0.5 ? 1 : -1;
      this.host.setFlip(this.walkDir);
      this.turnPauseMs = 0;
    }
    if (name === 'sit_on_window') this.checkTimer = 0;
  }

  /**
   * 交互打断。睡觉会先经过"惊醒"过渡;在窗户上会先跳下来。
   */
  interrupt(target: StateName, force = false): void {
    if (this.current === 'drag_struggle' && target !== 'drag_struggle' && !force) return;
    if (this.current === target) {
      this.elapsed = 0;
      return;
    }
    if (this.current === 'sleep') {
      this.queued = target;
      this.goto('wake_startled');
      return;
    }
    const def = DEFS[this.current];
    if (!def.interruptible && !force) return;
    if (
      (this.current === 'sit_on_window' || this.current === 'climb_window') &&
      target !== 'drag_struggle'
    ) {
      this.queued = target;
      this.goto('jump_down');
      return;
    }
    this.goto(target);
  }

  endDrag(): void {
    if (this.current === 'drag_struggle') {
      this.host.rememberGround();
      this.goto('sit');
    }
  }

  tick(dtMs: number): void {
    this.elapsed += dtMs;
    const def = DEFS[this.current];

    switch (this.current) {
      case 'walk':
      case 'run': {
        // 撞到屏幕边缘:先停一拍再掉头,而不是瞬间镜像
        if (this.turnPauseMs > 0) {
          this.turnPauseMs -= dtMs;
          break;
        }
        const base = this.current === 'walk' ? 55 : 150;
        const v = base * this.moveEnvelope();
        if (this.host.moveBy((this.walkDir * v * dtMs) / 1000) === 'edge') {
          this.walkDir = this.walkDir === 1 ? -1 : 1;
          this.host.setFlip(this.walkDir);
          this.turnPauseMs = 150;
        }
        break;
      }
      case 'climb_window': {
        const r = this.host.climbStep(dtMs);
        if (r === 'done') {
          this.goto('sit_on_window');
          return;
        }
        if (r === 'fail') {
          this.goto('jump_down');
          return;
        }
        break;
      }
      case 'sit_on_window': {
        this.checkTimer += dtMs;
        if (this.checkTimer > 3000) {
          this.checkTimer = 0;
          void this.host.climbCheck().then((ok) => {
            if (!ok && this.current === 'sit_on_window') this.goto('jump_down');
          });
        }
        break;
      }
      case 'jump_down': {
        if (this.host.descendStep(dtMs)) {
          const q = this.queued;
          this.queued = null;
          this.goto(q ?? 'sit');
          return;
        }
        break;
      }
      case 'drag_struggle':
        return; // 只能由 endDrag() 退出
    }

    // 看门狗:任何状态超时 2 倍 + 5s,强制回待机(验收:无卡死)
    if (this.elapsed > def.maxMs * 2 + 5000) {
      console.warn('[fsm] watchdog reset from', this.current);
      this.decideNext();
      return;
    }

    if (this.elapsed >= this.duration && !this.deciding) {
      if (this.current === 'climb_window' || this.current === 'sit_on_window') {
        this.goto('jump_down');
        return;
      }
      if (this.current === 'wake_startled') {
        const q = this.queued;
        this.queued = null;
        this.goto(q ?? 'daze');
        return;
      }
      this.decideNext();
    }
  }

  private decideNext(): void {
    const now = Date.now();
    // 被冷落超过 2 小时 → 生气背对
    if (
      now - this.host.lastInteractAt() > 2 * 3600_000 &&
      now - this.lastSulkAt > 2 * 3600_000 &&
      this.current !== 'sulk'
    ) {
      this.lastSulkAt = now;
      this.goto('sulk');
      return;
    }
    // Lv3+:刚被陪伴过时有概率主动撒娇
    if (
      this.host.intimacyLevel() >= 3 &&
      now - this.host.lastInteractAt() < 90_000 &&
      Math.random() < 0.2
    ) {
      this.goto('snuggle');
      return;
    }
    const r = Math.random();
    if (r < 0.22) {
      this.goto('walk');
      return;
    }
    if (r < 0.28) {
      this.goto('run');
      return;
    }
    if (r < 0.32 && now - this.lastClimbAt > 10 * 60_000) {
      this.lastClimbAt = now;
      this.deciding = true;
      void this.host.climbPrepare().then((ok) => {
        if (!this.deciding) return;
        if (ok) this.goto('climb_window');
        else this.pickIdle();
      });
      return;
    }
    this.pickIdle();
  }

  private pickIdle(): void {
    let total = 0;
    for (const [, w] of IDLE_POOL) total += w;
    let r = Math.random() * total;
    for (const [name, w] of IDLE_POOL) {
      r -= w;
      if (r <= 0) {
        this.goto(name);
        return;
      }
    }
    this.goto('sit');
  }
}
