import { useMemo, useState } from 'react';
import { LiveMap } from '../components/LiveMap';
import { metresAt, play, scheduleOf, useSim } from '../sim/store';
import { Link } from '../router';
import { clock, dayEvents, km, Kpi, pad, Panel, Planning, StatePill, useEnsurePlan, useSimSec, useUnits, VanChip, vanState } from './common';

export default function Tower() {
  useEnsurePlan();
  const scenario = useSim((s) => s.scenario);
  const live = useSim((s) => s.live);
  const delivered = useSim((s) => s.delivered);
  const log = useSim((s) => s.log);
  const playing = useSim((s) => s.sim.playing);
  const t = useSimSec(250);
  const [sel, setSel] = useState(-1);
  const [, plural] = useUnits();

  const sched = useMemo(() => (live && scenario ? scheduleOf(live, scenario) : []), [live, scenario]);
  const rows = useMemo(() => sched.map((s) => ({ s, ...vanState(s, t, delivered) })), [sched, t, delivered]);
  const events = useMemo(() => (live && scenario ? dayEvents(live, scenario, t, delivered, log).slice(0, 40) : []), [live, scenario, t, delivered, log]);

  if (!live || !scenario) return <Planning />;

  const totalStops = sched.reduce((a, s) => a + s.stops.length, 0);
  const done = rows.reduce((a, r) => a + r.done, 0);
  const onRoad = rows.filter((r) => r.state === 'en-route' || r.state === 'at-stop' || r.state === 'returning').length;
  const used = rows.filter((r) => r.state !== 'idle').length;
  const driven = sched.reduce((a, s) => a + (s.stops.length ? metresAt(s, live.geometry[s.van], scenario, t) : 0), 0);
  const lastBack = Math.max(...sched.filter((s) => s.stops.length).map((s) => s.end));
  const delivering = (rows.find((r) => r.state === 'at-stop') ?? null) !== null;

  return (
    <div className="tower">
      <dl className="kpis">
        <Kpi label="Drops delivered" value={`${done} / ${totalStops}`} note={`${Math.round((done / Math.max(1, totalStops)) * 100)}% of today`} />
        <Kpi label="Vans on the road" value={`${onRoad} / ${used}`} note={delivering ? 'Drivers at doors right now' : t < scheduleStart(sched) ? 'Loading at the depot' : ' '} />
        <Kpi label="Driven so far" value={`${km(driven)} km`} note={`of ${km(live.stats.distance)} km planned`} />
        <Kpi label="Last van back" value={clock(lastBack)} note={`${scenario.fleet.shiftSec / 3600}-hour shifts from ${clock(scenario.fleet.shiftStartSec)}`} />
        <Kpi label="Load carried" value={`${live.stats.load} ${plural}`} note={`${Math.round((live.stats.load / (live.stats.vans * scenario.fleet.capacity)) * 100)}% of capacity used`} />
      </dl>

      <div className="tower__grid">
        <Panel
          className="tower__map"
          title="Kesarnagar, live"
          actions={
            !playing && t < lastBack ? (
              <button className="chip" onClick={play}>
                ▶ Play the day
              </button>
            ) : null
          }
        >
          <LiveMap
            view={live}
            scenario={scenario}
            highlight={sel}
            onSelectVan={(v) => setSel((cur) => (cur === v ? -1 : v))}
            label={`Map of ${used} van routes at ${clock(t)}; ${done} of ${totalStops} drops delivered.`}
          />
          <p className="fineprint">
            Vans follow the planned schedule at {Math.round(scenario.fleet.speedMps * 3.6)} km/h; this is a simulation, not GPS. Click a route to
            isolate it.
          </p>
        </Panel>

        <Panel title="Today, as it happens" className="tower__feed">
          {events.length === 0 ? (
            <p className="muted">Nothing has happened yet. Press play, or drag the clock above.</p>
          ) : (
            <ol className="feed" aria-live="off">
              {events.map((e, i) => (
                <li key={i} className={`feed__item feed__item--${e.kind}`}>
                  <span className="mono feed__time">{clock(e.at)}</span>
                  <span>{e.text}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel title="Fleet" actions={<Link to="/app/fleet">Open fleet →</Link>}>
        <div className="table-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th scope="col">Van</th>
                <th scope="col">Status</th>
                <th scope="col">Next drop</th>
                <th scope="col">Progress</th>
                <th scope="col" className="num">
                  Distance
                </th>
                <th scope="col" className="num">
                  Back
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, state, next, done: d }) => {
                if (state === 'idle') return null;
                const nx = next >= 0 ? s.stops[next] : null;
                return (
                  <tr key={s.van} className={sel === s.van ? 'is-selected' : ''} onMouseEnter={() => setSel(s.van)} onMouseLeave={() => setSel(-1)}>
                    <th scope="row">
                      <VanChip van={s.van} to={`/app/fleet?van=${s.van + 1}`} />
                    </th>
                    <td>
                      <StatePill state={state} />
                    </td>
                    <td>
                      {nx ? (
                        <>
                          {scenario.orders[nx.order].name} <span className="mono muted">· {clock(nx.arrive)}</span>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="progress" role="img" aria-label={`${d} of ${s.stops.length} drops`}>
                        <span style={{ width: `${(d / s.stops.length) * 100}%` }} />
                      </span>
                      <span className="mono muted">
                        {' '}
                        {d}/{s.stops.length}
                      </span>
                    </td>
                    <td className="num mono">{km(s.metres)} km</td>
                    <td className="num mono">{clock(s.end)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="fineprint">
        Van {pad(1)}–{pad(live.routes.length)} on generated orders. Drops count as delivered when the schedule passes them or the driver app
        confirms them.
      </p>
    </div>
  );
}

function scheduleStart(s: { start: number }[]) {
  return s.length ? s[0].start : 0;
}
