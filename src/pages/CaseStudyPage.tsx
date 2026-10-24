import { Link } from '../router';
import { BRANDSHIFT_CONTACT, COUNTS, METRICS, SHOTS } from './caseData';

const FACTS = [
  { k: 'Client', v: 'Self-initiated concept. Firstlight is fictional; the work is real.' },
  { k: 'Role', v: 'Research, product concept, art direction, interaction design, engineering, QA' },
  { k: 'Built', v: '23–24 October 2026' },
  { k: 'Stack', v: 'React 19, TypeScript, Vite, Canvas 2D, WebGL, a Web Worker. No map, animation or UI libraries.' },
];

const PROCESS = [
  { t: 'Research the category', d: 'We inspected the live websites of logistics software companies. They explain routing with stock photography, tilted screenshots and video; none lets a visitor plan anything.' },
  { t: 'Choose a signature', d: 'If the product is routing, the site should route. The Untangle runs a real solver in the browser and animates a tangled manual plan into clean routes, with every number computed.' },
  { t: 'Use real material', d: 'Real photographs and footage, licensed for commercial use, graded to sit together and credited. A real 360° warehouse capture instead of a rendered one. A phone number on a truck was blurred.' },
  { t: 'Build the product, not screenshots of it', d: 'Nine console screens share one simulated day: plan, dispatch, fleet, driver app, tracking, disruptions, reports and settings, all live, all consistent with each other.' },
  { t: 'Verify, then claim', d: 'Unit tests for the solver and every dispatch operation, scripted browser checks for keyboard, reduced motion and layout, and measured performance. The numbers below are measured, not estimated.' },
];

const DECISIONS = [
  { t: 'A city drawn in code', d: 'A seeded street graph with a river and four bridges. It avoided map licensing under a deadline, and every line is a street the router actually uses.' },
  { t: 'A worker, not a server', d: 'The solver, insertions, breakdowns and closures run in a Web Worker. Nothing leaves the browser, and the page stays responsive while it computes.' },
  { t: 'Physically possible edits', d: 'Once a drop is done, it is frozen. Urgent orders, moves and breakdowns only change what is still ahead, and late vans keep their own departure times.' },
  { t: 'Re-plan as little as possible', d: 'Our first disruption design re-ordered each van’s remaining stops and saved almost nothing. We changed it to re-plan only the vans that need it, and wrote that finding into a guide.' },
  { t: 'The plan on a real floor', d: 'The depot page projects today’s staging lanes onto a real 360° photograph in perspective, with a custom WebGL viewer and no 3D library.' },
  { t: 'One scroll, one day', d: 'The home page tells the product as a single delivery day: a pinned map that follows one real simulated plan from overnight orders to the evening report, so a first-time visitor understands it before touching anything.' },
  { t: 'Guided, not guessed', d: 'A five-step console tour, offered once and always skippable, plus a clear next step at the end of every page. Nobody has to work out where to click first.' },
  { t: 'Fast before it’s clever', d: 'Prerendered pages, inlined CSS, code-split routes, lazy media with posters and placeholders, no preloader. Heavy work waits until it’s needed.' },
];

const CARRY = [
  'A product-led home page: prerendered first paint, then a live demo running on real logic',
  'A multi-page site and an app console sharing one state model and one design system',
  'A media pipeline: manifest-driven, licence-tracked, graded, responsive, with redaction',
  'An interactive 360° photograph with registered overlays, without a 3D framework',
  'Accessible interaction patterns: keyboard-movable map handles, focus management across routes, reduced-motion paths',
  'A verification harness that checks overflow, console errors, keyboard flows and paint timing on every build',
];

export default function CaseStudyPage() {
  return (
    <div className="case">
      <header className="pagehead pagehead--field">
        <div className="wrap">
          <p className="label">Case study · BrandShift</p>
          <h1>Firstlight: a product website where the product actually runs.</h1>
          <p className="pagehead__lede">
            A flagship demonstration for B2B software teams. It’s a fictional delivery-fleet platform whose website doesn’t describe the product; it
            lets you use it, on real photography, across {COUNTS.pages || 'twenty-plus'} pages and {COUNTS.consoleScreens} working console screens.
          </p>
          <div className="hero-field__ctas">
            <Link className="btn btn--primary" to="/">
              Open Firstlight
            </Link>
            <Link className="btn btn--light" to="/app">
              Go straight to the console
            </Link>
          </div>
          <dl className="case__facts">
            {FACTS.map((f) => (
              <div key={f.k}>
                <dt className="label">{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <section className="wrap case__section" aria-labelledby="case-problem">
        <div className="case__split">
          <h2 id="case-problem" className="section-title">
            The problem with software websites
          </h2>
          <div className="case__prose">
            <p>
              Buyers of business software decide most of the way before they speak to anyone. They read, compare and look for proof, and most
              product sites give them the same three things: a claim, a screenshot, a “book a demo” button.
            </p>
            <p>
              For a product as concrete as route planning, that wastes the best argument available. Routing is easy to understand when you watch it
              happen, and impossible to judge from a picture.
            </p>
          </div>
        </div>
      </section>

      <section className="wrap case__section" aria-labelledby="case-process">
        <h2 id="case-process" className="section-title">
          How we approached it
        </h2>
        <ol className="case__process">
          {PROCESS.map((p, i) => (
            <li key={p.t}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              <h3>{p.t}</h3>
              <p>{p.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {SHOTS.length > 0 && (
        <section className="case__shots" aria-labelledby="case-shots">
          <div className="wrap">
            <h2 id="case-shots" className="section-title">
              The work, as it renders
            </h2>
            <p className="section-lede">
              Screenshots captured from the production build by a script, not mock-ups. The photography in them is licensed and{' '}
              <Link to="/credits">credited</Link>.
            </p>
            <ul className="shots">
              {SHOTS.map((s) => (
                <li key={s.file} className={s.layout ? `is-${s.layout}` : undefined}>
                  <figure>
                    <img src={`/media/case/${s.file}`} alt={s.alt} width={s.w} height={s.h} loading="lazy" decoding="async" />
                    <figcaption>
                      <strong>{s.title}</strong> {s.note}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="wrap case__section" aria-labelledby="case-decisions">
        <h2 id="case-decisions" className="section-title">
          Decisions that shaped it
        </h2>
        <ol className="case__decisions">
          {DECISIONS.map((d, i) => (
            <li key={d.t}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              <h3>{d.t}</h3>
              <p>{d.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap case__section" aria-labelledby="case-measured">
        <h2 id="case-measured" className="section-title">
          Measured, not claimed
        </h2>
        <p className="section-lede">
          Lighthouse 12 and scripted headless Chrome against the production build, served locally. Emulated devices aren’t real phones; field numbers
          will differ.
        </p>
        <dl className="case__metrics">
          {METRICS.map((m) => (
            <div key={m.k}>
              <dd className="mono">{m.v}</dd>
              <dt>{m.k}</dt>
              <dd className="case__metric-note">{m.n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="wrap case__section case__split" aria-labelledby="case-real">
        <div>
          <h2 id="case-real" className="section-title">
            What’s real
          </h2>
          <ul className="case__list">
            <li>The routing solver, its limits and every number it reports</li>
            <li>Dispatch operations: moves, urgent orders, breakdowns and closures</li>
            <li>The photographs, footage and 360° capture (real, licensed, credited)</li>
            <li>CSV import and export, all in the browser</li>
            <li>The accessibility and performance work, and the tests behind it</li>
          </ul>
        </div>
        <div>
          <h2 className="section-title">What isn’t</h2>
          <ul className="case__list">
            <li>Firstlight, its prices and its customers. All fictional.</li>
            <li>Kesarnagar and every business in it</li>
            <li>Messaging, GPS and third-party connectors. Illustrated, not connected.</li>
            <li>The booking form. It validates, then says nothing was sent.</li>
            <li>The places in the photographs. They are unrelated real locations.</li>
          </ul>
        </div>
      </section>

      <section className="wrap case__section" aria-labelledby="case-carry">
        <h2 id="case-carry" className="section-title">
          What carries over to your project
        </h2>
        <ul className="case__carry">
          {CARRY.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="case__maint">
          <strong>Maintainable by your team:</strong> strict TypeScript throughout, {COUNTS.unitTests || 'dozens of'} unit tests on the logic,{' '}
          {COUNTS.browserChecks || 'scripted'} browser checks, a documented media pipeline and a README that explains how to run, build and verify
          everything. Content lives in typed components; a headless CMS can be added where editors need it.
        </p>
      </section>

      <section className="case__close" aria-labelledby="case-close">
        <div className="wrap">
          <p className="label">Work with BrandShift</p>
          <h2 id="case-close">Your product, on the page, working.</h2>
          <p>
            BrandShift builds websites and product experiences for software companies in India and abroad. Projects start at ₹80,000; builds like
            this one, with custom interactive systems, are scoped individually.
          </p>
          <div className="hero-field__ctas">
            {BRANDSHIFT_CONTACT ? (
              <a className="btn btn--primary" href={BRANDSHIFT_CONTACT}>
                Talk to BrandShift
              </a>
            ) : (
              <p className="case__contact">Reach BrandShift through the channel where you found this case study.</p>
            )}
            <Link className="btn btn--light" to="/">
              Explore Firstlight again
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
