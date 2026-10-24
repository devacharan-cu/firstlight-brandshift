import { Untangle } from '../components/Untangle';
import { DayStory } from '../components/DayStory';
import { Credit, Loop, Photo } from '../components/media';
import { Link } from '../router';
import { useMediaQuery } from '../lib/hooks';
import { useSim } from '../sim/store';
import { PANORAMAS } from '../media.gen';

const MODULES = [
  { to: '/app/planner', no: '01', name: 'Plan', text: 'A day of orders becomes van routes that respect every crate limit and every shift.' },
  { to: '/app/dispatch', no: '02', name: 'Dispatch', text: 'Urgent orders after planning, ranked by what each van would have to add.' },
  { to: '/app/driver', no: '03', name: 'Drive', text: 'The route on the driver’s phone, with the load sheet in reverse drop order.' },
  { to: '/app/track', no: '04', name: 'Track', text: 'An honest arrival window for every customer, corrected when the day changes.' },
  { to: '/app/disruptions', no: '05', name: 'Recover', text: 'Closures and breakdowns, re-planned for only the vans that need it.' },
  { to: '/app/reports', no: '06', name: 'Report', text: 'Distance, vans, hours and loads, computed from the plan, exported as CSV.' },
];

const INDUSTRIES = [
  { id: 'fmcg', photo: 'crates', name: 'FMCG distribution', note: 'Crates to kiranas and modern trade' },
  { id: 'pharmacy', photo: 'boxes', name: 'Pharmacy supply', note: 'Small totes, many drops, tight shifts' },
  { id: 'grocery', photo: 'loader', name: 'Grocery replenishment', note: 'Dense, early, time-critical' },
  { id: 'building', photo: 'forklift', name: 'Building supplies', note: 'Heavy units, long service stops' },
] as const;

function Hero() {
  return (
    <section className="hero-field" data-clock="05:30" aria-labelledby="home-title">
      <Loop id="sunrise" priority className="hero-field__media" controlsLabel="sunrise footage" />
      <div className="hero-field__scrim" aria-hidden />
      <div className="wrap hero-field__content">
        <p className="label hero-field__kicker">Route planning for delivery fleets</p>
        <h1 id="home-title" className="hero-field__title">
          <span>Tomorrow’s routes,</span> <span>untangled before</span> <em>first light.</em>
        </h1>
        <p className="hero-field__lede">
          Firstlight plans every van’s day around its crate limit and its driver’s shift, re-plans when the city changes, and tells
          every customer when to expect you.
        </p>
        <div className="hero-field__ctas">
          <a className="btn btn--primary" href="#story">
            See a day in two minutes <span aria-hidden>↓</span>
          </a>
          <a className="btn btn--light" href="#untangle">
            Plan orders yourself
          </a>
        </div>
        <ol className="hero-guide" aria-label="How to explore this site">
          <li>
            <span className="mono">1</span> Scroll a real simulated day
          </li>
          <li>
            <span className="mono">2</span> Plan a day of orders in your browser
          </li>
          <li>
            <span className="mono">3</span> Run the day in the console
          </li>
        </ol>
      </div>
      <div className="wrap hero-field__foot">
        <span className="mono">05:31 · first light over a city</span>
        <Credit kind="video" id="sunrise" />
      </div>
    </section>
  );
}

/** Facts a buyer can check on this site, measured on the build (see the case study). */
const PROOF = [
  { v: '0.3 s', k: 'to plan 300 orders, in your browser' },
  { v: '9', k: 'working console screens' },
  { v: '100', k: 'Lighthouse accessibility score' },
  { v: '142', k: 'automated checks, all passing' },
  { v: '0', k: 'cookies, trackers or third-party calls' },
];

function Proof() {
  return (
    <section className="proof" aria-label="Measured on this site">
      <ul className="wrap proof__list">
        {PROOF.map((p) => (
          <li key={p.k}>
            <span className="proof__v mono">{p.v}</span>
            <span className="proof__k">{p.k}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Planning() {
  const compact = useMediaQuery('(max-width: 720px)');
  const n = useSim((s) => s.scenario?.orders.length ?? s.stopCount);
  return (
    <section className="hero" id="untangle" data-clock="05:40" aria-labelledby="untangle-title">
      <div className="hero__intro">
        <p className="label eyebrow">Your turn · live planner</p>
        <h2 id="untangle-title" className="hero__h2">
          {n} orders. One depot. <em>Untangle</em> them.
        </h2>
        <p className="hero__lede">
          This is the product, not a picture of it. A real routing solver runs in your browser on a generated city, against the
          plan a careful dispatcher would make by hand.
        </p>
        <p className="hero__links">
          <Link to="/app/planner">Open the full planner →</Link>
          <Link to="/engine">How the solver works</Link>
        </p>
      </div>
      <Untangle compact={compact} />
    </section>
  );
}

function Modules() {
  const live = useSim((s) => s.live);
  const delivered = useSim((s) => Object.keys(s.delivered).length);
  const log = useSim((s) => s.log.length);
  const facts: Record<string, string> = live
    ? {
        Plan: `${live.stats.vans} vans · ${(live.stats.distance / 1000).toFixed(1)} km`,
        Dispatch: `${log} event${log === 1 ? '' : 's'} in the log`,
        Drive: `${delivered} drops marked delivered`,
        Track: `${live.routes.flat().length} live ETAs`,
        Recover: 'Bridges and breakdowns',
        Report: 'CSV export',
      }
    : {};
  return (
    <section className="modules" data-clock="19:20" aria-labelledby="modules-title">
      <div className="wrap">
        <p className="label">The platform</p>
        <h2 id="modules-title" className="section-title">
          Six modules. One simulated day you can open.
        </h2>
        <p className="section-lede">
          Every module below is a working screen in the console, connected to the same orders, vans and plan you just made.
        </p>
        <ol className="modules__grid">
          {MODULES.map((m) => (
            <li key={m.no}>
              <Link to={m.to} className="module">
                <span className="module__no mono">{m.no}</span>
                <span className="module__name">{m.name}</span>
                <span className="module__text">{m.text}</span>
                <span className="module__fact mono">{facts[m.name] ?? 'Open in the console'}</span>
                <span className="module__go" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function DepotTeaser() {
  return (
    <section className="depot-teaser" data-clock="19:25" aria-labelledby="depot-teaser-title">
      <div className="depot-teaser__media" aria-hidden>
        <img src="/media/warehouse-360-2048.webp" alt="" loading="lazy" decoding="async" width={2048} height={1024} />
      </div>
      <div className="wrap depot-teaser__content">
        <p className="label">The depot floor · 360°</p>
        <h2 id="depot-teaser-title">Stand in a real warehouse. Lay your plan on its floor.</h2>
        <p>
          A real hall photographed in 360°, with today’s plan projected onto it as staging lanes: one lane per van, loaded in reverse
          drop order.
        </p>
        <Link className="btn btn--light" to="/depot">
          Step onto the depot floor →
        </Link>
        <p className="depot-teaser__credit">
          360° photograph: {PANORAMAS['warehouse-360'].credit} · CC0. Not a Firstlight site.
        </p>
      </div>
    </section>
  );
}

function Industries() {
  return (
    <section className="ind-strip" data-clock="19:30" aria-labelledby="ind-title">
      <div className="wrap">
        <p className="label">Industries</p>
        <h2 id="ind-title" className="section-title">
          Same city, four kinds of day.
        </h2>
        <ul className="ind-strip__grid">
          {INDUSTRIES.map((i) => (
            <li key={i.id}>
              <Link to={`/industries#${i.id}`} className="ind-card">
                <Photo id={i.photo} sizes="(min-width: 1080px) 25vw, (min-width: 640px) 50vw, 100vw" />
                <span className="ind-card__name">{i.name}</span>
                <span className="ind-card__note">{i.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Close() {
  return (
    <section className="home-close" data-clock="19:45" aria-labelledby="close-title">
      <Loop id="twilight" className="home-close__media" controlsLabel="twilight footage" />
      <div className="home-close__scrim" aria-hidden />
      <div className="wrap home-close__content">
        <p className="label">After the last van is back</p>
        <h2 id="close-title">See your own orders untangled.</h2>
        <p>Thirty minutes. Bring a day of orders as a spreadsheet and we’ll plan them live, against how you plan today.</p>
        <div className="hero-field__ctas">
          <Link className="btn btn--primary" to="/demo">
            Book a walkthrough
          </Link>
          <Link className="btn btn--light" to="/pricing">
            See pricing
          </Link>
        </div>
        <Credit kind="video" id="twilight" />
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Proof />
      <div id="story">
        <DayStory />
      </div>
      <Planning />
      <Modules />
      <DepotTeaser />
      <Industries />
      <Close />
    </>
  );
}
