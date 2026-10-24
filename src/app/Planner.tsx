import { Untangle } from '../components/Untangle';
import { PlanTable } from '../components/DispatchSheet';
import { applySettings, useSim } from '../sim/store';
import { PRESETS, presetOf } from '../sim/presets';
import { Link } from '../router';
import { useMediaQuery } from '../lib/hooks';
import { Panel, useEnsurePlan, useUnits } from './common';

export default function Planner() {
  useEnsurePlan();
  const compact = useMediaQuery('(max-width: 720px)');
  const settings = useSim((s) => s.settings);
  const scenario = useSim((s) => s.scenario);
  const preset = presetOf(settings);
  const [, units] = useUnits();

  return (
    <div className="planner">
      <div className="planner__bar">
        <p className="planner__summary">
          <strong>{preset ? preset.name : 'Custom scenario'}</strong>
          <span className="mono muted">
            {' '}
            · {scenario?.orders.length ?? settings.orders} orders · {settings.vans} vans × {settings.capacity} {units} · {settings.shiftHours} h shifts ·{' '}
            {settings.serviceMin} min per stop
          </span>
        </p>
        <div className="planner__tools">
          <label className="sr-only" htmlFor="preset">
            Load an industry scenario
          </label>
          <select
            id="preset"
            className="select"
            value={preset?.id ?? ''}
            onChange={(e) => {
              const p = PRESETS.find((x) => x.id === e.target.value);
              if (p) applySettings(p.settings, `Loaded the ${p.name} scenario`);
            }}
          >
            {!preset && <option value="">Custom scenario</option>}
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Link className="chip" to="/app/settings">
            Settings
          </Link>
          <Link className="chip" to="/integrations#import">
            Import CSV
          </Link>
        </div>
      </div>

      <section className="hero hero--console" aria-label="Route planner">
        <div className="hero__intro">
          <p className="hero__lede">
            The solver’s plan for today’s orders, against the manual baseline. Move the depot or add an urgent order and both plans are
            rebuilt. Changes made in Dispatch and Fleet edit the <Link to="/app/fleet">live plan</Link>, not this one.
          </p>
        </div>
        <Untangle compact={compact} startRevealed />
      </section>

      <Panel title="Dispatch sheet">
        <PlanTable views={['baseline', 'optimized', 'live']} initial="optimized" />
      </Panel>
    </div>
  );
}
