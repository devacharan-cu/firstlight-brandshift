import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addUrgentOrder,
  clock,
  getCity,
  moveDepot,
  requestPlan,
  resetScenario,
  routeEtas,
  useSim,
} from '../sim/store';
import { drawBase, fitTransform, ink, pointAt, routeColor, routeDash, screenRoute, strokePartial, sx, sy, type ScreenRoute, type Transform } from '../map/draw';
import { nearestNode } from '../sim/city';
import { mulberry32 } from '../sim/rng';
import { LAMBDAS } from '../sim/solver';
import { currentPaper } from '../lib/daylight';
import { fmtH, fmtKm, useReducedMotion, useTween } from '../lib/hooks';
import type { ProgressPhase } from '../sim/protocol';
import { PROFILE_UNIT } from '../sim/scenario';

const FULL = { ghost: 0.12, fadeMs: 750, delay: 420, stagger: 115, draw: 1400 };
const SHORT = { ghost: 0.12, fadeMs: 300, delay: 120, stagger: 50, draw: 800 };
const MAX_URGENT = 12;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PHASE_TEXT: Record<ProgressPhase, (k: number, of: number, n: number) => string> = {
  matrix: (_k, _of, n) => `Measuring road distances between ${n + 1} locations`,
  baseline: () => 'Rebuilding the manual plan for comparison',
  savings: (k, of) => `Building routes by savings — start ${k + 1} of ${of}`,
  improve: (k, of) => `Improving with 2-opt, relocate and swap — start ${k + 1} of ${of}`,
  geometry: () => 'Tracing every route onto the streets',
  done: () => 'Choosing the best plan',
};

function nearestDistrict(x: number, y: number) {
  const city = getCity();
  let best = city.districts[0];
  let bd = Infinity;
  for (const d of city.districts) {
    const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
    if (dd < bd) {
      bd = dd;
      best = d;
    }
  }
  return best.name;
}

interface Hover {
  i: number;
  x: number;
  y: number;
}

export function Untangle({ compact, startRevealed = false }: { compact: boolean; startRevealed?: boolean }) {
  const city = getCity();
  const scenario = useSim((s) => s.scenario);
  const baseline = useSim((s) => s.baseline);
  const plan = useSim((s) => s.plan);
  const status = useSim((s) => s.planStatus);
  const progress = useSim((s) => s.progress);
  const roundTrip = useSim((s) => s.roundTripMs);
  const error = useSim((s) => s.error);
  const urgentCount = useSim((s) => s.urgentCount);
  const reduced = useReducedMotion();

  const [view, setView] = useState<'baseline' | 'optimized'>('baseline');
  const [revealed, setRevealed] = useState(false);
  const settingsProfile = useSim((s) => s.settings.profile);
  const [intro, setIntro] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const [highlight, setHighlight] = useState(-1);
  const [dragNode, setDragNode] = useState<number | null>(null);
  const [live, setLive] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const firstToolRef = useRef<HTMLButtonElement>(null);
  const focusTools = useRef(false);
  const [transform, setTransform] = useState<Transform | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<{ start: number; cfg: typeof FULL } | null>(null);
  const firstRef = useRef(true);
  const rafRef = useRef(0);
  const visibleRef = useRef(true);
  const keyTimer = useRef<number>(0);

  // ── layout ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const t = fitTransform(city, w, h, dpr, compact ? 6 : 14);
      for (const c of [baseRef.current!, sceneRef.current!]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const draw = () => drawBase(baseRef.current!.getContext('2d')!, city, t, compact ? 'compact' : 'full');
      draw();
      // redraw labels once webfonts are ready
      document.fonts?.ready.then(draw).catch(() => {});
      setTransform(t);
    });
    ro.observe(wrap);
    const io = new IntersectionObserver((es) => {
      visibleRef.current = es.some((e) => e.isIntersecting);
      if (visibleRef.current) kick();
    });
    io.observe(wrap);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, compact]);

  // ── screen-space data ─────────────────────────────────────────────────────
  const stopsXY = useMemo(() => {
    if (!scenario || !transform) return null;
    const a = new Float32Array(scenario.orders.length * 2);
    scenario.orders.forEach((o, i) => {
      a[2 * i] = sx(transform, city.x[o.node]);
      a[2 * i + 1] = sy(transform, city.y[o.node]);
    });
    return a;
  }, [scenario, transform, city]);

  const baseRoutes = useMemo<ScreenRoute[] | null>(() => {
    if (!baseline || !transform) return null;
    const n = baseline.geometry.length;
    return baseline.geometry.map((g, k) => screenRoute(city, transform, g.path, (k - (n - 1) / 2) * 0.9));
  }, [baseline, transform, city]);

  const opt = useMemo(() => {
    if (!plan || !transform) return null;
    const n = plan.n;
    const stopRoute = new Int16Array(n).fill(-1);
    const stopFrac = new Float32Array(n);
    const stopSeq = new Int16Array(n);
    plan.optimized.routes.forEach((r, k) => {
      const g = plan.optimized.geometry[k];
      const total = g.cum[g.cum.length - 1] || 1;
      r.forEach((o, j) => {
        stopRoute[o] = k;
        stopFrac[o] = g.cum[g.stopAt[j]] / total;
        stopSeq[o] = j;
      });
    });
    const routes = plan.optimized.geometry.map((g) => screenRoute(city, transform, g.path));
    // van badge at the point of each route farthest from the depot
    const badges = routes.map((r) => {
      let bi = 0;
      let bd = -1;
      for (let k = 0; k < r.pts.length / 2; k++) {
        const d = (r.pts[2 * k] - r.pts[0]) ** 2 + (r.pts[2 * k + 1] - r.pts[1]) ** 2;
        if (d > bd) {
          bd = d;
          bi = k;
        }
      }
      return [r.pts[2 * bi], r.pts[2 * bi + 1]] as [number, number];
    });
    return { routes, stopRoute, stopFrac, stopSeq, badges };
  }, [plan, transform, city]);

  const data = useRef({ stopsXY, baseRoutes, opt, view, highlight, hover, reduced, scenario });
  data.current = { stopsXY, baseRoutes, opt, view, highlight, hover, reduced, scenario };

  // ── draw loop ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    rafRef.current = 0;
    const canvas = sceneRef.current;
    const t = canvas && (canvas as HTMLCanvasElement & { _t?: Transform })._t;
    if (!canvas || !t) return;
    const ctx = canvas.getContext('2d')!;
    const d = data.current;
    ctx.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
    ctx.clearRect(0, 0, t.w, t.h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const now = performance.now();
    const anim = animRef.current;
    const cfg = anim?.cfg ?? FULL;
    const el = anim ? now - anim.start : Infinity;
    const showOpt = d.view === 'optimized' && !!d.opt;
    let still = false;

    // manual plan — the tangle
    if (d.baseRoutes) {
      const a = !showOpt ? 1 : d.reduced || !anim ? cfg.ghost : 1 + (cfg.ghost - 1) * easeInOut(clamp01(el / cfg.fadeMs));
      if (anim && el < cfg.fadeMs) still = true;
      ctx.lineWidth = compact ? 1 : 1.35;
      ctx.strokeStyle = ink(0.78 * a);
      d.baseRoutes.forEach((r, k) => {
        if (!showOpt && d.highlight === k) return;
        ctx.stroke(r.path);
      });
      if (!showOpt && d.highlight >= 0 && d.baseRoutes[d.highlight]) {
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = ink(0.92);
        ctx.stroke(d.baseRoutes[d.highlight].path);
      }
    }

    // optimised routes
    const prog: number[] = [];
    if (showOpt && d.opt) {
      const paper = currentPaper();
      d.opt.routes.forEach((r, k) => {
        const p = d.reduced || !anim ? 1 : easeInOut(clamp01((el - cfg.delay - k * cfg.stagger) / cfg.draw));
        prog[k] = p;
        if (p < 1) still = true;
        const dim = d.highlight >= 0 && d.highlight !== k;
        ctx.globalAlpha = dim ? 0.16 : 1;
        ctx.strokeStyle = paper;
        ctx.lineWidth = compact ? 3.6 : 5;
        strokePartial(ctx, r, p);
        ctx.strokeStyle = routeColor(k);
        ctx.lineWidth = d.highlight === k ? (compact ? 2.8 : 3.4) : compact ? 1.8 : 2.3;
        strokePartial(ctx, r, p, routeDash(k));
      });
      ctx.globalAlpha = 1;
    }

    // stops
    const xy = d.stopsXY;
    if (xy && d.scenario) {
      const n = xy.length / 2;
      const r0 = compact ? 1.6 : 2;
      // uncoloured stops in one batched path
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const rk = showOpt && d.opt ? d.opt.stopRoute[i] : -1;
        if (rk >= 0 && prog[rk] >= d.opt!.stopFrac[i]) continue;
        ctx.moveTo(xy[2 * i] + r0, xy[2 * i + 1]);
        ctx.arc(xy[2 * i], xy[2 * i + 1], r0, 0, Math.PI * 2);
      }
      ctx.fillStyle = ink(0.8);
      ctx.fill();
      if (showOpt && d.opt) {
        const paper = currentPaper();
        for (let i = 0; i < n; i++) {
          const rk = d.opt.stopRoute[i];
          if (rk < 0) continue;
          const p = prog[rk];
          const f = d.opt.stopFrac[i];
          if (p < f) continue;
          const pop = d.reduced ? 0 : clamp01(1 - (p - f) / 0.07);
          const rad = (compact ? 2.3 : 2.9) + pop * 2.6;
          ctx.globalAlpha = d.highlight >= 0 && d.highlight !== rk ? 0.2 : 1;
          ctx.beginPath();
          ctx.arc(xy[2 * i], xy[2 * i + 1], rad, 0, Math.PI * 2);
          ctx.fillStyle = routeColor(rk);
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = paper;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // urgent rings
      const pulse = d.reduced ? 0 : (Math.sin(now / 260) + 1) / 2;
      let anyUrgent = false;
      d.scenario.orders.forEach((o, i) => {
        if (!o.urgent) return;
        anyUrgent = true;
        ctx.beginPath();
        ctx.arc(xy[2 * i], xy[2 * i + 1], 6.5 + pulse * 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#c96a00';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      });
      if (anyUrgent && !d.reduced) still = true;
    }

    // van numbers — identity never rests on colour alone
    if (showOpt && d.opt && !compact) {
      ctx.font = '600 9.5px "Overpass Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      d.opt.badges.forEach(([x, y], k) => {
        if ((prog[k] ?? 0) < 1) return;
        if (d.highlight >= 0 && d.highlight !== k) return;
        const label = String(k + 1).padStart(2, '0');
        ctx.beginPath();
        ctx.roundRect(x - 11, y - 18, 22, 14, 2);
        ctx.fillStyle = currentPaper();
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = routeColor(k);
        ctx.stroke();
        ctx.fillStyle = ink(0.92);
        ctx.fillText(label, x, y - 10.5);
      });
    }

    // vans in motion once the plan has settled
    if (showOpt && d.opt && !still && !d.reduced) {
      const paper = currentPaper();
      d.opt.routes.forEach((r, k) => {
        if (d.highlight >= 0 && d.highlight !== k) return;
        const dist = ((now / 1000) * (compact ? 14 : 22) + k * 97) % r.length;
        const [x, y, a] = pointAt(r, dist);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = routeColor(k);
        ctx.strokeStyle = paper;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(-4.5, -2.6, 9, 5.2, 1.4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
      if (visibleRef.current) still = true;
    }

    if (anim && !(prog.some((p) => p < 1) || el < cfg.fadeMs)) {
      animRef.current = null;
      setAnimating(false);
    }
    if (still && visibleRef.current) rafRef.current = requestAnimationFrame(draw);
  }, [compact]);

  const kick = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    if (sceneRef.current && transform) (sceneRef.current as HTMLCanvasElement & { _t?: Transform })._t = transform;
    kick();
  });

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    },
    [],
  );

  // ── orchestration ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!plan || !revealed) {
      setView('baseline');
      return;
    }
    animRef.current = { start: performance.now(), cfg: firstRef.current ? FULL : SHORT };
    firstRef.current = false;
    setAnimating(!reduced);
    setView('optimized');
    const s = plan.optimized.stats;
    const b = plan.baseline.stats;
    setLive(
      `Planned: ${s.vans} vans and ${fmtKm(s.distance)} kilometres, compared with ${b.vans} vans and ${fmtKm(b.distance)} kilometres in the manual plan.`,
    );
  }, [plan, revealed, reduced]);

  // in the console the planner opens on the solved plan, animating once it arrives
  useEffect(() => {
    if (startRevealed && plan && !revealed) setRevealed(true);
  }, [startRevealed, plan, revealed]);

  // after an edit, re-plan automatically once the visitor has seen the optimiser
  useEffect(() => {
    if (revealed && !plan && baseline && status === 'idle') requestPlan().catch(() => {});
  }, [revealed, plan, baseline, status]);

  const runPlan = async () => {
    if (intro || status === 'solving') return;
    // the Plan button is replaced by the toolbar; keep keyboard focus in the same place
    focusTools.current = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('btn--plan');
    setIntro(true);
    try {
      await Promise.all([requestPlan(), sleep(reduced ? 0 : 700)]);
      setRevealed(true);
    } catch {
      /* status shows the error */
    } finally {
      setIntro(false);
    }
  };

  const reset = () => {
    resetScenario();
    setRevealed(false);
    setAddMode(false);
    setHighlight(-1);
    firstRef.current = true;
    setLive('Scenario reset to the original 300 orders and depot.');
  };

  // ── pointer: hover + add urgent ───────────────────────────────────────────
  const toWorld = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const t = transform!;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return { px, py, x: (px - t.ox) / t.scale, y: (py - t.oy) / t.scale };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!stopsXY || !transform || e.pointerType === 'touch') return;
    const { px, py } = toWorld(e);
    let best = -1;
    let bd = 14 * 14;
    for (let i = 0; i < stopsXY.length / 2; i++) {
      const dd = (stopsXY[2 * i] - px) ** 2 + (stopsXY[2 * i + 1] - py) ** 2;
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    }
    if (best < 0) {
      if (hover) setHover(null);
      if (highlight >= 0 && hover) setHighlight(-1);
      return;
    }
    setHover({ i: best, x: stopsXY[2 * best], y: stopsXY[2 * best + 1] });
    if (view === 'optimized' && opt) setHighlight(opt.stopRoute[best]);
  };

  const placeUrgent = (node: number) => {
    if (!scenario) return;
    if (urgentCount >= MAX_URGENT) {
      setLive(`The demo allows up to ${MAX_URGENT} urgent orders. Reset to start again.`);
      return;
    }
    const used = new Set([scenario.depotNode, ...scenario.orders.map((o) => o.node)]);
    const free = used.has(node) ? nearestNode(city, city.x[node], city.y[node], used) : node;
    if (addUrgentOrder(free)) {
      setAddMode(false);
      setLive(`Urgent order added near ${nearestDistrict(city.x[free], city.y[free])}. Re-planning all routes.`);
    }
  };

  const onClick = (e: React.MouseEvent) => {
    if (!addMode || !transform) return;
    const { x, y } = toWorld(e);
    placeUrgent(nearestNode(city, x, y));
  };

  useEffect(() => {
    if (revealed && focusTools.current) {
      focusTools.current = false;
      firstToolRef.current?.focus();
    }
  });

  const placeRandom = () => {
    focusTools.current = true;
    const rand = mulberry32(4242 + urgentCount);
    const x = city.width * (0.3 + rand() * 0.45);
    const y = city.height * (0.2 + rand() * 0.6);
    placeUrgent(nearestNode(city, x, y));
  };

  // ── depot handle ──────────────────────────────────────────────────────────
  const depotNode = dragNode ?? scenario?.depotNode ?? -1;
  const onDepotDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragNode(scenario!.depotNode);
  };
  const onDepotMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragNode === null || !transform) return;
    const { x, y } = toWorld(e);
    const n = nearestNode(city, x, y);
    if (n !== dragNode) setDragNode(n);
  };
  const commitDepot = (node: number) => {
    setDragNode(null);
    if (scenario && node !== scenario.depotNode) {
      moveDepot(node);
      setLive(`Depot moved near ${nearestDistrict(city.x[node], city.y[node])}. Re-planning both plans.`);
    }
  };
  const onDepotUp = () => {
    if (dragNode !== null) commitDepot(dragNode);
  };
  const onDepotKey = (e: React.KeyboardEvent) => {
    const step = 420;
    const dirs: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const dv = dirs[e.key];
    if (!dv || !scenario) return;
    e.preventDefault();
    const cur = dragNode ?? scenario.depotNode;
    const n = nearestNode(city, city.x[cur] + dv[0], city.y[cur] + dv[1]);
    setDragNode(n);
    window.clearTimeout(keyTimer.current);
    keyTimer.current = window.setTimeout(() => commitDepot(n), 700);
  };

  // ── derived UI ────────────────────────────────────────────────────────────
  const n = scenario?.orders.length ?? 0;
  const solving = intro || status === 'solving';
  const bStats = plan?.baseline.stats ?? baseline?.stats ?? null;
  const oStats = view === 'optimized' && plan ? plan.optimized.stats : null;

  let statusText: string;
  let statusKind: 'idle' | 'busy' | 'done' | 'warn' = 'idle';
  if (status === 'error') {
    statusText = `The planner stopped: ${error ?? 'unknown error'}. Reset to try again.`;
    statusKind = 'warn';
  } else if (solving) {
    statusKind = 'busy';
    statusText = progress ? PHASE_TEXT[progress.phase](progress.k, progress.of, n) : `Sending ${n} orders to the planner`;
  } else if (!baseline) {
    statusKind = 'busy';
    statusText = `Loading ${n || '…'} orders and the manual plan`;
  } else if (oStats && plan) {
    const moves =
      plan.counters.twoOpt + plan.counters.relocate + plan.counters.swap + plan.counters.twoOptStar + plan.counters.eliminated;
    statusKind = oStats.feasible ? 'done' : 'warn';
    statusText = oStats.feasible
      ? `Planned in ${((roundTrip ?? plan.timings.totalMs) / 1000).toFixed(2)} s on this device · best of ${LAMBDAS.length} starts · ${moves.toLocaleString('en-IN')} improving moves`
      : `Plan needs ${oStats.vans} vans; the fleet has ${scenario?.fleet.vans}. Remove urgent orders or reset.`;
  } else {
    statusText = `Manual plan loaded — ${bStats?.vans ?? '…'} vans, ${bStats ? fmtKm(bStats.distance) : '…'} km. Ready to plan.`;
  }

  const hoverOrder = hover && scenario ? scenario.orders[hover.i] : null;
  let hoverMeta = '';
  if (hover && hoverOrder && plan && view === 'optimized' && opt && scenario) {
    const r = opt.stopRoute[hover.i];
    const seq = opt.stopSeq[hover.i];
    const eta = routeEtas(plan, r, scenario)[seq];
    hoverMeta = `Van ${String(r + 1).padStart(2, '0')} · stop ${seq + 1} · ETA ${clock(eta)}`;
  } else if (hoverOrder) {
    hoverMeta = 'Manual plan';
  }

  const depotStyle =
    transform && depotNode >= 0
      ? { transform: `translate(${sx(transform, city.x[depotNode])}px, ${sy(transform, city.y[depotNode])}px)` }
      : { display: 'none' };

  return (
    <div className={`untangle ${view === 'optimized' ? 'is-lit' : ''} ${compact ? 'is-compact' : ''}`}>
      <div className="untangle__panel">
        <div className="untangle__actions">
          {!revealed ? (
            <button className="btn btn--primary btn--plan" onClick={runPlan} disabled={!baseline || solving} aria-describedby="plan-status">
              <span className="btn__label">{solving ? 'Planning…' : 'Plan routes'}</span>
              <span className="btn__meta">
                {n} orders · {scenario?.fleet.vans ?? 16} vans
              </span>
            </button>
          ) : (
            <div className="toolrow" role="group" aria-label="Change the scenario">
              <button
                ref={firstToolRef}
                className={`chip ${addMode ? 'is-on' : ''}`}
                aria-pressed={addMode}
                onClick={() => {
                  if (!solving && urgentCount < MAX_URGENT) setAddMode((m) => !m);
                }}
                aria-disabled={solving || urgentCount >= MAX_URGENT || undefined}
              >
                <span className="chip__ring" aria-hidden /> Add urgent order
              </button>
              <button className="chip" onClick={() => !solving && reset()} aria-disabled={solving || undefined}>
                ↺ Reset
              </button>
            </div>
          )}
          <p className={`hint ${revealed ? '' : 'hint--pre'}`}>
            {revealed
              ? addMode
                ? (
                    <>
                      {compact ? 'Tap' : 'Click'} the map to place it, or{' '}
                      <button className="linkish" onClick={placeRandom}>
                        place one for me
                      </button>
                      .
                    </>
                  )
                : <>Drag the <span className="depot-glyph" aria-hidden /> depot, or focus it and use arrow keys. Everything re-plans.</>
              : 'Runs a real routing solver in your browser.'}
          </p>
        </div>

        <div id="plan-status" className={`status status--${statusKind}`} role="status" aria-live="polite">
          <span className="status__dot" aria-hidden />
          <span>{statusText}</span>
        </div>

        {compact && (
          <div className="sheetbar">
            <p className="sheetbar__sum mono">
              {oStats && bStats
                ? `${fmtKm(oStats.distance)} km vs ${fmtKm(bStats.distance)} km · ${oStats.vans} vs ${bStats.vans} vans`
                : bStats
                  ? `Manual: ${fmtKm(bStats.distance)} km · ${bStats.vans} vans`
                  : ''}
            </p>
            <button className="sheettoggle" aria-expanded={sheetOpen} aria-controls="plan-details" onClick={() => setSheetOpen((o) => !o)}>
              {sheetOpen ? 'Hide comparison ▾' : 'Compare plans ▴'}
            </button>
          </div>
        )}

        <div id="plan-details" className={`untangle__details ${sheetOpen ? 'is-open' : ''}`}>
          <Comparison base={bStats} opt={oStats} fleet={scenario?.fleet.vans ?? 16} capacity={scenario?.fleet.capacity ?? 90} animate={animating} />
        </div>
      </div>

      <figure className="sheet">
        <div className="sheet__head">
          <span className="mono">
            {compact ? `Sheet 01 · ${n} orders` : `Sheet 01 · Kesarnagar · ${n} orders for Friday`}
          </span>
          {plan && revealed && (
            <div className="seg" role="group" aria-label="Which plan to show">
              <button aria-pressed={view === 'baseline'} onClick={() => setView('baseline')}>
                Manual
              </button>
              <button aria-pressed={view === 'optimized'} onClick={() => setView('optimized')}>
                Firstlight
              </button>
            </div>
          )}
        </div>
        <div
          ref={wrapRef}
          className={`sheet__map ${addMode ? 'is-adding' : ''} ${solving ? 'is-solving' : ''}`}
          onPointerMove={onMove}
          onPointerLeave={() => {
            setHover(null);
            setHighlight(-1);
          }}
          onClick={onClick}
        >
          <canvas ref={baseRef} className="sheet__canvas" aria-hidden />
          <canvas
            ref={sceneRef}
            className="sheet__canvas"
            role="img"
            aria-label={
              oStats
                ? `Map of Kesarnagar showing ${oStats.vans} colour-coded optimised van routes from the depot. Full details are in the dispatch sheet below.`
                : `Map of Kesarnagar with ${n} delivery stops and a tangled manual plan of ${bStats?.vans ?? ''} van routes.`
            }
          />
          <button
            className={`depot ${dragNode !== null ? 'is-dragging' : ''}`}
            style={depotStyle}
            onPointerDown={onDepotDown}
            onPointerMove={onDepotMove}
            onPointerUp={onDepotUp}
            onKeyDown={onDepotKey}
            aria-label={`Depot near ${depotNode >= 0 ? nearestDistrict(city.x[depotNode], city.y[depotNode]) : ''}. Drag, or use arrow keys to move it.`}
          >
            <span className="depot__mark" aria-hidden />
            <span className="depot__label" aria-hidden>
              Depot
            </span>
          </button>
          {hover && hoverOrder && (
            <div className="tip" style={{ transform: `translate(${hover.x}px, ${hover.y}px)` }} aria-hidden>
              <strong>{hoverOrder.name}</strong>
              <span>{hoverOrder.street}</span>
              <span className="mono">
                {hoverOrder.id} · {hoverOrder.demand} crate{hoverOrder.demand > 1 ? 's' : ''}
                {hoverOrder.urgent ? ' · urgent' : ''}
              </span>
              <span className="mono">{hoverMeta}</span>
            </div>
          )}
          <div className="sheet__scale mono" aria-hidden>
            <span style={{ width: transform ? `${transform.scale * 1000}px` : 0 }} /> 1 km
          </div>
          <div className="sheet__north mono" aria-hidden>
            N<span>↑</span>
          </div>
          {solving && <div className="sheet__scan" aria-hidden />}
        </div>
        <figcaption className="sheet__note">
          Simulation. {n} generated orders on Kesarnagar, a procedurally generated fictional city. Distances are shortest paths on
          its street graph; vans average {scenario ? Math.round(scenario.fleet.speedMps * 3.6) : 18} km/h with{' '}
          {scenario ? scenario.fleet.serviceSec / 60 : 6} minutes per stop, {scenario?.fleet.capacity ?? 90}{' '}
          {PROFILE_UNIT[settingsProfile][1]} and a {scenario ? scenario.fleet.shiftSec / 3600 : 9}-hour shift. Figures compare two plans
          for the same orders and are not customer results.
        </figcaption>
      </figure>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  );
}

function Comparison({
  base,
  opt,
  fleet,
  capacity,
  animate,
}: {
  base: import('../sim/solver').PlanStats | null;
  opt: import('../sim/solver').PlanStats | null;
  fleet: number;
  capacity: number;
  animate: boolean;
}) {
  const km = useTween(opt ? opt.distance : base?.distance ?? 0, animate ? 1900 : 500, animate ? 400 : 0);
  const vans = useTween(opt ? opt.vans : base?.vans ?? 0, animate ? 1900 : 500, animate ? 400 : 0);
  const hours = useTween(opt ? opt.duration : base?.duration ?? 0, animate ? 1900 : 500, animate ? 400 : 0);
  const load = (s: import('../sim/solver').PlanStats) => (s.load / (s.vans * capacity)) * 100;
  const loadT = useTween(opt ? load(opt) : base ? load(base) : 0, animate ? 1900 : 500, animate ? 400 : 0);
  const pct = base && opt ? ((opt.distance - base.distance) / base.distance) * 100 : null;

  return (
    <table className="compare">
      <caption className="sr-only">Manual plan compared with the Firstlight plan for the same orders</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">Measure</span>
          </th>
          <th scope="col">Manual plan</th>
          <th scope="col" className="compare__fl">
            Firstlight
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Distance</th>
          <td>{base ? `${fmtKm(base.distance)} km` : '—'}</td>
          <td className="compare__fl">
            {opt ? (
              <>
                <span className="compare__big">{fmtKm(km)}</span> km
              </>
            ) : (
              '—'
            )}
          </td>
        </tr>
        <tr>
          <th scope="row">Vans used</th>
          <td>{base ? `${base.vans} of ${fleet}` : '—'}</td>
          <td className="compare__fl">{opt ? `${Math.round(vans)} of ${fleet}` : '—'}</td>
        </tr>
        <tr>
          <th scope="row">Van-hours</th>
          <td>{base ? `${fmtH(base.duration)} h` : '—'}</td>
          <td className="compare__fl">{opt ? `${fmtH(hours)} h` : '—'}</td>
        </tr>
        <tr>
          <th scope="row">Avg. load</th>
          <td>{base ? `${Math.round(load(base))}%` : '—'}</td>
          <td className="compare__fl">{opt ? `${Math.round(loadT)}%` : '—'}</td>
        </tr>
      </tbody>
      {pct !== null && (
        <tfoot>
          <tr>
            <td colSpan={3}>
              <span className="delta">{pct.toFixed(1)}% distance</span>
              <span className="delta">−{base!.vans - opt!.vans} vans</span>
              <span className="delta">
                −{fmtH(base!.duration - opt!.duration)} van-hours
              </span>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
