/** 像素画底层:48×48 轮廓 mask、填充、自动描边 */

export const GRID = 48;
export const SCALE = 3;

export class Mask {
  a = new Uint8Array(GRID * GRID);

  set(x: number, y: number): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi >= 0 && xi < GRID && yi >= 0 && yi < GRID) this.a[yi * GRID + xi] = 1;
  }

  get(x: number, y: number): number {
    return x >= 0 && x < GRID && y >= 0 && y < GRID ? this.a[y * GRID + x] : 0;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number): void {
    rx = Math.max(1.2, rx);
    ry = Math.max(1.2, ry);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.02) this.set(x, y);
      }
    }
  }

  circle(cx: number, cy: number, r: number): void {
    this.ellipse(cx, cy, r, r);
  }

  rect(x: number, y: number, w: number, h: number): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy);
  }

  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): void {
    const minX = Math.floor(Math.min(ax, bx, cx));
    const maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy));
    const maxY = Math.ceil(Math.max(ay, by, cy));
    const sign = (x1: number, y1: number, x2: number, y2: number, px0: number, py0: number) =>
      (px0 - x2) * (y1 - y2) - (x1 - x2) * (py0 - y2);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d1 = sign(ax, ay, bx, by, x, y);
        const d2 = sign(bx, by, cx, cy, x, y);
        const d3 = sign(cx, cy, ax, ay, x, y);
        const neg = d1 < 0 || d2 < 0 || d3 < 0;
        const pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) this.set(x, y);
      }
    }
  }

  clearBelow(row: number): void {
    for (let y = row + 1; y < GRID; y++) for (let x = 0; x < GRID; x++) this.a[y * GRID + x] = 0;
  }

  /** 挖掉一个圆(幽灵底部波浪缺口等) */
  subCircle(cx: number, cy: number, r: number): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = (x - cx) / r;
        const dy = (y - cy) / r;
        if (dx * dx + dy * dy <= 1 && x >= 0 && x < GRID && y >= 0 && y < GRID) {
          this.a[y * GRID + x] = 0;
        }
      }
    }
  }

  isEdge(x: number, y: number): boolean {
    return (
      !!this.get(x, y) &&
      (!this.get(x - 1, y) || !this.get(x + 1, y) || !this.get(x, y - 1) || !this.get(x, y + 1))
    );
  }
}

export function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: string, w = 1, h = 1): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function paintMask(ctx: CanvasRenderingContext2D, m: Mask, fill: string, alpha = 1): void {
  ctx.fillStyle = fill;
  if (alpha < 1) ctx.globalAlpha = alpha;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (m.get(x, y)) ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

export function outlineMask(ctx: CanvasRenderingContext2D, m: Mask, color: string): void {
  ctx.fillStyle = color;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (m.get(x, y) && m.isEdge(x, y)) ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * Scale2x(EPX)平滑放大:保留像素画风格的同时消除阶梯锯齿。
 * 连续应用两次(4×)后再由渲染层线性缩小到目标尺寸,得到精细无马赛克的观感。
 */
export function scale2x(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const sctx = src.getContext('2d')!;
  const sd = new Uint32Array(sctx.getImageData(0, 0, w, h).data.buffer);
  const out = document.createElement('canvas');
  out.width = w * 2;
  out.height = h * 2;
  const octx = out.getContext('2d')!;
  const od = octx.createImageData(w * 2, h * 2);
  const dd = new Uint32Array(od.data.buffer);
  const get = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : sd[y * w + x];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = sd[y * w + x];
      const A = get(x, y - 1);
      const B = get(x + 1, y);
      const C = get(x - 1, y);
      const D = get(x, y + 1);
      let e0 = P, e1 = P, e2 = P, e3 = P;
      if (C === A && C !== D && A !== B) e0 = A;
      if (A === B && A !== C && B !== D) e1 = B;
      if (D === C && D !== B && C !== A) e2 = C;
      if (B === D && B !== A && D !== C) e3 = D;
      const oy = y * 2 * (w * 2);
      dd[oy + x * 2] = e0;
      dd[oy + x * 2 + 1] = e1;
      dd[oy + w * 2 + x * 2] = e2;
      dd[oy + w * 2 + x * 2 + 1] = e3;
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}

export function upscale4x(src: HTMLCanvasElement): HTMLCanvasElement {
  return scale2x(scale2x(src));
}

/** 沿 mask 外侧画一圈光晕(发光描边特效) */
export function haloMask(ctx: CanvasRenderingContext2D, m: Mask, color: string, alpha: number): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (m.get(x, y)) continue;
      if (m.get(x - 1, y) || m.get(x + 1, y) || m.get(x, y - 1) || m.get(x, y + 1)) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}
