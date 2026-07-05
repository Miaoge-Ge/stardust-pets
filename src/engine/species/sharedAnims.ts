/** 全物种共享的关键帧动作库(基于具名分组:body/head/earL/earR/tailBase/legs) */
import type { RigAnim } from '../rig';

export const SHARED_ANIMS: Record<string, RigAnim> = {
  sit: {
    loop: true,
    durationMs: 2400,
    keyframes: [
      { t: 0, parts: { body: { scaleY: 1 }, tailBase: { rotate: -4 } } },
      { t: 0.5, parts: { body: { scaleY: 1.02 }, tailBase: { rotate: 6 } } },
      { t: 1, parts: { body: { scaleY: 1 }, tailBase: { rotate: -4 } } },
    ],
  },
  lie: {
    loop: true,
    durationMs: 3200,
    keyframes: [
      { t: 0, parts: { body: { scaleY: 1 }, tailBase: { rotate: 0 } } },
      { t: 0.5, parts: { body: { scaleY: 1.03 }, tailBase: { rotate: 4 } } },
      { t: 1, parts: { body: { scaleY: 1 }, tailBase: { rotate: 0 } } },
    ],
  },
  daze: {
    loop: true,
    durationMs: 3000,
    keyframes: [
      { t: 0, parts: { head: { rotate: -3 } } },
      { t: 0.5, parts: { head: { rotate: 3 } } },
      { t: 1, parts: { head: { rotate: -3 } } },
    ],
  },
  yawn: {
    loop: false,
    durationMs: 1000,
    keyframes: [
      { t: 0, parts: { head: { rotate: 0, scaleY: 1 } } },
      { t: 0.5, parts: { head: { rotate: -4, scaleY: 1.08 } } },
      { t: 1, parts: { head: { rotate: 0, scaleY: 1 } } },
    ],
  },
  groom: {
    loop: true,
    durationMs: 2600,
    keyframes: [
      { t: 0, parts: { head: { rotate: 0 } } },
      { t: 0.5, parts: { head: { rotate: -8, ty: 2 } } },
      { t: 1, parts: { head: { rotate: 0 } } },
    ],
  },
  tail_chase: {
    loop: true,
    durationMs: 1400,
    keyframes: [
      { t: 0, parts: { body: { rotate: 0 }, tailBase: { rotate: 0 } } },
      { t: 0.5, parts: { body: { rotate: 8 }, tailBase: { rotate: -20 } } },
      { t: 1, parts: { body: { rotate: 0 }, tailBase: { rotate: 0 } } },
    ],
  },
  stretch: {
    loop: false,
    durationMs: 1400,
    keyframes: [
      { t: 0, parts: { body: { scaleX: 1, scaleY: 1 } } },
      { t: 0.6, parts: { body: { scaleX: 1.12, scaleY: 0.9, ty: 2 } } },
      { t: 1, parts: { body: { scaleX: 1, scaleY: 1 } } },
    ],
  },
  sleep: {
    loop: true,
    durationMs: 2800,
    keyframes: [
      { t: 0, parts: { body: { scaleY: 1, scaleX: 1 } } },
      { t: 0.5, parts: { body: { scaleY: 1.04, scaleX: 0.98 } } },
      { t: 1, parts: { body: { scaleY: 1, scaleX: 1 } } },
    ],
  },
  walk: {
    loop: true,
    durationMs: 900,
    keyframes: [
      { t: 0, parts: { body: { ty: 0 }, head: { ty: 0 } } },
      { t: 0.25, parts: { body: { ty: -2 }, head: { ty: -1 } } },
      { t: 0.5, parts: { body: { ty: 0 }, head: { ty: 0 } } },
      { t: 0.75, parts: { body: { ty: -2 }, head: { ty: -1 } } },
      { t: 1, parts: { body: { ty: 0 }, head: { ty: 0 } } },
    ],
  },
  run: {
    loop: true,
    durationMs: 500,
    keyframes: [
      { t: 0, parts: { body: { ty: 0, rotate: -3 } } },
      { t: 0.5, parts: { body: { ty: -4, rotate: 3 } } },
      { t: 1, parts: { body: { ty: 0, rotate: -3 } } },
    ],
  },
  jump: {
    loop: false,
    durationMs: 500,
    keyframes: [
      { t: 0, parts: { body: { ty: 0, scaleY: 1 } } },
      { t: 0.4, parts: { body: { ty: -14, scaleY: 1.1 } } },
      { t: 1, parts: { body: { ty: 0, scaleY: 0.94 } } },
    ],
  },
  hang: {
    loop: true,
    durationMs: 900,
    keyframes: [
      { t: 0, parts: { body: { rotate: -6 }, legs: { rotate: 4 } } },
      { t: 0.5, parts: { body: { rotate: 6 }, legs: { rotate: -4 } } },
      { t: 1, parts: { body: { rotate: -6 }, legs: { rotate: 4 } } },
    ],
  },
  click_happy: {
    loop: false,
    durationMs: 700,
    keyframes: [
      { t: 0, parts: { body: { ty: 0 }, earL: { rotate: 0 }, earR: { rotate: 0 } } },
      { t: 0.3, parts: { body: { ty: -10, scaleY: 1.08 }, earL: { rotate: -10 }, earR: { rotate: 10 } } },
      { t: 1, parts: { body: { ty: 0 }, earL: { rotate: 0 }, earR: { rotate: 0 } } },
    ],
  },
  petted: {
    loop: false,
    durationMs: 1300,
    keyframes: [
      { t: 0, parts: { head: { rotate: 0, ty: 0 } } },
      { t: 0.5, parts: { head: { rotate: -6, ty: 3 } } },
      { t: 1, parts: { head: { rotate: 0, ty: 0 } } },
    ],
  },
  hold_sign: {
    loop: true,
    durationMs: 1600,
    keyframes: [
      { t: 0, parts: { head: { rotate: -2 } } },
      { t: 0.5, parts: { head: { rotate: 2 } } },
      { t: 1, parts: { head: { rotate: -2 } } },
    ],
  },
  sulk: {
    loop: true,
    durationMs: 2000,
    keyframes: [
      { t: 0, parts: { tailBase: { rotate: 0 }, body: { rotate: 0 } } },
      { t: 0.5, parts: { tailBase: { rotate: -12 }, body: { rotate: 2 } } },
      { t: 1, parts: { tailBase: { rotate: 0 }, body: { rotate: 0 } } },
    ],
  },
  eat: {
    loop: true,
    durationMs: 500,
    keyframes: [
      { t: 0, parts: { head: { ty: 0 } } },
      { t: 0.5, parts: { head: { ty: 3 } } },
      { t: 1, parts: { head: { ty: 0 } } },
    ],
  },
  play_yarn: {
    loop: true,
    durationMs: 600,
    keyframes: [
      { t: 0, parts: { legs: { rotate: 0 } } },
      { t: 0.5, parts: { legs: { rotate: 12 } } },
      { t: 1, parts: { legs: { rotate: 0 } } },
    ],
  },
  curious_look: {
    loop: false,
    durationMs: 800,
    keyframes: [
      { t: 0, parts: { head: { rotate: 0 } } },
      { t: 1, parts: { head: { rotate: 12, tx: 2 } } },
    ],
  },
  wake_startled: {
    loop: false,
    durationMs: 700,
    keyframes: [
      { t: 0, parts: { earL: { rotate: 15 }, earR: { rotate: -15 }, body: { scaleY: 0.9 } } },
      { t: 1, parts: { earL: { rotate: 0 }, earR: { rotate: 0 }, body: { scaleY: 1 } } },
    ],
  },
  snuggle: {
    loop: true,
    durationMs: 1200,
    keyframes: [
      { t: 0, parts: { head: { rotate: -4, tx: 0 } } },
      { t: 0.5, parts: { head: { rotate: 4, tx: 2 } } },
      { t: 1, parts: { head: { rotate: -4, tx: 0 } } },
    ],
  },
  climb_window: {
    loop: true,
    durationMs: 500,
    keyframes: [
      { t: 0, parts: { body: { ty: 0 } } },
      { t: 0.5, parts: { body: { ty: -3 } } },
      { t: 1, parts: { body: { ty: 0 } } },
    ],
  },
};
