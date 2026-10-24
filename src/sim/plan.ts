import type { City } from './city';
import { TreeCache, distanceMatrix, pathTo } from './graph';
import { zoneOf, type Scenario } from './scenario';
import {
  baselinePlan,
  evaluate,
  orderByBearing,
  solve,
  type Phase,
  type Plan,
  type PlanStats,
  type Problem,
  type SolveCounters,
} from './solver';

export interface RouteGeometry {
  /** Node ids along the streets, depot → stops → depot. */
  path: Int32Array;
  /** Cumulative distance (m) at each path node. */
  cum: Float64Array;
  /** Index into `path` where each stop of the route is reached, in visit order. */
  stopAt: Int32Array;
}

export interface PlanView {
  /** Routes as lists of order indices (0-based into scenario.orders). */
  routes: number[][];
  stats: PlanStats;
  geometry: RouteGeometry[];
  /** Optional per-van departure (seconds after midnight); vans default to the shift start. */
  starts?: number[];
}

export interface PlanningResult {
  n: number;
  baseline: PlanView;
  optimized: PlanView;
  counters: SolveCounters;
  chosenLambda: number;
  timings: { matrixMs: number; baselineMs: number; optimizeMs: number; geometryMs: number; totalMs: number };
  /** For each city bridge: how many optimized route legs cross it. */
  bridgeUse: { edge: number; name: string; legs: number }[];
}

export function buildProblem(scenario: Scenario, cache: TreeCache): { problem: Problem; locNodes: number[] } {
  const locNodes = [scenario.depotNode, ...scenario.orders.map((o) => o.node)];
  const n = scenario.orders.length;
  const D = distanceMatrix(cache, locNodes);
  const demand = new Int32Array(n + 1);
  scenario.orders.forEach((o, i) => (demand[i + 1] = o.demand));
  const f = scenario.fleet;
  return {
    problem: {
      n,
      D,
      demand,
      capacity: f.capacity,
      speed: f.speedMps,
      service: f.serviceSec,
      shift: f.shiftSec,
      fleet: f.vans,
    },
    locNodes,
  };
}

export function geometryFor(city: City, cache: TreeCache, seqNodes: number[]): RouteGeometry {
  const path: number[] = [seqNodes[0]];
  const stopAt: number[] = [];
  for (let i = 0; i < seqNodes.length - 1; i++) {
    const leg = pathTo(cache.get(seqNodes[i]), seqNodes[i + 1]);
    for (let k = 1; k < leg.length; k++) path.push(leg[k]);
    if (i < seqNodes.length - 2) stopAt.push(path.length - 1);
  }
  const cum = new Float64Array(path.length);
  for (let k = 1; k < path.length; k++) {
    cum[k] = cum[k - 1] + Math.hypot(city.x[path[k]] - city.x[path[k - 1]], city.y[path[k]] - city.y[path[k - 1]]);
  }
  return { path: Int32Array.from(path), cum, stopAt: Int32Array.from(stopAt) };
}

function view(city: City, cache: TreeCache, problem: Problem, locNodes: number[], plan: Plan): PlanView {
  return {
    routes: plan.map((r) => r.map((c) => c - 1)),
    stats: evaluate(problem, plan),
    geometry: plan.map((r) => geometryFor(city, cache, [locNodes[0], ...r.map((c) => locNodes[c]), locNodes[0]])),
  };
}

export function edgeBetween(city: City, a: number, b: number): number {
  for (let k = city.adjStart[a]; k < city.adjStart[a + 1]; k++) if (city.adjNode[k] === b) return city.adjEdge[k];
  return -1;
}

export function planScenario(
  city: City,
  scenario: Scenario,
  cache: TreeCache,
  onPhase?: (phase: Phase | 'matrix' | 'baseline' | 'geometry', k: number, of: number) => void,
): PlanningResult {
  const t0 = performance.now();
  onPhase?.('matrix', 0, 1);
  const { problem, locNodes } = buildProblem(scenario, cache);
  const t1 = performance.now();
  onPhase?.('baseline', 0, 1);
  const zone = new Int32Array(problem.n + 1);
  for (let c = 1; c <= problem.n; c++) zone[c] = zoneOf(city, locNodes[c]);
  const base = baselinePlan(problem, zone);
  const t2 = performance.now();
  const result = solve(problem, onPhase);
  const lx = locNodes.map((v) => city.x[v]);
  const ly = locNodes.map((v) => city.y[v]);
  const optimizedPlan = orderByBearing(result.plan, lx, ly);
  const t3 = performance.now();
  onPhase?.('geometry', 0, 1);
  const baseline = view(city, cache, problem, locNodes, base);
  const optimized = view(city, cache, problem, locNodes, optimizedPlan);
  const t4 = performance.now();

  const bridgeUse = city.bridges.map((b) => {
    let legs = 0;
    for (const g of optimized.geometry) {
      for (let k = 1; k < g.path.length; k++) if (edgeBetween(city, g.path[k - 1], g.path[k]) === b.edge) legs++;
    }
    return { edge: b.edge, name: b.name, legs };
  });

  return {
    n: problem.n,
    baseline,
    optimized,
    counters: result.counters,
    chosenLambda: result.chosenLambda,
    timings: {
      matrixMs: t1 - t0,
      baselineMs: t2 - t1,
      optimizeMs: t3 - t2,
      geometryMs: t4 - t3,
      totalMs: t4 - t0,
    },
    bridgeUse,
  };
}
