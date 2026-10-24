import { useEffect, useState } from 'react';
import { Chapter } from './Chapter';
import { requestPlan, useSim } from '../sim/store';
import { fmtH, fmtKm, useNearViewport } from '../lib/hooks';
import type { PlanStats } from '../sim/solver';

const DRIVE = '#6250d6';
const SERVICE = '#12936a';

export function LoadBars({ title, stats, capacity, color }: { title: string; stats: PlanStats; capacity: number; color: string }) {
  const [tip, setTip] = useState<number | null>(null);
  const rows = stats.routes
    .map((r, k) => ({ k, load: r.load, stops: r.stops, pct: (r.load / capacity) * 100 }))
    .filter((r) => r.stops > 0)
    .sort((a, b) => b.pct - a.pct);
  const barH = 10;
  const gap = 6;
  const h = rows.length * (barH + gap);
  return (
    <figure className="chart">
      <figcaption className="chart__title">
        {title} <span className="mono">· {stats.vans} vans</span>
      </figcaption>
      <div className="chart__plot">
        <svg viewBox={`0 0 300 ${h + 18}`} className="chart__svg" role="img" aria-label={`${title}: load per van, from ${Math.round(rows[0]?.pct ?? 0)}% down to ${Math.round(rows[rows.length - 1]?.pct ?? 0)}% of capacity`}>
          {[0, 50, 100].map((g) => (
            <g key={g}>
              <line x1={g * 3} x2={g * 3} y1={0} y2={h} className="chart__grid" />
              <text x={g * 3} y={h + 13} className="chart__tick" textAnchor={g === 0 ? 'start' : g === 100 ? 'end' : 'middle'}>
                {g}%
              </text>
            </g>
          ))}
          {rows.map((r, i) => (
            <g
              key={r.k}
              onPointerEnter={() => setTip(i)}
              onPointerLeave={() => setTip(null)}
              className="chart__bar"
            >
              <rect x={0} y={i * (barH + gap) - gap / 2} width={300} height={barH + gap} fill="transparent" />
              <rect x={0} y={i * (barH + gap)} width={Math.max(4, r.pct * 3)} height={barH} rx={2} fill={color} />
            </g>
          ))}
        </svg>
        {tip !== null && rows[tip] && (
          <div className="chart__tip" style={{ top: `${((tip * (barH + gap)) / (h + 18)) * 100}%`, left: `${Math.min(70, rows[tip].pct)}%` }}>
            Van {String(rows[tip].k + 1).padStart(2, '0')} · {rows[tip].load} of {capacity} crates · {Math.round(rows[tip].pct)}%
          </div>
        )}
      </div>
    </figure>
  );
}

export function TimeSplit({ base, opt, service, stops }: { base: PlanStats; opt: PlanStats; service: number; stops: number }) {
  const [tip, setTip] = useState<string | null>(null);
  const rows = [
    { name: 'Manual plan', drive: base.duration - service * stops, service: service * stops },
    { name: 'Firstlight', drive: opt.duration - service * stops, service: service * stops },
  ];
  const max = Math.max(...rows.map((r) => r.drive + r.service));
  const W = 300;
  const sc = (s: number) => (s / max) * W;
  return (
    <figure className="chart chart--wide">
      <figcaption className="chart__title">Where the van-hours go</figcaption>
      <div className="chart__legend" aria-hidden>
        <span>
          <i style={{ background: DRIVE }} /> Driving
        </span>
        <span>
          <i style={{ background: SERVICE }} /> At the door
        </span>
      </div>
      <div className="chart__plot">
        <svg viewBox={`0 0 ${W + 70} 74`} className="chart__svg" role="img" aria-label={`Driving time falls from ${fmtH(rows[0].drive)} to ${fmtH(rows[1].drive)} hours; time at the door stays ${fmtH(rows[0].service)} hours.`}>
          {rows.map((r, i) => {
            const y = i * 34 + 14;
            const dw = sc(r.drive);
            return (
              <g key={r.name}>
                <text x={0} y={y - 4} className="chart__tick">
                  {r.name}
                </text>
                <rect
                  x={0}
                  y={y}
                  width={Math.max(0, dw - 1)}
                  height={12}
                  rx={2}
                  fill={DRIVE}
                  onPointerEnter={() => setTip(`${r.name} · driving ${fmtH(r.drive)} h`)}
                  onPointerLeave={() => setTip(null)}
                />
                <rect
                  x={dw + 1}
                  y={y}
                  width={Math.max(0, sc(r.service) - 1)}
                  height={12}
                  rx={2}
                  fill={SERVICE}
                  onPointerEnter={() => setTip(`${r.name} · at the door ${fmtH(r.service)} h`)}
                  onPointerLeave={() => setTip(null)}
                />
                <text x={sc(r.drive + r.service) + 6} y={y + 10} className="chart__val">
                  {fmtH(r.drive + r.service)} h
                </text>
              </g>
            );
          })}
        </svg>
        {tip && <div className="chart__tip chart__tip--static">{tip}</div>}
      </div>
    </figure>
  );
}

export function DayReport() {
  const scenario = useSim((s) => s.scenario);
  const plan = useSim((s) => s.plan);
  const disruption = useSim((s) => s.disruption);
  const [ref, near] = useNearViewport<HTMLDivElement>('400px');

  useEffect(() => {
    if (near && !plan) requestPlan().catch(() => {});
  }, [near, plan]);

  const b = plan?.baseline.stats;
  const o = plan?.optimized.stats;
  const n = scenario?.orders.length ?? 0;
  const cap = scenario?.fleet.capacity ?? 90;

  const tiles =
    b && o
      ? [
          { k: 'Distance driven', v: `${fmtKm(o.distance)} km`, was: `${fmtKm(b.distance)} km` },
          { k: 'Vans on the road', v: `${o.vans}`, was: `${b.vans}` },
          { k: 'Van-hours', v: `${fmtH(o.duration)} h`, was: `${fmtH(b.duration)} h` },
          { k: 'Distance per drop', v: `${((o.distance / n) / 1000).toFixed(2)} km`, was: `${((b.distance / n) / 1000).toFixed(2)} km` },
          { k: 'Average load', v: `${Math.round((o.load / (o.vans * cap)) * 100)}%`, was: `${Math.round((b.load / (b.vans * cap)) * 100)}%` },
        ]
      : [];

  return (
    <Chapter clock="19:00" note="Day report" title="By evening, the numbers are already written up.">
      <p className="chapter__lede">
        Every figure here is computed from the {n || ''} orders on today’s sheet: the manual plan against Firstlight’s, for the same
        orders and the same fleet. Change the depot or add an order up top and this report changes with it.
      </p>
      <div className="report" ref={ref}>
        {b && o && scenario ? (
          <>
            <dl className="tiles tiles--report">
              {tiles.map((t) => (
                <div key={t.k}>
                  <dt>{t.k}</dt>
                  <dd className="mono">{t.v}</dd>
                  <dd className="tiles__was mono">manual: {t.was}</dd>
                </div>
              ))}
              {disruption && (
                <div>
                  <dt>{disruption.bridgeName} closed</dt>
                  <dd className="mono">{fmtKm(disruption.replan.stats.distance)} km</dd>
                  <dd className="tiles__was mono">re-planned · detour would be {fmtKm(disruption.keep.stats.distance)} km</dd>
                </div>
              )}
            </dl>
            <div className="report__charts">
              <div className="report__pair">
                <p className="label">How full each van ran (share of {cap} crates)</p>
                <div className="multiples">
                  <LoadBars title="Manual plan" stats={b} capacity={cap} color="#5d574d" />
                  <LoadBars title="Firstlight" stats={o} capacity={cap} color="#b45f00" />
                </div>
              </div>
              <TimeSplit base={b} opt={o} service={scenario.fleet.serviceSec} stops={n} />
            </div>
            <table className="sr-only">
              <caption>Day report figures</caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">Manual plan</th>
                  <th scope="col">Firstlight</th>
                </tr>
              </thead>
              <tbody>
                {tiles.map((t) => (
                  <tr key={t.k}>
                    <th scope="row">{t.k}</th>
                    <td>{t.was}</td>
                    <td>{t.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="mono">Planning routes…</p>
        )}
        <p className="fineprint">
          Simulated figures on generated orders, not customer results. Time at the door is 6 minutes per stop in both plans; only
          driving changes.
        </p>
      </div>
    </Chapter>
  );
}
