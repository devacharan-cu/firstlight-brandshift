import { Masthead } from './Masthead';

/**
 * BrandShift case study. Every figure on this page was measured on the production build
 * (see README → "Measured results"); update both together when the build changes.
 */

/** Set to BrandShift's real contact URL (e.g. mailto: or a booking link) before publishing. */
const BRANDSHIFT_CONTACT = '';

const FACTS = [
  { k: 'Role', v: 'Product concept, art direction, design and front-end engineering' },
  { k: 'Built', v: 'October 2026, in one working day' },
  { k: 'Stack', v: 'React 19, TypeScript, Vite, Canvas 2D, a Web Worker. No map, animation or UI libraries.' },
  { k: 'Status', v: 'Portfolio demonstration. Firstlight is a fictional product.' },
];

const DECISIONS = [
  {
    t: 'Let the visitor do the thing',
    d: 'The logistics sites we reviewed explain routing with stock photography, tilted screenshots and video, and none of them let a visitor plan a route. So the hero isn’t a picture of the product. It is the product: a real solver plans 300 orders in the browser, and the routes visibly untangle.',
  },
  {
    t: 'Real logic, honest numbers',
    d: 'Clarke–Wright savings followed by 2-opt, relocate, swap and tail-exchange local search, with capacity and shift limits enforced. Every figure on the page is computed from the plan on screen, compared against an explicit manual baseline for the same orders.',
  },
  {
    t: 'A city drawn in code',
    d: 'Kesarnagar is a seeded street graph of about 2,000 junctions with a river, four bridges and a swirled old town. It avoided licensing and data cleanup under a deadline, and every line on the map is a street the router can use.',
  },
  {
    t: 'Canvas for the city, DOM for the interface',
    d: 'Streets render once to a cached layer. Routes draw with a single dash offset per route, not hundreds of animated segments. Controls, labels and the depot handle stay as real, keyboard-reachable HTML. No WebGL: it would have cost weight and legibility without adding anything a buyer would notice.',
  },
  {
    t: 'The day is the story',
    d: 'The page follows one dispatcher from 05:40 to evening. A single scroll listener shifts the paper from pre-dawn grey to evening amber through CSS custom properties: no React re-renders and no layout work.',
  },
  {
    t: 'Fast before it’s clever',
    d: 'The first viewport is prerendered at build time with inline CSS, so the headline paints before any JavaScript runs. The solver loads on demand in a worker. No preloader, no blocking third-party requests, no cookies.',
  },
];

const METRICS = [
  { v: '93–94', k: 'Lighthouse performance, mobile', n: 'Three runs, simulated slow 4G and 4× CPU; 100 on desktop' },
  { v: '100', k: 'Accessibility, best practices, SEO', n: 'Lighthouse, mobile and desktop' },
  { v: '2.1–2.3 s', k: 'Largest contentful paint, mobile', n: '0.5 s with the desktop preset' },
  { v: '≤0.002', k: 'Cumulative layout shift', n: 'Mobile runs' },
  { v: '≈100 KB', k: 'JavaScript, gzip', n: 'Hero first; chapters and a 7 KB solver worker load after' },
  { v: '0.1–0.3 s', k: '300 orders planned', n: 'Headless Chrome on the build machine, several runs' },
  { v: '20 + 12', k: 'Unit tests + browser checks', n: 'Distances, constraints, keyboard, reduced motion' },
  { v: '0', k: 'Horizontal overflow, console errors', n: 'At 390, 820 and 1440 px wide' },
];

const REUSABLE = [
  'An interactive-hero pattern: prerendered first paint, then a worker-backed live demo',
  'A Canvas map renderer with a cached base layer and dash-based route reveals',
  'The scroll-driven daylight token system, for any time-based product story',
  'Honesty patterns: illustrative labels, demo-only forms that say nothing was sent, and a published “not modelled” list',
  'A browser test harness for overflow, console errors, reduced motion and keyboard flows',
];

export function CaseStudy() {
  return (
    <>
      <Masthead home={false} />
      <main id="main" className="cs">
        <header className="wrap cs__head">
          <p className="label">Case study · BrandShift</p>
          <h1>Firstlight: putting the product on the page.</h1>
          <p className="cs__lede">
            A flagship demonstration for B2B software teams: a fictional route-planning product whose website doesn’t describe the
            product. It runs it, live, in the browser, and stays fast doing it.
          </p>
          <p className="cs__links">
            <a className="btn btn--primary" href="/">
              Open Firstlight →
            </a>
            {BRANDSHIFT_CONTACT && (
              <a className="btn btn--quiet" href={BRANDSHIFT_CONTACT}>
                Talk to BrandShift
              </a>
            )}
          </p>
          <dl className="cs__facts">
            {FACTS.map((f) => (
              <div key={f.k}>
                <dt className="label">{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
        </header>

        <section className="wrap cs__section" aria-labelledby="cs-decisions">
          <h2 id="cs-decisions">Six decisions that shaped it</h2>
          <ol className="cs__decisions">
            {DECISIONS.map((d) => (
              <li key={d.t}>
                <h3>{d.t}</h3>
                <p>{d.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="wrap cs__section" aria-labelledby="cs-measured">
          <h2 id="cs-measured">Measured, not claimed</h2>
          <p className="cs__note">
            Measured on 23 October 2026 against the production build served locally, with Lighthouse 12.8 and headless Chrome.
            Emulation isn’t a real phone; field numbers on real devices will differ.
          </p>
          <dl className="cs__metrics">
            {METRICS.map((m) => (
              <div key={m.k}>
                <dd className="mono">{m.v}</dd>
                <dt>{m.k}</dt>
                <dd className="cs__metric-note">{m.n}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="wrap cs__section cs__split" aria-labelledby="cs-real">
          <div>
            <h2 id="cs-real">What’s real</h2>
            <ul>
              <li>The routing solver, its constraints and every number it reports</li>
              <li>Road-network distances on the generated street graph</li>
              <li>Live re-planning for depot moves, urgent orders and bridge closures</li>
              <li>The accessibility and performance work, and the tests behind it</li>
            </ul>
          </div>
          <div>
            <h2>What isn’t</h2>
            <ul>
              <li>Firstlight, its pricing and its customers. All fictional.</li>
              <li>Kesarnagar and every business in it</li>
              <li>Messaging, GPS and integrations. Illustrated, not connected.</li>
              <li>The booking form. It validates, then says nothing was sent.</li>
            </ul>
          </div>
        </section>

        <section className="wrap cs__section" aria-labelledby="cs-reuse">
          <h2 id="cs-reuse">What carries over to client work</h2>
          <ul className="cs__reuse">
            {REUSABLE.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        <footer className="wrap cs__foot">
          <p>
            © 2026 BrandShift. Firstlight and Kesarnagar are invented for this demonstration. Typeset in Overpass and Overpass Mono
            (SIL Open Font License).
          </p>
        </footer>
      </main>
    </>
  );
}
