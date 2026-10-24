import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from '../router';
import { Photo } from '../components/media';

export function Wordmark() {
  return (
    <>
      <svg viewBox="0 0 30 20" aria-hidden>
        <path d="M2 17h26" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M7.5 17a7.5 7.5 0 0 1 15 0" fill="none" stroke="#e08d12" strokeWidth="2.6" />
        <path d="M15 3.5v3M6.2 7.4l2 2M23.8 7.4l-2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      Firstlight
    </>
  );
}

export const PRODUCT_LINKS = {
  platform: [
    { to: '/platform', label: 'Platform overview', note: 'Six modules, one simulated day' },
    { to: '/depot', label: 'The depot floor', note: 'A real warehouse in 360°, with your plan on it' },
    { to: '/engine', label: 'Routing engine', note: 'What the solver computes, and its limits' },
    { to: '/integrations', label: 'Integrations', note: 'Order sources, and a CSV import to try' },
    { to: '/security', label: 'Data & security', note: 'Design intent for a fictional product' },
  ],
  console: [
    { to: '/app', label: 'Control tower', note: 'Every van on a simulated clock' },
    { to: '/app/planner', label: 'Planner', note: 'The Untangle, full screen' },
    { to: '/app/dispatch', label: 'Dispatch', note: 'Urgent orders, ranked by cost' },
    { to: '/app/fleet', label: 'Fleet', note: 'Routes, loads and reassignment' },
    { to: '/app/driver', label: 'Driver app', note: 'The route on a phone' },
    { to: '/app/track', label: 'Tracking', note: 'What the customer sees' },
    { to: '/app/disruptions', label: 'Disruptions', note: 'Closures and breakdowns' },
    { to: '/app/reports', label: 'Reports', note: 'The day in numbers, with CSV export' },
  ],
};

const NAV = [
  { to: '/industries', label: 'Industries' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/resources', label: 'Resources' },
  { to: '/case-study', label: 'Case study' },
];

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);
  const megaBtn = useRef<HTMLButtonElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);

  // close menus on navigation
  useEffect(() => {
    setMenu(false);
    setMega(false);
  }, [loc.path]);

  useEffect(() => {
    if (!overlay) return;
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [overlay]);

  useEffect(() => {
    if (!mega && !menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (mega) {
        setMega(false);
        megaBtn.current?.focus();
      }
      if (menu) {
        setMenu(false);
        menuBtn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (mega && megaRef.current && !megaRef.current.contains(e.target as Node) && !megaBtn.current?.contains(e.target as Node)) setMega(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [mega, menu]);

  const productActive = [...PRODUCT_LINKS.platform, ...PRODUCT_LINKS.console].some((l) => l.to === loc.path);

  return (
    <header className={`masthead ${overlay && !scrolled && !menu && !mega ? 'is-overlay' : ''}`}>
      <div className="strip">
        <span>
          <span className="strip__clock" data-live-clock>
            05:40
          </span>{' '}
          IST
        </span>
        <span className="strip__sep">/</span>
        <span className="strip__hide-sm">Kesarnagar dispatch</span>
        <span className="strip__sep strip__hide-sm">/</span>
        <span>Simulation · fictional product</span>
        <Link className="strip__right strip__hide-sm" to="/case-study">
          A BrandShift showcase →
        </Link>
      </div>
      <nav className="nav" aria-label="Main">
        <Link className="wordmark" to="/" aria-label="Firstlight home">
          <Wordmark />
        </Link>
        <ul className="nav__links">
          <li>
            <button
              ref={megaBtn}
              className={`nav__mega-btn ${productActive ? 'is-active' : ''}`}
              aria-expanded={mega}
              aria-controls="mega"
              onClick={() => setMega((m) => !m)}
            >
              Product <span aria-hidden>▾</span>
            </button>
          </li>
          {NAV.map((l) => (
            <li key={l.to}>
              <Link to={l.to}>{l.label}</Link>
            </li>
          ))}
        </ul>
        <div className="nav__ctas">
          <Link className="btn btn--quiet nav__console" to="/app">
            Open the console
          </Link>
          <Link className="btn btn--ink nav__cta" to="/demo">
            Book a walkthrough
          </Link>
        </div>
        <button
          ref={menuBtn}
          className="btn btn--quiet nav__menu"
          aria-expanded={menu}
          aria-controls="menu-sheet"
          onClick={() => setMenu((o) => !o)}
        >
          {menu ? 'Close' : 'Menu'}
        </button>
      </nav>

      {mega && (
        <div className="mega" id="mega" ref={megaRef}>
          <div className="mega__inner">
            <section>
              <p className="label">The platform</p>
              <ul>
                {PRODUCT_LINKS.platform.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to}>
                      <strong>{l.label}</strong>
                      <span>{l.note}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <p className="label">The console · live simulation</p>
              <ul className="mega__grid">
                {PRODUCT_LINKS.console.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to}>
                      <strong>{l.label}</strong>
                      <span>{l.note}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            <Link className="mega__feature" to="/depot">
              <Photo id="dock-door" sizes="320px" />
              <span className="mega__feature-cap">
                <span className="label">New</span>
                Step onto the depot floor →
              </span>
            </Link>
          </div>
        </div>
      )}

      {menu && (
        <div className="menu-sheet" id="menu-sheet">
          <p className="label">Product</p>
          <ul>
            {[...PRODUCT_LINKS.platform.slice(0, 3), { to: '/app', label: 'Open the console', note: '' }].map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
            {NAV.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
          <Link className="btn btn--ink" to="/demo">
            Book a walkthrough
          </Link>
        </div>
      )}
    </header>
  );
}
