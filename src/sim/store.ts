import { useSyncExternalStore } from 'react';
import { generateCity, type City } from './city';
import { DEFAULT_SETTINGS, defaultDepot, fleetFrom, makeOrder, scenarioFrom, type Order, type Scenario, type Settings } from './scenario';
import { mulberry32 } from './rng';
import { routing } from './client';
import type { BaselineResult, ProgressPhase } from './protocol';
import type { PlanningResult, PlanView, RouteGeometry } from './plan';
import type { DisruptionResult } from './disruption';
import type { BreakdownResult, InsertionOption } from './ops';

/**
 * One shared, simulated operation for every page.
 *
 *  scenario  — the planning input (orders, depot, fleet)
 *  plan      — what the solver produced for those orders, with the manual baseline
 *  live      — the plan as dispatched; starts as the solver's plan and changes when a
 *              dispatcher moves stops, adds urgent orders or handles a breakdown
 *  delivered — proof-of-delivery marks from the driver app
 *  sim       — a clock for the control tower, driver app and tracking page
 *
 * State persists to sessionStorage so deep links and reloads keep the visitor's own day.
 */

let cityInstance: City | null = null;
export function getCity(): City {
  if (!cityInstance) cityInstance = generateCity();
  return cityInstance;
}

export interface LogEntry {
  at: number; // sim seconds
  kind: 'plan' | 'edit' | 'dispatch' | 'delivery' | 'disruption' | 'settings';
  text: string;
}

export interface SimClock {
  sec: number; // seconds after midnight
  playing: boolean;
  speed: number; // simulated seconds per real second
}

export interface SimState {
  settings: Settings;
  /** kept for the home hero: 300 orders on desktop, 120 on phones */
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
  live: PlanView | null;
  liveBusy: boolean;
  /** number of dispatcher changes applied to the live plan */
  edits: number;
  /** orders appended by dispatch after planning (indices ≥ plan.n) */
  dispatched: number;
  delivered: Record<number, number>;
  sim: SimClock;
  log: LogEntry[];
  disruption: DisruptionResult | null;
  disruptionStatus: 'idle' | 'solving' | 'ready' | 'error';
  breakdown: BreakdownResult | null;
  breakdownStatus: 'idle' | 'solving' | 'ready' | 'error';
}

export const SIM_START = 7 * 3600 + 50 * 60;

let state: SimState = {
  settings: DEFAULT_SETTINGS,
  stopCount: DEFAULT_SETTINGS.orders,
  scenario: null,
  version: 0,
  baseline: null,
  plan: null,
  planStatus: 'idle',
  progress: null,
  roundTripMs: null,
  error: null,
  urgentCount: 0,
  live: null,
  liveBusy: false,
  edits: 0,
  dispatched: 0,
  delivered: {},
  sim: { sec: SIM_START, playing: false, speed: 120 },
  log: [],
  disruption: null,
  disruptionStatus: 'idle',
  breakdown: null,
  breakdownStatus: 'idle',
};

const listeners = new Set<() => void>();
function set(patch: Partial<SimState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  schedulePersist();
}
export const getState = () => state;
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useSim<T>(selector: (s: SimState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

function log(kind: LogEntry['kind'], text: string) {
  return [...state.log, { at: state.sim.sec, kind, text }].slice(-200);
}

// ── persistence ──────────────────────────────────────────────────────────────
const KEY = 'firstlight:v2';
interface Saved {
  settings: Settings;
  scenario: Scenario;
  urgentCount: number;
  liveRoutes: number[][] | null;
  liveStarts?: number[];
  edits: number;
  dispatched: number;
  delivered: Record<number, number>;
  sim: SimClock;
  log: LogEntry[];
}
let persistTimer = 0;
function schedulePersist() {
  if (typeof window === 'undefined' || !state.scenario) return;
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    const saved: Saved = {
      settings: state.settings,
      scenario: state.scenario!,
      urgentCount: state.urgentCount,
      liveRoutes: state.live?.routes ?? null,
      liveStarts: state.live?.starts,
      edits: state.edits,
      dispatched: state.dispatched,
      delivered: state.delivered,
      sim: { ...state.sim, playing: false },
      log: state.log,
    };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      /* storage unavailable: the day simply won't survive a reload */
    }
  }, 300);
}
function restore(): Saved | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
let pendingLive: number[][] | null = null;
let restoredDelivered: Record<number, number> | null = null;

// ── scenario lifecycle ───────────────────────────────────────────────────────
function loadBaseline() {
  const v = state.version;
  routing
    .baseline(state.scenario!)
    .then((baseline) => {
      if (state.version === v) set({ baseline });
    })
    .catch((e: Error) => {
      if (state.version === v) set({ error: e.message, planStatus: 'error' });
    });
}

function setScenario(scenario: Scenario, extra: Partial<SimState> = {}) {
  pendingLive = null;
  restoredDelivered = null;
  set({
    scenario,
    version: state.version + 1,
    baseline: null,
    plan: null,
    planStatus: 'idle',
    progress: null,
    error: null,
    live: null,
    liveBusy: false,
    edits: 0,
    dispatched: 0,
    delivered: {},
    disruption: null,
    disruptionStatus: 'idle',
    breakdown: null,
    breakdownStatus: 'idle',
    ...extra,
  });
  loadBaseline();
}

let initialised = false;
/** Called once by the app shell. Restores the visitor's session or starts a fresh day. */
export function initSimulation(compact: boolean) {
  if (initialised) return;
  initialised = true;
  const saved = typeof window !== 'undefined' ? restore() : null;
  if (saved?.scenario) {
    // Orders appended by dispatch are part of the saved scenario; the solver re-plans the
    // original orders and the saved live routes are restored on top.
    const planned = saved.scenario.orders.length - saved.dispatched;
    setScenario({ ...saved.scenario, orders: saved.scenario.orders.slice(0, planned) }, {
      settings: saved.settings,
      stopCount: saved.settings.orders,
      urgentCount: saved.urgentCount,
      sim: saved.sim,
      // the re-plan below logs itself again
      log: saved.log.filter((e) => e.kind !== 'plan'),
    });
    pendingLive = saved.liveRoutes;
    restoredStarts = saved.liveStarts;
    restoredEdits = saved.edits ?? 0;
    restoredDelivered = saved.delivered;
    restoredExtra = saved.dispatched ? saved.scenario.orders.slice(planned) : null;
    return;
  }
  const settings = { ...DEFAULT_SETTINGS, orders: compact ? 120 : DEFAULT_SETTINGS.orders };
  setScenario(scenarioFrom(getCity(), settings), { settings, stopCount: settings.orders, urgentCount: 0 });
}
let restoredExtra: Scenario['orders'] | null = null;
let restoredEdits = 0;
let restoredStarts: number[] | undefined;

export function applySettings(settings: Settings, label = 'Scenario settings changed') {
  setScenario(scenarioFrom(getCity(), settings, state.scenario?.depotNode), {
    settings,
    stopCount: settings.orders,
    urgentCount: 0,
    sim: { ...state.sim, sec: SIM_START, playing: false },
    log: [{ at: SIM_START, kind: 'settings', text: label }],
  });
}

/** Replace the day's orders with an imported list (e.g. from CSV), keeping the fleet settings. */
export function importOrders(orders: Order[], label: string) {
  if (!orders.length) return;
  const settings = { ...state.settings, orders: orders.length };
  setScenario(
    { depotNode: state.scenario?.depotNode ?? defaultDepot(getCity()), orders, fleet: fleetFrom(settings) },
    {
      settings,
      stopCount: orders.length,
      urgentCount: 0,
      sim: { ...state.sim, sec: SIM_START, playing: false },
      log: [{ at: SIM_START, kind: 'settings', text: label }],
    },
  );
}

let inflight: Promise<PlanningResult> | null = null;
let inflightVersion = -1;

/** Runs (or reuses) the optimisation for the current scenario. */
export function requestPlan(): Promise<PlanningResult> {
  if (state.plan) return Promise.resolve(state.plan);
  if (inflight && inflightVersion === state.version) return inflight;
  if (!state.scenario) return Promise.reject(new Error('No scenario yet'));
  const v = state.version;
  const t0 = performance.now();
  set({ planStatus: 'solving', progress: null, error: null });
  inflightVersion = v;
  inflight = routing
    .plan(state.scenario, (phase, k, of) => {
      if (state.version === v) set({ progress: { phase, k, of } });
    })
    .then((plan) => {
      if (state.version !== v) return plan;
      set({
        plan,
        planStatus: 'ready',
        roundTripMs: performance.now() - t0,
        progress: null,
        live: plan.optimized,
        log: log('plan', `Planned ${plan.n} orders on ${plan.optimized.stats.vans} vans`),
      });
      restoreSession();
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

function restoreSession() {
  const routes = pendingLive;
  const delivered = restoredDelivered;
  const extra = restoredExtra;
  pendingLive = null;
  restoredDelivered = null;
  restoredExtra = null;
  if (extra?.length && state.scenario) {
    set({ scenario: { ...state.scenario, orders: [...state.scenario.orders, ...extra] }, dispatched: extra.length });
  }
  const valid = routes && routes.flat().every((o) => o < (state.scenario?.orders.length ?? 0));
  if (routes && valid) {
    const v = state.version;
    routing
      .evaluate(state.scenario!, routes, restoredStarts)
      .then((view) => {
        if (state.version === v) set({ live: view, delivered: delivered ?? {}, edits: restoredEdits });
      })
      .catch(() => {});
  } else if (delivered) {
    set({ delivered });
  }
}

export function moveDepot(node: number) {
  if (!state.scenario || node === state.scenario.depotNode) return;
  setScenario({ ...state.scenario, depotNode: node }, { log: log('settings', 'Depot moved') });
}

export function addUrgentOrder(node: number): boolean {
  const sc = state.scenario;
  if (!sc) return false;
  if (node === sc.depotNode || sc.orders.some((o) => o.node === node)) return false;
  const rand = mulberry32(9000 + state.urgentCount);
  const order = makeOrder(node, rand, state.urgentCount, true, state.settings.profile);
  setScenario(
    { ...sc, orders: [...sc.orders, order] },
    { urgentCount: state.urgentCount + 1, log: log('settings', `Urgent order ${order.id} added before planning`) },
  );
  return true;
}

export function resetScenario() {
  setScenario(scenarioFrom(getCity(), state.settings), {
    urgentCount: 0,
    sim: { ...state.sim, sec: SIM_START, playing: false },
    log: [],
  });
}

// ── live plan editing ────────────────────────────────────────────────────────
async function replaceLive(routes: number[][], text: string, kind: LogEntry['kind'] = 'edit') {
  const v = state.version;
  set({ liveBusy: true });
  try {
    const view = await routing.evaluate(state.scenario!, routes, state.live?.starts);
    if (state.version === v) set({ live: view, liveBusy: false, edits: state.edits + 1, log: log(kind, text) });
    return view;
  } catch (e) {
    if (state.version === v) set({ liveBusy: false, error: (e as Error).message });
    throw e;
  }
}

/** Move one stop to another van; returns the change in total distance (metres). */
export async function moveStop(order: number, toVan: number): Promise<number> {
  const live = state.live;
  if (!live || !state.scenario) throw new Error('Nothing planned yet');
  const v = state.version;
  set({ liveBusy: true });
  try {
    const { move, view } = await routing.move(state.scenario, live.routes, order, toVan, frozenCounts(), live.starts);
    if (state.version !== v) return 0;
    const o = state.scenario.orders[order];
    const km = (Math.abs(move.deltaMetres) / 1000).toFixed(1);
    set({
      live: view,
      liveBusy: false,
      edits: state.edits + 1,
      log: log('edit', `${o.id} moved from Van ${pad(move.from + 1)} to Van ${pad(move.to + 1)} (${move.deltaMetres >= 0 ? '+' : '−'}${km} km)`),
    });
    return move.deltaMetres;
  } catch (e) {
    set({ liveBusy: false, error: (e as Error).message });
    throw e;
  }
}

/** A new order arrives after planning: add it to the day and rank the vans that could take it. */
export async function receiveOrder(node: number): Promise<{ order: number; options: InsertionOption[] }> {
  const sc = state.scenario;
  if (!sc || !state.live) throw new Error('Plan the day first');
  const used = new Set([sc.depotNode, ...sc.orders.map((o) => o.node)]);
  if (used.has(node)) throw new Error('That address already has an order');
  const rand = mulberry32(7000 + state.dispatched);
  const order = makeOrder(node, rand, 500 + state.dispatched, true, state.settings.profile);
  // appending keeps every existing index stable, so the existing plans stay valid
  const scenario = { ...sc, orders: [...sc.orders, order] };
  set({ scenario, dispatched: state.dispatched + 1, log: log('dispatch', `New urgent order ${order.id} received`) });
  const options = await routing.insertOptions(scenario, state.live.routes, scenario.orders.length - 1, frozenCounts());
  return { order: scenario.orders.length - 1, options };
}

export async function insertionOptionsFor(order: number): Promise<InsertionOption[]> {
  if (!state.scenario || !state.live) return [];
  return routing.insertOptions(state.scenario, state.live.routes, order, frozenCounts());
}

export async function assignOrder(order: number, van: number, position: number) {
  const routes = state.live!.routes.map((r) => r.slice());
  routes[van].splice(position, 0, order);
  await replaceLive(routes, `${state.scenario!.orders[order].id} assigned to Van ${pad(van + 1)}`, 'dispatch');
}

/** Orders in the scenario that no van in the live plan carries yet (urgent orders waiting for dispatch). */
export function unassignedOrders(sc: Scenario | null = state.scenario, live: PlanView | null = state.live): number[] {
  if (!sc || !live) return [];
  const on = new Set(live.routes.flat());
  return sc.orders.map((_, i) => i).filter((i) => !on.has(i));
}

export function revertLive() {
  if (!state.plan || !state.scenario) return;
  set({
    scenario: { ...state.scenario, orders: state.scenario.orders.slice(0, state.plan.n) },
    dispatched: 0,
    live: state.plan.optimized,
    edits: 0,
    delivered: {},
    breakdown: null,
    breakdownStatus: 'idle',
    log: log('edit', 'Live plan reset to the solver’s plan'),
  });
}

// ── delivery + clock ─────────────────────────────────────────────────────────
export function markDelivered(order: number) {
  const o = state.scenario?.orders[order];
  set({
    delivered: { ...state.delivered, [order]: state.sim.sec },
    log: o ? log('delivery', `${o.id} marked delivered in the driver app`) : state.log,
  });
}
export function undoDelivered(order: number) {
  const d = { ...state.delivered };
  delete d[order];
  set({ delivered: d });
}

let ticker = 0;
function tick(last: number) {
  ticker = requestAnimationFrame((now) => {
    if (!state.sim.playing) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    const sec = Math.min(20 * 3600, state.sim.sec + dt * state.sim.speed);
    set({ sim: { ...state.sim, sec, playing: sec < 20 * 3600 } });
    tick(now);
  });
}
export function play() {
  if (state.sim.playing) return;
  set({ sim: { ...state.sim, playing: true } });
  cancelAnimationFrame(ticker);
  tick(performance.now());
}
export function pause() {
  cancelAnimationFrame(ticker);
  set({ sim: { ...state.sim, playing: false } });
}
export function setSpeed(speed: number) {
  set({ sim: { ...state.sim, speed } });
}
export function setSimTime(sec: number) {
  set({ sim: { ...state.sim, sec: Math.max(6 * 3600, Math.min(20 * 3600, sec)) } });
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.sim.playing) pause();
  });
}

// ── disruptions ──────────────────────────────────────────────────────────────
export async function requestDisruption(closedEdge: number) {
  await requestPlan();
  const v = state.version;
  set({ disruptionStatus: 'solving' });
  try {
    const d = await routing.disrupt(state.scenario!, state.plan!.optimized, closedEdge);
    if (state.version === v) set({ disruption: d, disruptionStatus: 'ready', log: log('disruption', `What-if: ${d.bridgeName} closed`) });
  } catch (e) {
    if (state.version === v) set({ disruptionStatus: 'error', error: (e as Error).message });
  }
}
export function clearDisruption() {
  set({ disruption: null, disruptionStatus: 'idle' });
}

export async function requestBreakdown(van: number) {
  const live = state.live;
  if (!live || !state.scenario) return;
  const v = state.version;
  set({ breakdownStatus: 'solving' });
  try {
    const b = await routing.breakdown(state.scenario, live.routes, van, frozenCounts(), state.sim.sec, live.starts);
    if (state.version === v) set({ breakdown: b, breakdownStatus: 'ready' });
  } catch (e) {
    if (state.version === v) set({ breakdownStatus: 'error', error: (e as Error).message });
  }
}
export function applyBreakdown(kind: 'redistribute' | 'hybrid' = 'redistribute') {
  const b = state.breakdown;
  if (!b) return;
  const hybrid = kind === 'hybrid' ? b.hybrid : null;
  if (kind === 'hybrid' && !hybrid) return;
  set({
    live: hybrid ? hybrid.view : b.redistribute.view,
    edits: state.edits + 1,
    breakdown: null,
    breakdownStatus: 'idle',
    log: log(
      'disruption',
      hybrid
        ? `Van ${pad(b.van + 1)} off the road: ${b.redistribute.touched.length} vans took ${b.redistribute.moved} drops, spare Van ${pad(hybrid.spareVan + 1)} leaves ${clock(hybrid.startSec)} with ${hybrid.stops}`
        : `Van ${pad(b.van + 1)} off the road: ${b.redistribute.touched.length} vans took its stops`,
    ),
  });
}
export function clearBreakdown() {
  set({ breakdown: null, breakdownStatus: 'idle' });
}

// ── derived helpers ──────────────────────────────────────────────────────────

/** Per van: how many leading stops are already done at the simulated time (schedule or proof of delivery). */
export function frozenCounts(): number[] {
  const { live, scenario, sim, delivered } = state;
  if (!live || !scenario) return [];
  return scheduleOf(live, scenario).map((s) => {
    const firstOpen = s.stops.findIndex((x) => !(delivered[x.order] !== undefined || sim.sec >= x.depart));
    return firstOpen < 0 ? s.stops.length : firstOpen;
  });
}
export const pad = (n: number) => String(n).padStart(2, '0');

export function clock(sec: number): string {
  const s = Math.round(sec / 60) * 60;
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor((s % 3600) / 60);
  return `${pad(h)}:${pad(m)}`;
}

/** Arrival times (s after midnight) for any route geometry, leaving the depot at `start`. */
export function etasFor(g: RouteGeometry, scenario: Scenario, start = scenario.fleet.shiftStartSec): number[] {
  const f = scenario.fleet;
  return Array.from(g.stopAt, (pathIdx, k) => start + g.cum[pathIdx] / f.speedMps + k * f.serviceSec);
}

/** Arrival time (s after midnight) of each stop on an optimised route. */
export function routeEtas(plan: PlanningResult, van: number, scenario: Scenario): number[] {
  return etasFor(plan.optimized.geometry[van], scenario);
}

export interface StopTiming {
  order: number;
  arrive: number;
  depart: number;
}
export interface VanSchedule {
  van: number;
  stops: StopTiming[];
  start: number;
  end: number;
  metres: number;
}

export function scheduleOf(view: PlanView, scenario: Scenario): VanSchedule[] {
  const f = scenario.fleet;
  return view.routes.map((r, van) => {
    const g = view.geometry[van];
    const start = view.starts?.[van] ?? f.shiftStartSec;
    const etas = r.length ? etasFor(g, scenario, start) : [];
    const metres = g.cum[g.cum.length - 1] ?? 0;
    return {
      van,
      stops: r.map((order, k) => ({ order, arrive: etas[k], depart: etas[k] + f.serviceSec })),
      start,
      end: r.length ? start + metres / f.speedMps + r.length * f.serviceSec : start,
      metres,
    };
  });
}

/** Metres along a van's path at a given time, following its schedule. */
export function metresAt(s: VanSchedule, g: RouteGeometry, scenario: Scenario, t: number): number {
  const speed = scenario.fleet.speedMps;
  if (t <= s.start || !s.stops.length) return 0;
  let fromT = s.start;
  let fromM = 0;
  for (let k = 0; k < s.stops.length; k++) {
    const st = s.stops[k];
    const atM = g.cum[g.stopAt[k]];
    if (t < st.arrive) return Math.min(atM, fromM + (t - fromT) * speed);
    if (t < st.depart) return atM;
    fromT = st.depart;
    fromM = atM;
  }
  const total = g.cum[g.cum.length - 1];
  return Math.min(total, fromM + (t - fromT) * speed);
}

export type StopStatus = 'delivered' | 'at-stop' | 'next' | 'planned';
export function stopStatus(s: VanSchedule, k: number, t: number, delivered: Record<number, number>): StopStatus {
  const done = (x: StopTiming) => delivered[x.order] !== undefined || t >= x.depart;
  const st = s.stops[k];
  if (done(st)) return 'delivered';
  if (t >= st.arrive) return 'at-stop';
  const firstOpen = s.stops.findIndex((x) => !done(x));
  return firstOpen === k ? 'next' : 'planned';
}
