import { describe, expect, it } from 'vitest';
import { generateCity } from '../src/sim/city';
import { dijkstra, TreeCache } from '../src/sim/graph';
import { buildProblem, edgeBetween, planScenario } from '../src/sim/plan';
import { defaultScenario, type Scenario } from '../src/sim/scenario';
import { evaluate, improve, objective, routeDistance, savingsPlan, type Problem } from '../src/sim/solver';
import { disrupt } from '../src/sim/disruption';

const city = generateCity();
const cache = new TreeCache(city);
const base = defaultScenario(city, 120);
const result = planScenario(city, base, cache);

describe('city graph', () => {
  it('is fully connected', () => {
    const t = dijkstra(city, 0);
    for (let v = 0; v < city.nodeCount; v++) expect(Number.isFinite(t.dist[v])).toBe(true);
  });

  it('crosses the river only on bridges', () => {
    expect(city.bridges.length).toBe(4);
  });

  it('is deterministic for a seed', () => {
    const again = generateCity();
    expect(again.nodeCount).toBe(city.nodeCount);
    expect(Array.from(again.edgeA)).toEqual(Array.from(city.edgeA));
  });
});

describe('distance accounting', () => {
  it('distance matrix is symmetric road-network distance', () => {
    const { problem, locNodes } = buildProblem(base, cache);
    const m = problem.n + 1;
    for (let i = 0; i < m; i += 7) {
      for (let j = 0; j < m; j += 11) {
        expect(problem.D[i * m + j]).toBeCloseTo(problem.D[j * m + i], 6);
        expect(problem.D[i * m + j]).toBeCloseTo(dijkstra(city, locNodes[i]).dist[locNodes[j]], 6);
      }
    }
  });

  it('reported route distances equal the length of the drawn street geometry', () => {
    for (const view of [result.baseline, result.optimized]) {
      view.geometry.forEach((g, k) => {
        expect(g.cum[g.cum.length - 1]).toBeCloseTo(view.stats.routes[k].distance, 3);
      });
      const total = view.geometry.reduce((a, g) => a + g.cum[g.cum.length - 1], 0);
      expect(total).toBeCloseTo(view.stats.distance, 2);
    }
  });

  it('drawn geometry only follows real street edges and visits stops in order', () => {
    for (const [k, g] of result.optimized.geometry.entries()) {
      for (let i = 1; i < g.path.length; i++) expect(edgeBetween(city, g.path[i - 1], g.path[i])).toBeGreaterThanOrEqual(0);
      const route = result.optimized.routes[k];
      expect(g.stopAt.length).toBe(route.length);
      route.forEach((o, j) => expect(g.path[g.stopAt[j]]).toBe(base.orders[o].node));
      expect(g.path[0]).toBe(base.depotNode);
      expect(g.path[g.path.length - 1]).toBe(base.depotNode);
    }
  });

  it('the reduction compares two plans of the same orders', () => {
    const b = result.baseline.stats;
    const o = result.optimized.stats;
    expect(b.load).toBe(o.load);
    expect(o.distance).toBeLessThan(b.distance);
  });
});

describe('route assignments', () => {
  it('serves every order exactly once in both plans', () => {
    for (const view of [result.baseline, result.optimized]) {
      const seen = new Array(base.orders.length).fill(0);
      view.routes.flat().forEach((o) => seen[o]++);
      expect(seen.every((c) => c === 1)).toBe(true);
      expect(view.stats.allServed).toBe(true);
    }
  });

  it('is reproducible', () => {
    const again = planScenario(city, base, new TreeCache(city));
    expect(again.optimized.routes).toEqual(result.optimized.routes);
    expect(again.baseline.routes).toEqual(result.baseline.routes);
    expect(again.optimized.stats.distance).toBe(result.optimized.stats.distance);
  });

  it('local search never makes the savings plan worse', () => {
    const { problem } = buildProblem(base, cache);
    const counters = { twoOpt: 0, relocate: 0, swap: 0, twoOptStar: 0, eliminated: 0, iterations: 0 };
    const start = savingsPlan(problem, 1);
    const improved = improve(problem, start, counters);
    expect(objective(problem, improved)).toBeLessThanOrEqual(objective(problem, start) + 1e-6);
  });
});

describe('constraints', () => {
  const tight = (patch: Partial<Scenario['fleet']>): Scenario => ({ ...base, fleet: { ...base.fleet, ...patch } });

  it('respects vehicle capacity', () => {
    const sc = tight({ capacity: 30 });
    const r = planScenario(city, sc, cache);
    for (const s of r.optimized.stats.routes) expect(s.load).toBeLessThanOrEqual(30);
    for (const s of r.baseline.stats.routes) expect(s.load).toBeLessThanOrEqual(30);
    expect(r.optimized.stats.capacityOk).toBe(true);
  });

  it('respects the shift length', () => {
    const sc = tight({ shiftSec: 2.5 * 3600 });
    const r = planScenario(city, sc, cache);
    for (const s of r.optimized.stats.routes) expect(s.duration).toBeLessThanOrEqual(2.5 * 3600 + 1e-6);
    expect(r.optimized.stats.shiftOk).toBe(true);
  });

  it('reports a fleet that is too small instead of hiding it', () => {
    const sc = tight({ vans: 2 });
    const r = planScenario(city, sc, cache);
    expect(r.optimized.stats.vans).toBeGreaterThan(2);
    expect(r.optimized.stats.fleetOk).toBe(false);
    expect(r.optimized.stats.feasible).toBe(false);
  });

  it('flags an order that no van can carry', () => {
    const sc: Scenario = { ...base, orders: base.orders.map((o, i) => (i === 0 ? { ...o, demand: 500 } : o)) };
    const r = planScenario(city, sc, cache);
    expect(r.baseline.stats.capacityOk).toBe(false);
    expect(r.optimized.stats.capacityOk).toBe(false);
  });

  it('evaluate() measures what routeDistance measures', () => {
    const { problem } = buildProblem(base, cache);
    const plan = result.optimized.routes.map((r) => r.map((o) => o + 1));
    const stats = evaluate(problem as Problem, plan);
    expect(stats.distance).toBeCloseTo(
      plan.reduce((a, r) => a + routeDistance(problem, r), 0),
      6,
    );
  });
});

describe('bridge closure', () => {
  const busiest = [...result.bridgeUse].sort((a, b) => b.legs - a.legs)[0];
  const d = disrupt(city, base, result.optimized, busiest.edge);
  const usesEdge = (path: Int32Array) => {
    for (let i = 1; i < path.length; i++) if (edgeBetween(city, path[i - 1], path[i]) === busiest.edge) return true;
    return false;
  };

  it('identifies the routes that relied on the bridge', () => {
    expect(d.crossing.length).toBeGreaterThan(0);
    d.crossing.forEach((k) => expect(usesEdge(result.optimized.geometry[k].path)).toBe(true));
  });

  it('never routes over the closed bridge in the detour or the re-plan', () => {
    for (const g of [...d.keep.geometry, ...d.replan.geometry]) expect(usesEdge(g.path)).toBe(false);
  });

  it('keeps the same routes when detouring, and they get longer', () => {
    expect(d.keep.stats.vans).toBe(result.optimized.stats.vans);
    expect(d.keep.stats.distance).toBeGreaterThan(result.optimized.stats.distance);
    d.keep.geometry.forEach((g, k) => expect(g.cum[g.cum.length - 1]).toBeCloseTo(d.keep.stats.routes[k].distance, 3));
  });

  it('re-plans every order exactly once within the limits', () => {
    const seen = new Array(base.orders.length).fill(0);
    d.replan.routes.flat().forEach((o) => seen[o]++);
    expect(seen.every((c) => c === 1)).toBe(true);
    expect(d.replan.stats.capacityOk && d.replan.stats.shiftOk).toBe(true);
    expect(d.replan.stats.distance).toBeLessThanOrEqual(d.keep.stats.distance);
  });

  it('leaves every route that did not cross the bridge exactly as printed', () => {
    result.optimized.routes.forEach((r, k) => {
      if (d.crossing.includes(k)) return;
      expect(d.replan.routes[k]).toEqual(r);
      for (const o of r) expect(d.etaAfter[o]).toBeCloseTo(d.etaBefore[o], 6);
    });
  });
});
