import { RoadClass, type City } from '../sim/city';

/**
 * Route palette — order chosen with the dataviz validator against daylight paper (#f4efe4):
 * worst adjacent CVD ΔE 9.5 including the wrap-around pairs for 9–12 routes (routes are
 * coloured in bearing order, so neighbours on the map are neighbours in this list).
 * Routes beyond 12 reuse a hue with a dash pattern; van numbers on the map and the
 * dispatch table carry identity too, so colour is never the only cue.
 */
export const ROUTE_COLORS = [
  '#6250d6',
  '#12936a',
  '#2a78d6',
  '#c23a32',
  '#9a4fc4',
  '#b0602a',
  '#2f5aa8',
  '#d4572a',
  '#0f95a6',
  '#b38200',
  '#d6527f',
  '#3f8a2a',
];

export const routeColor = (k: number) => ROUTE_COLORS[k % ROUTE_COLORS.length];
export const routeDash = (k: number): number[] => (k >= ROUTE_COLORS.length ? [7, 4] : []);

const INK = '23, 20, 15';
const ink = (a: number) => `rgba(${INK}, ${a})`;

export interface Transform {
  scale: number; // px per metre
  ox: number;
  oy: number;
  w: number; // css px
  h: number;
  dpr: number;
}

export function fitTransform(city: City, w: number, h: number, dpr: number, margin: number): Transform {
  const scale = Math.min((w - 2 * margin) / city.width, (h - 2 * margin) / city.height);
  return {
    scale,
    ox: (w - city.width * scale) / 2,
    oy: (h - city.height * scale) / 2,
    w,
    h,
    dpr,
  };
}

export const sx = (t: Transform, x: number) => t.ox + x * t.scale;
export const sy = (t: Transform, y: number) => t.oy + y * t.scale;

function polyPath(t: Transform, pts: [number, number][]): Path2D {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(sx(t, x), sy(t, y)) : p.moveTo(sx(t, x), sy(t, y))));
  return p;
}

function offsetLine(pts: [number, number][], d: number): [number, number][] {
  return pts.map(([x, y], i) => {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    return [x - ((y1 - y0) / len) * d, y + ((x1 - x0) / len) * d];
  });
}

/** Static cartography: river, parks, rail, streets, labels. Drawn once per resize. */
export function drawBase(ctx: CanvasRenderingContext2D, city: City, t: Transform, detail: 'full' | 'compact') {
  ctx.save();
  ctx.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
  ctx.clearRect(0, 0, t.w, t.h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s = t.scale;

  // graticule — 1 km survey grid
  ctx.strokeStyle = ink(0.06);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= city.width; x += 1000) {
    ctx.moveTo(Math.round(sx(t, x)) + 0.5, sy(t, 0));
    ctx.lineTo(Math.round(sx(t, x)) + 0.5, sy(t, city.height));
  }
  for (let y = 0; y <= city.height; y += 1000) {
    ctx.moveTo(sx(t, 0), Math.round(sy(t, y)) + 0.5);
    ctx.lineTo(sx(t, city.width), Math.round(sy(t, y)) + 0.5);
  }
  ctx.stroke();

  // river
  const hw = city.riverHalfWidth;
  const north = offsetLine(city.river, -hw);
  const south = offsetLine(city.river, hw);
  const water = new Path2D();
  [...north, ...south.slice().reverse()].forEach(([x, y], i) =>
    i ? water.lineTo(sx(t, x), sy(t, y)) : water.moveTo(sx(t, x), sy(t, y)),
  );
  water.closePath();
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx(t, 0) - 40, sy(t, 0) - 40, city.width * s + 80, city.height * s + 80);
  ctx.clip();
  ctx.fillStyle = 'rgba(70, 104, 124, 0.13)';
  ctx.fill(water);
  ctx.strokeStyle = ink(0.42);
  ctx.lineWidth = 0.9;
  ctx.stroke(polyPath(t, north));
  ctx.stroke(polyPath(t, south));
  ctx.strokeStyle = 'rgba(52, 86, 108, 0.22)';
  ctx.lineWidth = 0.6;
  ctx.setLineDash([6, 7]);
  for (const d of [-hw * 0.45, 0, hw * 0.45]) ctx.stroke(polyPath(t, offsetLine(city.river, d)));
  ctx.setLineDash([]);
  ctx.restore();

  // parks — hatched
  const hatch = document.createElement('canvas');
  hatch.width = hatch.height = Math.round(7 * t.dpr);
  const hc = hatch.getContext('2d')!;
  hc.strokeStyle = 'rgba(64, 92, 52, 0.32)';
  hc.lineWidth = 0.8 * t.dpr;
  hc.beginPath();
  hc.moveTo(0, hatch.height);
  hc.lineTo(hatch.width, 0);
  hc.stroke();
  const pattern = ctx.createPattern(hatch, 'repeat')!;
  pattern.setTransform(new DOMMatrix().scale(1 / t.dpr));
  for (const p of city.parks) {
    ctx.beginPath();
    ctx.ellipse(sx(t, p.cx), sy(t, p.cy), p.rx * s, p.ry * s, p.rot, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(96, 128, 72, 0.07)';
    ctx.fill();
    ctx.fillStyle = pattern;
    ctx.fill();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(64, 92, 52, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // rail
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx(t, 0), sy(t, 0) - 20, city.width * s, city.height * s + 40);
  ctx.clip();
  const rail = polyPath(t, city.rail);
  ctx.strokeStyle = ink(0.55);
  ctx.lineWidth = 1;
  ctx.stroke(rail);
  ctx.lineWidth = 3.4;
  ctx.setLineDash([0.9, 5]);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = ink(0.4);
  ctx.stroke(rail);
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  ctx.restore();

  // streets — one batched path per class
  const widths =
    detail === 'full'
      ? [0.45, 0.75, 1.7, 2.6]
      : [0.35, 0.6, 1.3, 2.1];
  const alphas = [0.2, 0.32, 0.55, 0.85];
  for (const cls of [RoadClass.Lane, RoadClass.Street, RoadClass.Arterial, RoadClass.Bridge]) {
    ctx.beginPath();
    for (let e = 0; e < city.edgeCount; e++) {
      if (city.edgeClass[e] !== cls) continue;
      const a = city.edgeA[e];
      const b = city.edgeB[e];
      ctx.moveTo(sx(t, city.x[a]), sy(t, city.y[a]));
      ctx.lineTo(sx(t, city.x[b]), sy(t, city.y[b]));
    }
    ctx.strokeStyle = ink(alphas[cls]);
    ctx.lineWidth = widths[cls];
    ctx.stroke();
  }
  // bridge abutments
  ctx.strokeStyle = ink(0.75);
  ctx.lineWidth = 1;
  for (const b of city.bridges) {
    const a = city.edgeA[b.edge];
    const c = city.edgeB[b.edge];
    const ax = sx(t, city.x[a]);
    const ay = sy(t, city.y[a]);
    const cx = sx(t, city.x[c]);
    const cy = sy(t, city.y[c]);
    const len = Math.hypot(cx - ax, cy - ay) || 1;
    const nx = (-(cy - ay) / len) * 3.2;
    const ny = ((cx - ax) / len) * 3.2;
    ctx.beginPath();
    ctx.moveTo(ax + nx, ay + ny);
    ctx.lineTo(cx + nx, cy + ny);
    ctx.moveTo(ax - nx, ay - ny);
    ctx.lineTo(cx - nx, cy - ny);
    ctx.stroke();
  }

  // labels
  const fontPx = detail === 'full' ? 10 : 8.5;
  ctx.font = `600 ${fontPx}px "Geist Mono Variable", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0.16em';
  ctx.fillStyle = ink(0.5);
  for (const d of city.districts) ctx.fillText(d.name.toUpperCase(), sx(t, d.x), sy(t, d.y));
  ctx.fillStyle = 'rgba(64, 92, 52, 0.75)';
  ctx.font = `500 ${fontPx - 1}px "Geist Mono Variable", ui-monospace, monospace`;
  for (const p of city.parks) ctx.fillText(p.name.toUpperCase(), sx(t, p.cx), sy(t, p.cy));

  // river name along its course
  const rx = city.width * 0.43;
  const ry = Math.round(city.river.find(([x]) => x >= rx)?.[1] ?? 0);
  const dx = 200;
  const ang = Math.atan2(
    (city.river.find(([x]) => x >= rx + dx)?.[1] ?? ry) - (city.river.find(([x]) => x >= rx - dx)?.[1] ?? ry),
    2 * dx,
  );
  ctx.save();
  ctx.translate(sx(t, rx), sy(t, ry));
  ctx.rotate(ang);
  ctx.fillStyle = 'rgba(40, 72, 94, 0.7)';
  ctx.font = `500 ${fontPx}px "Geist Mono Variable", ui-monospace, monospace`;
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0.5em';
  ctx.fillText('KESAR RIVER', 0, 0);
  ctx.restore();
  ctx.restore();
}

// ─── Dynamic scene ───────────────────────────────────────────────────────────

export interface ScreenRoute {
  path: Path2D;
  pts: Float32Array; // x,y pairs
  cum: Float32Array; // cumulative screen length
  length: number;
}

export function screenRoute(city: City, t: Transform, nodes: Int32Array, offsetPx = 0): ScreenRoute {
  const n = nodes.length;
  const pts = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) {
    pts[2 * k] = sx(t, city.x[nodes[k]]);
    pts[2 * k + 1] = sy(t, city.y[nodes[k]]);
  }
  if (offsetPx) {
    const out = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - 1);
      const b = Math.min(n - 1, k + 1);
      const dx = pts[2 * b] - pts[2 * a];
      const dy = pts[2 * b + 1] - pts[2 * a + 1];
      const len = Math.hypot(dx, dy) || 1;
      out[2 * k] = pts[2 * k] - (dy / len) * offsetPx;
      out[2 * k + 1] = pts[2 * k + 1] + (dx / len) * offsetPx;
    }
    pts.set(out);
  }
  const cum = new Float32Array(n);
  const path = new Path2D();
  for (let k = 0; k < n; k++) {
    const x = pts[2 * k];
    const y = pts[2 * k + 1];
    if (k === 0) path.moveTo(x, y);
    else {
      path.lineTo(x, y);
      cum[k] = cum[k - 1] + Math.hypot(x - pts[2 * k - 2], y - pts[2 * k - 1]);
    }
  }
  return { path, pts, cum, length: cum[n - 1] || 0 };
}

export function pointAt(r: ScreenRoute, d: number): [number, number, number] {
  const { cum, pts } = r;
  if (d <= 0) return [pts[0], pts[1], 0];
  let lo = 0;
  let hi = cum.length - 1;
  if (d >= cum[hi]) return [pts[2 * hi], pts[2 * hi + 1], 0];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < d) lo = mid;
    else hi = mid;
  }
  const f = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
  const x0 = pts[2 * lo];
  const y0 = pts[2 * lo + 1];
  const x1 = pts[2 * hi];
  const y1 = pts[2 * hi + 1];
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, Math.atan2(y1 - y0, x1 - x0)];
}

/** Draws the visible portion [0, frac] of a route using a dash — no per-segment work. */
export function strokePartial(ctx: CanvasRenderingContext2D, r: ScreenRoute, frac: number, dash: number[] = []) {
  if (frac <= 0) return;
  if (frac >= 1) {
    ctx.setLineDash(dash);
    ctx.stroke(r.path);
    ctx.setLineDash([]);
    return;
  }
  ctx.setLineDash([r.length * frac, r.length + 1]);
  ctx.stroke(r.path);
  ctx.setLineDash([]);
}

export { ink };

/** Fit an arbitrary world-space box (metres) into the canvas. */
export function fitBox(
  w: number,
  h: number,
  dpr: number,
  box: { x0: number; y0: number; x1: number; y1: number },
  margin: number,
): Transform {
  const bw = Math.max(1, box.x1 - box.x0);
  const bh = Math.max(1, box.y1 - box.y0);
  const scale = Math.min((w - 2 * margin) / bw, (h - 2 * margin) / bh);
  return {
    scale,
    ox: w / 2 - (box.x0 + bw / 2) * scale,
    oy: h / 2 - (box.y0 + bh / 2) * scale,
    w,
    h,
    dpr,
  };
}
