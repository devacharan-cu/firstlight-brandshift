import { useEffect, useState, type ReactNode } from 'react';
import { routeColor } from '../map/draw';
import { clock, getState, pad, requestPlan, scheduleOf, subscribe, useSim, type LogEntry, type VanSchedule } from '../sim/store';
import { PROFILE_UNIT } from '../sim/scenario';
import type { PlanView } from '../sim/plan';
import type { Scenario } from '../sim/scenario';
import { Link } from '../router';

/** Console pages need a planned day: start the solver as soon as the scenario exists. */
export function useEnsurePlan() {
  const scenario = useSim((s) => s.scenario);
  const plan = useSim((s) => s.plan);
  const status = useSim((s) => s.planStatus);
  useEffect(() => {
    if (scenario && !plan && status === 'idle') requestPlan().catch(() => {});
  }, [scenario, plan, status]);
}

/** The simulated time, re-rendering at most every `ms` milliseconds. */
export function useSimSec(ms = 250): number {
  const [sec, setSec] = useState(() => getState().sim.sec);
  useEffect(() => {
    let last = 0;
    let timer = 0;
    const on = () => {
      const now = performance.now();
      const apply = () => {
        last = performance.now();
        setSec(getState().sim.sec);
      };
      if (now - last >= ms) apply();
      else if (!timer) timer = window.setTimeout(() => ((timer = 0), apply()), ms - (now - last));
    };
    const unsub = subscribe(on);
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, [ms]);
  return sec;
}

export function useUnits() {
  const profile = useSim((s) => s.settings.profile);
  return PROFILE_UNIT[profile];
}

export function VanChip({ van, to }: { van: number; to?: string }) {
  const body = (
    <>
      <i style={{ background: routeColor(van) }} aria-hidden />
      Van {pad(van + 1)}
    </>
  );
  return to ? (
    <Link className="vanchip" to={to}>
      {body}
    </Link>
  ) : (
    <span className="vanchip">{body}</span>
  );
}

export type VanState = 'loading' | 'en-route' | 'at-stop' | 'returning' | 'back' | 'idle';
export function vanState(s: VanSchedule, t: number, delivered: Record<number, number>): { state: VanState; next: number; done: number } {
  if (!s.stops.length) return { state: 'idle', next: -1, done: 0 };
  const done = s.stops.filter((x) => delivered[x.order] !== undefined || t >= x.depart).length;
  if (t < s.start) return { state: 'loading', next: 0, done };
  if (t >= s.end) return { state: 'back', next: -1, done };
  const at = s.stops.findIndex((x) => t >= x.arrive && t < x.depart);
  if (at >= 0) return { state: 'at-stop', next: at, done };
  const next = s.stops.findIndex((x) => !(delivered[x.order] !== undefined || t >= x.depart));
  if (next < 0) return { state: 'returning', next: -1, done };
  return { state: 'en-route', next, done };
}

const STATE_TEXT: Record<VanState, string> = {
  loading: 'Loading',
  'en-route': 'En route',
  'at-stop': 'At a drop',
  returning: 'Returning',
  back: 'Back at depot',
  idle: 'Not used today',
};

export function StatePill({ state }: { state: VanState }) {
  return <span className={`pill pill--${state}`}>{STATE_TEXT[state]}</span>;
}

/** Events derived from the schedule up to the simulated time, merged with what people did. */
export function dayEvents(view: PlanView, scenario: Scenario, t: number, delivered: Record<number, number>, log: LogEntry[]) {
  const out: { at: number; kind: string; text: string; van?: number; seq: number }[] = [];
  let seq = 0;
  const sched = scheduleOf(view, scenario);
  for (const s of sched) {
    if (!s.stops.length) continue;
    if (t >= s.start) out.push({ seq: seq++, at: s.start, kind: 'depart', text: `Van ${pad(s.van + 1)} left the depot with ${s.stops.length} drops`, van: s.van });
    for (const st of s.stops) {
      if (delivered[st.order] !== undefined) continue;
      if (t >= st.depart) out.push({ seq: seq++, at: st.depart, kind: 'drop', text: `${scenario.orders[st.order].id} delivered · ${scenario.orders[st.order].name}`, van: s.van });
    }
    if (t >= s.end) out.push({ seq: seq++, at: s.end, kind: 'return', text: `Van ${pad(s.van + 1)} back at the depot`, van: s.van });
  }
  for (const [o, at] of Object.entries(delivered)) {
    const order = scenario.orders[+o];
    if (order) out.push({ seq: seq++, at, kind: 'pod', text: `${order.id} confirmed in the driver app` });
  }
  for (const e of log) out.push({ seq: seq++, at: e.at, kind: e.kind, text: e.text });
  // newest first; within the same minute, the most recent action first
  return out.filter((e) => e.at <= t + 1).sort((a, b) => b.at - a.at || b.seq - a.seq);
}

export function Planning({ children }: { children?: ReactNode }) {
  const status = useSim((s) => s.planStatus);
  const progress = useSim((s) => s.progress);
  const error = useSim((s) => s.error);
  const n = useSim((s) => s.scenario?.orders.length ?? 0);
  const phase: Record<string, string> = {
    matrix: `Measuring road distances between ${n + 1} locations`,
    baseline: 'Building the manual baseline',
    savings: `Building routes by savings — start ${(progress?.k ?? 0) + 1} of ${progress?.of ?? 4}`,
    improve: `Improving with local search — start ${(progress?.k ?? 0) + 1} of ${progress?.of ?? 4}`,
    geometry: 'Tracing routes onto streets',
    done: 'Choosing the best plan',
  };
  return (
    <div className="planning" role="status" aria-live="polite">
      <span className="planning__dot" aria-hidden />
      {status === 'error' ? (
        <p>The planner stopped: {error}. Try Settings → Reset.</p>
      ) : (
        <p>{progress ? phase[progress.phase] : `Planning ${n || ''} orders…`}</p>
      )}
      {children}
    </div>
  );
}

export function Panel({ title, actions, children, className = '' }: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel__head">
        <h2 className="panel__title">{title}</h2>
        {actions && <div className="panel__actions">{actions}</div>}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="kpi">
      <dt>{label}</dt>
      <dd className="kpi__value mono">{value}</dd>
      {note && <dd className="kpi__note">{note}</dd>}
    </div>
  );
}

export const km = (m: number) => (m / 1000).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const hrs = (s: number) => (s / 3600).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export { clock, pad };
