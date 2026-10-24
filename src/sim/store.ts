import { useSyncExternalStore } from 'react';
import { generateCity, type City } from './city';
import { defaultScenario, makeOrder, type Scenario } from './scenario';
import { mulberry32 } from './rng';
import { routing } from './client';
import type { BaselineResult, ProgressPhase } from './protocol';
import type { PlanningResult } from './plan';
import type { DisruptionResult } from './disruption';

let cityInstance: City | null = null;
export function getCity(): City {
  if (!cityInstance) cityInstance = generateCity();
  return cityInstance;
}

export interface SimState {
  stopCount: number;
  scenario: Scenario | null;
  version: number;
  baseline: BaselineResult | null;
  plan: PlanningResult | null;
  planStatus: 'idle' | 'solving' | 'ready' | 'error';
  progress: { phase: ProgressPhase; k: number; of: number } | null;
  roundTripMs: number | null;
  error: string | null;
  urgentCount: number;
  disruption: DisruptionResult | null;
  disruptionStatus: 'idle' | 'solving' | 'ready' | 'error';
}

let state: SimState = {
  stopCount: 300,
  scenario: null,
  version: 0,
  baseline: null,
  plan: null,
  planStatus: 'idle',
  progress: null,
  roundTripMs: null,
  error: null,
  urgentCount: 0,
  disruption: null,
  disruptionStatus: 'idle',
};

const listeners = new Set<() => void>();
function set(patch: Partial<SimState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getState = () => state;
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useSim<T>(selector: (s: SimState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

function loadBaseline() {
  const v = state.version;
  const sc = state.scenario!;
  routing
    .baseline(sc)
    .then((baseline) => {
      if (state.version === v) set({ baseline });
    })
    .catch((e: Error) => {
      if (state.version === v) set({ error: e.message, planStatus: 'error' });
    });
}

function setScenario(scenario: Scenario, extra: Partial<SimState> = {}) {
  set({
    scenario,
    version: state.version + 1,
    baseline: null,
    plan: null,
    planStatus: 'idle',
    progress: null,
    error: null,
    disruption: null,
    disruptionStatus: 'idle',
    ...extra,
  });
  loadBaseline();
}

export function initSimulation(stopCount: number) {
  if (state.scenario && state.stopCount === stopCount) return;
  set({ stopCount });
  setScenario(defaultScenario(getCity(), stopCount), { urgentCount: 0 });
}

let inflight: Promise<PlanningResult> | null = null;
let inflightVersion = -1;

/** Runs (or reuses) the optimisation for the current scenario. */
export function requestPlan(): Promise<PlanningResult> {
  if (state.plan) return Promise.resolve(state.plan);
  if (inflight && inflightVersion === state.version) return inflight;
  const v = state.version;
  const t0 = performance.now();
  set({ planStatus: 'solving', progress: null, error: null });
  inflightVersion = v;
  inflight = routing
    .plan(state.scenario!, (phase, k, of) => {
      if (state.version === v) set({ progress: { phase, k, of } });
    })
    .then((plan) => {
      if (state.version === v) set({ plan, planStatus: 'ready', roundTripMs: performance.now() - t0, progress: null });
      return plan;
    })
    .catch((e: Error) => {
      if (state.version === v) set({ planStatus: 'error', error: e.message });
      throw e;
    })
    .finally(() => {
      if (inflightVersion === v) inflight = null;
    });
  return inflight;
}

export function moveDepot(node: number) {
  if (!state.scenario || node === state.scenario.depotNode) return;
  setScenario({ ...state.scenario, depotNode: node });
}

export function addUrgentOrder(node: number): boolean {
  const sc = state.scenario;
  if (!sc) return false;
  if (node === sc.depotNode || sc.orders.some((o) => o.node === node)) return false;
  const rand = mulberry32(9000 + state.urgentCount);
  const order = makeOrder(node, rand, state.urgentCount, true);
  setScenario({ ...sc, orders: [...sc.orders, order] }, { urgentCount: state.urgentCount + 1 });
  return true;
}

export function resetScenario() {
  setScenario(defaultScenario(getCity(), state.stopCount), { urgentCount: 0 });
}

export async function requestDisruption(closedEdge: number) {
  const plan = await requestPlan();
  const v = state.version;
  set({ disruptionStatus: 'solving' });
  try {
    const d = await routing.disrupt(state.scenario!, plan.optimized, closedEdge);
    if (state.version === v) set({ disruption: d, disruptionStatus: 'ready' });
  } catch (e) {
    if (state.version === v) set({ disruptionStatus: 'error', error: (e as Error).message });
  }
}

/** Arrival time (s after midnight) of each stop on an optimised route. */
export function routeEtas(plan: PlanningResult, van: number, scenario: Scenario): number[] {
  const g = plan.optimized.geometry[van];
  const f = scenario.fleet;
  return Array.from(g.stopAt, (pathIdx, k) => f.shiftStartSec + g.cum[pathIdx] / f.speedMps + k * f.serviceSec);
}

export function clock(sec: number): string {
  const s = Math.round(sec / 60) * 60;
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Arrival times (s after midnight) for any route geometry. */
export function etasFor(g: import('./plan').RouteGeometry, scenario: Scenario): number[] {
  const f = scenario.fleet;
  return Array.from(g.stopAt, (pathIdx, k) => f.shiftStartSec + g.cum[pathIdx] / f.speedMps + k * f.serviceSec);
}

export function clearDisruption() {
  set({ disruption: null, disruptionStatus: 'idle' });
}
