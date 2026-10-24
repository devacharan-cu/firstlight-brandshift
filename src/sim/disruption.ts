import type { City } from './city';
import { TreeCache } from './graph';
import { buildProblem, edgeBetween, geometryFor, type PlanView, type RouteGeometry } from './plan';
import type { Scenario } from './scenario';
import { evaluate, solve, type PlanStats } from './solver';

/**
 * A bridge closes before the vans leave (07:30, shift starts 08:00).
 *
 * Three plans are compared on the same orders:
 *  - planned:  the optimised plan with the bridge open
 *  - keep:     the same routes and stop order, forced to detour around the closure
 *  - replan:   Firstlight's answer — only the routes that crossed the bridge are re-planned
 *              (their stops, their vans); every other driver's day stays as printed
 *  - full:     a full re-plan of every route, as a reference
 * All plans use the same distance model, so the differences are like-for-like.
 */

export interface DisruptionResult {
  closedEdge: number;
  bridgeName: string;
  planned: { stats: PlanStats; geometry: RouteGeometry[]; routes: number[][] };
  keep: { stats: PlanStats; geometry: RouteGeometry[] };
  replan: PlanView;
  full: PlanStats;
  /** indices of planned routes that would have crossed the bridge */
  crossing: number[];
  /** per order: arrival (s after midnight) and van, before and after re-planning */
  etaBefore: Float64Array;
  etaAfter: Float64Array;
  vanBefore: Int16Array;
  vanAfter: Int16Array;
  changedEtas: number;
  ms: number;
}

const closureCaches = new Map<string, TreeCache>();

export function closedCache(city: City, edge: number): TreeCache {
  const key = String(edge);
  let c = closureCaches.get(key);
  if (!c) {
    const mask = new Uint8Array(city.edgeCount);
    mask[edge] = 1;
    c = new TreeCache(city, mask);
    closureCaches.set(key, c);
  }
  return c;
}

function etas(scenario: Scenario, routes: number[][], geometry: RouteGeometry[], into: Float64Array, vans: Int16Array) {
  const f = scenario.fleet;
  routes.forEach((r, v) => {
    const g = geometry[v];
    r.forEach((o, j) => {
      into[o] = f.shiftStartSec + g.cum[g.stopAt[j]] / f.speedMps + j * f.serviceSec;
      vans[o] = v;
    });
  });
}

export function disrupt(
  city: City,
  scenario: Scenario,
  planned: { routes: number[][]; geometry: RouteGeometry[]; stats: PlanStats },
  closedEdge: number,
): DisruptionResult {
  const t0 = performance.now();
  const closed = closedCache(city, closedEdge);
  const { problem, locNodes } = buildProblem(scenario, closed);
  const toPlan = (routes: number[][]) => routes.map((r) => r.map((o) => o + 1));
  const seq = (r: number[]) => [locNodes[0], ...r.map((c) => locNodes[c]), locNodes[0]];

  // keep the routes, detour around the closure
  const keepPlan = toPlan(planned.routes);
  const keep = {
    stats: evaluate(problem, keepPlan),
    geometry: keepPlan.map((r) => geometryFor(city, closed, seq(r))),
  };

  const crossing: number[] = [];
  planned.geometry.forEach((g, k) => {
    for (let i = 1; i < g.path.length; i++) {
      if (edgeBetween(city, g.path[i - 1], g.path[i]) === closedEdge) {
        crossing.push(k);
        break;
      }
    }
  });

  // targeted re-plan: only the stops of crossing routes, on the vans they had
  const subOrders = crossing.flatMap((k) => planned.routes[k]);
  const sub = buildProblem({ ...scenario, orders: subOrders.map((o) => scenario.orders[o]) }, closed);
  const subResult = subOrders.length ? solve(sub.problem) : null;
  const newRoutes = (subResult?.plan ?? []).map((r) => r.map((c) => subOrders[c - 1]));
  // keep van numbers stable: untouched routes keep their index, new routes reuse the freed ones first
  const routes: number[][] = planned.routes.map((r, k) => (crossing.includes(k) ? [] : r.slice()));
  const free = [...crossing];
  for (const r of newRoutes) {
    const slot = free.shift();
    if (slot === undefined) routes.push(r);
    else routes[slot] = r;
  }
  // A freed slot can stay empty if the affected stops now fit on fewer vans; stats skip empty routes.
  const replan: PlanView = {
    routes,
    stats: evaluate(problem, toPlan(routes.filter((r) => r.length > 0))),
    geometry: routes.map((r, k) => {
      if (k < planned.routes.length && !crossing.includes(k)) return planned.geometry[k]; // untouched: identical path
      return geometryFor(city, closed, r.length ? seq(r.map((o) => o + 1)) : [locNodes[0]]);
    }),
  };

  // full re-plan without the bridge, for reference
  const full = evaluate(problem, solve(problem).plan);

  const n = scenario.orders.length;
  const etaBefore = new Float64Array(n);
  const etaAfter = new Float64Array(n);
  const vanBefore = new Int16Array(n);
  const vanAfter = new Int16Array(n);
  etas(scenario, planned.routes, planned.geometry, etaBefore, vanBefore);
  etas(scenario, replan.routes, replan.geometry, etaAfter, vanAfter);
  let changedEtas = 0;
  for (let o = 0; o < n; o++) if (Math.abs(etaAfter[o] - etaBefore[o]) >= 5 * 60) changedEtas++;

  return {
    closedEdge,
    bridgeName: city.bridges.find((b) => b.edge === closedEdge)?.name ?? 'Bridge',
    planned: { stats: planned.stats, geometry: planned.geometry, routes: planned.routes },
    keep,
    replan,
    full,
    crossing,
    etaBefore,
    etaAfter,
    vanBefore,
    vanAfter,
    changedEtas,
    ms: performance.now() - t0,
  };
}
