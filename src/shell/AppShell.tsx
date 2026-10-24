import type { ReactNode } from 'react';
import { Link, useLocation } from '../router';
import { findRoute } from '../routes';
import { Wordmark } from './SiteHeader';
import { Icon } from './icons';
import { clock, pause, play, setSimTime, setSpeed, useSim } from '../sim/store';
import { PROFILE_UNIT } from '../sim/scenario';

const NAV = [
  { to: '/app', label: 'Control tower', icon: 'tower' },
  { to: '/app/planner', label: 'Planner', icon: 'planner' },
  { to: '/app/dispatch', label: 'Dispatch', icon: 'dispatch' },
  { to: '/app/fleet', label: 'Fleet', icon: 'fleet' },
  { to: '/app/driver', label: 'Driver app', icon: 'driver' },
  { to: '/app/track', label: 'Tracking', icon: 'track' },
  { to: '/app/disruptions', label: 'Disruptions', icon: 'disruption' },
  { to: '/app/reports', label: 'Reports', icon: 'reports' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' },
];

const SPEEDS = [
  { v: 60, label: '1 min/s' },
  { v: 300, label: '5 min/s' },
  { v: 900, label: '15 min/s' },
];

function SimClock() {
  const sim = useSim((s) => s.sim);
  const ready = useSim((s) => !!s.live);
  return (
    <div className="simclock" role="group" aria-label="Simulation clock">
      <button
        className="simclock__play"
        onClick={() => (sim.playing ? pause() : play())}
        disabled={!ready}
        aria-label={sim.playing ? 'Pause the simulated day' : 'Play the simulated day'}
      >
        <Icon name={sim.playing ? 'pause' : 'play'} size={16} />
      </button>
      <output className="simclock__time mono" aria-live="off">
        {clock(sim.sec)}
      </output>
      <label className="sr-only" htmlFor="sim-time">
        Simulated time of day
      </label>
      <input
        id="sim-time"
        className="simclock__range"
        type="range"
        min={6 * 3600}
        max={20 * 3600}
        step={60}
        value={sim.sec}
        onChange={(e) => setSimTime(+e.target.value)}
        aria-valuetext={clock(sim.sec)}
        disabled={!ready}
      />
      <label className="sr-only" htmlFor="sim-speed">
        Simulation speed
      </label>
      <select id="sim-speed" className="simclock__speed" value={sim.speed} onChange={(e) => setSpeed(+e.target.value)}>
        {SPEEDS.map((s) => (
          <option key={s.v} value={s.v}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LiveBadge() {
  const scenario = useSim((s) => s.scenario);
  const live = useSim((s) => s.live);
  const status = useSim((s) => s.planStatus);
  const busy = useSim((s) => s.liveBusy);
  const settings = useSim((s) => s.settings);
  const edits = useSim((s) => s.edits);
  const unit = PROFILE_UNIT[settings.profile][1];
  let text = 'Loading the day…';
  if (status === 'solving') text = 'Planning…';
  else if (live && scenario) text = `${scenario.orders.length} orders · ${live.stats.vans} vans · ${(live.stats.distance / 1000).toFixed(1)} km`;
  else if (scenario) text = `${scenario.orders.length} orders · ${scenario.fleet.vans} vans · ${scenario.fleet.capacity} ${unit} each`;
  return (
    <p className="livebadge mono" aria-live="polite">
      <span className={`livebadge__dot ${busy || status === 'solving' ? 'is-busy' : live ? 'is-live' : ''}`} aria-hidden />
      {text}
      {edits > 0 && (
        <span className="livebadge__tag">
          edited · {edits} change{edits === 1 ? '' : 's'}
        </span>
      )}
    </p>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const route = findRoute(loc.path);
  const title = route.title.replace(/ — Firstlight$/, '');
  return (
    <div className="console">
      <a className="skip" href="#console-main">
        Skip to content
      </a>
      <aside className="console__side">
        <Link className="wordmark console__brand" to="/" aria-label="Firstlight website">
          <Wordmark />
        </Link>
        <p className="console__env mono">Console · simulation</p>
        <nav aria-label="Console">
          <ul>
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="console__link">
                  <Icon name={n.icon} />
                  <span>{n.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="console__foot">
          <Link to="/" className="console__back">
            <Icon name="back" size={16} /> Back to the website
          </Link>
          <p className="console__note">
            Fictional product. Every figure here is computed from a simulated day on generated orders.
          </p>
        </div>
      </aside>
      <div className="console__main">
        <header className="console__bar">
          <h1 className="console__title">{title}</h1>
          <LiveBadge />
          <SimClock />
        </header>
        <main id="console-main" className="console__page" tabIndex={-1} data-clock="11:00">
          {children}
        </main>
      </div>
    </div>
  );
}
