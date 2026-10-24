import { lazy, Suspense, useEffect, useState } from 'react';
import { Untangle } from './components/Untangle';
import { Masthead } from './components/Masthead';
import { initSimulation } from './sim/store';
import { startDaylight } from './lib/daylight';
import { useMediaQuery } from './lib/hooks';

const Chapters = lazy(() => import('./components/Chapters'));

export function App() {
  const compact = useMediaQuery('(max-width: 720px)');
  // the stop count is decided once per visit so the scenario stays stable on rotate/resize
  const [stopCount] = useState(() => (matchMedia('(max-width: 720px)').matches ? 120 : 300));

  useEffect(() => {
    initSimulation(stopCount);
  }, [stopCount]);

  useEffect(() => startDaylight(), []);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Masthead />
      <main id="main">
        <section className="hero" data-clock="05:40" id="top" aria-labelledby="hero-title">
          <div className="hero__intro">
            <p className="label eyebrow">Route planning for delivery fleets</p>
            <h1 id="hero-title">
              Tomorrow’s routes, <em>untangled</em> before first light.
            </h1>
            <p className="hero__lede">
              Firstlight turns a day of orders into van routes that respect every crate limit and every driver’s shift — in seconds,
              not a dispatcher’s whole morning.
            </p>
            <p className="hero__links">
              <a href="#pricing">See pricing →</a>
              <a href="#how">How the planner works</a>
            </p>
          </div>
          <Untangle compact={compact} />
        </section>
        <Suspense fallback={<div className="chapters-pending" aria-busy="true" />}>
          <Chapters />
        </Suspense>
      </main>
    </>
  );
}
