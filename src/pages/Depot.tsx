import { useCallback, useMemo, useState } from 'react';
import { PanoViewer, type ProjectFn } from '../components/PanoViewer';
import { PANORAMAS } from '../media.gen';
import { clock, pad, scheduleOf, useSim } from '../sim/store';
import { routeColor } from '../map/draw';
import { PROFILE_UNIT } from '../sim/scenario';
import { Link } from '../router';
import { useEnsurePlan } from '../app/common';
import { Credit, Plate } from '../components/media';

const CAM_H = 1.55; // assumed camera height above the floor, metres
// The open floor in front of the camera, measured against the photograph: lanes stay inside
// this rectangle so none of them runs up a wall or under the partitions.
const FLOOR_W = 6.4; // metres across
const GAP = 0.24;
const MAX_LANE_W = 1.1;
const X_SHIFT = 0.35; // the left partition stands closer to the camera than the right wall
const NEAR = 2.6;
const FAR = 5.7;

interface Lane {
  van: number;
  x0: number;
  x1: number;
}

function lanesFor(n: number): Lane[] {
  const LANE_W = Math.min(MAX_LANE_W, (FLOOR_W - (n - 1) * GAP) / Math.max(1, n));
  const total = n * LANE_W + (n - 1) * GAP;
  return Array.from({ length: n }, (_, i) => {
    const x0 = X_SHIFT - total / 2 + i * (LANE_W + GAP);
    return { van: i, x0, x1: x0 + LANE_W };
  });
}

export default function Depot() {
  useEnsurePlan();
  const scenario = useSim((s) => s.scenario);
  const live = useSim((s) => s.live);
  const profile = useSim((s) => s.settings.profile);
  const [showLanes, setShowLanes] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [, units] = PROFILE_UNIT[profile];
  const pano = PANORAMAS['warehouse-360'];
  // a phone's tall, narrow view starts wider and looking further down, so every lane is in frame
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
  const initial = narrow ? { yaw: 0, pitch: -0.3, fov: (100 * Math.PI) / 180 } : undefined;

  const used = useMemo(() => (live ? live.routes.map((r, k) => ({ r, k })).filter((x) => x.r.length) : []), [live]);
  const lanes = useMemo(() => lanesFor(used.length).map((l, i) => ({ ...l, van: used[i].k })), [used]);
  const sched = useMemo(() => (live && scenario ? scheduleOf(live, scenario) : []), [live, scenario]);

  const overlay = useCallback(
    (ctx: CanvasRenderingContext2D, project: ProjectFn) => {
      if (!showLanes || !live) return;
      for (const l of lanes) {
        const cap = scenario!.fleet.capacity;
        const load = live.stats.routes[l.van].load;
        const fill = Math.min(1, load / cap);
        const quad = (z0: number, z1: number) =>
          [
            project([l.x0, -CAM_H, z0]),
            project([l.x1, -CAM_H, z0]),
            project([l.x1, -CAM_H, z1]),
            project([l.x0, -CAM_H, z1]),
          ] as ([number, number] | null)[];
        const outline = quad(NEAR, FAR);
        if (outline.some((p) => !p)) continue;
        const pts = outline as [number, number][];
        const active = open === null || open === l.van;
        // lane outline
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fillStyle = active ? 'rgba(17, 14, 10, 0.18)' : 'rgba(17, 14, 10, 0.06)';
        ctx.fill();
        ctx.strokeStyle = routeColor(l.van);
        ctx.globalAlpha = active ? 1 : 0.35;
        ctx.lineWidth = 2;
        ctx.stroke();
        // staged load, filled from the door end: share of capacity
        const filled = quad(NEAR, NEAR + (FAR - NEAR) * fill);
        if (filled.every(Boolean)) {
          ctx.beginPath();
          (filled as [number, number][]).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fillStyle = routeColor(l.van);
          ctx.globalAlpha = active ? 0.55 : 0.18;
          ctx.fill();
        }
        // stop dividers: one tick per drop, last drop deepest
        const stops = live.routes[l.van].length;
        ctx.globalAlpha = active ? 0.8 : 0.25;
        ctx.strokeStyle = '#fff6e8';
        ctx.lineWidth = 1;
        for (let s = 1; s < stops; s++) {
          const z = NEAR + ((FAR - NEAR) * fill * s) / stops;
          const inset = (l.x1 - l.x0) * 0.14;
          const a = project([l.x0 + inset, -CAM_H, z]);
          const b = project([l.x1 - inset, -CAM_H, z]);
          if (a && b) {
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
    },
    [showLanes, lanes, live, scenario, open],
  );

  const fallback = (
    <figure className="pano-fallback">
      <img src="/media/warehouse-360-2048.webp" alt={pano.alt} width={2048} height={1024} loading="lazy" />
      <figcaption className="fineprint">This browser can’t display the interactive 360° view, so here is the flat panorama. The lanes are listed below.</figcaption>
    </figure>
  );

  const openLane = open !== null ? sched[open] : null;

  return (
    <div className="depotpage">
      <header className="pagehead pagehead--field">
        <div className="wrap">
          <p className="label">The depot floor · 360°</p>
          <h1>Your plan, laid out where the vans are loaded.</h1>
          <p className="pagehead__lede">
            A real warehouse photographed in 360°, with today’s plan projected onto its floor: one staging lane per van, filled to that van’s
            load, one tick per drop, last drop deepest so the first delivery is nearest the door.
          </p>
        </div>
      </header>

      <section className="wrap depot__stage" aria-label="360-degree depot view" data-clock="06:00">
        <PanoViewer
          src="/media/warehouse-360-4096.webp"
          srcSmall="/media/warehouse-360-2048.webp"
          lqip={pano.lqip}
          label={`${pano.alt} Today's plan is drawn on the floor as ${lanes.length} staging lanes.`}
          overlay={overlay}
          fallback={fallback}
          initial={initial}
        >
          {(_cam, project) =>
            showLanes &&
            project &&
            live &&
            lanes.map((l) => {
              const p = project([(l.x0 + l.x1) / 2, -CAM_H, NEAR]);
              if (!p) return null;
              return (
                <button
                  key={l.van}
                  className={`lanetag ${open === l.van ? 'is-open' : ''}`}
                  style={{ transform: `translate(${p[0]}px, ${p[1]}px)`, '--c': routeColor(l.van) } as React.CSSProperties}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen((o) => (o === l.van ? null : l.van));
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-pressed={open === l.van}
                  aria-label={`${pad(l.van + 1)}: lane for Van ${pad(l.van + 1)}, ${live.stats.routes[l.van].load} ${units}, ${live.routes[l.van].length} drops`}
                >
                  {pad(l.van + 1)}
                </button>
              );
            })
          }
        </PanoViewer>

        <div className="depot__bar">
          <button className={`chip ${showLanes ? 'is-on' : ''}`} aria-pressed={showLanes} onClick={() => setShowLanes((s) => !s)}>
            {showLanes ? 'Hide' : 'Show'} the plan on the floor
          </button>
          <p className="fineprint">
            360° photograph: <a href={pano.page} target="_blank" rel="noopener noreferrer">{pano.credit}</a> · CC0. An empty hall, not a
            working depot and not a Firstlight site. Lanes are an illustrative projection: the floor’s scale is estimated.
          </p>
        </div>

        {openLane && live && scenario && (
          <aside className="lanecard" aria-live="polite">
            <p className="label" style={{ color: routeColor(openLane.van) }}>
              Lane {pad(openLane.van + 1)}
            </p>
            <p className="lanecard__title">
              Van {pad(openLane.van + 1)} · {live.stats.routes[openLane.van].load}/{scenario.fleet.capacity} {units} · leaves {clock(openLane.start)}
            </p>
            <ol className="lanecard__list">
              {[...openLane.stops].reverse().map((st, i) => (
                <li key={st.order}>
                  <span className="mono">{openLane.stops.length - i}</span> {scenario.orders[st.order].name}
                  <span className="mono muted"> · {scenario.orders[st.order].demand}</span>
                </li>
              ))}
            </ol>
            <p className="fineprint">Listed in loading order: the last drop goes in first, deepest in the van.</p>
            <Link to={`/app/fleet?van=${openLane.van + 1}`}>This van in the console →</Link>
          </aside>
        )}
      </section>

      <section className="wrap depot__table" aria-labelledby="lanes-title">
        <h2 id="lanes-title" className="section-title">
          Staging lanes for today
        </h2>
        <p className="section-lede">The same lanes as a table, from the live plan in the console.</p>
        {live && scenario ? (
          <div className="table-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th scope="col">Lane</th>
                  <th scope="col" className="num">
                    Drops
                  </th>
                  <th scope="col" className="num">
                    Load
                  </th>
                  <th scope="col">Loaded first (last drop)</th>
                  <th scope="col">Loaded last (first drop)</th>
                  <th scope="col" className="num">
                    Leaves
                  </th>
                </tr>
              </thead>
              <tbody>
                {used.map(({ k, r }) => (
                  <tr key={k}>
                    <th scope="row">
                      <span className="vanchip">
                        <i style={{ background: routeColor(k) }} aria-hidden />
                        Van {pad(k + 1)}
                      </span>
                    </th>
                    <td className="num mono">{r.length}</td>
                    <td className="num mono">
                      {live.stats.routes[k].load}/{scenario.fleet.capacity}
                    </td>
                    <td>{scenario.orders[r[r.length - 1]].name}</td>
                    <td>{scenario.orders[r[0]].name}</td>
                    <td className="num mono">{clock(sched[k]?.start ?? scenario.fleet.shiftStartSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mono">Planning today’s routes…</p>
        )}
      </section>

      <section className="wrap depot__why" aria-labelledby="why-lanes">
        <div>
          <h2 id="why-lanes" className="section-title">
            Why lanes, and why in reverse
          </h2>
          <p className="section-lede">
            A van loaded in delivery order buries its first drop behind everything else. Staged last-drop-first, the next delivery is always the
            crate nearest the door, and a loader can check a lane against the sheet at a glance.
          </p>
          <p className="depot__links">
            <Link to="/app/driver">See the load sheet in the driver app →</Link>
            <Link to="/app/fleet">Rebalance vans in the console →</Link>
          </p>
        </div>
        <Plate id="forklift" no="05" title="Staging before the doors open" ratio="4 / 3" />
      </section>
      <p className="wrap fineprint">
        Credits: <Credit kind="photo" id="forklift" />
      </p>
    </div>
  );
}
