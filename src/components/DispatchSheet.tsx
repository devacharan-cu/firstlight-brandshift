import { useState } from 'react';
import { clock, etasFor, requestPlan, useSim } from '../sim/store';
import { routeColor } from '../map/draw';
import { fmtH, fmtKm } from '../lib/hooks';
import { Chapter } from './Chapter';

/** The printed dispatch sheet — and the full text alternative to the map. */
export function DispatchSheet() {
  const scenario = useSim((s) => s.scenario);
  const plan = useSim((s) => s.plan);
  const baseline = useSim((s) => s.baseline);
  const status = useSim((s) => s.planStatus);
  const [which, setWhich] = useState<'optimized' | 'baseline'>('optimized');

  const showingOpt = which === 'optimized' && !!plan;
  const view = showingOpt ? plan!.optimized : (plan?.baseline ?? baseline);

  return (
    <Chapter id="day" clock="05:50" note="Sheet printed" title="Every van’s day, on one sheet.">
      <p className="chapter__lede">
        The plan isn’t a picture. It’s a list your drivers can follow: which van, which stops, in which order, and when each one
        is due back. The sheet below is generated from the plan on the map above, so it changes when you change the scenario.
      </p>

      <div className="dsheet">
        <div className="dsheet__bar">
          <div className="seg" role="group" aria-label="Which plan to list">
            <button aria-pressed={which === 'baseline'} onClick={() => setWhich('baseline')}>
              Manual plan
            </button>
            <button
              aria-pressed={which === 'optimized'}
              onClick={() => {
                setWhich('optimized');
                if (!plan) requestPlan().catch(() => {});
              }}
            >
              Firstlight plan
            </button>
          </div>
          <span className="mono dsheet__meta">
            {scenario ? `${scenario.orders.length} orders · ${scenario.fleet.capacity} crates per van · shift starts 08:00` : ''}
          </span>
        </div>

        {which === 'optimized' && !plan && (
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

        {view && scenario && (which === 'baseline' || plan) && (
          <div className="dsheet__table" role="group" aria-label={`${showingOpt ? 'Firstlight' : 'Manual'} plan by van`}>
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
              const etas = etasFor(view.geometry[k], scenario);
              const pct = Math.min(100, (s.load / scenario.fleet.capacity) * 100);
              return (
                <details key={k} className="dsheet__van">
                  <summary
                    className="dsheet__row"
                    aria-label={`Van ${k + 1}: ${s.stops} stops, ${s.load} of ${scenario.fleet.capacity} crates, ${fmtKm(s.distance)} kilometres, ${fmtH(s.duration)} hours, back at depot ${clock(scenario.fleet.shiftStartSec + s.duration)}`}
                  >
                    <span className="dsheet__van-id">
                      <i
                        className="swatch"
                        style={{ background: showingOpt ? routeColor(k) : 'var(--ink)' }}
                        aria-hidden
                      />
                      Van {String(k + 1).padStart(2, '0')}
                    </span>
                    <span className="mono">
                      {s.stops}
                    </span>
                    <span className="dsheet__load">
                      <span className="loadbar" aria-hidden>
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span className="mono">
                        {s.load}/{scenario.fleet.capacity}
                      </span>
                    </span>
                    <span className="mono">
                      {fmtKm(s.distance)} km
                    </span>
                    <span className="mono">
                      {fmtH(s.duration)} h
                    </span>
                    <span className="mono">
                      {clock(scenario.fleet.shiftStartSec + s.duration)}
                    </span>
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
                          <span className="mono">{order.demand} cr</span>
                        </li>
                      );
                    })}
                  </ol>
                </details>
              );
            })}
            <div className="dsheet__row dsheet__row--total">
              <span>{view.stats.vans} vans</span>
              <span className="mono">
                {scenario.orders.length}
              </span>
              <span className="mono">
                {view.stats.load} crates
              </span>
              <span className="mono">
                {fmtKm(view.stats.distance)} km
              </span>
              <span className="mono">
                {fmtH(view.stats.duration)} h
              </span>
              <span />
            </div>
          </div>
        )}
        <p className="fineprint">Open any van to see its stops in order with estimated arrival times. Generated orders, fictional businesses.</p>
      </div>
    </Chapter>
  );
}
