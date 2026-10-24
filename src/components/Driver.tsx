import { useEffect, useState } from 'react';
import { Chapter } from './Chapter';
import { clock, etasFor, requestPlan, useSim } from '../sim/store';
import { routeColor } from '../map/draw';
import { fmtKm, useNearViewport } from '../lib/hooks';

export function Driver() {
  const scenario = useSim((s) => s.scenario);
  const plan = useSim((s) => s.plan);
  const [ref, near] = useNearViewport<HTMLDivElement>('400px');
  const [van, setVan] = useState(0);
  const [done, setDone] = useState(0);
  const [tab, setTab] = useState<'route' | 'load'>('route');

  useEffect(() => {
    if (near && !plan) requestPlan().catch(() => {});
  }, [near, plan]);

  useEffect(() => {
    setDone(0);
  }, [van, plan]);

  const routes = plan?.optimized.routes ?? [];
  const v = Math.min(van, Math.max(0, routes.length - 1));
  const route = routes[v] ?? [];
  const geom = plan?.optimized.geometry[v];
  const stats = plan?.optimized.stats.routes[v];
  const etas = geom && scenario ? etasFor(geom, scenario) : [];
  const next = route[done];
  const nextOrder = scenario && next !== undefined ? scenario.orders[next] : null;
  const color = routeColor(v);

  return (
    <Chapter clock="06:15" note="Hand-off" title="Routes land on the driver’s phone before the gates open.">
      <div className="split" ref={ref}>
        <div className="split__text">
          <ol className="points">
            <li>
              <strong>One route per driver, in order.</strong> No more reading a list over the loading bay. The next stop, the
              address and the crate count are the first thing the driver sees.
            </li>
            <li>
              <strong>Loaded in reverse.</strong> The load sheet stacks crates last-drop-first, so the next delivery is always
              nearest the door.
            </li>
            <li>
              <strong>Every tap reports back.</strong> Marking a drop delivered moves the plan forward and feeds the ETAs your
              customers see.
            </li>
          </ol>
          <div className="vanpick" role="group" aria-label="Choose a van">
            {routes.map((_, k) => (
              <button
                key={k}
                className="vanpick__btn"
                aria-pressed={k === v}
                onClick={() => setVan(k)}
                style={{ '--c': routeColor(k) } as React.CSSProperties}
              >
                {String(k + 1).padStart(2, '0')}
              </button>
            ))}
          </div>
          <p className="fineprint">
            Illustrative driver-app screen, built from the van routes in your simulation above. It isn’t connected to any real
            vehicle.
          </p>
        </div>

        <div className="phone" aria-label="Driver app preview" role="region">
          <div className="phone__screen" style={{ '--c': color } as React.CSSProperties}>
            {!plan || !scenario || !stats ? (
              <div className="phone__loading mono">Planning routes…</div>
            ) : (
              <>
                <div className="phone__top">
                  <span className="mono">Van {String(v + 1).padStart(2, '0')} · Friday</span>
                  <span className="mono">{clock(done < route.length ? etas[done] : scenario.fleet.shiftStartSec + stats.duration)}</span>
                </div>
                <div className="phone__tabs" role="tablist">
                  <button role="tab" aria-selected={tab === 'route'} onClick={() => setTab('route')}>
                    Route
                  </button>
                  <button role="tab" aria-selected={tab === 'load'} onClick={() => setTab('load')}>
                    Load sheet
                  </button>
                </div>
                {tab === 'route' ? (
                  <div className="phone__body" role="tabpanel">
                    <div className="phone__progress" aria-label={`${done} of ${route.length} delivered`}>
                      <span style={{ width: `${(done / route.length) * 100}%` }} />
                    </div>
                    <p className="mono phone__small">
                      {done} of {route.length} delivered · {fmtKm(stats.distance)} km today
                    </p>
                    {nextOrder ? (
                      <div className="nextstop">
                        <p className="mono phone__small">
                          Next · stop {done + 1} · due {clock(etas[done])}
                        </p>
                        <p className="nextstop__name">{nextOrder.name}</p>
                        <p className="nextstop__addr">{nextOrder.street}, Kesarnagar</p>
                        <p className="mono phone__small">
                          {nextOrder.id} · {nextOrder.demand} crate{nextOrder.demand > 1 ? 's' : ''}
                          {nextOrder.urgent ? ' · urgent' : ''}
                        </p>
                        <button className="phone__cta" onClick={() => setDone((d) => d + 1)}>
                          Mark delivered
                        </button>
                      </div>
                    ) : (
                      <div className="nextstop">
                        <p className="nextstop__name">All {route.length} drops done.</p>
                        <p className="nextstop__addr">Return to depot · due {clock(scenario.fleet.shiftStartSec + stats.duration)}</p>
                        <button className="phone__cta" onClick={() => setDone(0)}>
                          Restart demo
                        </button>
                      </div>
                    )}
                    <ol className="phone__list" start={done + 2}>
                      {route.slice(done + 1, done + 5).map((o, j) => (
                        <li key={o}>
                          <span>{scenario.orders[o].name}</span>
                          <span className="mono">{clock(etas[done + 1 + j])}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="phone__body" role="tabpanel">
                    <p className="mono phone__small">
                      {stats.load} of {scenario.fleet.capacity} crates · door at the top
                    </p>
                    <ol className="loadsheet">
                      {route.map((o, j) => (
                        <li key={o} className={j < done ? 'is-gone' : ''}>
                          <span className="mono">#{j + 1}</span>
                          <span>{scenario.orders[o].name}</span>
                          <span className="loadsheet__crates" aria-label={`${scenario.orders[o].demand} crates`}>
                            {Array.from({ length: scenario.orders[o].demand }, (_, c) => (
                              <i key={c} />
                            ))}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Chapter>
  );
}
