import { useMemo, useState } from 'react';
import { LiveMap } from '../components/LiveMap';
import { moveStop, scheduleOf, stopStatus, useSim } from '../sim/store';
import { Link, useLocation } from '../router';
import { routeColor } from '../map/draw';
import { clock, hrs, km, pad, Panel, Planning, StatePill, useEnsurePlan, useSimSec, useUnits, VanChip, vanState } from './common';

export default function Fleet() {
  useEnsurePlan();
  const loc = useLocation();
  const scenario = useSim((s) => s.scenario);
  const live = useSim((s) => s.live);
  const busy = useSim((s) => s.liveBusy);
  const delivered = useSim((s) => s.delivered);
  const t = useSimSec(500);
  const [unit, units] = useUnits();
  const [notice, setNotice] = useState<string | null>(null);

  const sched = useMemo(() => (live && scenario ? scheduleOf(live, scenario) : []), [live, scenario]);
  if (!live || !scenario) return <Planning />;

  const usedVans = sched.filter((s) => s.stops.length);
  const param = parseInt(loc.search.get('van') ?? '', 10);
  const van = Number.isFinite(param) && sched[param - 1]?.stops.length ? param - 1 : usedVans[0]?.van ?? 0;
  const s = sched[van];
  const stats = live.stats.routes[van];
  const st = vanState(s, t, delivered);
  const cap = scenario.fleet.capacity;

  const onMove = async (order: number, to: number) => {
    const o = scenario.orders[order];
    setNotice(`Moving ${o.id}…`);
    try {
      const delta = await moveStop(order, to);
      setNotice(
        `${o.id} moved to Van ${pad(to + 1)}. Fleet distance ${delta >= 0 ? '+' : '−'}${km(Math.abs(delta))} km. Both routes re-sequenced.`,
      );
    } catch (e) {
      setNotice(`Couldn’t move ${o.id}: ${(e as Error).message}`);
    }
  };

  // shift timeline geometry
  const t0 = scenario.fleet.shiftStartSec;
  const span = scenario.fleet.shiftSec;
  const pos = (sec: number) => `${Math.max(0, Math.min(100, ((sec - t0) / span) * 100))}%`;

  return (
    <div className="fleet">
      <Panel title={`Vans · ${usedVans.length} on today’s plan`} className="fleet__list">
        <ul className="vanlist">
          {usedVans.map((v) => {
            const r = live.stats.routes[v.van];
            const vs = vanState(v, t, delivered);
            return (
              <li key={v.van}>
                <Link to={`/app/fleet?van=${v.van + 1}`} keepScroll replace className={`vanlist__item ${v.van === van ? 'is-active' : ''}`}>
                  <VanChip van={v.van} />
                  <span className="mono muted">
                    {r.stops} drops · {km(r.distance)} km
                  </span>
                  <span className="loadbar" aria-label={`${r.load} of ${cap} ${units}`}>
                    <span style={{ width: `${Math.min(100, (r.load / cap) * 100)}%`, background: routeColor(v.van) }} />
                  </span>
                  <StatePill state={vs.state} />
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="fleet__detail">
        <Panel
          title={
            <>
              Van {pad(van + 1)} <span className="muted">· {s.stops.length} drops</span>
            </>
          }
          actions={
            <>
              <Link to={`/app/driver?van=${van + 1}`}>Driver app →</Link>
            </>
          }
        >
          <dl className="vanfacts">
            <div>
              <dt>Status</dt>
              <dd>
                <StatePill state={st.state} />
              </dd>
            </div>
            <div>
              <dt>Load</dt>
              <dd className={`mono ${stats.load > cap ? 'warn' : ''}`}>
                {stats.load} / {cap} {units}
              </dd>
            </div>
            <div>
              <dt>Distance</dt>
              <dd className="mono">{km(stats.distance)} km</dd>
            </div>
            <div>
              <dt>Shift used</dt>
              <dd className={`mono ${stats.duration > scenario.fleet.shiftSec ? 'warn' : ''}`}>
                {hrs(stats.duration)} of {scenario.fleet.shiftSec / 3600} h
              </dd>
            </div>
            <div>
              <dt>Back at depot</dt>
              <dd className="mono">{clock(s.end)}</dd>
            </div>
          </dl>

          <div className="shiftline" aria-label={`Shift timeline from ${clock(t0)} to ${clock(t0 + span)}`}>
            <span className="shiftline__track" />
            <span className="shiftline__used" style={{ width: pos(s.end), background: routeColor(van) }} />
            {s.stops.map((x, k) => (
              <span key={x.order} className="shiftline__stop" style={{ left: pos(x.arrive) }} title={`${clock(x.arrive)} · ${scenario.orders[x.order].name}`} data-k={k} />
            ))}
            <span className="shiftline__now" style={{ left: pos(t) }} aria-hidden />
            <span className="shiftline__labels mono" aria-hidden>
              <span>{clock(t0)}</span>
              <span>{clock(t0 + span / 2)}</span>
              <span>{clock(t0 + span)}</span>
            </span>
          </div>

          <LiveMap view={live} scenario={scenario} highlight={van} focusVan={van} label={`Van ${van + 1}'s route, ${km(stats.distance)} kilometres`} className="fleet__map" />
        </Panel>

        <Panel title="Stops in order">
          <p className="muted fleet__help" aria-live="polite">
            {busy ? 'Re-planning…' : notice ?? `Move a stop to another van: Firstlight inserts it where it costs least and re-sequences both routes.`}
          </p>
          <div className="table-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Due</th>
                  <th scope="col">Customer</th>
                  <th scope="col" className="num">
                    {units}
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Move to</th>
                </tr>
              </thead>
              <tbody>
                {s.stops.map((x, k) => {
                  const o = scenario.orders[x.order];
                  const status = stopStatus(s, k, t, delivered);
                  return (
                    <tr key={x.order} className={status === 'next' ? 'is-selected' : ''}>
                      <td className="mono muted">{k + 1}</td>
                      <td className="mono">{clock(x.arrive)}</td>
                      <td>
                        <Link to={`/app/track?order=${encodeURIComponent(o.id)}`}>{o.name}</Link>
                        <span className="muted"> · {o.street}</span>
                        {o.urgent && <em className="tag">urgent</em>}
                      </td>
                      <td className="num mono">{o.demand}</td>
                      <td>
                        <span className={`dot dot--${status}`}>{status === 'at-stop' ? 'at the door' : status}</span>
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`mv-${x.order}`}>
                          Move {o.id} to another van
                        </label>
                        <select
                          id={`mv-${x.order}`}
                          className="select select--sm"
                          value=""
                          disabled={busy || status === 'delivered'}
                          onChange={(e) => e.target.value && onMove(x.order, +e.target.value)}
                        >
                          <option value="">Choose…</option>
                          {sched.map((v) => {
                            if (v.van === van || !v.stops.length) return null;
                            const spare = cap - live.stats.routes[v.van].load;
                            return (
                              <option key={v.van} value={v.van} disabled={spare < o.demand}>
                                Van {pad(v.van + 1)} · {spare} {spare === 1 ? unit : units} spare
                              </option>
                            );
                          })}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

