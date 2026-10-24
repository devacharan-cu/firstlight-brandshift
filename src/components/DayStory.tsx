import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '../router';
import { getCity, clock, etasFor } from '../sim/store';
import { routing } from '../sim/client';
import { DEFAULT_SETTINGS, scenarioFrom, type Scenario } from '../sim/scenario';
import type { PlanningResult } from '../sim/plan';
import type { DisruptionResult } from '../sim/disruption';
import { drawBase, fitTransform, pointAt, routeColor, screenRoute, strokePartial, sx, sy, type ScreenRoute, type Transform } from '../map/draw';
import { Photo } from './media';
import { useReducedMotion } from '../lib/hooks';

/**
 * "A day with Firstlight": one long pinned scroll that walks a whole delivery day on a real plan.
 * The stage (map + cards) stays in view while the steps scroll past; scroll position drives which
 * step is shown and how far through it the animation is. Everything on the map is computed: the
 * story runs its own fixed 120-order day through the routing worker, separate from the visitor's
 * plan in the Untangle below.
 */

interface Step {
  time: string;
  title: string;
  body: string;
  to: string;
  cta: string;
}

const STEPS: Step[] = [
  {
    time: '05:40',
    title: 'Overnight, the orders land.',
    body: '120 drops for today: kiranas, chemists, bakeries and dairies across the city. Each is an address and a number of crates.',
    to: '/integrations#import',
    cta: 'Import your own orders',
  },
  {
    time: '05:41',
    title: 'Planned by hand, it tangles.',
    body: 'A careful dispatcher splits the city into areas and fills each van nearest-first. It works, but routes cross and vans run half-empty.',
    to: '/engine',
    cta: 'How the manual baseline works',
  },
  {
    time: '05:42',
    title: 'Firstlight untangles it.',
    body: 'In well under a second, the solver rebuilds every route around each van’s crate limit and each driver’s shift. Fewer kilometres, fewer vans.',
    to: '/app/planner',
    cta: 'Open the planner',
  },
  {
    time: '06:00',
    title: 'Loaded last drop first.',
    body: 'Each van gets a load sheet in reverse order, so the first delivery is nearest the door and nobody digs through crates at a kerb.',
    to: '/depot',
    cta: 'See the lanes on a real depot floor',
  },
  {
    time: '08:00',
    title: 'On the road, on the driver’s phone.',
    body: 'Drivers follow the route stop by stop and mark each drop delivered. The control tower sees every van against its plan.',
    to: '/app/driver',
    cta: 'Open the driver app',
  },
  {
    time: '10:30',
    title: 'A bridge closes. Only some vans change.',
    body: 'Firstlight re-plans just the vans that would have crossed it. Everyone else keeps their route, so drivers aren’t thrown by a new day.',
    to: '/app/disruptions',
    cta: 'Close a bridge yourself',
  },
  {
    time: '14:00',
    title: 'The customer knows when.',
    body: 'Every stop gets an honest arrival window from the live plan, and it moves if the day does. That is the only part the customer ever sees.',
    to: '/app/track',
    cta: 'Open customer tracking',
  },
  {
    time: '19:00',
    title: 'The day, in numbers.',
    body: 'Distance, vans, hours and how full each van ran, computed from the plan itself and ready to export. Tomorrow’s orders are already arriving.',
    to: '/app/reports',
    cta: 'Open the reports',
  },
];

interface StoryData {
  scenario: Scenario;
  plan: PlanningResult;
  disruption: DisruptionResult | null;
}

/** Where on screen a step counts as "being read": below the pinned map on phones. */
const readingLine = () => window.innerHeight * (window.innerWidth <= 900 ? 0.8 : 0.55);

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const km = (m: number) => (m / 1000).toFixed(1);

export function DayStory() {
  const section = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const baseCv = useRef<HTMLCanvasElement>(null);
  const topCv = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<StoryData | null>(null);
  const progress = useRef({ step: 0, local: 0 });
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // Compute the story's day when the section comes near the viewport.
  useEffect(() => {
    const el = section.current!;
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const city = getCity();
        const scenario = scenarioFrom(city, { ...DEFAULT_SETTINGS, orders: 120 });
        routing
          .plan(scenario)
          .then(async (plan) => {
            if (cancelled) return;
            setData({ scenario, plan, disruption: null });
            const busiest = [...plan.bridgeUse].sort((a, b) => b.legs - a.legs)[0];
            if (!busiest || !busiest.legs) return;
            const disruption = await routing.disrupt(scenario, plan.optimized, busiest.edge);
            if (!cancelled) setData({ scenario, plan, disruption });
          })
          .catch(() => {});
      },
      { rootMargin: '150% 0px' },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, []);

  // Screen-space routes for the current canvas size.
  const geo = useRef<{ t: Transform; base: ScreenRoute[]; opt: ScreenRoute[]; replan: ScreenRoute[]; w: number; h: number } | null>(null);
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = stage.current!;
    const city = getCity();
    const build = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const t = fitTransform(city, w, h, dpr, w < 560 ? 6 : 18);
      for (const c of [baseCv.current!, topCv.current!]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const bctx = baseCv.current!.getContext('2d')!;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBase(bctx, city, t, w < 560 ? 'compact' : 'full');
      const routesOf = (g: { path: Int32Array }[] | undefined) => (g ?? []).map((r) => screenRoute(city, t, r.path));
      geo.current = {
        t,
        w,
        h,
        base: routesOf(data?.plan.baseline.geometry),
        opt: routesOf(data?.plan.optimized.geometry),
        replan: routesOf(data?.disruption?.replan.geometry),
      };
      drawRef.current();
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(el);
    document.fonts?.ready.then(build).catch(() => {});
    return () => ro.disconnect();
  }, [data]);

  // Paint the overlay for a given step and local progress.
  useEffect(() => {
    const city = getCity();
    drawRef.current = () => {
      const g = geo.current;
      const cv = topCv.current;
      if (!g || !cv || !data) return;
      const ctx = cv.getContext('2d')!;
      const { t } = g;
      ctx.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);
      const { step: s, local } = progress.current;
      const lp = reducedRef.current ? 1 : local;
      const { scenario, plan, disruption } = data;
      const orders = scenario.orders;
      const vanOf = new Int16Array(orders.length).fill(-1);
      plan.optimized.routes.forEach((r, k) => r.forEach((o) => (vanOf[o] = k)));
      const lw = g.w < 560 ? 0.75 : 1;

      // routes
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (s === 1 || (s === 2 && lp < 0.45)) {
        const frac = s === 1 ? ease(lp) : 1;
        ctx.globalAlpha = s === 2 ? 1 - lp / 0.45 : 1;
        ctx.lineWidth = 1.4 * lw;
        g.base.forEach((r, k) => {
          ctx.strokeStyle = k % 2 ? 'rgba(21,19,15,0.62)' : 'rgba(180,95,0,0.75)';
          strokePartial(ctx, r, frac);
        });
        ctx.globalAlpha = 1;
      }
      const crossing = new Set(s === 5 && disruption ? disruption.crossing : []);
      if (s >= 2) {
        const frac = s === 2 ? ease(clamp01((lp - 0.2) / 0.8)) : 1;
        g.opt.forEach((r, k) => {
          const dimmed = s === 5 && crossing.size > 0 && !crossing.has(k);
          ctx.globalAlpha = dimmed ? 0.28 : s === 6 ? 0.4 : 1;
          ctx.strokeStyle = routeColor(k);
          ctx.lineWidth = 2.2 * lw;
          if (crossing.has(k)) {
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 1.5 * lw;
            strokePartial(ctx, r, 1, [4, 4]);
          } else strokePartial(ctx, r, frac);
        });
        ctx.globalAlpha = 1;
        if (s === 5 && disruption) {
          const f = ease(lp);
          crossing.forEach((k) => {
            const r = g.replan[k];
            if (!r) return;
            ctx.strokeStyle = routeColor(k);
            ctx.lineWidth = 2.8 * lw;
            strokePartial(ctx, r, f);
          });
        }
      }

      // stops
      const shown = s === 0 ? Math.floor(ease(lp) * orders.length) : orders.length;
      for (let i = 0; i < shown; i++) {
        const o = orders[i];
        const x = sx(t, city.x[o.node]);
        const y = sy(t, city.y[o.node]);
        ctx.beginPath();
        ctx.arc(x, y, (s >= 2 ? 2.4 : 2.1) * lw, 0, Math.PI * 2);
        ctx.fillStyle = s >= 2 && vanOf[i] >= 0 ? routeColor(vanOf[i]) : 'rgba(21,19,15,0.72)';
        ctx.globalAlpha = s === 6 ? 0.35 : 1;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // vans on the road
      if (s === 4 || s === 5) {
        const f = s === 4 ? lp : 0.55;
        g.opt.forEach((r, k) => {
          if (crossing.has(k)) return;
          const [x, y] = pointAt(r, r.length * Math.min(0.999, f));
          ctx.beginPath();
          ctx.arc(x, y, 5.2 * lw, 0, Math.PI * 2);
          ctx.fillStyle = '#fffdf9';
          ctx.fill();
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = routeColor(k);
          ctx.stroke();
        });
      }

      // closed bridge
      if (s === 5 && disruption) {
        const e = disruption.closedEdge;
        const a = city.edgeA[e];
        const b = city.edgeB[e];
        const x = sx(t, (city.x[a] + city.x[b]) / 2);
        const y = sy(t, (city.y[a] + city.y[b]) / 2);
        const r = 9 * lw + 3 * Math.sin(performance.now() / 300);
        ctx.fillStyle = '#b3261e';
        ctx.beginPath();
        ctx.arc(x, y, 11 * lw, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(179,38,30,0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.2;
        const d = 4.5 * lw;
        ctx.beginPath();
        ctx.moveTo(x - d, y - d);
        ctx.lineTo(x + d, y + d);
        ctx.moveTo(x + d, y - d);
        ctx.lineTo(x - d, y + d);
        ctx.stroke();
      }

      // the customer's stop
      if (s === 6) {
        const target = customerStop(data);
        if (target) {
          const o = orders[target.order];
          const x = sx(t, city.x[o.node]);
          const y = sy(t, city.y[o.node]);
          const pulse = (performance.now() / 1400) % 1;
          ctx.strokeStyle = `rgba(14,124,134,${0.5 * (1 - pulse)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 8 + pulse * 22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#0e7c86';
          ctx.beginPath();
          ctx.arc(x, y, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // depot
      const dx = sx(t, city.x[scenario.depotNode]);
      const dy = sy(t, city.y[scenario.depotNode]);
      ctx.fillStyle = '#15130f';
      ctx.fillRect(dx - 7, dy - 7, 14, 14);
      ctx.fillStyle = '#f2a93b';
      ctx.fillRect(dx - 4, dy - 4, 8, 8);
    };
    drawRef.current();
  }, [data]);

  // Scroll → step + local progress. Animated steps (closure, customer) keep repainting while shown.
  useEffect(() => {
    const el = body.current!;
    let raf = 0;
    let visible = false;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = Math.max(1, r.height - vh);
      const p = clamp01(-r.top / total);
      // The active step is the one whose text is at the middle of the screen, so the stage always
      // shows what the reader is reading; local progress is how far that text has travelled.
      const mid = readingLine();
      const items = el.querySelectorAll<HTMLElement>('.story__step');
      let s = 0;
      let local = 0;
      items.forEach((li, k) => {
        const b = li.getBoundingClientRect();
        if (b.top <= mid) {
          s = k;
          local = clamp01((mid - b.top) / Math.max(1, b.height));
        }
      });
      progress.current = { step: s, local };
      el.style.setProperty('--story-p', p.toFixed(4));
      el.style.setProperty('--step-p', local.toFixed(3));
      setStep(s);
      drawRef.current();
      if (visible && (s === 5 || s === 6) && !reducedRef.current) raf = requestAnimationFrame(update);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) onScroll();
    });
    io.observe(el);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const goTo = (k: number) => {
    const li = body.current!.querySelectorAll<HTMLElement>('.story__step')[k];
    if (!li) return;
    const b = li.getBoundingClientRect();
    // put the middle of that step's text at the reading line used above
    const top = b.top + window.scrollY + b.height * 0.6 - readingLine();
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  };

  const facts = useMemo(() => (data ? storyFacts(data) : null), [data]);
  const timeLabel = step === 4 && facts ? clock(8 * 3600 + Math.round((progress.current.local * 6 * 3600) / 300) * 300) : STEPS[step].time;

  return (
    <section className="story" ref={section} data-clock="05:40" aria-labelledby="story-title">
      <div className="wrap story__head">
        <p className="label">A day with Firstlight · two-minute scroll</p>
        <h2 id="story-title" className="section-title">
          From last night’s orders to tonight’s report, in one scroll.
        </h2>
        <p className="section-lede">
          Keep scrolling: the map follows one real simulated day, step by step. Then plan your own orders below, or open the console and run the day
          yourself.
        </p>
      </div>

      <div className="story__body" ref={body} style={{ '--steps': STEPS.length } as React.CSSProperties}>
        <div className="story__pin">
          <div className="story__frame">
            <div className="story__hud">
              <span className="story__clock mono" aria-hidden>
                {timeLabel}
              </span>
              <ol className="story__ticks" aria-label="Steps of the day">
                {STEPS.map((s, k) => (
                  <li key={s.time}>
                    <button
                      type="button"
                      className={k === step ? 'is-on' : k < step ? 'is-past' : ''}
                      onClick={() => goTo(k)}
                      aria-label={`Step ${k + 1}: ${s.title}`}
                      aria-current={k === step ? 'step' : undefined}
                    />
                  </li>
                ))}
              </ol>
              <span className="story__count mono" aria-hidden>
                {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
              </span>
            </div>
            <div className="story__stage" ref={stage} role="img" aria-label={`Map of the simulated city at ${STEPS[step].time}: ${STEPS[step].title}`}>
              <canvas ref={baseCv} className="story__cv" aria-hidden />
              <canvas ref={topCv} className="story__cv" aria-hidden />
              {!data && <p className="story__loading mono">Planning the day…</p>}
              <StageCards step={step} data={data} facts={facts} />
            </div>
            <div className="story__bar" aria-hidden>
              <span />
            </div>
          </div>
        </div>

        <ol className="story__steps">
          {STEPS.map((s, k) => (
            <li key={s.time} className={`story__step ${k === step ? 'is-on' : ''}`}>
              <div className="story__card">
                <p className="story__time mono">
                  <span>{String(k + 1).padStart(2, '0')}</span> {s.time}
                </p>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                {facts && <p className="story__fact mono">{facts.lines[k]}</p>}
                <Link className="story__cta" to={s.to}>
                  {s.cta} <span aria-hidden>→</span>
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function customerStop(data: StoryData) {
  // a mid-afternoon stop on the longest route
  const { plan, scenario } = data;
  const k = plan.optimized.stats.routes.reduce((best, r, i, all) => (r.stops > all[best].stops ? i : best), 0);
  const g = plan.optimized.geometry[k];
  const etas = etasFor(g, scenario);
  const idx = Math.max(0, etas.findIndex((e) => e >= 13.5 * 3600));
  const at = idx >= 0 ? idx : Math.floor(etas.length / 2);
  return { van: k, order: plan.optimized.routes[k][at], eta: etas[at] };
}

function storyFacts(data: StoryData) {
  const { plan, scenario, disruption } = data;
  const b = plan.baseline.stats;
  const o = plan.optimized.stats;
  const cap = scenario.fleet.capacity;
  const crates = scenario.orders.reduce((n, x) => n + x.demand, 0);
  const sheet = plan.optimized.routes[0].map((i) => scenario.orders[i]).reverse();
  const c = customerStop(data);
  const extra = disruption ? disruption.replan.stats.distance - disruption.planned.stats.distance : 0;
  return {
    baseKm: km(b.distance),
    optKm: km(o.distance),
    baseVans: b.vans,
    optVans: o.vans,
    saved: Math.round((1 - o.distance / b.distance) * 100),
    sheet,
    sheetLoad: plan.optimized.stats.routes[0].load,
    cap,
    loads: o.routes.filter((r) => r.stops > 0).map((r) => r.load / cap),
    customer: c ? { order: scenario.orders[c.order], van: c.van, eta: c.eta } : null,
    disruption: disruption
      ? { bridge: disruption.bridgeName, vans: disruption.crossing.length, of: o.vans, extraKm: km(extra), etas: disruption.changedEtas }
      : null,
    lines: [
      `${scenario.orders.length} orders · ${crates} crates · 1 depot`,
      `Manual: ${km(b.distance)} km on ${b.vans} vans`,
      `Firstlight: ${km(o.distance)} km on ${o.vans} vans · ${Math.round((1 - o.distance / b.distance) * 100)}% shorter`,
      `Van 01: ${plan.optimized.routes[0].length} drops, ${plan.optimized.stats.routes[0].load} of ${cap} crates`,
      `${o.vans} vans out · shifts from ${clock(scenario.fleet.shiftStartSec)}`,
      disruption
        ? `${disruption.bridgeName} closed: ${disruption.crossing.length} of ${o.vans} vans re-planned, +${km(extra)} km`
        : 'Computing the closure…',
      c ? `${scenario.orders[c.order].name}: due ${clock(c.eta)}` : '',
      `${km(o.distance)} km · ${(o.duration / 3600).toFixed(1)} van-hours · ${Math.round((o.load / (o.vans * cap)) * 100)}% full`,
    ],
  };
}

type Facts = ReturnType<typeof storyFacts>;

/** The cards that slide over the map, one set per step. */
function StageCards({ step, data, facts }: { step: number; data: StoryData | null; facts: Facts | null }) {
  const on = (k: number | number[]) => ((Array.isArray(k) ? k.includes(step) : k === step) ? ' is-on' : '');
  if (!data || !facts) return null;
  return (
    <div className="scards" aria-hidden>
      <div className={`scard scard--stat scard--tl${on([1, 2])}`}>
        <p className="label">Distance today</p>
        <p className="scard__big mono">
          <span className={step >= 2 ? 'is-old' : ''}>{facts.baseKm}</span>
          {step >= 2 && <span className="scard__new">{facts.optKm}</span>}
          <small>km</small>
        </p>
        <p className="scard__sub mono">
          {step >= 2 ? `${facts.optVans} vans, not ${facts.baseVans} · −${facts.saved}%` : `${facts.baseVans} vans · planned by hand`}
        </p>
      </div>

      <div className={`scard scard--photo scard--br${on(3)}`}>
        <Photo id="dock-door" sizes="320px" />
        <div className="scard__sheet">
          <p className="label">Van 01 · load sheet</p>
          <ol>
            {facts.sheet.slice(0, 4).map((o, i) => (
              <li key={o.id}>
                <span className="mono">{String(facts.sheet.length - i).padStart(2, '0')}</span> {o.name}
                <span className="mono">{o.demand}</span>
              </li>
            ))}
          </ol>
          <p className="scard__sub mono">
            Loaded first, delivered last · {facts.sheetLoad}/{facts.cap} crates
          </p>
        </div>
      </div>

      <div className={`scard scard--phone scard--br${on(4)}`}>
        <div className="phone-mini">
          <p className="phone-mini__top mono">
            <span>Van 02</span>
            <span>Next stop</span>
          </p>
          <p className="phone-mini__name">{data.scenario.orders[data.plan.optimized.routes[1]?.[3] ?? 0].name}</p>
          <p className="phone-mini__addr">{data.scenario.orders[data.plan.optimized.routes[1]?.[3] ?? 0].street}</p>
          <span className="phone-mini__btn">Delivered</span>
        </div>
      </div>

      <div className={`scard scard--alert scard--tl${on(5)}`}>
        <p className="label">Disruption</p>
        {facts.disruption ? (
          <>
            <p className="scard__title">{facts.disruption.bridge} closed</p>
            <p className="scard__sub">
              {facts.disruption.vans} of {facts.disruption.of} vans re-planned · +{facts.disruption.extraKm} km · the rest unchanged
            </p>
          </>
        ) : (
          <p className="scard__sub">Re-planning…</p>
        )}
      </div>

      {facts.customer && (
        <div className={`scard scard--track scard--br${on(6)}`}>
          <Photo id="handover" sizes="320px" />
          <div className="scard__track">
            <p className="label">Your delivery · {facts.customer.order.id}</p>
            <p className="scard__title">
              Arriving {clock(Math.floor((facts.customer.eta - 15 * 60) / 300) * 300)}–{clock(Math.ceil((facts.customer.eta + 15 * 60) / 300) * 300)}
            </p>
            <p className="scard__sub">{facts.customer.order.name}</p>
          </div>
        </div>
      )}

      <div className={`scard scard--report scard--tl${on(7)}`}>
        <p className="label">Day report · van loads</p>
        <div className="scard__bars">
          {facts.loads.map((l, i) => (
            <span key={i} style={{ '--h': `${Math.round(l * 100)}%`, '--c': routeColor(i), '--i': i } as React.CSSProperties} />
          ))}
        </div>
        <p className="scard__sub mono">{facts.lines[7]}</p>
      </div>
    </div>
  );
}
