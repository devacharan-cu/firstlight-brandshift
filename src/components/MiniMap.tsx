import { useEffect, useRef, useState } from 'react';
import { getCity } from '../sim/store';
import { drawBase, fitBox, fitTransform, ink, pointAt, screenRoute, sx, sy, type Transform } from '../map/draw';
import { currentPaper } from '../lib/daylight';

export interface MapLayer {
  path: Int32Array;
  color: string;
  width?: number;
  dash?: number[];
  alpha?: number;
}

export interface MapMarker {
  node: number;
  kind: 'stop' | 'depot' | 'target' | 'closed' | 'van';
  /** world position overriding the node (e.g. a bridge midpoint) */
  at?: [number, number];
  color?: string;
  /** for vans: distance along `along` layer path (metres) */
  along?: { path: Int32Array; metres: number };
}

interface Props {
  layers: MapLayer[];
  markers?: MapMarker[];
  box?: { x0: number; y0: number; x1: number; y1: number };
  label: string;
  className?: string;
}

/** Small static map for story chapters. Redraws only when its inputs change. */
export function MiniMap({ layers, markers = [], box, label, className }: Props) {
  const city = getCity();
  const wrap = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const top = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState<Transform | null>(null);

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const tr = box ? fitBox(w, h, dpr, box, 10) : fitTransform(city, w, h, dpr, 8);
      for (const c of [base.current!, top.current!]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const paint = () => drawBase(base.current!.getContext('2d')!, city, tr, w < 520 ? 'compact' : 'full');
      paint();
      document.fonts?.ready.then(paint).catch(() => {});
      setT(tr);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [city, box]);

  useEffect(() => {
    if (!t) return;
    const ctx = top.current!.getContext('2d')!;
    ctx.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
    ctx.clearRect(0, 0, t.w, t.h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const paper = currentPaper();
    for (const l of layers) {
      const r = screenRoute(city, t, l.path);
      ctx.globalAlpha = l.alpha ?? 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = paper;
      ctx.lineWidth = (l.width ?? 2.4) + 2.6;
      ctx.stroke(r.path);
      ctx.setLineDash(l.dash ?? []);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.width ?? 2.4;
      ctx.stroke(r.path);
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    for (const m of markers) {
      let x = m.at ? sx(t, m.at[0]) : sx(t, city.x[m.node]);
      let y = m.at ? sy(t, m.at[1]) : sy(t, city.y[m.node]);
      if (m.kind === 'van' && m.along) {
        const r = screenRoute(city, t, m.along.path);
        const total = r.length;
        // metres → screen length (uniform scale)
        const [px, py, a] = pointAt(r, Math.min(total, m.along.metres * t.scale));
        x = px;
        y = py;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = m.color ?? '#17140f';
        ctx.strokeStyle = paper;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-7, -4, 14, 8, 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (m.kind === 'stop') {
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = m.color ?? ink(0.8);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = paper;
        ctx.stroke();
      } else if (m.kind === 'depot') {
        ctx.fillStyle = '#17140f';
        ctx.fillRect(x - 6, y - 6, 12, 12);
        ctx.fillStyle = '#f2a93b';
        ctx.fillRect(x - 3, y - 3, 6, 6);
      } else if (m.kind === 'target') {
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#b45f00';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#17140f';
        ctx.fill();
      } else if (m.kind === 'closed') {
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#b3261e';
        ctx.fill();
        ctx.strokeStyle = '#fff6ea';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(x - 4.5, y - 4.5);
        ctx.lineTo(x + 4.5, y + 4.5);
        ctx.moveTo(x + 4.5, y - 4.5);
        ctx.lineTo(x - 4.5, y + 4.5);
        ctx.stroke();
      }
    }
  }, [t, layers, markers, city]);

  return (
    <div ref={wrap} className={`minimap ${className ?? ''}`}>
      <canvas ref={base} aria-hidden />
      <canvas ref={top} role="img" aria-label={label} />
    </div>
  );
}
