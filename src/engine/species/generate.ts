/**
 * 参数化物种 SVG 生成器:复用一期像素系统已验证的解剖学差异(体圆润度/腿型/
 * 颈部融合/扁平宽体等),但输出层是手绘贝塞尔矢量形状而非像素格,用于快速
 * 覆盖猫以外的其余 19 个物种,同时保持每种在轮廓上有真实区别。
 */
import type { SpeciesRig } from '../rig';

type EarStyle = 'round' | 'pointy' | 'floppy' | 'none' | 'horn' | 'antler' | 'small' | 'tuft';
type TailStyle = 'short' | 'long' | 'fluffy' | 'none' | 'curl' | 'feather';
type BeakStyle = 'none' | 'pointed' | 'flat';
type LegMode = 'stubby' | 'normal' | 'long' | 'none';

export interface ShapeSpec {
  bodyRx: number;
  bodyRy: number;
  headR: number;
  neckFuse?: boolean;
  earStyle: EarStyle;
  tailStyle: TailStyle;
  muzzle?: boolean;
  beak?: BeakStyle;
  mask?: boolean;
  shell?: boolean;
  spines?: boolean;
  wingBig?: boolean;
  bigBelly?: boolean;
  spikes?: boolean;
  crest?: boolean;
  horn?: boolean;
  tentacles?: boolean;
  floaty?: boolean;
  eyeRings?: boolean;
  legMode: LegMode;
}

const BODY_CX = 50;
const BODY_CY = 66;
const HEAD_CX = 50;

function earsMarkup(style: EarStyle, headCy: number, headR: number): { left: string; right: string } {
  const top = headCy - headR;
  switch (style) {
    case 'round':
      return {
        left: `<circle cx="${HEAD_CX - headR + 3}" cy="${top + 4}" r="6" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.5"/>`,
        right: `<circle cx="${HEAD_CX + headR - 3}" cy="${top + 4}" r="6" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.5"/>`,
      };
    case 'floppy':
      return {
        left: `<ellipse cx="${HEAD_CX - headR - 1}" cy="${headCy + 4}" rx="5" ry="10" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.5"/>`,
        right: `<ellipse cx="${HEAD_CX + headR + 1}" cy="${headCy + 4}" rx="5" ry="10" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.5"/>`,
      };
    case 'none':
      return { left: '', right: '' };
    case 'horn':
      return {
        left: `<path d="M ${HEAD_CX - 8} ${top + 6} L ${HEAD_CX - 12} ${top - 10} L ${HEAD_CX - 3} ${top + 3} Z" fill="var(--c-outline)"/>`,
        right: `<path d="M ${HEAD_CX + 8} ${top + 6} L ${HEAD_CX + 12} ${top - 10} L ${HEAD_CX + 3} ${top + 3} Z" fill="var(--c-outline)"/>`,
      };
    case 'antler':
      return {
        left: `<g stroke="#8a6437" stroke-width="2" fill="none" stroke-linecap="round"><path d="M ${HEAD_CX - 7} ${top + 4} L ${HEAD_CX - 11} ${top - 12} M ${HEAD_CX - 11} ${top - 6} L ${HEAD_CX - 16} ${top - 9} M ${HEAD_CX - 11} ${top - 10} L ${HEAD_CX - 15} ${top - 14}"/></g>`,
        right: `<g stroke="#8a6437" stroke-width="2" fill="none" stroke-linecap="round"><path d="M ${HEAD_CX + 7} ${top + 4} L ${HEAD_CX + 11} ${top - 12} M ${HEAD_CX + 11} ${top - 6} L ${HEAD_CX + 16} ${top - 9} M ${HEAD_CX + 11} ${top - 10} L ${HEAD_CX + 15} ${top - 14}"/></g>`,
      };
    case 'small':
      return {
        left: `<path d="M ${HEAD_CX - 6} ${top + 6} L ${HEAD_CX - 9} ${top - 3} L ${HEAD_CX - 2} ${top + 4} Z" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.3"/>`,
        right: `<path d="M ${HEAD_CX + 6} ${top + 6} L ${HEAD_CX + 9} ${top - 3} L ${HEAD_CX + 2} ${top + 4} Z" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.3"/>`,
      };
    case 'tuft':
      return {
        left: `<path d="M ${HEAD_CX - 4} ${top + 2} L ${HEAD_CX - 5} ${top - 8} L ${HEAD_CX - 1} ${top + 1} Z" fill="var(--c-accent)"/>`,
        right: `<path d="M ${HEAD_CX + 4} ${top + 2} L ${HEAD_CX + 5} ${top - 8} L ${HEAD_CX + 1} ${top + 1} Z" fill="var(--c-accent)"/>`,
      };
    case 'pointy':
    default:
      return {
        left: `<path d="M ${HEAD_CX - 12} ${top + 6} L ${HEAD_CX - 24} ${top - 14} L ${HEAD_CX - 18} ${top + 10} Z" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.6" stroke-linejoin="round"/>`,
        right: `<path d="M ${HEAD_CX + 12} ${top + 6} L ${HEAD_CX + 24} ${top - 14} L ${HEAD_CX + 18} ${top + 10} Z" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.6" stroke-linejoin="round"/>`,
      };
  }
}

function tailMarkup(style: TailStyle, bodyRx: number, bodyRy: number): string {
  // 尾巴锚点落在身体椭圆的真实边缘上(而非固定偏移),避免尾巴悬空脱离轮廓
  const dyRatio = 0.4;
  const edgeX = bodyRx * Math.sqrt(Math.max(0, 1 - dyRatio * dyRatio));
  const baseX = BODY_CX + edgeX - 2;
  const baseY = BODY_CY + bodyRy * dyRatio;
  switch (style) {
    case 'none':
      return '';
    case 'short':
      return `<circle cx="${baseX + 4}" cy="${baseY}" r="5" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.4"/>`;
    case 'fluffy':
      return `<circle cx="${baseX + 8}" cy="${baseY - 6}" r="8" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.5"/>
              <circle cx="${baseX + 4}" cy="${baseY - 2}" r="6" fill="var(--c-light)"/>`;
    case 'feather':
      return `<path d="M ${baseX} ${baseY} C ${baseX + 14} ${baseY - 4} ${baseX + 18} ${baseY - 16} ${baseX + 10} ${baseY - 22}
              C ${baseX + 16} ${baseY - 14} ${baseX + 12} ${baseY - 4} ${baseX} ${baseY} Z" fill="var(--c-accent)" stroke="var(--c-outline)" stroke-width="1.2"/>`;
    case 'long':
      return `<path d="M ${baseX} ${baseY} C ${baseX + 16} ${baseY + 2} ${baseX + 22} ${baseY - 14} ${baseX + 14} ${baseY - 20}
              C ${baseX + 12} ${baseY - 14} ${baseX + 15} ${baseY - 6} ${baseX + 4} ${baseY - 4} Z"
              fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.5" stroke-linejoin="round"/>`;
    case 'curl':
    default:
      return `<path d="M ${baseX} ${baseY} C ${baseX + 12} ${baseY - 2} ${baseX + 20} ${baseY - 12} ${baseX + 17} ${baseY - 22}
              C ${baseX + 15} ${baseY - 28} ${baseX + 10} ${baseY - 27} ${baseX + 10} ${baseY - 21}
              C ${baseX + 10} ${baseY - 14} ${baseX + 5} ${baseY - 8} ${baseX - 3} ${baseY - 7} Z"
              fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.6" stroke-linejoin="round"/>`;
  }
}

function legsMarkup(mode: LegMode, bodyRx: number, bodyRy: number): string {
  if (mode === 'none') return '';
  // 腿从身体内部 0.4 倍处开始(藏在身体后面),只露出底部一小截,比例参照手绘猫模型
  const y = BODY_CY + bodyRy * 0.4;
  const h = mode === 'long' ? bodyRy * 1.1 : mode === 'stubby' ? bodyRy * 0.4 : bodyRy * 0.8;
  const w = mode === 'long' ? bodyRx * 0.2 : bodyRx * 0.3;
  const dx = bodyRx * 0.42;
  return `<rect x="${BODY_CX - dx - w / 2}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="var(--c-shade)" stroke="var(--c-outline)" stroke-width="1.3"/>
          <rect x="${BODY_CX + dx - w / 2}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.3"/>`;
}

function faceMarkup(spec: ShapeSpec, headCy: number, headR: number): string {
  const eyeDx = headR * 0.42;
  const eyeY = headCy - headR * 0.05;
  let mouth: string;
  if (spec.beak === 'pointed') {
    mouth = `<path d="M ${HEAD_CX - 4} ${headCy + headR * 0.3} L ${HEAD_CX} ${headCy + headR * 0.65} L ${HEAD_CX + 4} ${headCy + headR * 0.3} Z" fill="#e8a13d" stroke="var(--c-outline)" stroke-width="1"/>`;
  } else if (spec.beak === 'flat') {
    mouth = `<ellipse cx="${HEAD_CX}" cy="${headCy + headR * 0.4}" rx="7" ry="3.5" fill="#f2b035" stroke="var(--c-outline)" stroke-width="1"/>`;
  } else {
    mouth = `<path d="M ${HEAD_CX} ${headCy + headR * 0.35} Q ${HEAD_CX - 3.5} ${headCy + headR * 0.55} ${HEAD_CX - 6} ${headCy + headR * 0.42}
             M ${HEAD_CX} ${headCy + headR * 0.35} Q ${HEAD_CX + 3.5} ${headCy + headR * 0.55} ${HEAD_CX + 6} ${headCy + headR * 0.42}"
             fill="none" stroke="var(--c-outline)" stroke-width="1.2" stroke-linecap="round"/>
             <path d="M ${HEAD_CX - 1.5} ${headCy + headR * 0.22} L ${HEAD_CX + 1.5} ${headCy + headR * 0.22} L ${HEAD_CX} ${headCy + headR * 0.35} Z" fill="#e8877a"/>`;
  }
  const mask = spec.mask
    ? `<ellipse cx="${HEAD_CX - eyeDx}" cy="${eyeY}" rx="5.5" ry="6.5" fill="#3a3540"/>
       <ellipse cx="${HEAD_CX + eyeDx}" cy="${eyeY}" rx="5.5" ry="6.5" fill="#3a3540"/>`
    : '';
  const eyeRings = spec.eyeRings
    ? `<circle cx="${HEAD_CX - eyeDx}" cy="${eyeY}" r="7" fill="var(--c-belly)"/>
       <circle cx="${HEAD_CX + eyeDx}" cy="${eyeY}" r="7" fill="var(--c-belly)"/>`
    : '';
  return `${mask}${eyeRings}
    <g data-part="eyeL"><ellipse cx="${HEAD_CX - eyeDx}" cy="${eyeY}" rx="3.2" ry="4" fill="var(--c-eye, #2b2b33)"/><circle cx="${HEAD_CX - eyeDx - 1}" cy="${eyeY - 1.5}" r="1.1" fill="#fff"/></g>
    <g data-part="eyeR"><ellipse cx="${HEAD_CX + eyeDx}" cy="${eyeY}" rx="3.2" ry="4" fill="var(--c-eye, #2b2b33)"/><circle cx="${HEAD_CX + eyeDx - 1}" cy="${eyeY - 1.5}" r="1.1" fill="#fff"/></g>
    ${mouth}`;
}

function featuresMarkup(spec: ShapeSpec, bodyRx: number, bodyRy: number): string {
  const parts: string[] = [];
  if (spec.shell) {
    parts.push(
      `<ellipse cx="${BODY_CX}" cy="${BODY_CY - bodyRy * 0.15}" rx="${bodyRx * 0.92}" ry="${bodyRy * 0.75}" fill="var(--c-pattern)" stroke="var(--c-outline)" stroke-width="1.6"/>`
    );
    for (let i = -1; i <= 1; i++) {
      parts.push(
        `<circle cx="${BODY_CX + i * bodyRx * 0.4}" cy="${BODY_CY - bodyRy * 0.15}" r="${bodyRx * 0.22}" fill="none" stroke="var(--c-outline)" stroke-width="1" opacity="0.5"/>`
      );
    }
  }
  if (spec.spikes) {
    for (let i = -1; i <= 1; i++) {
      const x = BODY_CX + i * 8;
      const y = BODY_CY - bodyRy - i * 0 + 2;
      parts.push(`<path d="M ${x - 3} ${y + 6} L ${x} ${y - 4} L ${x + 3} ${y + 6} Z" fill="var(--c-pattern)" stroke="var(--c-outline)" stroke-width="1"/>`);
    }
  }
  if (spec.spines) {
    for (let i = -2; i <= 2; i++) {
      const x = BODY_CX + i * 6;
      parts.push(`<path d="M ${x - 2} ${BODY_CY - bodyRy + 4} L ${x} ${BODY_CY - bodyRy - 5} L ${x + 2} ${BODY_CY - bodyRy + 4} Z" fill="var(--c-pattern)"/>`);
    }
  }
  if (spec.bigBelly) {
    parts.push(`<ellipse cx="${BODY_CX}" cy="${BODY_CY + bodyRy * 0.25}" rx="${bodyRx * 0.6}" ry="${bodyRy * 0.65}" fill="var(--c-belly)"/>`);
  }
  if (spec.wingBig) {
    parts.push(
      `<path d="M ${BODY_CX - bodyRx * 0.6} ${BODY_CY} C ${BODY_CX - bodyRx * 1.7} ${BODY_CY - 8} ${BODY_CX - bodyRx * 1.9} ${BODY_CY + 10} ${BODY_CX - bodyRx * 1.1} ${BODY_CY + 16}
      C ${BODY_CX - bodyRx * 1.3} ${BODY_CY + 4} ${BODY_CX - bodyRx * 0.9} ${BODY_CY - 2} ${BODY_CX - bodyRx * 0.6} ${BODY_CY} Z"
      fill="var(--c-shade)" stroke="var(--c-outline)" stroke-width="1.4" opacity="0.92"/>`
    );
  }
  if (spec.horn) {
    parts.push(
      `<path d="M ${HEAD_CX - 2} ${BODY_CY - bodyRy * 2.3} L ${HEAD_CX + 2} ${BODY_CY - bodyRy * 2.3} L ${HEAD_CX} ${BODY_CY - bodyRy * 2.9} Z" fill="#f2c14e" stroke="#b58a2a" stroke-width="1"/>`
    );
  }
  if (spec.crest) {
    for (let i = -1; i <= 1; i++) {
      parts.push(
        `<path d="M ${HEAD_CX + i * 3} ${BODY_CY - bodyRy * 2.1} L ${HEAD_CX + i * 5} ${BODY_CY - bodyRy * 2.6} L ${HEAD_CX + i * 2} ${BODY_CY - bodyRy * 2.15} Z" fill="var(--c-accent)"/>`
      );
    }
  }
  if (spec.tentacles) {
    for (let i = -2; i <= 2; i++) {
      const x = BODY_CX + i * bodyRx * 0.35;
      parts.push(
        `<path d="M ${x} ${BODY_CY + bodyRy - 4} Q ${x - 3} ${BODY_CY + bodyRy + 8} ${x + 2} ${BODY_CY + bodyRy + 14}"
        fill="none" stroke="var(--c-body)" stroke-width="4" stroke-linecap="round"/>`
      );
    }
  }
  return parts.join('\n');
}

export function buildSpeciesRig(spec: ShapeSpec): SpeciesRig {
  const headCy = spec.neckFuse ? BODY_CY - spec.bodyRy - spec.headR * 0.55 : BODY_CY - spec.bodyRy - spec.headR * 0.75;
  const bodyBottomWave = spec.floaty
    ? `<path d="M ${BODY_CX - spec.bodyRx} ${BODY_CY + 4} Q ${BODY_CX - spec.bodyRx * 0.5} ${BODY_CY + spec.bodyRy + 10} ${BODY_CX} ${BODY_CY + 4}
       Q ${BODY_CX + spec.bodyRx * 0.5} ${BODY_CY + spec.bodyRy + 10} ${BODY_CX + spec.bodyRx} ${BODY_CY + 4} Z" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.6"/>`
    : '';
  const ears = earsMarkup(spec.earStyle, headCy, spec.headR);

  const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g data-part="tailBase">${tailMarkup(spec.tailStyle, spec.bodyRx, spec.bodyRy)}</g>
    <g data-part="legs">${legsMarkup(spec.legMode, spec.bodyRx, spec.bodyRy)}</g>
    <g data-part="body">
      <ellipse cx="${BODY_CX}" cy="${BODY_CY}" rx="${spec.bodyRx}" ry="${spec.bodyRy}" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.8"/>
      ${bodyBottomWave}
      ${featuresMarkup(spec, spec.bodyRx, spec.bodyRy)}
    </g>
    <g data-part="earR">${ears.right}</g>
    <g data-part="earL">${ears.left}</g>
    <g data-part="head">
      <circle cx="${HEAD_CX}" cy="${headCy}" r="${spec.headR}" fill="var(--c-body)" stroke="var(--c-outline)" stroke-width="1.8"/>
      ${spec.muzzle ? `<ellipse cx="${HEAD_CX}" cy="${headCy + spec.headR * 0.35}" rx="${spec.headR * 0.55}" ry="${spec.headR * 0.4}" fill="var(--c-belly)"/>` : ''}
      ${faceMarkup(spec, headCy, spec.headR)}
    </g>
  </svg>`;

  return {
    svg,
    origins: {
      body: [BODY_CX, BODY_CY + spec.bodyRy * 0.6],
      head: [HEAD_CX, headCy + spec.headR * 0.3],
      earL: [HEAD_CX - spec.headR * 0.7, headCy - spec.headR * 0.4],
      earR: [HEAD_CX + spec.headR * 0.7, headCy - spec.headR * 0.4],
      tailBase: [BODY_CX + spec.bodyRx - 2, BODY_CY + 8],
      legs: [BODY_CX, BODY_CY + spec.bodyRy],
    },
    animations: {},
  };
}

// ---------------------------------------------------------------- 19 物种规格

export const SPECIES_SHAPES: Record<string, ShapeSpec> = {
  sp_dog:      { bodyRx: 22, bodyRy: 19, headR: 17, earStyle: 'floppy', tailStyle: 'curl', muzzle: true, legMode: 'normal' },
  sp_rabbit:   { bodyRx: 21, bodyRy: 21, headR: 16, earStyle: 'pointy', tailStyle: 'short', legMode: 'normal' },
  sp_fox:      { bodyRx: 19, bodyRy: 17, headR: 15, earStyle: 'pointy', tailStyle: 'fluffy', muzzle: true, legMode: 'normal' },
  sp_hamster:  { bodyRx: 24, bodyRy: 20, headR: 16, neckFuse: true, earStyle: 'round', tailStyle: 'none', legMode: 'stubby' },
  sp_bird:     { bodyRx: 16, bodyRy: 18, headR: 13, earStyle: 'none', tailStyle: 'feather', beak: 'pointed', legMode: 'stubby' },
  sp_duck:     { bodyRx: 19, bodyRy: 18, headR: 14, earStyle: 'none', tailStyle: 'short', beak: 'flat', legMode: 'stubby' },
  sp_hedgehog: { bodyRx: 21, bodyRy: 18, headR: 14, earStyle: 'small', tailStyle: 'none', spines: true, legMode: 'stubby' },
  sp_panda:    { bodyRx: 24, bodyRy: 22, headR: 18, earStyle: 'round', tailStyle: 'short', mask: true, legMode: 'stubby' },
  sp_penguin:  { bodyRx: 18, bodyRy: 23, headR: 13, earStyle: 'none', tailStyle: 'short', beak: 'pointed', bigBelly: true, legMode: 'stubby' },
  sp_turtle:   { bodyRx: 25, bodyRy: 16, headR: 12, earStyle: 'none', tailStyle: 'short', shell: true, legMode: 'stubby' },
  sp_owl:      { bodyRx: 20, bodyRy: 21, headR: 17, neckFuse: true, earStyle: 'tuft', tailStyle: 'short', beak: 'pointed', eyeRings: true, legMode: 'stubby' },
  sp_deer:     { bodyRx: 18, bodyRy: 19, headR: 14, earStyle: 'antler', tailStyle: 'short', muzzle: true, legMode: 'long' },
  sp_bat:      { bodyRx: 16, bodyRy: 17, headR: 15, earStyle: 'pointy', tailStyle: 'none', wingBig: true, legMode: 'stubby' },
  sp_dragon:   { bodyRx: 20, bodyRy: 18, headR: 15, earStyle: 'horn', tailStyle: 'long', spikes: true, legMode: 'normal' },
  sp_unicorn:  { bodyRx: 19, bodyRy: 20, headR: 15, earStyle: 'round', tailStyle: 'long', horn: true, muzzle: true, legMode: 'long' },
  sp_phoenix:  { bodyRx: 16, bodyRy: 18, headR: 13, earStyle: 'none', tailStyle: 'feather', beak: 'pointed', crest: true, legMode: 'stubby' },
  sp_slime:    { bodyRx: 22, bodyRy: 20, headR: 10, neckFuse: true, earStyle: 'none', tailStyle: 'none', legMode: 'none' },
  sp_octopus:  { bodyRx: 21, bodyRy: 19, headR: 10, neckFuse: true, earStyle: 'none', tailStyle: 'none', tentacles: true, legMode: 'none' },
  sp_ghost:    { bodyRx: 19, bodyRy: 21, headR: 10, neckFuse: true, earStyle: 'none', tailStyle: 'none', floaty: true, legMode: 'none' },
};
