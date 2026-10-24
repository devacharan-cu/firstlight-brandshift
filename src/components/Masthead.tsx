import { useEffect, useRef, useState } from 'react';

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

const LINKS = [
  { href: '/#day', label: 'The day' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#how', label: 'How it works' },
  { href: '/case-study.html', label: 'Case study' },
];

export function Masthead({ home = true }: { home?: boolean }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="masthead">
      <div className="strip">
        {!home ? (
          <>
            <span className="strip__clock">Case study</span>
            <span className="strip__sep">/</span>
            <span>Firstlight is a fictional product</span>
            <a className="strip__right strip__hide-sm" href="/">
              Back to the demo →
            </a>
          </>
        ) : (
          <>
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
            <a className="strip__right strip__hide-sm" href="/case-study.html">
              A BrandShift showcase →
            </a>
          </>
        )}
      </div>
      <nav className="nav" aria-label="Main">
        <a className="wordmark" href={home ? '#top' : '/'} aria-label="Firstlight home">
          <Wordmark />
        </a>
        <ul className="nav__links">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>
        <a className="btn btn--ink nav__cta" href="/#book">
          Book a walkthrough
        </a>
        <button
          ref={btnRef}
          className="btn btn--quiet nav__menu"
          aria-expanded={open}
          aria-controls="menu-sheet"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </nav>
      {open && (
        <div className="menu-sheet" id="menu-sheet">
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <a className="btn btn--ink" href="/#book" onClick={() => setOpen(false)}>
            Book a walkthrough
          </a>
        </div>
      )}
    </header>
  );
}
