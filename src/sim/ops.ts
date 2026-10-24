import type { City } from './city';
import type { TreeCache } from './graph';
import { buildProblem, geometryFor, type PlanView } from './plan';
import type { Scenario } from './scenario';
import { durationOf, evaluateAligned, routeDistance, routeLoad, twoOptRoute, type Plan, type Problem } from './solver';

/**
 * Operations a dispatcher performs on the live plan after it has been planned.
 * Routes are lists of order indices (0-based) into scenario.orders, one list per van;
 * an empty list is a van with nothing to do. Van numbering never shifts.
 *
 * `frozen[v]` is how many stops at the start of van v's route are already done (delivered,
 * or passed by the simulated clock). Done stops are never reordered and nothing is inserted
 * before them: a van cannot go back in time.
 */

const toPlan = (routes: number[][]): Plan => routes.map((r) => r.map((o) => o + 1));
const fz = (frozen: number[] | undefined, v: number) => frozen?.[v] ?? 0;

export function viewOf(city: City, scenario: Scenario, cache: TreeCache, routes: number[][], problem?: Problem, starts?: number[]): PlanView {
  const p = problem ?? buildProblem(scenario, cache).problem;
  const depot = scenario.depotNode;
  return {
    routes: routes.map((r) => r.slice()),
    stats: evaluateAligned(p, toPlan(routes)),
    geometry: routes.map((r) => geometryFor(city, cache, [depot, ...r.map((o) => scenario.orders[o].node), depot])),
    ...(starts ? { starts: routes.map((_, v) => starts[v] ?? scenario.fleet.shiftStartSec) } : {}),
  };
}

function cheapestPosition(p: Problem, route: number[], c: number, minPos = 0): { pos: number; delta: number } {
  // route and c in 1-based customer indices
  const D = (a: number, b: number) => p.D[a * (p.n + 1) + b];
  let best = { pos: minPos, delta: Infinity };
  for (let q = Math.min(minPos, route.length); q <= route.length; q++) {
    const a = q === 0 ? 0 : route[q - 1];
    const b = q === route.length ? 0 : route[q];
    const delta = D(a, c) + D(c, b) - D(a, b);
    if (delta < best.delta) best = { pos: q, delta };
  }
  return best;
}

export interface InsertionOption {
  van: number;
  addedMetres: number;
  load: number;
  duration: number;
  capacityOk: boolean;
  shiftOk: boolean;
  position: number;
}

/** For one order not yet on any van: the cheapest still-possible place on every van, best first. */
export function insertionOptions(
  scenario: Scenario,
  cache: TreeCache,
  routes: number[][],
  order: number,
  frozen?: number[],
): InsertionOption[] {
  const { problem: p } = buildProblem(scenario, cache);
  const c = order + 1;
  const plan = toPlan(routes);
  const out = plan.map((r, van) => {
    const { pos, delta } = cheapestPosition(p, r, c, fz(frozen, van));
    const load = routeLoad(p, r) + p.demand[c];
    const duration = durationOf(p, routeDistance(p, r) + delta, r.length + 1);
    return {
      van,
      addedMetres: delta,
      load,
      duration,
      capacityOk: load <= p.capacity,
      shiftOk: duration <= p.shift + 1e-6,
      position: pos,
    };
  });
  return out.sort(
    (a, b) => Number(b.capacityOk && b.shiftOk) - Number(a.capacityOk && a.shiftOk) || a.addedMetres - b.addedMetres || a.van - b.van,
  );
}

/** Insert an order on a van at a given position (callers show the limits). */
export function insertOrder(routes: number[][], van: number, order: number, position: number): number[][] {
  const next = routes.map((r) => r.slice());
  next[van].splice(position, 0, order);
  return next;
}

export interface MoveResult {
  routes: number[][];
  from: number;
  to: number;
  deltaMetres: number;
}

/** Move one open stop to another van at its cheapest still-possible position, then tidy both open tails with 2-opt. */
export function moveOrder(
  scenario: Scenario,
  cache: TreeCache,
  routes: number[][],
  order: number,
  toVan: number,
  frozen?: number[],
): MoveResult {
  const { problem: p } = buildProblem(scenario, cache);
  const plan = toPlan(routes);
  const from = plan.findIndex((r) => r.includes(order + 1));
  if (from < 0) throw new Error('Order is not on any van');
  if (plan[from].indexOf(order + 1) < fz(frozen, from)) throw new Error('That stop has already been delivered');
  if (from === toVan) return { routes, from, to: toVan, deltaMetres: 0 };
  const before = routeDistance(p, plan[from]) + routeDistance(p, plan[toVan]);
  plan[from] = plan[from].filter((c) => c !== order + 1);
  const { pos } = cheapestPosition(p, plan[toVan], order + 1, fz(frozen, toVan));
  plan[toVan].splice(pos, 0, order + 1);
  twoOptRoute(p, plan[from], fz(frozen, from));
  twoOptRoute(p, plan[toVan], fz(frozen, toVan));
  const after = routeDistance(p, plan[from]) + routeDistance(p, plan[toVan]);
  return { routes: plan.map((r) => r.map((c) => c - 1)), from, to: toVan, deltaMetres: after - before };
}

export interface BreakdownResult {
  van: number;
  /**
   * The broken van's open stops redistributed across the vans still running (cheapest feasible
   * insertion after each van's done stops, then 2-opt on open tails). fleetDeltaMetres is the
   * change in total fleet distance; it can be negative because the broken van stops driving.
   */
  redistribute: { routes: number[][]; view: PlanView; unserved: number[]; touched: number[]; fleetDeltaMetres: number; moved: number };
  /** a spare van takes all of the broken van's open stops, leaving the depot `delayMin` from now */
  spare: SpareOption;
  /** what a dispatcher would usually do: running vans take what fits, a spare van takes the rest */
  hybrid: (SpareOption & { routes: number[][]; view: PlanView; spareVan: number }) | null;
  ms: number;
}

export interface SpareOption {
  available: boolean;
  delayMin: number;
  stops: number;
  /** departure and return, seconds after midnight */
  startSec: number;
  endSec: number;
  /** the spare driver works a normal shift from their own departure */
  overtime: boolean;
}

/**
 * A van goes off the road at `nowSec` (seconds after midnight). Three honest options:
 * redistribute its open stops onto running vans, send a spare van later with all of them,
 * or both: running vans take what fits and a spare van takes the rest.
 */
export function breakdown(
  city: City,
  scenario: Scenario,
  cache: TreeCache,
  routes: number[][],
  van: number,
  frozen?: number[],
  nowSec = scenario.fleet.shiftStartSec,
  starts?: number[],
  spareDelayMin = 45,
): BreakdownResult {
  const t0 = performance.now();
  const { problem: p } = buildProblem(scenario, cache);
  const plan = toPlan(routes);
  const keep = fz(frozen, van);
  const orphans = plan[van].slice(keep).sort((a, b) => p.demand[b] - p.demand[a] || a - b);
  const before = plan.reduce((s, r) => s + routeDistance(p, r), 0);
  const originalOpen = plan[van].slice(keep);
  plan[van] = plan[van].slice(0, keep);
  const unserved: number[] = [];
  const touched = new Set<number>();
  for (const c of orphans) {
    let best: { van: number; pos: number; delta: number } | null = null;
    plan.forEach((r, k) => {
      if (k === van || r.length === 0) return;
      if (routeLoad(p, r) + p.demand[c] > p.capacity) return;
      const { pos, delta } = cheapestPosition(p, r, c, fz(frozen, k));
      if (durationOf(p, routeDistance(p, r) + delta, r.length + 1) > p.shift) return;
      if (!best || delta < best.delta) best = { van: k, pos, delta };
    });
    if (!best) {
      unserved.push(c - 1);
      continue;
    }
    const b = best as { van: number; pos: number; delta: number };
    plan[b.van].splice(b.pos, 0, c);
    touched.add(b.van);
  }
  for (const k of touched) twoOptRoute(p, plan[k], fz(frozen, k));
  const after = plan.reduce((s, r) => s + routeDistance(p, r), 0);
  const next = plan.map((r) => r.map((c) => c - 1));

  const used = routes.filter((r) => r.length > 0).length;
  const available = used < p.fleet;
  const startSec = Math.max(scenario.fleet.shiftStartSec, nowSec) + spareDelayMin * 60;
  const spareFor = (stops: number[]): SpareOption => {
    const r = stops.slice();
    twoOptRoute(p, r);
    const endSec = startSec + durationOf(p, routeDistance(p, r), r.length);
    return { available, delayMin: spareDelayMin, stops: r.length, startSec, endSec, overtime: endSec - startSec > p.shift };
  };

  let hybrid: BreakdownResult['hybrid'] = null;
  if (unserved.length && available) {
    const spareRoute = unserved.map((o) => o + 1);
    twoOptRoute(p, spareRoute);
    // the spare takes the first van number not used today
    let spareVan = routes.findIndex((r, k) => r.length === 0 && k !== van);
    const hybridRoutes = next.map((r) => r.slice());
    if (spareVan < 0) {
      spareVan = hybridRoutes.length;
      hybridRoutes.push([]);
    }
    hybridRoutes[spareVan] = spareRoute.map((c) => c - 1);
    const hybridStarts = hybridRoutes.map((_, k) => (k === spareVan ? startSec : (starts?.[k] ?? scenario.fleet.shiftStartSec)));
    hybrid = {
      ...spareFor(spareRoute),
      routes: hybridRoutes,
      view: viewOf(city, scenario, cache, hybridRoutes, p, hybridStarts),
      spareVan,
    };
  }

  return {
    van,
    redistribute: {
      routes: next,
      view: viewOf(city, scenario, cache, next, p, starts),
      unserved,
      touched: [...touched].sort((a, b) => a - b),
      fleetDeltaMetres: after - before,
      moved: orphans.length - unserved.length,
    },
    spare: spareFor(originalOpen),
    hybrid,
    ms: performance.now() - t0,
  };
}
