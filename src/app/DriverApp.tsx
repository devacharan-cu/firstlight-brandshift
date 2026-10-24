import { useMemo, useState } from 'react';
import { LiveMap } from '../components/LiveMap';
import { markDelivered, scheduleOf, stopStatus, undoDelivered, useSim } from '../sim/store';
import { Link, useLocation } from '../router';
import { routeColor } from '../map/draw';
import { Photo, Credit } from '../components/media';
import { clock, km, pad, Panel, Planning, useEnsurePlan, useSimSec, useUnits } from './common';

type Tab = 'route' | 'map' | 'load';

export default function DriverApp() {
  useEnsurePlan();
  const loc = useLocation();
  const scenario = useSim((s) => s.scenario);
  const live = useSim((s) => s.live);
  const delivered = useSim((s) => s.delivered);
  const t = useSimSec(500);
  const [unit, units] = useUnits();
  const [tab, setTab] = useState<Tab>('route');
  const [showDone, setShowDone] = useState(false);

  const sched = useMemo(() => (live && scenario ? scheduleOf(live, scenario) : []), [live, scenario]);
  if (!live || !scenario) return <Planning />;

  const used = sched.filter((s) => s.stops.length);
  const param = parseInt(loc.search.get('van') ?? '', 10);
  const van = Number.isFinite(param) && sched[param - 1]?.stops.length ? param - 1 : used[0]?.van ?? 0;
  const s = sched[van];
  const stats = live.stats.routes[van];
  const statuses = s.stops.map((_, k) => stopStatus(s, k, t, delivered));
  const nextIdx = statuses.findIndex((st) => st !== 'delivered');
  const doneCount = statuses.filter((st) => st === 'delivered').length;
  const next = nextIdx >= 0 ? s.stops[nextIdx] : null;
  const nextOrder = next ? scenario.orders[next.order] : null;
  const color = routeColor(van);
  const beforeShift = t < s.start;

  return (
    <div className="driverpage">
      <div className="driverpage__phone">
        <div className="phone phone--app" style={{ '--c': color } as React.CSSProperties}>
          <div className="phone__screen">
            <div className="phone__status mono" aria-hidden>
              <span>{clock(t)}</span>
              <span>Firstlight Driver</span>
            </div>
            <div className="phone__top">
              <span className="mono">Van {pad(van + 1)}</span>
              <span className="mono">
                {doneCount}/{s.stops.length} done
              </span>
            </div>
            <div className="phone__progress" aria-label={`${doneCount} of ${s.stops.length} delivered`}>
              <span style={{ width: `${(doneCount / s.stops.length) * 100}%` }} />
            </div>
            <div className="phone__tabs phone__tabs--3" role="tablist" aria-label="Driver app sections">
              {(['route', 'map', 'load'] as Tab[]).map((k) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                  {k === 'route' ? 'Route' : k === 'map' ? 'Map' : 'Load sheet'}
                </button>
              ))}
            </div>

            {tab === 'route' && (
              <div className="phone__body" role="tabpanel">
                {beforeShift && <p className="phone__banner mono">Shift starts {clock(s.start)} · loading now</p>}
                {next && nextOrder ? (
                  <div className="nextstop">
                    <p className="mono phone__small">
                      {statuses[nextIdx] === 'at-stop' ? 'At the door' : 'Next'} · stop {nextIdx + 1} · due {clock(next.arrive)}
                    </p>
                    <p className="nextstop__name">{nextOrder.name}</p>
                    <p className="nextstop__addr">{nextOrder.street}, Kesarnagar</p>
                    <p className="mono phone__small">
                      {nextOrder.id} · {nextOrder.demand} {nextOrder.demand === 1 ? unit : units}
                      {nextOrder.urgent ? ' · URGENT' : ''}
                    </p>
                    <div className="nextstop__actions">
                      <button className="phone__cta" onClick={() => markDelivered(next.order)}>
                        Delivered
                      </button>
                      <button className="phone__ghost" onClick={() => setTab('map')}>
                        Map
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="nextstop">
                    <p className="nextstop__name">All {s.stops.length} drops done.</p>
                    <p className="nextstop__addr">
                      {t >= s.end ? `Back at the depot since ${clock(s.end)}` : `Head back to the depot · due ${clock(s.end)}`}
                    </p>
                  </div>
                )}
                <ol className="phone__list" aria-label="Upcoming stops">
                  {s.stops.map((x, k) => {
                    if (k <= nextIdx || statuses[k] === 'delivered') return null;
                    return (
                      <li key={x.order}>
                        <span>
                          <b className="mono">{k + 1}</b> {scenario.orders[x.order].name}
                          {scenario.orders[x.order].urgent && <em className="tag">urgent</em>}
                        </span>
                        <span className="mono">{clock(x.arrive)}</span>
                      </li>
                    );
                  })}
                </ol>
                {doneCount > 0 && (
                  <>
                    <button className="phone__more" onClick={() => setShowDone((d) => !d)} aria-expanded={showDone}>
                      {showDone ? 'Hide' : 'Show'} completed ({doneCount})
                    </button>
                    {showDone && (
                      <ol className="phone__list phone__list--done">
                        {s.stops.map((x, k) =>
                          statuses[k] === 'delivered' ? (
                            <li key={x.order}>
                              <span>
                                <b className="mono">{k + 1}</b> {scenario.orders[x.order].name}
                              </span>
                              {delivered[x.order] !== undefined ? (
                                <button className="phone__undo" onClick={() => undoDelivered(x.order)} aria-label={`Undo delivered for ${scenario.orders[x.order].name}`}>
                                  POD {clock(delivered[x.order])} · undo
                                </button>
                              ) : (
                                <span className="mono">{clock(x.depart)}</span>
                              )}
                            </li>
                          ) : null,
                        )}
                      </ol>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'map' && (
              <div className="phone__body" role="tabpanel">
                <LiveMap view={live} scenario={scenario} highlight={van} focusVan={van} label={`Van ${van + 1}'s route`} className="phone__map" />
                <p className="mono phone__small">
                  {km(stats.distance)} km today · {nextOrder ? `next: ${nextOrder.name}` : 'returning to depot'}
                </p>
                <p className="phone__small">Turn-by-turn navigation would come from the phone’s maps app; this view shows the planned route.</p>
              </div>
            )}

            {tab === 'load' && (
              <div className="phone__body" role="tabpanel">
                <p className="mono phone__small">
                  {stats.load} of {scenario.fleet.capacity} {units} · loaded last drop first
                </p>
                <ol className="loadsheet">
                  {s.stops.map((x, k) => (
                    <li key={x.order} className={statuses[k] === 'delivered' ? 'is-gone' : ''}>
                      <span className="mono">#{k + 1}</span>
                      <span>{scenario.orders[x.order].name}</span>
                      <span className="loadsheet__crates" aria-label={`${scenario.orders[x.order].demand} ${units}`}>
                        {Array.from({ length: Math.min(12, scenario.orders[x.order].demand) }, (_, c) => (
                          <i key={c} />
                        ))}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="driverpage__side">
        <Panel title="Choose a driver">
          <div className="vanpick" role="group" aria-label="Choose a van">
            {used.map((v) => (
              <Link
                key={v.van}
                to={`/app/driver?van=${v.van + 1}`}
                replace
                keepScroll
                className="vanpick__btn"
                style={{ '--c': routeColor(v.van) } as React.CSSProperties}
              >
                {pad(v.van + 1)}
              </Link>
            ))}
          </div>
          <p className="muted driverpage__help">
            The app follows the simulated clock. Tap <b>Delivered</b> to record proof of delivery. The control tower, tracking page and reports
            pick it up immediately.
          </p>
          <p className="driverpage__links">
            <Link to={`/app/fleet?van=${van + 1}`}>This van in Fleet →</Link>
            {nextOrder && <Link to={`/app/track?order=${encodeURIComponent(nextOrder.id)}`}>Next customer’s tracking page →</Link>}
          </p>
        </Panel>
        <figure className="driverpage__photo">
          <Photo id="courier" sizes="(min-width: 1080px) 30vw, 100vw" />
          <figcaption>
            On the road, the app is the whole plan. <Credit kind="photo" id="courier" />
          </figcaption>
        </figure>
        <p className="fineprint">Illustrative driver app inside a simulation. It is not connected to any device, vehicle or person.</p>
      </div>
    </div>
  );
}
