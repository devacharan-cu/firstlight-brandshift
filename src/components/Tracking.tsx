import { useEffect, useMemo, useState } from 'react';
import { Chapter } from './Chapter';
import { MiniMap } from './MiniMap';
import { clock, etasFor, getCity, requestPlan, useSim } from '../sim/store';
import { routeColor } from '../map/draw';
import { useNearViewport } from '../lib/hooks';
import type { RouteGeometry } from '../sim/plan';

interface Pick {
  van: number;
  order: number;
  seq: number; // index in `stops`
  stops: number[];
  geometry: RouteGeometry;
  etas: number[]; // seconds after midnight
  previousEta?: number;
  reason: 'closure' | 'planned';
}

/** Metres along the path at time `t`, following the planned schedule. */
function metresAt(p: Pick, t: number, service: number, speed: number): number {
  const at = (j: number) => p.geometry.cum[p.geometry.stopAt[j]];
  const start = p.etas[0] - at(0) / speed;
  if (t <= start) return 0;
  for (let j = 0; j < p.etas.length; j++) {
    if (t < p.etas[j]) {
      const fromM = j === 0 ? 0 : at(j - 1);
      const fromT = j === 0 ? start : p.etas[j - 1] + service;
      return fromM + Math.max(0, t - fromT) * speed;
    }
    if (t < p.etas[j] + service) return at(j);
  }
  const last = p.etas.length - 1;
  return Math.min(p.geometry.cum[p.geometry.cum.length - 1], at(last) + (t - p.etas[last] - service) * speed);
}

export function Tracking() {
  const city = getCity();
  const scenario = useSim((s) => s.scenario);
  const plan = useSim((s) => s.plan);
  const disruption = useSim((s) => s.disruption);
  const [ref, near] = useNearViewport<HTMLDivElement>('400px');
  const [time, setTime] = useState(13 * 3600 + 40 * 60);

  useEffect(() => {
    if (near && !plan) requestPlan().catch(() => {});
  }, [near, plan]);

  const pick = useMemo<Pick | null>(() => {
    if (!plan || !scenario) return null;
    // prefer a customer whose ETA moved because of the closure
    if (disruption) {
      // a representative affected customer: ETA moved 5+ minutes, due closest to 14:00
      let bestO = -1;
      let bestD = Infinity;
      for (let o = 0; o < disruption.etaAfter.length; o++) {
        const shift = Math.abs(disruption.etaAfter[o] - disruption.etaBefore[o]);
        const d = Math.abs(disruption.etaAfter[o] - 14 * 3600);
        if (shift >= 5 * 60 && d < bestD) {
          bestD = d;
          bestO = o;
        }
      }
      if (bestO >= 0) {
        const v = disruption.vanAfter[bestO];
        const geometry = disruption.replan.geometry[v];
        const stops = disruption.replan.routes[v];
        return {
          van: v,
          order: bestO,
          seq: stops.indexOf(bestO),
          stops,
          geometry,
          etas: etasFor(geometry, scenario),
          previousEta: disruption.etaBefore[bestO],
          reason: 'closure',
        };
      }
    }
    // otherwise, the delivery due closest to 14:30
    let best: Pick | null = null;
    let bd = Infinity;
    plan.optimized.routes.forEach((r, k) => {
      const etas = etasFor(plan.optimized.geometry[k], scenario);
      r.forEach((o, j) => {
        const dd = Math.abs(etas[j] - (14 * 3600 + 30 * 60));
        if (dd < bd && j > 2) {
          bd = dd;
          best = { van: k, order: o, seq: j, stops: r, geometry: plan.optimized.geometry[k], etas, reason: 'planned' };
        }
      });
    });
    return best;
  }, [plan, scenario, disruption]);

  useEffect(() => {
    if (pick) setTime(Math.max(12 * 3600, Math.round((pick.etas[pick.seq] - 40 * 60) / 60) * 60));
  }, [pick]);

  const order = pick && scenario ? scenario.orders[pick.order] : null;
  const eta = pick ? pick.etas[pick.seq] : 0;
  // the morning message carries the original window; a closure update carries the new one
  const firstEta = pick?.reason === 'closure' && pick.previousEta ? pick.previousEta : eta;
  const winStart = Math.floor(firstEta / 600) * 600;
  const service = scenario?.fleet.serviceSec ?? 360;
  const speed = scenario?.fleet.speedMps ?? 5;
  const metres = pick ? metresAt(pick, time, service, speed) : 0;
  const stopsAway = pick ? pick.etas.slice(0, pick.seq).filter((e) => e + service > time).length : 0;
  const delivered = pick ? time >= eta : false;
  const departed = pick ? time > pick.etas[0] - pick.geometry.cum[pick.geometry.stopAt[0]] / speed : false;

  const box = useMemo(() => {
    if (!pick) return undefined;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of pick.geometry.path) {
      x0 = Math.min(x0, city.x[n]);
      y0 = Math.min(y0, city.y[n]);
      x1 = Math.max(x1, city.x[n]);
      y1 = Math.max(y1, city.y[n]);
    }
    const pad = 500;
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }, [pick, city]);

  const layers = useMemo(
    () => (pick ? [{ path: pick.geometry.path, color: routeColor(pick.van), width: 2.6 }] : []),
    [pick],
  );
  const markers = useMemo(
    () =>
      pick && scenario
        ? [
            ...pick.stops.map((o) => ({ node: scenario.orders[o].node, kind: 'stop' as const, color: routeColor(pick.van) })),
            { node: scenario.depotNode, kind: 'depot' as const },
            { node: scenario.orders[pick.order].node, kind: 'target' as const },
            { node: 0, kind: 'van' as const, color: '#17140f', along: { path: pick.geometry.path, metres } },
          ]
        : [],
    [pick, scenario, metres],
  );

  let statusLine = '';
  if (pick) {
    if (delivered) statusLine = `Delivered at ${clock(eta)}`;
    else if (!departed) statusLine = 'Van is being loaded at the depot';
    else if (stopsAway === 0) statusLine = `Next stop is you · arriving about ${clock(eta)}`;
    else statusLine = `${stopsAway} stop${stopsAway > 1 ? 's' : ''} before yours · arriving about ${clock(eta)}`;
  }

  return (
    <Chapter clock="14:00" note="Customer view" title="Customers see a real arrival time, not a ‘today, 9 to 6’.">
      <p className="chapter__lede">
        Because the route is known stop by stop, every customer can get an honest window, and a corrected one when the day
        changes. Drag the time to follow the van.
      </p>
      <div className="track" ref={ref}>
        <div className="track__phone">
          {order && pick ? (
            <>
              <div className="bubble">
                <p className="bubble__from mono">Kesarnagar Wholesale</p>
                <p>
                  Hello {order.name}, your order {order.id} ({order.demand} crate{order.demand > 1 ? 's' : ''}) is on Van{' '}
                  {String(pick.van + 1).padStart(2, '0')} today. Expected{' '}
                  <strong>
                    {clock(winStart)}–{clock(winStart + 30 * 60)}
                  </strong>
                  .
                </p>
              </div>
              {pick.reason === 'closure' && pick.previousEta && (
                <div className="bubble bubble--update">
                  <p className="bubble__from mono">Update · 07:32</p>
                  <p>
                    {disruption?.bridgeName} is closed. Your new arrival time is about <strong>{clock(eta)}</strong> (was{' '}
                    {clock(pick.previousEta)}).
                  </p>
                </div>
              )}
              <div className="trackcard">
                <p className="mono trackcard__time">{clock(time)}</p>
                <p className="trackcard__status">{statusLine}</p>
                <p className="mono fineprint">
                  {order.street} · stop {pick.seq + 1} of {pick.stops.length} on this run
                </p>
              </div>
            </>
          ) : (
            <p className="mono">Planning routes…</p>
          )}
        </div>
        <div className="track__map">
          {pick && (
            <MiniMap
              layers={layers}
              markers={markers}
              box={box}
              label={`Van ${pick.van + 1}'s route with the customer's stop circled. ${statusLine}.`}
            />
          )}
          <div className="scrub">
            <label className="label" htmlFor="time-scrub">
              Time of day
            </label>
            <input
              id="time-scrub"
              type="range"
              min={8 * 3600}
              max={17 * 3600}
              step={60}
              value={time}
              onChange={(e) => setTime(+e.target.value)}
              aria-valuetext={clock(time)}
            />
            <div className="scrub__ticks mono" aria-hidden>
              <span>08:00</span>
              <span>12:30</span>
              <span>17:00</span>
            </div>
          </div>
          <p className="fineprint">
            Illustrative messages. A real deployment would need an SMS or WhatsApp Business provider; none is connected here. Van
            positions follow the planned schedule at 18 km/h, not live GPS.
          </p>
        </div>
      </div>
    </Chapter>
  );
}
