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
