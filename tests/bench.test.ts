import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { generateCity } from '../src/sim/city';
import { TreeCache } from '../src/sim/graph';
import { defaultScenario } from '../src/sim/scenario';
import { planScenario } from '../src/sim/plan';

/** Quality + timing report (Node, single thread). Writes .bench.json. */
describe('bench', () => {
  it('reports quality and timing', () => {
    const t0 = performance.now();
    const city = generateCity();
    const cityMs = performance.now() - t0;
    const out: unknown[] = [];
    for (const n of [120, 300]) {
      const sc = defaultScenario(city, n);
      const r = planScenario(city, sc, new TreeCache(city));
      const b = r.baseline.stats;
      const o = r.optimized.stats;
      out.push({
        nodes: city.nodeCount,
        edges: city.edgeCount,
        bridges: city.bridges.length,
        cityMs: +cityMs.toFixed(1),
        orders: sc.orders.length,
        crates: o.load,
        baseline: { km: +(b.distance / 1000).toFixed(1), vans: b.vans, hours: +(b.duration / 3600).toFixed(1), feasible: b.feasible },
        optimized: {
          km: +(o.distance / 1000).toFixed(1),
          vans: o.vans,
          hours: +(o.duration / 3600).toFixed(1),
          feasible: o.feasible,
          maxRouteH: +(Math.max(...o.routes.map((x) => x.duration)) / 3600).toFixed(2),
          loads: o.routes.map((x) => x.load),
        },
        savingPct: +((1 - o.distance / b.distance) * 100).toFixed(1),
        timings: Object.fromEntries(Object.entries(r.timings).map(([k, v]) => [k, +v.toFixed(0)])),
        counters: r.counters,
        lambda: r.chosenLambda,
        bridgeUse: r.bridgeUse,
      });
      expect(o.feasible).toBe(true);
    }
    writeFileSync('.bench.json', JSON.stringify(out, null, 1));
  }, 120000);
});
