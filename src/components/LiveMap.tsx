import { useEffect, useMemo, useRef, useState } from 'react';
import { drawBase, fitBox, fitTransform, ink, pointAt, routeColor, screenRoute, sx, sy, type ScreenRoute, type Transform } from '../map/draw';
import { getCity, getState, metresAt, scheduleOf, subscribe, type VanSchedule } from '../sim/store';
import { nearestNode } from '../sim/city';
import { currentPaper } from '../lib/daylight';
import type { PlanView } from '../sim/plan';
import type { Scenario } from '../sim/scenario';

const NO_MARKS: number[] = [];

interface Props {
  view: PlanView;
  scenario: Scenario;
  /** van to emphasise; others fade */
  highlight?: number;
  /** fit the map to one van's route */
  focusVan?: number;
  onSelectVan?: (van: number) => void;
  label: string;
  className?: string;
  /** draw vans at the simulated time */
  vans?: boolean;
  /** when set, a click picks the nearest street junction instead of a route */
  onPick?: (node: number) => void;
  /** extra highlighted nodes (e.g. a new order waiting for a van) */
  marks?: number[];
}

/**
 * The live fleet map: routes, stops by status and vans at the simulated time.
 * Vans redraw on clock ticks straight from the store, without React renders.
 */
export function LiveMap({ view, scenario, highlight = -1, focusVan, onSelectVan, label, className = '', vans = true, onPick, marks = NO_MARKS }: Props) {
  const city = getCity();
  const wrap = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const top = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState<Transform | null>(null);

  const box = useMemo(() => {
    if (focusVan === undefined || !view.geometry[focusVan] || view.geometry[focusVan].path.length < 2) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of view.geometry[focusVan].path) {
      x0 = Math.min(x0, city.x[n]);
      y0 = Math.min(y0, city.y[n]);
      x1 = Math.max(x1, city.x[n]);
      y1 = Math.max(y1, city.y[n]);
    }
    return { x0: x0 - 600, y0: y0 - 600, x1: x1 + 600, y1: y1 + 600 };
  }, [focusVan, view, city]);

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const tr = box ? fitBox(w, h, dpr, box, 12) : fitTransform(city, w, h, dpr, 10);
      for (const c of [base.current!, top.current!]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const paint = () => drawBase(base.current!.getContext('2d')!, city, tr, w < 560 ? 'compact' : 'full');
      paint();
      document.fonts?.ready.then(paint).catch(() => {});
      setT(tr);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [city, box]);

  const data = useMemo(() => {
    if (!t) return null;
    const routes: ScreenRoute[] = view.geometry.map((g) => screenRoute(city, t, g.path));
    const sched: VanSchedule[] = scheduleOf(view, scenario);
    return { routes, sched };
  }, [t, view, scenario, city]);

  useEffect(() => {
    if (!t || !data) return;
    const ctx = top.current!.getContext('2d')!;
    let raf = 0;
    let lastSec = -1;
    let lastDelivered: Record<number, number> | null = null;
    const draw = () => {
      raf = 0;
      const s = getState();
      const now = s.sim.sec;
      if (now === lastSec && s.delivered === lastDelivered) return;
      lastSec = now;
      lastDelivered = s.delivered;
      ctx.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
      ctx.clearRect(0, 0, t.w, t.h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const paper = currentPaper();
      // routes
      data.routes.forEach((r, k) => {
        if (!view.routes[k].length) return;
        const dim = highlight >= 0 && highlight !== k;
        ctx.globalAlpha = dim ? 0.18 : 1;
        ctx.strokeStyle = paper;
        ctx.lineWidth = highlight === k ? 6 : 4;
        ctx.stroke(r.path);
        ctx.strokeStyle = routeColor(k);
        ctx.lineWidth = highlight === k ? 3 : 1.8;
        ctx.stroke(r.path);
      });
      ctx.globalAlpha = 1;
      // stops by status
      data.sched.forEach((sch, k) => {
        const dim = highlight >= 0 && highlight !== k;
        sch.stops.forEach((st) => {
          const o = scenario.orders[st.order];
          const x = sx(t, city.x[o.node]);
          const y = sy(t, city.y[o.node]);
          const done = s.delivered[st.order] !== undefined || now >= st.depart;
          ctx.globalAlpha = dim ? 0.2 : 1;
          ctx.beginPath();
          ctx.arc(x, y, done ? 2.2 : 3, 0, Math.PI * 2);
          ctx.fillStyle = done ? ink(0.35) : routeColor(k);
          ctx.fill();
          if (!done) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = paper;
            ctx.stroke();
          }
          if (o.urgent && !done) {
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.strokeStyle = '#c96a00';
            ctx.lineWidth = 1.6;
            ctx.stroke();
          }
        });
      });
      ctx.globalAlpha = 1;
      // depot
      const dx = sx(t, city.x[scenario.depotNode]);
      const dy = sy(t, city.y[scenario.depotNode]);
      ctx.fillStyle = '#17140f';
      ctx.fillRect(dx - 7, dy - 7, 14, 14);
      ctx.fillStyle = '#f2a93b';
      ctx.fillRect(dx - 3.5, dy - 3.5, 7, 7);
      // marks: orders waiting for a van
      for (const node of marks) {
        const mx = sx(t, city.x[node]);
        const my = sy(t, city.y[node]);
        ctx.beginPath();
        ctx.arc(mx, my, 9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(242, 169, 59, 0.35)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#b45f00';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mx, my, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#17140f';
        ctx.fill();
      }
      // vans
      if (vans) {
        data.sched.forEach((sch, k) => {
          if (!sch.stops.length) return;
          if (highlight >= 0 && highlight !== k) return;
          const g = view.geometry[k];
          const m = metresAt(sch, g, scenario, now);
          if (now <= sch.start || now >= sch.end) return;
          const [x, y, a] = pointAt(data.routes[k], m * t.scale);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a);
          ctx.fillStyle = routeColor(k);
          ctx.strokeStyle = paper;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(-7, -4.2, 14, 8.4, 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          ctx.font = '600 9px "Overpass Mono", monospace';
          ctx.fillStyle = ink(0.9);
          ctx.fillText(String(k + 1).padStart(2, '0'), x + 8, y - 6);
        });
      }
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    lastSec = -1;
    kick();
    const unsub = subscribe(kick);
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [t, data, view, scenario, highlight, vans, city, marks]);

  const onClick = (e: React.MouseEvent) => {
    if (!t || !data) return;
    const rect = wrap.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (onPick) {
      onPick(nearestNode(city, (px - t.ox) / t.scale, (py - t.oy) / t.scale));
      return;
    }
    if (!onSelectVan) return;
    // nearest route within 10px
    let best = -1;
    let bd = 12 * 12;
    data.routes.forEach((r, k) => {
      for (let i = 0; i < r.pts.length; i += 2) {
        const d = (r.pts[i] - px) ** 2 + (r.pts[i + 1] - py) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
    });
    if (best >= 0) onSelectVan(best);
  };

  return (
    <div ref={wrap} className={`livemap ${onPick ? 'is-picking' : ''} ${className}`} onClick={onClick}>
      <canvas ref={base} aria-hidden />
      <canvas ref={top} role="img" aria-label={label} />
    </div>
  );
}
