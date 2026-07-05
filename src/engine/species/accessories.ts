/**
 * 头饰 / 颈饰矢量贴花:所有物种共用同一套绘制函数,按头部/颈部锚点定位,
 * 让 headwear/neckwear 这两个收藏维度重新在外观上真正体现出来。
 */

export function headwearMarkup(id: string, hx: number, hy: number, hr: number): string {
  const top = hy - hr;
  switch (id) {
    case 'head_cap':
      return `<ellipse cx="${hx}" cy="${top + 2}" rx="${hr * 0.8}" ry="${hr * 0.35}" fill="var(--c-accent)" stroke="var(--c-outline)" stroke-width="1.2"/>
              <circle cx="${hx}" cy="${top - 1}" r="2" fill="var(--c-light)"/>`;
    case 'head_bow':
      return `<path d="M ${hx + 3} ${top} L ${hx + 9} ${top - 4} L ${hx + 9} ${top + 4} Z" fill="var(--c-accent)" stroke="var(--c-outline)" stroke-width="1"/>
              <path d="M ${hx + 3} ${top} L ${hx - 3} ${top - 4} L ${hx - 3} ${top + 4} Z" fill="var(--c-accent)" stroke="var(--c-outline)" stroke-width="1"/>
              <circle cx="${hx + 3}" cy="${top}" r="2" fill="var(--c-pattern)"/>`;
    case 'head_flower':
      return `<g fill="#ffffff" stroke="var(--c-outline)" stroke-width="0.6">
                <circle cx="${hx - 7}" cy="${top - 2}" r="2.2"/>
                <circle cx="${hx - 10}" cy="${top + 1}" r="2.2"/>
                <circle cx="${hx - 4}" cy="${top + 1}" r="2.2"/>
                <circle cx="${hx - 7}" cy="${top + 4}" r="2.2"/>
              </g><circle cx="${hx - 7}" cy="${top + 1}" r="1.6" fill="#f2c14e"/>`;
    case 'head_glasses':
      return `<g fill="none" stroke="var(--c-outline)" stroke-width="1.4">
                <circle cx="${hx - hr * 0.42}" cy="${hy - 1}" r="4.2"/>
                <circle cx="${hx + hr * 0.42}" cy="${hy - 1}" r="4.2"/>
                <line x1="${hx - hr * 0.42 + 4}" y1="${hy - 1}" x2="${hx + hr * 0.42 - 4}" y2="${hy - 1}"/>
              </g>`;
    case 'head_beret':
      return `<ellipse cx="${hx - 1}" cy="${top + 1}" rx="${hr * 0.75}" ry="${hr * 0.3}" fill="var(--c-pattern)" stroke="var(--c-outline)" stroke-width="1.2"/>
              <rect x="${hx - 1}" y="${top - 3}" width="2" height="3" fill="var(--c-outline)"/>`;
    case 'head_monocle':
      return `<circle cx="${hx + hr * 0.4}" cy="${hy - 1}" r="4.5" fill="none" stroke="#d9b23c" stroke-width="1.4"/>
              <line x1="${hx + hr * 0.4 + 4}" y1="${hy + 3}" x2="${hx + hr * 0.4 + 7}" y2="${hy + 9}" stroke="#d9b23c" stroke-width="1"/>`;
    case 'head_crown':
      return `<path d="M ${hx - 9} ${top + 3} L ${hx - 6} ${top - 5} L ${hx - 2} ${top + 1} L ${hx} ${top - 7} L ${hx + 2} ${top + 1} L ${hx + 6} ${top - 5} L ${hx + 9} ${top + 3} Z"
              fill="#f2c14e" stroke="#b58a2a" stroke-width="1"/><circle cx="${hx}" cy="${top - 1}" r="1.6" fill="#e8574d"/>`;
    case 'head_halo':
      return `<ellipse cx="${hx}" cy="${top - 6}" rx="8" ry="2.6" fill="none" stroke="#f2c14e" stroke-width="1.8" opacity="0.9"/>`;
    default:
      return '';
  }
}

/** 材质贴花:叠加在身体上,让"绒毛/光滑/果冻/鳞片/星尘"这个收藏维度也体现在外观上 */
export function materialMarkup(id: string, cx: number, cy: number, rx: number, ry: number): string {
  switch (id) {
    case 'mat_sleek':
      return `<ellipse cx="${cx - rx * 0.35}" cy="${cy - ry * 0.5}" rx="${rx * 0.25}" ry="${ry * 0.35}" fill="#ffffff" opacity="0.28" transform="rotate(-25 ${cx - rx * 0.35} ${cy - ry * 0.5})"/>`;
    case 'mat_jelly':
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#ffffff" opacity="0.18"/>
              <ellipse cx="${cx - rx * 0.3}" cy="${cy - ry * 0.4}" rx="${rx * 0.3}" ry="${ry * 0.22}" fill="#ffffff" opacity="0.4"/>`;
    case 'mat_scales': {
      const dots: string[] = [];
      for (let row = -1; row <= 1; row++) {
        for (let col = -2; col <= 2; col++) {
          const x = cx + col * rx * 0.32 + (row % 2 === 0 ? rx * 0.16 : 0);
          const y = cy + row * ry * 0.35;
          dots.push(`<path d="M ${x - 3} ${y} Q ${x} ${y - 3} ${x + 3} ${y} Q ${x} ${y + 2} ${x - 3} ${y} Z" fill="var(--c-shade)" opacity="0.35"/>`);
        }
      }
      return dots.join('');
    }
    case 'mat_stardust': {
      const sparkles: string[] = [];
      const seeds = [
        [-0.5, -0.5], [0.3, -0.6], [-0.2, 0.2], [0.5, 0.1], [0, -0.8], [-0.6, 0.3], [0.6, -0.2],
      ];
      for (const [dx, dy] of seeds) {
        const x = cx + dx * rx;
        const y = cy + dy * ry;
        sparkles.push(
          `<path d="M ${x} ${y - 2} L ${x + 0.6} ${y - 0.6} L ${x + 2} ${y} L ${x + 0.6} ${y + 0.6} L ${x} ${y + 2} L ${x - 0.6} ${y + 0.6} L ${x - 2} ${y} L ${x - 0.6} ${y - 0.6} Z" fill="#fff2c0" opacity="0.85"/>`
        );
      }
      return sparkles.join('');
    }
    default:
      return '';
  }
}

export function neckwearMarkup(id: string, nx: number, ny: number): string {
  switch (id) {
    case 'neck_scarf':
      return `<path d="M ${nx - 9} ${ny} Q ${nx} ${ny + 4} ${nx + 9} ${ny} L ${nx + 9} ${ny + 3} Q ${nx} ${ny + 7} ${nx - 9} ${ny + 3} Z"
              fill="var(--c-accent)" stroke="var(--c-outline)" stroke-width="1"/>
              <rect x="${nx + 5}" y="${ny + 3}" width="3" height="7" fill="var(--c-accent)"/>`;
    case 'neck_bell':
      return `<path d="M ${nx - 9} ${ny - 1} Q ${nx} ${ny + 2} ${nx + 9} ${ny - 1}" fill="none" stroke="var(--c-outline)" stroke-width="1.6"/>
              <circle cx="${nx}" cy="${ny + 4}" r="3" fill="#f2c14e" stroke="#b58a2a" stroke-width="1"/>
              <circle cx="${nx}" cy="${ny + 5}" r="0.8" fill="#7a5f1e"/>`;
    case 'neck_bowtie':
      return `<path d="M ${nx} ${ny + 2} L ${nx - 6} ${ny - 1} L ${nx - 6} ${ny + 5} Z" fill="var(--c-accent)" stroke="var(--c-outline)" stroke-width="1"/>
              <path d="M ${nx} ${ny + 2} L ${nx + 6} ${ny - 1} L ${nx + 6} ${ny + 5} Z" fill="var(--c-accent)" stroke="var(--c-outline)" stroke-width="1"/>
              <circle cx="${nx}" cy="${ny + 2}" r="1.8" fill="var(--c-pattern)"/>`;
    case 'neck_necklace':
      return `<path d="M ${nx - 8} ${ny} Q ${nx} ${ny + 5} ${nx + 8} ${ny}" fill="none" stroke="#f2c14e" stroke-width="1.4"/>
              <circle cx="${nx}" cy="${ny + 5}" r="2" fill="#e8574d"/>`;
    case 'neck_cape':
      return `<path d="M ${nx - 11} ${ny - 2} Q ${nx} ${ny + 3} ${nx + 11} ${ny - 2} L ${nx + 9} ${ny + 26} Q ${nx} ${ny + 32} ${nx - 9} ${ny + 26} Z"
              fill="var(--c-pattern)" stroke="var(--c-outline)" stroke-width="1.3" opacity="0.92"/>
              <circle cx="${nx - 6}" cy="${ny}" r="1.4" fill="#f2c14e"/><circle cx="${nx + 6}" cy="${ny}" r="1.4" fill="#f2c14e"/>`;
    default:
      return '';
  }
}
