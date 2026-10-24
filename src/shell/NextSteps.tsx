import { Link } from '../router';

/**
 * "Where to next": every public page ends with the two or three most useful next steps, so a
 * first-time visitor always has an obvious way forward through the site.
 */

interface Next {
  to: string;
  kicker: string;
  title: string;
}

const CONSOLE: Next = { to: '/app', kicker: 'Try it', title: 'Open the console and run the day' };
const DEMO: Next = { to: '/demo', kicker: 'Talk to us', title: 'Book a 30-minute walkthrough' };
const PRICING: Next = { to: '/pricing', kicker: 'Cost', title: 'See per-van pricing' };
const PLATFORM: Next = { to: '/platform', kicker: 'Overview', title: 'The six modules, one by one' };
const DEPOT: Next = { to: '/depot', kicker: '360°', title: 'Your plan on a real depot floor' };
const ENGINE: Next = { to: '/engine', kicker: 'Under the hood', title: 'How the routing engine works' };

const MAP: Record<string, Next[]> = {
  '/platform': [CONSOLE, DEPOT, PRICING],
  '/depot': [CONSOLE, PLATFORM, DEMO],
  '/industries': [CONSOLE, PRICING, DEMO],
  '/pricing': [DEMO, CONSOLE, { to: '/security', kicker: 'Trust', title: 'Data and security' }],
  '/integrations': [CONSOLE, { to: '/security', kicker: 'Trust', title: 'Data and security' }, DEMO],
  '/engine': [CONSOLE, { to: '/resources', kicker: 'Guides', title: 'Practical reading for dispatchers' }, DEMO],
  '/security': [{ to: '/integrations', kicker: 'Connect', title: 'Integrations and CSV import' }, PRICING, DEMO],
  '/resources': [CONSOLE, ENGINE, DEMO],
  '/demo': [CONSOLE, PRICING, PLATFORM],
  '/case-study': [{ to: '/', kicker: 'The work', title: 'Explore Firstlight from the start' }, CONSOLE, DEPOT],
  '/credits': [{ to: '/', kicker: 'Home', title: 'Back to the start' }, CONSOLE, { to: '/case-study', kicker: 'BrandShift', title: 'Read the case study' }],
};

export function NextSteps({ path }: { path: string }) {
  const items = MAP[path] ?? (path.startsWith('/resources/') ? [CONSOLE, { to: '/resources', kicker: 'Guides', title: 'More guides' }, DEMO] : null);
  if (!items) return null;
  return (
    <nav className="next" aria-labelledby="next-title">
      <div className="wrap">
        <h2 id="next-title" className="label">
          Where to next
        </h2>
        <ul className="next__list">
          {items.map((n) => (
            <li key={n.to}>
              <Link to={n.to} className="next__card">
                <span className="next__kicker mono">{n.kicker}</span>
                <span className="next__title">{n.title}</span>
                <span className="next__go" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
