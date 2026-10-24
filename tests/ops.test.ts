import { describe, expect, it } from 'vitest';
import { generateCity } from '../src/sim/city';
import { TreeCache } from '../src/sim/graph';
import { planScenario } from '../src/sim/plan';
import { defaultScenario, generateOrders, scenarioFrom, DEFAULT_SETTINGS, makeOrder, type Profile } from '../src/sim/scenario';
import { breakdown, insertionOptions, insertOrder, moveOrder, viewOf } from '../src/sim/ops';
import { mulberry32 } from '../src/sim/rng';

const city = generateCity();
const cache = new TreeCache(city);
const scenario = defaultScenario(city, 120);
const plan = planScenario(city, scenario, cache);
const live = plan.optimized.routes;
const everyOnce = (routes: number[][], n: number) => {
  const seen = new Array(n).fill(0);
  routes.flat().forEach((o) => seen[o]++);
  return seen.every((c) => c === 1);
};

describe('live plan evaluation', () => {
  it('keeps van numbering when a van is emptied', () => {
    const routes = live.map((r, k) => (k === 0 ? [] : r));
    const v = viewOf(city, scenario, cache, routes);
    expect(v.routes.length).toBe(live.length);
    expect(v.stats.routes.length).toBe(live.length);
    expect(v.stats.routes[0].stops).toBe(0);
    expect(v.stats.vans).toBe(live.length - 1);
  });

  it('matches the solver’s own numbers for the unedited plan', () => {
    const v = viewOf(city, scenario, cache, live);
    expect(v.stats.distance).toBeCloseTo(plan.optimized.stats.distance, 3);
  });
});

describe('moving a stop', () => {
  const order = live[0][Math.floor(live[0].length / 2)];
  const res = moveOrder(scenario, cache, live, order, 1);

  it('puts the order on the target van and nowhere else', () => {
    expect(res.routes[1]).toContain(order);
    expect(res.routes[0]).not.toContain(order);
    expect(everyOnce(res.routes, scenario.orders.length)).toBe(true);
  });

  it('reports a distance change that matches the plan totals', () => {
    const before = viewOf(city, scenario, cache, live).stats.distance;
    const after = viewOf(city, scenario, cache, res.routes).stats.distance;
    expect(after - before).toBeCloseTo(res.deltaMetres, 3);
  });
});

describe('inserting a new urgent order', () => {
  const rand = mulberry32(99);
  const used = new Set([scenario.depotNode, ...scenario.orders.map((o) => o.node)]);
  let node = 0;
  while (used.has(node)) node++;
  const sc = { ...scenario, orders: [...scenario.orders, makeOrder(node, rand, 900, true)] };
  const idx = sc.orders.length - 1;
  const opts = insertionOptions(sc, cache, live, idx);

  it('ranks every van, feasible options first and cheapest first', () => {
    expect(opts.length).toBe(live.length);
    const feasible = opts.filter((o) => o.capacityOk && o.shiftOk);
    for (let i = 1; i < feasible.length; i++) expect(feasible[i].addedMetres).toBeGreaterThanOrEqual(feasible[i - 1].addedMetres);
    expect(opts.slice(0, feasible.length).every((o) => o.capacityOk && o.shiftOk)).toBe(true);
  });

  it('adds exactly the quoted distance when applied', () => {
    const best = opts[0];
    const routes = insertOrder(live, best.van, idx, best.position);
    const before = viewOf(city, sc, cache, live).stats.distance;
    const after = viewOf(city, sc, cache, routes).stats.distance;
    expect(after - before).toBeCloseTo(best.addedMetres, 3);
    expect(everyOnce(routes, sc.orders.length)).toBe(true);
  });
});

describe('van breakdown', () => {
  const van = 2;
  const b = breakdown(city, scenario, cache, live, van);

  it('empties the broken van and re-homes or reports every one of its stops', () => {
    expect(b.redistribute.routes[van]).toEqual([]);
    const placed = new Set(b.redistribute.routes.flat());
    for (const o of live[van]) expect(placed.has(o) || b.redistribute.unserved.includes(o)).toBe(true);
    expect(placed.size + b.redistribute.unserved.length).toBe(scenario.orders.length);
  });

  it('respects capacity and shift on the vans that took the stops', () => {
    for (const k of b.redistribute.touched) {
      expect(b.redistribute.view.stats.routes[k].load).toBeLessThanOrEqual(scenario.fleet.capacity);
      expect(b.redistribute.view.stats.routes[k].duration).toBeLessThanOrEqual(scenario.fleet.shiftSec + 1e-6);
    }
  });

  it('leaves untouched vans exactly as they were', () => {
    live.forEach((r, k) => {
      if (k !== van && !b.redistribute.touched.includes(k)) expect(b.redistribute.routes[k]).toEqual(r);
    });
  });
});

describe('scenario profiles', () => {
  it('keeps the default profile identical to the original generator', () => {
    expect(generateOrders(city, 50, 7, 'mixed')).toEqual(generateOrders(city, 50, 7));
  });

  it.each(['pharmacy', 'grocery', 'building'] as Profile[])('%s scenarios plan feasibly with their preset fleets', (profile) => {
    const presets: Record<string, Partial<typeof DEFAULT_SETTINGS>> = {
      pharmacy: { orders: 120, capacity: 60, serviceMin: 4 },
      grocery: { orders: 120, capacity: 80, serviceMin: 5 },
      building: { orders: 60, capacity: 120, serviceMin: 12, vans: 14 },
    };
    const sc = scenarioFrom(city, { ...DEFAULT_SETTINGS, ...presets[profile], profile });
    const r = planScenario(city, sc, cache);
    expect(r.optimized.stats.feasible).toBe(true);
    expect(r.optimized.stats.distance).toBeLessThan(r.baseline.stats.distance);
  });
});

describe('edits after the day has started', () => {
  // pretend the first 5 stops of every van are already delivered
  const frozen = live.map((r) => Math.min(5, r.length));

  it('never inserts a new order before stops that are already done', () => {
    const rand = mulberry32(5);
    const used = new Set([scenario.depotNode, ...scenario.orders.map((o) => o.node)]);
    let node = 10;
    while (used.has(node)) node++;
    const sc = { ...scenario, orders: [...scenario.orders, makeOrder(node, rand, 901, true)] };
    const opts = insertionOptions(sc, cache, live, sc.orders.length - 1, frozen);
    for (const o of opts) expect(o.position).toBeGreaterThanOrEqual(frozen[o.van]);
  });

  const long = live.map((r, k) => [k, r.length] as const).filter(([, n]) => n >= 8).map(([k]) => k);

  it('keeps every van’s done stops in place when moving a stop', () => {
    const [a, b] = long;
    const order = live[a][7];
    const res = moveOrder(scenario, cache, live, order, b, frozen);
    expect(res.routes[a].slice(0, 5)).toEqual(live[a].slice(0, 5));
    expect(res.routes[b].slice(0, 5)).toEqual(live[b].slice(0, 5));
    expect(res.routes[b].indexOf(order)).toBeGreaterThanOrEqual(5);
  });

  it('refuses to move a stop that has already been delivered', () => {
    expect(() => moveOrder(scenario, cache, live, live[long[0]][2], long[1], frozen)).toThrow(/delivered/);
  });

  it('a van that breaks down mid-day keeps its delivered stops and hands over only the rest', () => {
    const v = long[0];
    const b = breakdown(city, scenario, cache, live, v, frozen);
    expect(b.redistribute.routes[v]).toEqual(live[v].slice(0, 5));
    expect(b.redistribute.moved + b.redistribute.unserved.length).toBe(live[v].length - 5);
    for (const k of b.redistribute.touched) expect(b.redistribute.routes[k].slice(0, 5)).toEqual(live[k].slice(0, 5));
  });
});

describe('breakdown options', () => {
  it('times a spare van from now, not from the start of the shift', () => {
    const now = 10 * 3600;
    const b = breakdown(city, scenario, cache, live, 0, live.map(() => 0), now);
    expect(b.spare.startSec).toBe(now + 45 * 60);
    expect(b.spare.endSec).toBeGreaterThan(b.spare.startSec);
  });

  it('the hybrid keeps every order exactly once and gives the spare its own departure', () => {
    // make vans nearly full by using a tight capacity scenario so that something is left over
    const sc = { ...scenario, fleet: { ...scenario.fleet, capacity: 40 } };
    const r = planScenario(city, sc, cache).optimized.routes;
    const b = breakdown(city, sc, cache, r, 0, r.map(() => 0), sc.fleet.shiftStartSec);
    if (!b.hybrid) return; // everything fitted: nothing to check
    const seen = new Array(sc.orders.length).fill(0);
    b.hybrid.routes.flat().forEach((o) => seen[o]++);
    expect(seen.every((c) => c === 1)).toBe(true);
    expect(b.hybrid.view.starts?.[b.hybrid.spareVan]).toBe(b.hybrid.startSec);
  });
});
