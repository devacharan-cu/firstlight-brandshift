import { useState } from 'react';
import { clock, etasFor, requestPlan, useSim } from '../sim/store';
import { routeColor } from '../map/draw';
import { fmtH, fmtKm } from '../lib/hooks';
import { PROFILE_UNIT } from '../sim/scenario';
import { Chapter } from './Chapter';

type Which = 'baseline' | 'optimized' | 'live';

/**
 * The dispatch sheet: every van, its stops in order and when each is due. It is also the
 * full text alternative to the maps.
 */
export function PlanTable({ views = ['baseline', 'optimized'], initial = 'optimized' }: { views?: Which[]; initial?: Which }) {
  const scenario = useSim((s) => s.scenario);
  const plan = useSim((s) => s.plan);
  const baseline = useSim((s) => s.baseline);
  const live = useSim((s) => s.live);
  const status = useSim((s) => s.planStatus);
  const profile = useSim((s) => s.settings.profile);
  const [which, setWhich] = useState<Which>(initial);
  const [, units] = PROFILE_UNIT[profile];

  const view = which === 'live' ? live : which === 'optimized' ? (plan?.optimized ?? null) : (plan?.baseline ?? baseline);
  const coloured = which !== 'baseline';
  const label: Record<Which, string> = { baseline: 'Manual plan', optimized: 'Firstlight plan', live: 'Live (as dispatched)' };

  return (
    <div className="dsheet">
      <div className="dsheet__bar">
        <div className="seg" role="group" aria-label="Which plan to list">
          {views.map((v) => (
            <button
              key={v}
              aria-pressed={which === v}
              onClick={() => {
                setWhich(v);
                if (v !== 'baseline' && !plan) requestPlan().catch(() => {});
              }}
            >
              {label[v]}
            </button>
          ))}
        </div>
        <span className="mono dsheet__meta">
          {scenario ? `${scenario.orders.length} orders · ${scenario.fleet.capacity} ${units} per van · shift starts ${clock(scenario.fleet.shiftStartSec)}` : ''}
        </span>
      </div>

      {!view && (
        <div className="dsheet__empty">
          <p>
            {status === 'solving' ? 'Planning routes…' : 'Firstlight hasn’t planned these orders yet.'}{' '}
            {status !== 'solving' && (
              <button className="linkish" onClick={() => requestPlan().catch(() => {})}>
                Plan them now
              </button>
            )}
          </p>
        </div>
      )}

      {view && scenario && (
        <div className="dsheet__table" role="group" aria-label={`${label[which]} by van`}>
          <div className="dsheet__row dsheet__row--head" aria-hidden>
            <span>Van</span>
            <span>Stops</span>
            <span>Load</span>
            <span>Distance</span>
            <span>Shift</span>
            <span>Back at depot</span>
          </div>
          {view.routes.map((r, k) => {
            const s = view.stats.routes[k];
            if (!r.length || !s) return null;
            const etas = etasFor(view.geometry[k], scenario);
            const pct = Math.min(100, (s.load / scenario.fleet.capacity) * 100);
            return (
              <details key={k} className="dsheet__van">
                <summary
                  className="dsheet__row"
                  aria-label={`Van ${k + 1}: ${s.stops} stops, ${s.load} of ${scenario.fleet.capacity} ${units}, ${fmtKm(s.distance)} kilometres, ${fmtH(s.duration)} hours, back at depot ${clock(scenario.fleet.shiftStartSec + s.duration)}`}
                >
                  <span className="dsheet__van-id">
                    <i className="swatch" style={{ background: coloured ? routeColor(k) : 'var(--ink)' }} aria-hidden />
                    Van {String(k + 1).padStart(2, '0')}
                  </span>
                  <span className="mono">{s.stops}</span>
                  <span className="dsheet__load">
                    <span className="loadbar" aria-hidden>
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <span className="mono">
                      {s.load}/{scenario.fleet.capacity}
                    </span>
                  </span>
                  <span className="mono">{fmtKm(s.distance)} km</span>
                  <span className="mono">{fmtH(s.duration)} h</span>
                  <span className={`mono ${s.duration > scenario.fleet.shiftSec ? 'warn' : ''}`}>{clock(scenario.fleet.shiftStartSec + s.duration)}</span>
                </summary>
                <ol className="dsheet__stops">
                  {r.map((o, j) => {
                    const order = scenario.orders[o];
                    return (
                      <li key={o}>
                        <span className="mono">{clock(etas[j])}</span>
                        <span>
                          {order.name}
                          {order.urgent && <em className="tag">urgent</em>}
                        </span>
                        <span className="dsheet__addr">{order.street}</span>
                        <span className="mono">
                          {order.demand} {units.slice(0, 2)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </details>
            );
          })}
          <div className="dsheet__row dsheet__row--total">
            <span>{view.stats.vans} vans</span>
            <span className="mono">{view.routes.flat().length}</span>
            <span className="mono">
              {view.stats.load} {units}
            </span>
            <span className="mono">{fmtKm(view.stats.distance)} km</span>
            <span className="mono">{fmtH(view.stats.duration)} h</span>
            <span />
          </div>
        </div>
      )}
      <p className="fineprint">Open any van to see its stops in order with estimated arrival times. Generated orders, fictional businesses.</p>
    </div>
  );
}

export function DispatchSheet() {
  return (
    <Chapter id="day" clock="05:50" note="Sheet printed" title="Every van’s day, on one sheet.">
      <p className="chapter__lede">
        The plan isn’t a picture. It’s a list your drivers can follow: which van, which stops, in which order, and when each one is due
        back. The sheet below is generated from the plan on the map above, so it changes when you change the scenario.
      </p>
      <PlanTable />
    </Chapter>
  );
}
