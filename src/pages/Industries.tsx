import { Link, navigate } from '../router';
import { Plate } from '../components/media';
import { PRESETS, presetOf, type Preset } from '../sim/presets';
import { PROFILE_UNIT } from '../sim/scenario';
import { applySettings, requestPlan, useSim } from '../sim/store';

function LiveResult({ p }: { p: Preset }) {
  const settings = useSim((s) => s.settings);
  const plan = useSim((s) => s.plan);
  const scenario = useSim((s) => s.scenario);
  const active = presetOf(settings)?.id === p.id;
  if (!active) return null;
  if (!plan || !scenario) return <p className="ind__live mono">This is the current scenario. Planning…</p>;
  const o = plan.optimized.stats;
  const b = plan.baseline.stats;
  const maxLoad = Math.max(...o.routes.map((r) => r.load / scenario.fleet.capacity));
  const maxShift = Math.max(...o.routes.map((r) => r.duration / scenario.fleet.shiftSec));
  return (
    <p className="ind__live mono">
      Current scenario · Firstlight: {o.vans} vans, {(o.distance / 1000).toFixed(1)} km against the manual plan’s {b.vans} vans,{' '}
      {(b.distance / 1000).toFixed(1)} km. Fullest van at {Math.round(maxLoad * 100)}% of capacity, longest shift {Math.round(maxShift * 100)}%
      of the limit: {maxLoad >= maxShift ? 'capacity is binding' : 'the shift is binding'}.
    </p>
  );
}

export default function Industries() {
  const settings = useSim((s) => s.settings);
  const active = presetOf(settings);

  const load = (p: Preset) => {
    applySettings(p.settings, `Loaded the ${p.name} scenario`);
    void requestPlan().catch(() => {});
    void navigate('/app/planner');
  };

  return (
    <div className="industries">
      <header className="pagehead">
        <div className="wrap">
          <p className="label">Industries</p>
          <h1>Same city. Four very different delivery days.</h1>
          <p className="pagehead__lede">
            What a van carries and how long each door takes changes which limit runs out first. Each scenario below is a set of simulation inputs
            you can load into the console and plan for yourself: they are illustrative settings, not industry statistics.
          </p>
          <nav className="ind__jump" aria-label="Jump to an industry">
            {PRESETS.map((p) => (
              <a key={p.id} href={`#${p.id}`} className={active?.id === p.id ? 'is-active' : ''}>
                {p.name}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {PRESETS.map((p, i) => {
        const units = PROFILE_UNIT[p.settings.profile][1];
        return (
          <section key={p.id} id={p.id} className={`modrow ${i % 2 ? 'modrow--flip' : ''}`} aria-labelledby={`${p.id}-title`}>
            <div className="wrap modrow__grid">
              <div className="modrow__text">
                <p className="label">{p.short}</p>
                <h2 id={`${p.id}-title`} className="modrow__claim">
                  {p.name}
                </h2>
                <p className="modrow__body">{p.day}</p>
                <dl className="ind__inputs">
                  <div>
                    <dt>Orders</dt>
                    <dd className="mono">{p.settings.orders}</dd>
                  </div>
                  <div>
                    <dt>Per van</dt>
                    <dd className="mono">
                      {p.settings.capacity} {units}
                    </dd>
                  </div>
                  <div>
                    <dt>At each door</dt>
                    <dd className="mono">{p.settings.serviceMin} min</dd>
                  </div>
                  <div>
                    <dt>Shift</dt>
                    <dd className="mono">{p.settings.shiftHours} h</dd>
                  </div>
                  <div>
                    <dt>Typical drop</dt>
                    <dd className="mono">
                      {p.settings.profile === 'building' ? '4–12' : p.settings.profile === 'pharmacy' ? '1–3' : p.settings.profile === 'grocery' ? '2–5' : '1–6'}{' '}
                      {units}
                    </dd>
                  </div>
                </dl>
                <p className="ind__binding">
                  <strong>What runs out first:</strong> {p.binding}
                </p>
                <LiveResult p={p} />
                <div className="hero-field__ctas">
                  <button className="btn btn--primary" onClick={() => load(p)}>
                    Plan this day in the console →
                  </button>
                  {active?.id === p.id && (
                    <Link className="btn btn--quiet" to="/app">
                      Watch it in the control tower
                    </Link>
                  )}
                </div>
              </div>
              <Plate id={p.photo} no={`0${i + 6}`} title={p.short} ratio="4 / 5" sizes="(min-width: 1080px) 40vw, 100vw" />
            </div>
          </section>
        );
      })}

      <section className="wrap platform__cta">
        <h2 className="section-title">Your day isn’t on this list?</h2>
        <p className="section-lede">
          Every input is adjustable in Settings, and orders can be imported from a spreadsheet. A walkthrough starts from your own orders.
        </p>
        <div className="hero-field__ctas">
          <Link className="btn btn--ink" to="/app/settings">
            Adjust the scenario
          </Link>
          <Link className="btn btn--quiet" to="/integrations#import">
            Import orders from CSV
          </Link>
        </div>
      </section>
    </div>
  );
}
