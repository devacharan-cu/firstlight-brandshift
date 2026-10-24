/// <reference lib="webworker" />
import { generateCity, type City } from './city';
import { TreeCache } from './graph';
import { planScenario, buildProblem, geometryFor } from './plan';
import { disrupt } from './disruption';
import { zoneOf, type Scenario } from './scenario';
import { baselinePlan, evaluate } from './solver';
import { breakdown, insertionOptions, moveOrder, viewOf } from './ops';
import type { WorkerRequest, WorkerResponse } from './protocol';

let city: City | null = null;
let cache: TreeCache | null = null;

function ensure() {
  if (!city) {
    city = generateCity();
    cache = new TreeCache(city);
  }
  return { city: city!, cache: cache! };
}

const post = (m: WorkerResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

function baselineOnly(c: City, tc: TreeCache, scenario: Scenario) {
  const t0 = performance.now();
  const { problem, locNodes } = buildProblem(scenario, tc);
  const zone = new Int32Array(problem.n + 1);
  for (let k = 1; k <= problem.n; k++) zone[k] = zoneOf(c, locNodes[k]);
  const plan = baselinePlan(problem, zone);
  return {
    routes: plan.map((r) => r.map((k) => k - 1)),
    stats: evaluate(problem, plan),
    geometry: plan.map((r) => geometryFor(c, tc, [locNodes[0], ...r.map((k) => locNodes[k]), locNodes[0]])),
    ms: performance.now() - t0,
  };
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  const done = (result: unknown) => post({ type: 'result', id: msg.id, result } as WorkerResponse);
  try {
    const { city: c, cache: tc } = ensure();
    switch (msg.type) {
      case 'baseline':
        return done(baselineOnly(c, tc, msg.scenario));
      case 'plan':
        return done(planScenario(c, msg.scenario, tc, (phase, k, of) => post({ type: 'progress', id: msg.id, phase, k, of })));
      case 'disrupt':
        return done(disrupt(c, msg.scenario, msg.planned, msg.closedEdge));
      case 'evaluate':
        return done(viewOf(c, msg.scenario, tc, msg.routes));
      case 'insertOptions':
        return done(insertionOptions(msg.scenario, tc, msg.routes, msg.order, msg.frozen));
      case 'move': {
        const move = moveOrder(msg.scenario, tc, msg.routes, msg.order, msg.toVan, msg.frozen);
        return done({ move, view: viewOf(c, msg.scenario, tc, move.routes) });
      }
      case 'breakdown':
        return done(breakdown(c, msg.scenario, tc, msg.routes, msg.van, msg.frozen));
    }
  } catch (err) {
    post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
