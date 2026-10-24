import { useMemo } from 'react';
import { LoadBars, TimeSplit } from '../components/DayReport';
import { getCity, metresAt, scheduleOf, useSim } from '../sim/store';
import { downloadText } from '../sim/csv';
import type { PlanStats } from '../sim/solver';
import type { PlanView } from '../sim/plan';
import type { Scenario } from '../sim/scenario';
import { clock, dayEvents, hrs, km, pad, Panel, Planning, useEnsurePlan, useSimSec, useUnits, VanChip } from './common';

const q = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: (string | number)[][]) => rows.map((r) => r.map(q).join(',')).join('\n') + '\n';

function routesCsv(view: PlanView, scenario: Scenario) {
  const city = getCity();
  const rows: (string | number)[][] = [['van', 'sequence', 'order_id', 'customer', 'address', 'x_km', 'y_km', 'units', 'eta', 'departs_depot']];
  scheduleOf(view, scenario).forEach((s) =>
    s.stops.forEach((st, k) => {
      const o = scenario.orders[st.order];
      rows.push([`Van ${pad(s.van + 1)}`, k + 1, o.id, o.name, o.street, (city.x[o.node] / 1000).toFixed(3), (city.y[o.node] / 1000).toFixed(3), o.demand, clock(st.arrive), clock(s.start)]);
    }),
  );
  return csv(rows);
}

function longest(s: PlanStats) {
  return Math.max(0, ...s.routes.map((r) => r.duration));
}

export default function Reports() {
  useEnsurePlan();
  const scenario = useSim((s) => s.scenario);
  const plan = useSim((s) => s.plan);
  const live = useSim((s) => s.live);
  const delivered = useSim((s) => s.delivered);
  const log = useSim((s) => s.log);
  const edits = useSim((s) => s.edits);
  const t = useSimSec(1000);
  const [, units] = useUnits();

  const sched = useMemo(() => (live && scenario ? scheduleOf(live, scenario) : []), [live, scenario]);
  if (!plan || !live || !scenario) return <Planning />;

  const cap = scenario.fleet.capacity;
  const columns: { name: string; s: PlanStats; orders: number }[] = [
    { name: 'Manual baseline', s: plan.baseline.stats, orders: plan.n },
    { name: 'Firstlight plan', s: plan.optimized.stats, orders: plan.n },
    { name: edits ? `Live · ${edits} change${edits === 1 ? '' : 's'}` : 'Live (unchanged)', s: live.stats, orders: live.routes.flat().length },
  ];
  const rows: { k: string; v: (c: (typeof columns)[number]) => string }[] = [
    { k: 'Orders served', v: (c) => String(c.orders) },
    { k: 'Vans used', v: (c) => `${c.s.vans} of ${scenario.fleet.vans}` },
    { k: 'Distance', v: (c) => `${km(c.s.distance)} km` },
    { k: 'Distance per drop', v: (c) => `${(c.s.distance / 1000 / Math.max(1, c.orders)).toFixed(2)} km` },
    { k: 'Van-hours', v: (c) => `${hrs(c.s.duration)} h` },
    { k: 'Longest shift', v: (c) => `${hrs(longest(c.s))} h` },
    { k: 'Average load', v: (c) => `${Math.round((c.s.load / (c.s.vans * cap)) * 100)}%` },
    { k: 'Within all limits', v: (c) => (c.s.feasible ? 'Yes' : 'No') },
  ];

  const total = sched.reduce((a, s) => a + s.stops.length, 0);
  const done = sched.reduce((a, s) => a + s.stops.filter((x) => delivered[x.order] !== undefined || t >= x.depart).length, 0);
  const driven = sched.reduce((a, s) => a + (s.stops.length ? metresAt(s, live.geometry[s.van], scenario, t) : 0), 0);
  const pods = Object.keys(delivered).length;
  const stamp = `firstlight-${scenario.orders.length}-orders`;

  return (
    <div className="reports">
      <Panel
        title="The day in three plans"
        actions={
          <span className="muted mono">
            {clock(t)} · {done}/{total} drops · {km(driven)} km driven · {pods} proofs of delivery
          </span>
        }
      >
        <div className="table-wrap">
          <table className="dtable report-table">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                {columns.map((c) => (
                  <th key={c.name} scope="col" className="num">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.k}>
                  <th scope="row">{r.k}</th>
                  {columns.map((c) => (
                    <td key={c.name} className="num mono">
                      {r.v(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fineprint">
          All three columns use the same orders, street graph and limits. The live column includes changes made in Dispatch, Fleet and
          Disruptions, so it can be longer than the solver’s plan. Simulated figures, not customer results.
        </p>
      </Panel>

      <div className="reports__charts">
        <Panel title={`How full each van ran · share of ${cap} ${units}`}>
          <div className="multiples">
            <LoadBars title="Manual baseline" stats={plan.baseline.stats} capacity={cap} color="#5d574d" />
            <LoadBars title="Live plan" stats={live.stats} capacity={cap} color="#b45f00" />
          </div>
        </Panel>
        <Panel title="Where the van-hours go">
          <TimeSplit base={plan.baseline.stats} opt={live.stats} service={scenario.fleet.serviceSec} stops={plan.n} />
          <p className="fineprint">The live bar includes any orders added after planning.</p>
        </Panel>
      </div>

      <Panel title="By van · live plan">
        <div className="table-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th scope="col">Van</th>
                <th scope="col" className="num">
                  Drops
                </th>
                <th scope="col" className="num">
                  Load
                </th>
                <th scope="col" className="num">
                  Distance
                </th>
                <th scope="col" className="num">
                  Driving
                </th>
                <th scope="col" className="num">
                  At doors
                </th>
                <th scope="col" className="num">
                  Leaves
                </th>
                <th scope="col" className="num">
                  Back
                </th>
              </tr>
            </thead>
            <tbody>
              {sched.map((s) => {
                if (!s.stops.length) return null;
                const st = live.stats.routes[s.van];
                const service = s.stops.length * scenario.fleet.serviceSec;
                return (
                  <tr key={s.van}>
                    <th scope="row">
                      <VanChip van={s.van} to={`/app/fleet?van=${s.van + 1}`} />
                    </th>
                    <td className="num mono">{s.stops.length}</td>
                    <td className={`num mono ${st.load > cap ? 'warn' : ''}`}>
                      {st.load}/{cap}
                    </td>
                    <td className="num mono">{km(st.distance)} km</td>
                    <td className="num mono">{hrs(st.duration - service)} h</td>
                    <td className="num mono">{hrs(service)} h</td>
                    <td className="num mono">{clock(s.start)}</td>
                    <td className={`num mono ${st.duration > scenario.fleet.shiftSec ? 'warn' : ''}`}>{clock(s.end)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Export">
        <div className="exports">
          <button className="btn btn--ink" onClick={() => downloadText(`${stamp}-routes.csv`, routesCsv(live, scenario))}>
            Routes, stop by stop (CSV)
          </button>
          <button
            className="btn btn--quiet"
            onClick={() =>
              downloadText(`${stamp}-summary.csv`, csv([['measure', ...columns.map((c) => c.name)], ...rows.map((r) => [r.k, ...columns.map((c) => r.v(c))])]))
            }
          >
            Day summary (CSV)
          </button>
          <button
            className="btn btn--quiet"
            onClick={() =>
              downloadText(
                `${stamp}-events.csv`,
                csv([['time', 'kind', 'event'], ...dayEvents(live, scenario, t, delivered, log).reverse().map((e) => [clock(e.at), e.kind, e.text])]),
              )
            }
          >
            Event log to {clock(t)} (CSV)
          </button>
        </div>
        <p className="fineprint">Files are generated in your browser from the simulation. Nothing is uploaded anywhere.</p>
      </Panel>
    </div>
  );
}
