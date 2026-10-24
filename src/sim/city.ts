import { mulberry32 } from './rng';

/**
 * Kesarnagar — a fictional, procedurally generated city.
 *
 * The street network is a real graph: every street drawn on the map is an edge
 * the router can use, and every distance the solver reports is a shortest path
 * along these edges (metres). The geography is invented; it is not real-world
 * driving distance.
 */

export const CITY_W = 12000; // metres
export const CITY_H = 8000;
const SPACING = 200;

export const enum RoadClass {
  Lane = 0,
  Street = 1,
  Arterial = 2,
  Bridge = 3,
}

export interface Park {
  name: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
}

export interface Bridge {
  edge: number;
  name: string;
}

export interface City {
  width: number;
  height: number;
  nodeCount: number;
  x: Float64Array;
  y: Float64Array;
  edgeCount: number;
  edgeA: Int32Array;
  edgeB: Int32Array;
  edgeLen: Float64Array;
  edgeClass: Uint8Array;
  adjStart: Int32Array;
  adjNode: Int32Array;
  adjEdge: Int32Array;
  riverHalfWidth: number;
  river: [number, number][];
  rail: [number, number][];
  parks: Park[];
  bridges: Bridge[];
  districts: { name: string; x: number; y: number }[];
}

export function riverY(x: number): number {
  return CITY_H * 0.63 + 640 * Math.sin(x / 2300 + 0.9) + 210 * Math.sin(x / 760 + 2.1);
}

const RIVER_HALF = 170;

const PARKS: Park[] = [
  { name: 'Company Bagh', cx: CITY_W * 0.6, cy: CITY_H * 0.3, rx: 620, ry: 380, rot: 0.35 },
  { name: 'Lake Talav', cx: CITY_W * 0.27, cy: CITY_H * 0.48, rx: 520, ry: 330, rot: -0.2 },
  { name: 'Ridge Forest', cx: CITY_W * 0.83, cy: CITY_H * 0.77, rx: 760, ry: 420, rot: 0.6 },
];

const BRIDGE_COLS: Record<number, string> = {
  12: 'Mill Bridge',
  28: 'Gandhi Setu',
  44: 'Station Bridge',
  52: 'Ferry Ghat Bridge',
};

function warp(px: number, py: number, rand: () => number): [number, number] {
  let x = px + 300 * Math.sin(py / 2600 + 1.3) + 110 * Math.sin((px + py) / 1300) + 45 * Math.sin(py / 520);
  let y = py + 240 * Math.sin(px / 3000 + 0.4) + 95 * Math.sin((px - py) / 1150) + 40 * Math.sin(px / 610);
  // Old town: a swirl makes the centre feel older and less planned.
  const ox = CITY_W * 0.43;
  const oy = CITY_H * 0.36;
  const R = 2900;
  const dx = x - ox;
  const dy = y - oy;
  const d = Math.hypot(dx, dy);
  if (d < R) {
    const a = 0.85 * (1 - d / R) ** 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    x = ox + dx * c - dy * s;
    y = oy + dx * s + dy * c;
  }
  return [x + (rand() - 0.5) * 36, y + (rand() - 0.5) * 36];
}

function inPark(x: number, y: number): boolean {
  for (const p of PARKS) {
    const c = Math.cos(-p.rot);
    const s = Math.sin(-p.rot);
    const dx = x - p.cx;
    const dy = y - p.cy;
    const u = (dx * c - dy * s) / p.rx;
    const v = (dx * s + dy * c) / p.ry;
    if (u * u + v * v < 1) return true;
  }
  return false;
}

function outsideLimits(x: number, y: number, rand: () => number): boolean {
  const u = Math.abs((x - CITY_W * 0.5) / (CITY_W * 0.54));
  const v = Math.abs((y - CITY_H * 0.5) / (CITY_H * 0.56));
  return u ** 3 + v ** 3 > 1 + (rand() - 0.5) * 0.12;
}

function roadClass(i: number, j: number, horizontal: boolean): RoadClass {
  const line = horizontal ? j : i;
  if (line % 8 === 4) return RoadClass.Arterial;
  if (line % 2 === 0) return RoadClass.Street;
  return RoadClass.Lane;
}

export function generateCity(seed = 20261024): City {
  const rand = mulberry32(seed);
  const cols = Math.floor(CITY_W / SPACING) + 1;
  const rows = Math.floor(CITY_H / SPACING) + 1;
  const total = cols * rows;
  const gx = new Float64Array(total);
  const gy = new Float64Array(total);
  const alive = new Uint8Array(total);
  const id = (i: number, j: number) => j * cols + i;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const [x, y] = warp(i * SPACING, j * SPACING, rand);
      const k = id(i, j);
      gx[k] = x;
      gy[k] = y;
      const inRiver = Math.abs(y - riverY(x)) < RIVER_HALF + 50;
      alive[k] = inRiver || inPark(x, y) || outsideLimits(x, y, rand) ? 0 : 1;
    }
  }

  const ea: number[] = [];
  const eb: number[] = [];
  const ec: number[] = [];
  const cx = CITY_W * 0.47;
  const cy = CITY_H * 0.45;
  const addEdge = (a: number, b: number, cls: RoadClass) => {
    ea.push(a);
    eb.push(b);
    ec.push(cls);
  };

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = id(i, j);
      if (!alive[a]) continue;
      const r = Math.hypot((gx[a] - cx) / (CITY_W * 0.5), (gy[a] - cy) / (CITY_H * 0.5));
      for (const horizontal of [true, false]) {
        const ni = horizontal ? i + 1 : i;
        const nj = horizontal ? j : j + 1;
        if (ni >= cols || nj >= rows) continue;
        const b = id(ni, nj);
        if (!alive[b]) continue;
        // never connect across the river except at bridges
        const sa = gy[a] < riverY(gx[a]);
        const sb = gy[b] < riverY(gx[b]);
        if (sa !== sb) continue;
        const cls = roadClass(i, j, horizontal);
        const pRemove =
          cls === RoadClass.Arterial ? 0 : 0.03 + 0.34 * r * r + (cls === RoadClass.Lane ? 0.12 : 0);
        if (rand() < pRemove) continue;
        addEdge(a, b, cls);
      }
    }
  }

  // Diagonal avenues radiate from the old town, plus occasional diagonal lanes.
  // A diagonal crosses the interior of one grid cell, so it never intersects another street;
  // at most one diagonal is allowed per cell.
  const cellUsed = new Uint8Array(cols * rows);
  const addDiag = (i: number, j: number, di: number, dj: number, cls: RoadClass) => {
    const ci = Math.min(i, i + di);
    const cj = Math.min(j, j + dj);
    if (ci < 0 || cj < 0 || ci >= cols - 1 || cj >= rows - 1) return;
    const cell = cj * cols + ci;
    if (cellUsed[cell]) return;
    const a = id(i, j);
    const b = id(i + di, j + dj);
    if (!alive[a] || !alive[b]) return;
    if (gy[a] < riverY(gx[a]) !== gy[b] < riverY(gx[b])) return;
    cellUsed[cell] = 1;
    addEdge(a, b, cls);
  };
  const oi = Math.round((CITY_W * 0.43) / SPACING);
  const oj = Math.round((CITY_H * 0.36) / SPACING);
  for (const [di, dj, len] of [
    [1, 1, 14],
    [-1, -1, 12],
    [1, -1, 13],
    [-1, 1, 11],
  ]) {
    let i = oi;
    let j = oj;
    for (let s = 0; s < len; s++) {
      addDiag(i, j, di, dj, RoadClass.Arterial);
      i += di;
      j += dj;
    }
  }
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const k = id(i, j);
      const old = Math.hypot(gx[k] - CITY_W * 0.43, gy[k] - CITY_H * 0.36) < 2600;
      if (rand() < (old ? 0.2 : 0.045)) {
        if (rand() < 0.5) addDiag(i, j, 1, 1, RoadClass.Lane);
        else addDiag(i + 1, j, -1, 1, RoadClass.Lane);
      }
    }
  }

  // Bridges: join the nearest surviving nodes either side of the river in chosen columns.
  const bridgeIdx: { idx: number; name: string }[] = [];
  for (const [colStr, name] of Object.entries(BRIDGE_COLS)) {
    const i = Number(colStr);
    let above = -1;
    let below = -1;
    for (let j = 0; j < rows; j++) {
      const k = id(i, j);
      if (!alive[k]) continue;
      if (gy[k] < riverY(gx[k])) above = k;
      else if (below < 0) below = k;
    }
    if (above >= 0 && below >= 0) {
      bridgeIdx.push({ idx: ea.length, name });
      addEdge(above, below, RoadClass.Bridge);
    }
  }

  // Keep only the connected component containing the centre.
  const adjTmp: number[][] = Array.from({ length: total }, () => []);
  for (let e = 0; e < ea.length; e++) {
    adjTmp[ea[e]].push(eb[e]);
    adjTmp[eb[e]].push(ea[e]);
  }
  let start = -1;
  let best = Infinity;
  for (let k = 0; k < total; k++) {
    if (!alive[k] || adjTmp[k].length === 0) continue;
    const d = Math.hypot(gx[k] - cx, gy[k] - cy);
    if (d < best) {
      best = d;
      start = k;
    }
  }
  const reached = new Uint8Array(total);
  const stack = [start];
  reached[start] = 1;
  while (stack.length) {
    const k = stack.pop()!;
    for (const n of adjTmp[k]) {
      if (!reached[n]) {
        reached[n] = 1;
        stack.push(n);
      }
    }
  }

  const remap = new Int32Array(total).fill(-1);
  let n = 0;
  for (let k = 0; k < total; k++) if (reached[k]) remap[k] = n++;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let k = 0; k < total; k++) {
    if (remap[k] >= 0) {
      x[remap[k]] = gx[k];
      y[remap[k]] = gy[k];
    }
  }

  const oldToNewEdge = new Int32Array(ea.length).fill(-1);
  const A: number[] = [];
  const B: number[] = [];
  const C: number[] = [];
  for (let e = 0; e < ea.length; e++) {
    const a = remap[ea[e]];
    const b = remap[eb[e]];
    if (a < 0 || b < 0) continue;
    oldToNewEdge[e] = A.length;
    A.push(a);
    B.push(b);
    C.push(ec[e]);
  }
  const m = A.length;
  const edgeA = Int32Array.from(A);
  const edgeB = Int32Array.from(B);
  const edgeClass = Uint8Array.from(C);
  const edgeLen = new Float64Array(m);
  for (let e = 0; e < m; e++) edgeLen[e] = Math.hypot(x[edgeA[e]] - x[edgeB[e]], y[edgeA[e]] - y[edgeB[e]]);

  // CSR adjacency
  const deg = new Int32Array(n + 1);
  for (let e = 0; e < m; e++) {
    deg[edgeA[e] + 1]++;
    deg[edgeB[e] + 1]++;
  }
  for (let k = 0; k < n; k++) deg[k + 1] += deg[k];
  const adjStart = deg;
  const fill = adjStart.slice(0, n);
  const adjNode = new Int32Array(2 * m);
  const adjEdge = new Int32Array(2 * m);
  for (let e = 0; e < m; e++) {
    const a = edgeA[e];
    const b = edgeB[e];
    adjNode[fill[a]] = b;
    adjEdge[fill[a]++] = e;
    adjNode[fill[b]] = a;
    adjEdge[fill[b]++] = e;
  }

  const river: [number, number][] = [];
  for (let px = -400; px <= CITY_W + 400; px += 100) river.push([px, riverY(px)]);
  const rail: [number, number][] = [];
  for (let px = -400; px <= CITY_W + 400; px += 100)
    rail.push([px, CITY_H * 0.2 + 420 * Math.sin(px / 3100 + 0.3) + px * 0.06]);

  return {
    width: CITY_W,
    height: CITY_H,
    nodeCount: n,
    x,
    y,
    edgeCount: m,
    edgeA,
    edgeB,
    edgeLen,
    edgeClass,
    adjStart,
    adjNode,
    adjEdge,
    riverHalfWidth: RIVER_HALF,
    river,
    rail,
    parks: PARKS,
    bridges: bridgeIdx
      .filter((b) => oldToNewEdge[b.idx] >= 0)
      .map((b) => ({ edge: oldToNewEdge[b.idx], name: b.name })),
    districts: [
      { name: 'Old Market', x: CITY_W * 0.43, y: CITY_H * 0.37 },
      { name: 'Mill Lines', x: CITY_W * 0.14, y: CITY_H * 0.3 },
      { name: 'Cantonment', x: CITY_W * 0.8, y: CITY_H * 0.4 },
      { name: 'Riverside', x: CITY_W * 0.6, y: CITY_H * 0.82 },
      { name: 'New Colony', x: CITY_W * 0.3, y: CITY_H * 0.85 },
      { name: 'Station Ward', x: CITY_W * 0.72, y: CITY_H * 0.13 },
    ],
  };
}

/** Nearest graph node to a point (linear scan; the city has ~2k nodes). */
export function nearestNode(city: City, px: number, py: number, exclude?: Set<number>): number {
  let best = -1;
  let bd = Infinity;
  for (let k = 0; k < city.nodeCount; k++) {
    if (exclude?.has(k)) continue;
    const d = (city.x[k] - px) ** 2 + (city.y[k] - py) ** 2;
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}
