import { Article, LiveBox } from './Article';
import { Link } from '../../router';
import { applySettings, requestPlan, useSim } from '../../sim/store';
import { useEnsurePlan } from '../../app/common';
import { PRESETS, presetOf } from '../../sim/presets';
import { PROFILE_UNIT } from '../../sim/scenario';

function Binding() {
  const plan = useSim((s) => s.plan);
  const scenario = useSim((s) => s.scenario);
  const settings = useSim((s) => s.settings);
  const status = useSim((s) => s.planStatus);
  const active = presetOf(settings);
  const [, units] = PROFILE_UNIT[settings.profile];

  let body = <p className="mono">Planning…</p>;
  if (plan && scenario) {
    const o = plan.optimized.stats;
    const used = o.routes.filter((r) => r.stops);
    const load = used.reduce((a, r) => a + r.load / scenario.fleet.capacity, 0) / used.length;
    const time = used.reduce((a, r) => a + r.duration / scenario.fleet.shiftSec, 0) / used.length;
    const binding = load >= time ? 'capacity' : 'the shift';
    body = (
      <>
        <div className="bars" aria-hidden>
          <span className="bars__row">
            <span className="bars__k">Capacity used</span>
            <span className="bars__track">
              <span style={{ width: `${Math.min(100, load * 100)}%` }} />
            </span>
            <span className="mono">{Math.round(load * 100)}%</span>
          </span>
          <span className="bars__row">
            <span className="bars__k">Shift used</span>
            <span className="bars__track bars__track--shift">
              <span style={{ width: `${Math.min(100, time * 100)}%` }} />
            </span>
            <span className="mono">{Math.round(time * 100)}%</span>
          </span>
        </div>
        <p>
          {active ? active.name : 'The current scenario'}: on average each van is{' '}
          <strong className="mono">{Math.round(load * 100)}%</strong> full and uses <strong className="mono">{Math.round(time * 100)}%</strong> of its
          shift, so <strong>{binding}</strong> is the limit that runs out first. {o.vans} vans carry {o.load} {units}.
        </p>
      </>
    );
  }
  return (
    <LiveBox title="Which limit binds in your scenario">
      {body}
      <div className="livebox__actions" role="group" aria-label="Try another kind of day">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`chip ${active?.id === p.id ? 'is-on' : ''}`}
            aria-pressed={active?.id === p.id}
            disabled={status === 'solving'}
            onClick={() => {
              applySettings(p.settings, `Loaded the ${p.name} scenario`);
              void requestPlan().catch(() => {});
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
    </LiveBox>
  );
}

export default function CapacityOrShift() {
  useEnsurePlan();
  return (
    <Article slug="capacity-or-shift">
      <p className="prose__lead">
        Every delivery van runs out of something first: room, or time. Which one decides how many vans you need, and it changes with what you deliver
        far more than with where you deliver it.
      </p>

      <h2>Two limits, one plan</h2>
      <p>
        A van can only carry so much, and a driver can only work so long. A route is legal only if it fits both. When the load fills up first, the
        plan is <em>capacity-bound</em>: adding a van is the only way to take more orders. When the hours run out first, it is <em>shift-bound</em>:
        the van has room but no time left to use it.
      </p>

      <Binding />

      <h2>Why it matters for the fleet you need</h2>
      <p>
        On a capacity-bound day, shorter routes save fuel but rarely save a van: the crates still have to go somewhere. The levers are bigger vans,
        fewer part-empty routes, and orders that fill vans evenly. On a shift-bound day, every minute saved at doors or on the road turns into more
        drops per van, so faster handovers and tighter sequencing can take a whole van off the road.
      </p>
      <p>
        The four industry scenarios show this clearly. Building supplies, with long unloading at each site, behaves very differently from pharmacy
        supply, where totes are light and drops are many. Switch between them above and watch the bars swap.
      </p>

      <h2>How to check your own operation</h2>
      <ol>
        <li>Take one ordinary day of orders and plan it.</li>
        <li>For each van, compare load against capacity and working time against the shift.</li>
        <li>Average both across vans. The higher one is your binding limit.</li>
        <li>Spend improvement effort on that limit first; savings on the other one rarely change the number of vans.</li>
      </ol>
      <p>
        In the console, <Link to="/app/reports">Reports</Link> shows load and time for every van, and <Link to="/app/settings">Settings</Link> lets you
        change capacity, shift length and time at the door to see which change actually saves a van.
      </p>
    </Article>
  );
}
