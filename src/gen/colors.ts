/** 颜色工具:HSL → HEX、明暗调整、混色(渐变纹用) */

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.min(100, Math.max(0, s)) / 100;
  l = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** amt: -1(全黑) .. 0 .. 1(全白) */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  const f = 1 + amt;
  return rgbToHex(r * f, g * f, b * f);
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export interface CreatureColors {
  body: string;
  shade: string;
  light: string;
  belly: string;
  outline: string;
  pattern: string;
  accent: string;
  animated: boolean;
  gradientStops?: string[];
}

/**
 * 全随机配色:色相 0~360 完全随机(不再局限于预设色板的固定色相区间)。
 * animatedBonus = true 时额外生成三段流光渐变色(高稀有度专属观感)。
 */
export function randomCreatureColors(rng: () => number, animatedBonus: boolean): CreatureColors {
  const hue = rng() * 360;
  const sat = 40 + rng() * 50; // 40~90
  const lit = 42 + rng() * 32; // 42~74
  const body = hslToHex(hue, sat, lit);
  const patternShift = (25 + rng() * 60) * (rng() < 0.5 ? 1 : -1);
  const pattern = hslToHex(hue + patternShift, Math.min(92, sat + 5), Math.max(18, lit - 22));
  const accent = hslToHex(hue + 165 + (rng() - 0.5) * 50, Math.min(88, sat + 12), 58 + rng() * 10);
  const base: CreatureColors = {
    body,
    shade: shade(body, -0.22),
    light: shade(body, 0.22),
    belly: hslToHex(hue + 8, Math.max(12, sat - 22), Math.min(92, lit + 26)),
    outline: hslToHex(hue, Math.min(60, sat + 5), Math.max(10, lit - 45)),
    pattern,
    accent,
    animated: false,
  };
  if (!animatedBonus) return base;
  const stops = [hue, hue + 55 + rng() * 70, hue + 150 + rng() * 70].map((h) =>
    hslToHex(h, 68 + rng() * 22, 58 + rng() * 18)
  );
  return { ...base, animated: true, gradientStops: stops };
}
