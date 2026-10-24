/**
 * Capacitated vehicle routing with a maximum shift duration.
 *
 * Locations are indexed 0..n where 0 is the depot. A plan is a list of routes,
 * each an ordered list of customer indices; every route starts and ends at the depot.
 *
 * Enforced constraints: vehicle capacity (crates) and shift length
 * (drive time + service time). Not modelled: delivery time windows, traffic,
 * multiple depots, driver breaks.
 */

export interface Problem {
  n: number;
  D: Float64Array; // (n + 1)² road-network distances, metres
  demand: Int32Array; // length n + 1, demand[0] = 0
  capacity: number;
  speed: number; // m/s
  service: number; // s per stop
  shift: number; // s
  fleet: number;
}

export type Plan = number[][];

export interface RouteStats {
  distance: number;
  load: number;
  duration: number;
  stops: number;
}

export interface PlanStats {
  distance: number;
  vans: number;
  duration: number;
  load: number;
  routes: RouteStats[];
  capacityOk: boolean;
  shiftOk: boolean;
  fleetOk: boolean;
  allServed: boolean;
  feasible: boolean;
}

export interface SolveCounters {
  twoOpt: number;
  relocate: number;
  swap: number;
  twoOptStar: number;
  eliminated: number;
  iterations: number;
}

/** Objective weight for each van used, in metres. Only used to rank plans. */
export const VAN_COST = 15000;
const EPS = 1e-7;

const idx = (p: Problem, a: number, b: number) => a * (p.n + 1) + b;

export function routeDistance(p: Problem, r: number[]): number {
  if (r.length === 0) return 0;
  let d = 0;
  let prev = 0;
  for (const c of r) {
    d += p.D[idx(p, prev, c)];
    prev = c;
  }
  return d + p.D[idx(p, prev, 0)];
}

export function routeLoad(p: Problem, r: number[]): number {
  let l = 0;
  for (const c of r) l += p.demand[c];
  return l;
}

export function durationOf(p: Problem, distance: number, stops: number): number {
  return distance / p.speed + p.service * stops;
}

export function evaluate(p: Problem, plan: Plan): PlanStats {
  const routes: RouteStats[] = [];
  const seen = new Int32Array(p.n + 1);
  let distance = 0;
  let duration = 0;
  let load = 0;
  let capacityOk = true;
  let shiftOk = true;
  for (const r of plan) {
    if (r.length === 0) continue;
    const d = routeDistance(p, r);
    const l = routeLoad(p, r);
    const t = durationOf(p, d, r.length);
    for (const c of r) seen[c]++;
    routes.push({ distance: d, load: l, duration: t, stops: r.length });
    distance += d;
    duration += t;
    load += l;
    if (l > p.capacity) capacityOk = false;
    if (t > p.shift + 1e-6) shiftOk = false;
  }
  let allServed = true;
  for (let c = 1; c <= p.n; c++) if (seen[c] !== 1) allServed = false;
  const fleetOk = routes.length <= p.fleet;
  return {
    distance,
    vans: routes.length,
    duration,
    load,
    routes,
    capacityOk,
    shiftOk,
    fleetOk,
    allServed,
    feasible: capacityOk && shiftOk && fleetOk && allServed,
  };
}

/**
 * Like evaluate(), but keeps one entry per van (empty routes included) so van numbering stays
 * stable while a dispatcher edits the live plan. `vans` counts only vans with stops.
 */
export function evaluateAligned(p: Problem, plan: Plan): PlanStats {
  const compact = evaluate(p, plan.filter((r) => r.length > 0));
  let k = 0;
  const routes = plan.map((r) => (r.length ? compact.routes[k++] : { distance: 0, load: 0, duration: 0, stops: 0 }));
  return { ...compact, routes };
}

export function objective(p: Problem, plan: Plan): number {
  let o = 0;
  for (const r of plan) if (r.length) o += routeDistance(p, r) + VAN_COST;
  return o;
}

/**
 * Manual baseline — an explicit, reproducible stand-in for a careful dispatcher:
 * orders are grouped by fixed "pincode" zone; within each zone a van is loaded
 * nearest-next from the depot until capacity or shift would be exceeded, then
 * the next van starts. Vans never cross zone boundaries.
 */
export function baselinePlan(p: Problem, zone: Int32Array): Plan {
  const byZone = new Map<number, number[]>();
  for (let c = 1; c <= p.n; c++) {
    const z = zone[c];
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z)!.push(c);
  }
  const plan: Plan = [];
  for (const z of [...byZone.keys()].sort((a, b) => a - b)) {
    const remaining = byZone.get(z)!;
    while (remaining.length) {
      const route: number[] = [];
      let cur = 0;
      let load = 0;
      let time = 0;
      for (;;) {
        let best = -1;
        let bd = Infinity;
        for (let k = 0; k < remaining.length; k++) {
          const u = remaining[k];
          const d = p.D[idx(p, cur, u)];
          if (d >= bd) continue;
          if (load + p.demand[u] > p.capacity) continue;
          const t = time + d / p.speed + p.service + p.D[idx(p, u, 0)] / p.speed;
          if (t > p.shift) continue;
          best = k;
          bd = d;
        }
        if (best < 0) break;
        const u = remaining[best];
        remaining.splice(best, 1);
        route.push(u);
        time += bd / p.speed + p.service;
        load += p.demand[u];
        cur = u;
      }
      if (route.length === 0) {
        // A single order that cannot fit any van on its own; keep it visible as infeasible.
        route.push(remaining.shift()!);
      }
      plan.push(route);
    }
  }
  return plan;
}

/** Clarke–Wright parallel savings with route-shape parameter λ. */
export function savingsPlan(p: Problem, lambda: number): Plan {
  const n = p.n;
  const routes: (number[] | null)[] = [null];
  const routeOf = new Int32Array(n + 1);
  const dist = new Float64Array(n + 1);
  const load = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    routes.push([i]);
    routeOf[i] = i;
    dist[i] = 2 * p.D[idx(p, 0, i)];
    load[i] = p.demand[i];
  }
  const pi: number[] = [];
  const pj: number[] = [];
  const ps: number[] = [];
  for (let i = 1; i <= n; i++) {
    const d0i = p.D[idx(p, 0, i)];
    for (let j = i + 1; j <= n; j++) {
      const s = d0i + p.D[idx(p, 0, j)] - lambda * p.D[idx(p, i, j)];
      if (s > 0) {
        pi.push(i);
        pj.push(j);
        ps.push(s);
      }
    }
  }
  const order = Array.from(ps.keys());
  order.sort((a, b) => ps[b] - ps[a] || pi[a] - pi[b] || pj[a] - pj[b]);

  for (const k of order) {
    const i = pi[k];
    const j = pj[k];
    const A = routeOf[i];
    const B = routeOf[j];
    if (A === B) continue;
    const ra = routes[A]!;
    const rb = routes[B]!;
    const iEnd = ra[ra.length - 1] === i;
    const iStart = ra[0] === i;
    const jEnd = rb[rb.length - 1] === j;
    const jStart = rb[0] === j;
    if (!(iEnd || iStart) || !(jEnd || jStart)) continue;
    if (load[A] + load[B] > p.capacity) continue;
    const nd = dist[A] + dist[B] - p.D[idx(p, 0, i)] - p.D[idx(p, 0, j)] + p.D[idx(p, i, j)];
    if (durationOf(p, nd, ra.length + rb.length) > p.shift) continue;
    const a = iEnd ? ra : ra.slice().reverse();
    const b = jStart ? rb : rb.slice().reverse();
    const merged = a.concat(b);
    routes[A] = merged;
    routes[B] = null;
    for (const c of rb) routeOf[c] = A;
    dist[A] = nd;
    load[A] += load[B];
  }
  return routes.filter((r): r is number[] => r !== null && r.length > 0);
}

// ─── Local search ────────────────────────────────────────────────────────────

/** 2-opt within one route. The first `frozen` stops (already delivered) are never reordered. */
export function twoOptRoute(p: Problem, r: number[], frozen = 0): number {
  const seq = [0, ...r, 0];
  const L = seq.length;
  let moves = 0;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = frozen; i < L - 3; i++) {
      const a = seq[i];
      const b = seq[i + 1];
      const dab = p.D[idx(p, a, b)];
      for (let j = i + 2; j < L - 1; j++) {
        const c = seq[j];
        const d = seq[j + 1];
        const delta = p.D[idx(p, a, c)] + p.D[idx(p, b, d)] - dab - p.D[idx(p, c, d)];
        if (delta < -EPS) {
          for (let lo = i + 1, hi = j; lo < hi; lo++, hi--) {
            const t = seq[lo];
            seq[lo] = seq[hi];
            seq[hi] = t;
          }
          moves++;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }
  r.splice(0, r.length, ...seq.slice(1, -1));
  return moves;
}

function relocatePass(p: Problem, plan: Plan): number {
  let moves = 0;
  const dists = plan.map((r) => routeDistance(p, r));
  const loads = plan.map((r) => routeLoad(p, r));
  for (let A = 0; A < plan.length; A++) {
    for (let pos = 0; pos < plan[A].length; pos++) {
      const ra = plan[A];
      const u = ra[pos];
      const prev = pos === 0 ? 0 : ra[pos - 1];
      const next = pos === ra.length - 1 ? 0 : ra[pos + 1];
      const gain = p.D[idx(p, prev, u)] + p.D[idx(p, u, next)] - p.D[idx(p, prev, next)];
      const emptied = ra.length === 1;
      let bestDelta = -EPS;
      let bestB = -1;
      let bestQ = -1;
      for (let B = 0; B < plan.length; B++) {
        const rb = plan[B];
        if (B !== A) {
          if (rb.length === 0) continue;
          if (loads[B] + p.demand[u] > p.capacity) continue;
        }
        const baseDist = B === A ? dists[A] - gain : dists[B];
        const baseStops = B === A ? rb.length - 1 : rb.length;
        for (let q = 0; q <= rb.length; q++) {
          let c: number;
          let d: number;
          if (B === A) {
            // q indexes the route with u removed; q === pos puts u back where it was
            const m = rb.length - 1;
            if (q > m || q === pos) continue;
            const reduced = (k: number) => (k < pos ? rb[k] : rb[k + 1]);
            c = q === 0 ? 0 : reduced(q - 1);
            d = q === m ? 0 : reduced(q);
          } else {
            c = q === 0 ? 0 : rb[q - 1];
            d = q === rb.length ? 0 : rb[q];
          }
          const ins = p.D[idx(p, c, u)] + p.D[idx(p, u, d)] - p.D[idx(p, c, d)];
          let delta = ins - gain;
          if (B !== A && emptied) delta -= VAN_COST;
          if (delta >= bestDelta) continue;
          if (durationOf(p, baseDist + ins, baseStops + 1) > p.shift) continue;
          bestDelta = delta;
          bestB = B;
          bestQ = q;
        }
      }
      if (bestB >= 0) {
        ra.splice(pos, 1);
        plan[bestB].splice(bestQ, 0, u);
        dists[A] = routeDistance(p, ra);
        loads[A] = routeLoad(p, ra);
        if (bestB !== A) {
          dists[bestB] = routeDistance(p, plan[bestB]);
          loads[bestB] = routeLoad(p, plan[bestB]);
        }
        moves++;
        pos--; // re-examine the element that slid into this position
        if (plan[A].length === 0) break;
      }
    }
  }
  return moves;
}

function swapPass(p: Problem, plan: Plan): number {
  let moves = 0;
  const dists = plan.map((r) => routeDistance(p, r));
  const loads = plan.map((r) => routeLoad(p, r));
  for (let A = 0; A < plan.length; A++) {
    for (let B = A + 1; B < plan.length; B++) {
      const ra = plan[A];
      const rb = plan[B];
      for (let i = 0; i < ra.length; i++) {
        for (let j = 0; j < rb.length; j++) {
          const u = ra[i];
          const v = rb[j];
          const lA = loads[A] - p.demand[u] + p.demand[v];
          const lB = loads[B] - p.demand[v] + p.demand[u];
          if (lA > p.capacity || lB > p.capacity) continue;
          const aP = i === 0 ? 0 : ra[i - 1];
          const aN = i === ra.length - 1 ? 0 : ra[i + 1];
          const bP = j === 0 ? 0 : rb[j - 1];
          const bN = j === rb.length - 1 ? 0 : rb[j + 1];
          const dA = p.D[idx(p, aP, v)] + p.D[idx(p, v, aN)] - p.D[idx(p, aP, u)] - p.D[idx(p, u, aN)];
          const dB = p.D[idx(p, bP, u)] + p.D[idx(p, u, bN)] - p.D[idx(p, bP, v)] - p.D[idx(p, v, bN)];
          if (dA + dB >= -EPS) continue;
          if (durationOf(p, dists[A] + dA, ra.length) > p.shift) continue;
          if (durationOf(p, dists[B] + dB, rb.length) > p.shift) continue;
          ra[i] = v;
          rb[j] = u;
          dists[A] += dA;
          dists[B] += dB;
          loads[A] = lA;
          loads[B] = lB;
          moves++;
        }
      }
    }
  }
  return moves;
}

/** 2-opt*: exchange route tails between two routes — removes crossings between vans. */
function twoOptStarPass(p: Problem, plan: Plan): number {
  let moves = 0;
  for (let A = 0; A < plan.length; A++) {
    for (let B = A + 1; B < plan.length; B++) {
      let changed = true;
      while (changed) {
        changed = false;
        const sa = [0, ...plan[A], 0];
        const sb = [0, ...plan[B], 0];
        const LA = sa.length;
        const LB = sb.length;
        if (LA < 3 || LB < 3) break;
        const before = 2;
        const pdA = new Float64Array(LA);
        const plA = new Float64Array(LA);
        for (let k = 1; k < LA; k++) {
          pdA[k] = pdA[k - 1] + p.D[idx(p, sa[k - 1], sa[k])];
          plA[k] = plA[k - 1] + p.demand[sa[k]];
        }
        const pdB = new Float64Array(LB);
        const plB = new Float64Array(LB);
        for (let k = 1; k < LB; k++) {
          pdB[k] = pdB[k - 1] + p.D[idx(p, sb[k - 1], sb[k])];
          plB[k] = plB[k - 1] + p.demand[sb[k]];
        }
        const distA = pdA[LA - 1];
        const distB = pdB[LB - 1];
        const loadA = plA[LA - 1];
        const loadB = plB[LB - 1];
        let best = -EPS;
        let bi = -1;
        let bj = -1;
        for (let i = 0; i < LA - 1; i++) {
          for (let j = 0; j < LB - 1; j++) {
            const countA = i + (LB - 2 - j);
            const countB = j + (LA - 2 - i);
            let delta =
              p.D[idx(p, sa[i], sb[j + 1])] +
              p.D[idx(p, sb[j], sa[i + 1])] -
              p.D[idx(p, sa[i], sa[i + 1])] -
              p.D[idx(p, sb[j], sb[j + 1])];
            const after = (countA > 0 ? 1 : 0) + (countB > 0 ? 1 : 0);
            delta -= VAN_COST * (before - after);
            if (delta >= best) continue;
            const nlA = plA[i] + (loadB - plB[j]);
            const nlB = plB[j] + (loadA - plA[i]);
            if (nlA > p.capacity || nlB > p.capacity) continue;
            const ndA = pdA[i] + p.D[idx(p, sa[i], sb[j + 1])] + (distB - pdB[j + 1]);
            const ndB = pdB[j] + p.D[idx(p, sb[j], sa[i + 1])] + (distA - pdA[i + 1]);
            if (durationOf(p, ndA, countA) > p.shift || durationOf(p, ndB, countB) > p.shift) continue;
            best = delta;
            bi = i;
            bj = j;
          }
        }
        if (bi >= 0) {
          const na = sa.slice(0, bi + 1).concat(sb.slice(bj + 1));
          const nb = sb.slice(0, bj + 1).concat(sa.slice(bi + 1));
          plan[A] = na.slice(1, -1);
          plan[B] = nb.slice(1, -1);
          moves++;
          changed = true;
        }
      }
    }
  }
  return moves;
}

function cheapestInsertion(p: Problem, plan: Plan, u: number, skip: number): [number, number, number] {
  let best = Infinity;
  let bB = -1;
  let bQ = -1;
  for (let B = 0; B < plan.length; B++) {
    if (B === skip) continue;
    const rb = plan[B];
    if (rb.length === 0) continue;
    if (routeLoad(p, rb) + p.demand[u] > p.capacity) continue;
    const dist = routeDistance(p, rb);
    for (let q = 0; q <= rb.length; q++) {
      const c = q === 0 ? 0 : rb[q - 1];
      const d = q === rb.length ? 0 : rb[q];
      const ins = p.D[idx(p, c, u)] + p.D[idx(p, u, d)] - p.D[idx(p, c, d)];
      if (ins >= best) continue;
      if (durationOf(p, dist + ins, rb.length + 1) > p.shift) continue;
      best = ins;
      bB = B;
      bQ = q;
    }
  }
  return [bB, bQ, best];
}

/** Try to remove the lightest van by re-inserting all of its stops elsewhere. */
function eliminateRoute(p: Problem, plan: Plan): Plan | null {
  if (plan.length < 2) return null;
  let target = 0;
  let minLoad = Infinity;
  plan.forEach((r, k) => {
    const l = routeLoad(p, r);
    if (l < minLoad) {
      minLoad = l;
      target = k;
    }
  });
  const trial = plan.map((r) => r.slice());
  const stops = trial[target].slice().sort((a, b) => p.demand[b] - p.demand[a] || a - b);
  trial[target] = [];
  for (const u of stops) {
    const [B, q] = cheapestInsertion(p, trial, u, target);
    if (B < 0) return null;
    trial[B].splice(q, 0, u);
  }
  const next = trial.filter((r) => r.length > 0);
  return objective(p, next) < objective(p, plan) - EPS ? next : null;
}

export function improve(p: Problem, input: Plan, counters: SolveCounters, maxIter = 60): Plan {
  let plan = input.map((r) => r.slice());
  for (let iter = 0; iter < maxIter; iter++) {
    counters.iterations++;
    let moves = 0;
    for (const r of plan) {
      const m = twoOptRoute(p, r);
      counters.twoOpt += m;
      moves += m;
    }
    let m = relocatePass(p, plan);
    counters.relocate += m;
    moves += m;
    plan = plan.filter((r) => r.length > 0);
    m = swapPass(p, plan);
    counters.swap += m;
    moves += m;
    m = twoOptStarPass(p, plan);
    counters.twoOptStar += m;
    moves += m;
    plan = plan.filter((r) => r.length > 0);
    const eliminated = eliminateRoute(p, plan);
    if (eliminated) {
      plan = eliminated;
      counters.eliminated++;
      moves++;
    }
    if (moves === 0) break;
  }
  for (const r of plan) counters.twoOpt += twoOptRoute(p, r);
  return plan;
}

export type Phase = 'savings' | 'improve' | 'done';

export interface SolveResult {
  plan: Plan;
  stats: PlanStats;
  counters: SolveCounters;
  lambdas: number[];
  chosenLambda: number;
}

export const LAMBDAS = [0.7, 1.0, 1.3, 1.6];

export function solve(p: Problem, onPhase?: (phase: Phase, k: number, of: number) => void): SolveResult {
  const counters: SolveCounters = { twoOpt: 0, relocate: 0, swap: 0, twoOptStar: 0, eliminated: 0, iterations: 0 };
  let best: Plan | null = null;
  let bestObj = Infinity;
  let chosen = LAMBDAS[0];
  LAMBDAS.forEach((lambda, k) => {
    onPhase?.('savings', k, LAMBDAS.length);
    const start = savingsPlan(p, lambda);
    onPhase?.('improve', k, LAMBDAS.length);
    const plan = improve(p, start, counters);
    const o = objective(p, plan);
    if (o < bestObj - EPS) {
      bestObj = o;
      best = plan;
      chosen = lambda;
    }
  });
  onPhase?.('done', LAMBDAS.length, LAMBDAS.length);
  const plan = best!;
  return { plan, stats: evaluate(p, plan), counters, lambdas: LAMBDAS, chosenLambda: chosen };
}

/** Orders routes by the bearing of their centroid from the depot, so colours sweep around the city. */
export function orderByBearing(plan: Plan, x: ArrayLike<number>, y: ArrayLike<number>): Plan {
  const keyed = plan.map((r) => {
    let sx = 0;
    let sy = 0;
    for (const c of r) {
      sx += x[c];
      sy += y[c];
    }
    const a = Math.atan2(sy / r.length - y[0], sx / r.length - x[0]);
    return { r, a };
  });
  keyed.sort((p, q) => p.a - q.a);
  return keyed.map((k) => k.r);
}
