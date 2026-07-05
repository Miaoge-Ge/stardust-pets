/**
 * 猫:第一个完整矢量模型(验证 rig 管线用)。
 * 用分层椭圆/贝塞尔路径构建(专业扁平插画常用技法),而非像素格拼接,
 * 边缘天然平滑抗锯齿,配色全部走 CSS 变量,换色零成本。
 */
import type { SpeciesRig } from '../rig';
import { SHARED_ANIMS } from './sharedAnims';

export const CAT_RIG: SpeciesRig = {
  svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g data-part="tailBase">
      <path d="M 68 78 C 80 76 88 66 85 56 C 83 50 78 51 78 57 C 78 64 73 70 65 71 Z"
        fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.6" stroke-linejoin="round"/>
    </g>
    <g data-part="legs">
      <rect x="34" y="72" width="8" height="16" rx="4" fill="var(--c-shade)" stroke="var(--c-outline)" stroke-width="1.4"/>
      <rect x="58" y="72" width="8" height="16" rx="4" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.4"/>
    </g>
    <g data-part="body">
      <ellipse cx="50" cy="64" rx="24" ry="20" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.8"/>
      <ellipse cx="50" cy="72" rx="13" ry="11" fill="var(--c-belly)"/>
      <path data-pattern="1" d="M 31 52 Q 50 46 69 52 L 69 56 Q 50 50 31 56 Z" fill="var(--c-pattern)" opacity="0.5"/>
    </g>
    <g data-part="earR">
      <path d="M 62 28 L 74 8 L 68 32 Z" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M 65 26 L 71 14 L 68 28 Z" fill="var(--c-belly)"/>
    </g>
    <g data-part="earL">
      <path d="M 38 28 L 26 8 L 32 32 Z" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M 35 26 L 29 14 L 32 28 Z" fill="var(--c-belly)"/>
    </g>
    <g data-part="head">
      <circle cx="50" cy="38" r="19" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.8"/>
      <ellipse cx="50" cy="45" rx="10" ry="7" fill="var(--c-belly)"/>
      <g data-part="eyeL">
        <ellipse cx="43" cy="37" rx="3.2" ry="4" fill="var(--c-eye, #2b2b33)"/>
        <circle cx="42" cy="35.5" r="1.1" fill="#fff"/>
      </g>
      <g data-part="eyeR">
        <ellipse cx="57" cy="37" rx="3.2" ry="4" fill="var(--c-eye, #2b2b33)"/>
        <circle cx="56" cy="35.5" r="1.1" fill="#fff"/>
      </g>
      <path d="M 48.5 43 L 51.5 43 L 50 45 Z" fill="#e8877a"/>
      <path data-part="mouth" d="M 50 45 Q 46 49 43 46 M 50 45 Q 54 49 57 46" fill="none" stroke="var(--c-outline)" stroke-width="1.3" stroke-linecap="round"/>
      <g stroke="var(--c-outline)" stroke-width="0.8" opacity="0.55" stroke-linecap="round">
        <line x1="30" y1="40" x2="20" y2="38"/>
        <line x1="30" y1="43" x2="20" y2="44"/>
        <line x1="70" y1="40" x2="80" y2="38"/>
        <line x1="70" y1="43" x2="80" y2="44"/>
      </g>
    </g>
  </svg>`,
  origins: {
    body: [50, 74],
    head: [50, 57],
    earL: [38, 30],
    earR: [62, 30],
    tailBase: [68, 74],
    eyeL: [43, 37],
    eyeR: [57, 37],
  },
  animations: {},
};

export { SHARED_ANIMS };
