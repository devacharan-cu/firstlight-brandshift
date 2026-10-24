import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * A five-step guided tour of the console. Offered once on a first visit (remembered in this
 * browser only), always skippable, and re-opened from the "Tour" button in the console bar.
 * Each step spotlights one part of the screen and explains it in a sentence or two.
 */

interface TourStep {
  target: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    target: '.console__side nav',
    title: 'Every screen of the product',
    body: 'Planner, dispatch, fleet, driver app, tracking, disruptions and reports. They all work on the same simulated day, so a change in one shows up in the others.',
  },
  {
    target: '.simclock',
    title: 'The day runs on this clock',
    body: 'Press play or drag the slider. Vans move along their routes, drops are delivered and customer ETAs update as the simulated time passes.',
  },
  {
    target: '.livebadge',
    title: 'Your plan, live',
    body: 'Orders, vans and kilometres for the plan you are running. Edits you make anywhere, such as an urgent order or a moved stop, update it everywhere.',
  },
  {
    target: '.console__page .panel',
    title: 'The screen you are on',
    body: 'Everything here is computed from the plan in your browser: nothing is sent anywhere. Click a van, a stop or a route to see its details.',
  },
  {
    target: '.console__link[href="/app/disruptions"]',
    title: 'Then try to break the day',
    body: 'Close a bridge or take a van off the road, and see what Firstlight re-plans and what it leaves alone.',
  },
];

const KEY = 'firstlight:tour';
const seen = () => {
  try {
    return localStorage.getItem(KEY) === 'done';
  } catch {
    return true;
  }
};
const remember = () => {
  try {
    localStorage.setItem(KEY, 'done');
  } catch {
    /* private mode: the offer may come back, which is harmless */
  }
};

let openTour: () => void = () => {};
/** Opens the tour from anywhere in the console (the "Tour" button). */
export function startTour() {
  openTour();
}

export function Tour() {
  const [mode, setMode] = useState<'off' | 'offer' | 'on'>('off');
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openTour = () => {
      returnTo.current = document.activeElement as HTMLElement | null;
      setI(0);
      setMode('on');
    };
    // offer once, after the console has had a moment to plan the day
    const t = window.setTimeout(() => !seen() && setMode('offer'), 1400);
    return () => window.clearTimeout(t);
  }, []);

  const close = useCallback(() => {
    remember();
    setMode('off');
    returnTo.current?.focus?.();
  }, []);

  // measure the target, and keep measuring while it may move (scroll, resize, layout)
  useLayoutEffect(() => {
    if (mode !== 'on') return;
    const el = document.querySelector<HTMLElement>(STEPS[i].target);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
    let raf = 0;
    const measure = () => {
      raf = 0;
      setRect(el.getBoundingClientRect());
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', on, true);
    window.addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', on, true);
      window.removeEventListener('resize', on);
    };
  }, [mode, i]);

  useEffect(() => {
    if (mode === 'off') return;
    // the offer appears unasked, so it must not take focus; the tour itself does
    if (mode === 'on') card.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (mode === 'on' && e.key === 'ArrowRight') setI((n) => Math.min(STEPS.length - 1, n + 1));
      if (mode === 'on' && e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, i, close]);

  if (mode === 'off') return null;

  if (mode === 'offer') {
    return (
      <div className="tour-offer" role="dialog" aria-labelledby="tour-offer-title" ref={card} tabIndex={-1}>
        <p className="label">New here?</p>
        <p id="tour-offer-title" className="tour-offer__title">
          Take the 60-second tour of the console.
        </p>
        <p className="tour-offer__body">Five short steps: what each part does and what to try first.</p>
        <div className="tour__actions">
          <button className="btn btn--primary btn--sm" onClick={() => setMode('on')}>
            Start the tour
          </button>
          <button className="btn btn--quiet btn--sm" onClick={close}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  const step = STEPS[i];
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(360, vw - 24);
  // place the card beside the target where there is room, else below or above it
  let left = 12;
  let top = vh - 260;
  if (rect) {
    if (rect.right + pad + 16 + cardW < vw) {
      left = rect.right + pad + 16;
      top = Math.min(Math.max(12, rect.top), vh - 280);
    } else if (rect.bottom + 230 < vh) {
      left = Math.min(Math.max(12, rect.left), vw - cardW - 12);
      top = rect.bottom + pad + 12;
    } else {
      left = Math.min(Math.max(12, rect.left), vw - cardW - 12);
      top = Math.max(12, rect.top - pad - 232);
    }
  }
  return (
    <div className="tour" aria-live="polite">
      {rect && (
        <div
          className="tour__spot"
          aria-hidden
          style={{
            left: Math.max(4, rect.left - pad),
            top: Math.max(4, rect.top - pad),
            width: Math.min(vw - 8, rect.width + pad * 2),
            height: Math.min(vh - 8, rect.height + pad * 2),
          }}
        />
      )}
      <div
        className="tour__card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        ref={card}
        tabIndex={-1}
        style={{ left, top, width: cardW }}
        key={i}
      >
        <p className="label">
          Tour · {i + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title" className="tour__title">
          {step.title}
        </h2>
        <p className="tour__body">{step.body}</p>
        <div className="tour__dots" aria-hidden>
          {STEPS.map((s, k) => (
            <span key={s.target} className={k === i ? 'is-on' : ''} />
          ))}
        </div>
        <div className="tour__actions">
          {i > 0 && (
            <button className="btn btn--quiet btn--sm" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          {i < STEPS.length - 1 ? (
            <button className="btn btn--primary btn--sm" onClick={() => setI(i + 1)}>
              Next
            </button>
          ) : (
            <button className="btn btn--primary btn--sm" onClick={close}>
              Start exploring
            </button>
          )}
          <button className="tour__skip" onClick={close}>
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
