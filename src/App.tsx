import { useEffect, useRef, useState } from 'react';
import { useDocumentMeta, useLocation } from './router';
import { findRoute, getLoaded } from './routes';
import { SiteHeader } from './shell/SiteHeader';
import { SiteFooter } from './shell/SiteFooter';
import { AppShell } from './shell/AppShell';
import { initSimulation } from './sim/store';
import { refreshDaylight, startDaylight } from './lib/daylight';
import { refreshReveal } from './lib/reveal';

export function App() {
  const loc = useLocation();
  const route = findRoute(loc.path);
  const Page = getLoaded(loc.path);
  const [announce, setAnnounce] = useState('');
  const first = useRef(true);
  useDocumentMeta(route.title, route.description);

  useEffect(() => {
    initSimulation(matchMedia('(max-width: 720px)').matches);
  }, []);
  useEffect(() => startDaylight(), []);

  useEffect(() => {
    refreshDaylight();
    // after the new page has laid out
    const raf = requestAnimationFrame(() => requestAnimationFrame(refreshReveal));
    if (first.current) {
      first.current = false;
      return;
    }
    // After client-side navigation, move focus to the new page and announce it,
    // as a full page load would for screen-reader users.
    const main = document.getElementById(route.chrome === 'app' ? 'console-main' : 'main');
    main?.focus({ preventScroll: true });
    setAnnounce(route.title);
    return () => cancelAnimationFrame(raf);
  }, [loc.path, route.chrome, route.title]);

  const content = Page ? <Page /> : <div className="page-loading" aria-busy="true" />;

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {route.chrome === 'app' ? (
        <AppShell>{content}</AppShell>
      ) : (
        <>
          <a className="skip" href="#main">
            Skip to content
          </a>
          <SiteHeader overlay={loc.path === '/'} />
          <main id="main" tabIndex={-1} data-clock="10:00">
            {content}
          </main>
          <SiteFooter />
        </>
      )}
    </>
  );
}
