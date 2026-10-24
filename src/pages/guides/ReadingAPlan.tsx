import { Article, LiveBox } from './Article';
import { Link } from '../../router';
import { useSim } from '../../sim/store';
import { useEnsurePlan } from '../../app/common';
import { PROFILE_UNIT } from '../../sim/scenario';

export default function ReadingAPlan() {
  useEnsurePlan();
  const plan = useSim((s) => s.plan);
  const live = useSim((s) => s.live);
  const scenario = useSim((s) => s.scenario);
  const profile = useSim((s) => s.settings.profile);
  const [, units] = PROFILE_UNIT[profile];

  const view = live ?? plan?.optimized;
  const n = view ? view.routes.flat().length : 0;
  const cap = scenario?.fleet.capacity ?? 0;
  const shift = scenario?.fleet.shiftSec ?? 1;
  const longest = view ? Math.max(...view.stats.routes.map((r) => r.duration)) : 0;
  const loadPct = view ? Math.round((view.stats.load / (view.stats.vans * cap)) * 100) : 0;
  const emptiest = view ? Math.min(...view.stats.routes.filter((r) => r.stops).map((r) => r.load / cap)) : 0;

  return (
    <Article slug="reading-a-route-plan">
      <p className="prose__lead">
        A route plan arrives as a map full of coloured lines, and the lines tell you almost nothing. Five numbers tell you nearly everything.
        Here they are, with the values from the plan in this browser beside each one.
      </p>

      <h2>1. Distance per drop</h2>
      <p>
        Total kilometres divided by the number of deliveries. It is the single best number for comparing two plans of the same orders, because
        it doesn’t care how many vans you used. On dense city work it should be well under a kilometre; a plan that sends vans criss-crossing the
        river will show it here first.
      </p>
      <LiveBox title="In your plan">
        {view ? (
          <p>
            <strong className="mono">{(view.stats.distance / 1000 / Math.max(1, n)).toFixed(2)} km</strong> per drop across {n} drops
            {plan ? (
              <>
                , against <strong className="mono">{(plan.baseline.stats.distance / 1000 / plan.n).toFixed(2)} km</strong> in the manual plan
              </>
            ) : null}
            .
          </p>
        ) : (
          <p className="mono">Planning…</p>
        )}
      </LiveBox>

      <h2>2. Vans used against vans available</h2>
      <p>
        Every van that leaves the gate costs a driver’s day. A plan that uses fewer vans for the same orders is usually worth more than one that
        saves a few kilometres. If a plan needs more vans than you have, it isn’t a plan, and a good planner says so instead of quietly dropping
        orders.
      </p>
      <LiveBox title="In your plan">
        {view && scenario ? (
          <p>
            <strong className="mono">
              {view.stats.vans} of {scenario.fleet.vans}
            </strong>{' '}
            vans{plan ? `, against ${plan.baseline.stats.vans} in the manual plan` : ''}. {view.stats.fleetOk ? 'Within the fleet.' : 'More than the fleet has.'}
          </p>
        ) : (
          <p className="mono">Planning…</p>
        )}
      </LiveBox>

      <h2>3. Average load</h2>
      <p>
        How full the vans are, on average, as a share of what they can carry. High is good, but look at the spread too: one van at 40% next to
        nine at 98% usually means the last route was built from leftovers, and those stops might sit better elsewhere.
      </p>
      <LiveBox title="In your plan">
        {view ? (
          <p>
            Average <strong className="mono">{loadPct}%</strong> of {cap} {units}; the emptiest van is at{' '}
            <strong className="mono">{Math.round(emptiest * 100)}%</strong>.
          </p>
        ) : (
          <p className="mono">Planning…</p>
        )}
      </LiveBox>

      <h2>4. The longest shift</h2>
      <p>
        Totals hide the driver who gets the worst route. Check the longest working day in the plan against your shift limit, including the time spent
        at doors, not just driving. If it is close to the limit, the plan has no slack for the morning’s first surprise.
      </p>
      <LiveBox title="In your plan">
        {view ? (
          <p>
            Longest route takes <strong className="mono">{(longest / 3600).toFixed(1)} h</strong> of a {shift / 3600}-hour shift (
            {Math.round((longest / shift) * 100)}%).
          </p>
        ) : (
          <p className="mono">Planning…</p>
        )}
      </LiveBox>

      <h2>5. The gap to a plan you’d make by hand</h2>
      <p>
        A routing tool’s numbers mean nothing without a baseline. Ask any planner, human or software, to show the same orders planned the
        simple way, area by area and nearest stop next, and compare all four numbers above. If the tool can’t show you that comparison, you
        can’t tell what it is worth.
      </p>
      <LiveBox title="In your plan">
        {plan ? (
          <p>
            Firstlight’s plan is{' '}
            <strong className="mono">{Math.round((1 - plan.optimized.stats.distance / plan.baseline.stats.distance) * 100)}% shorter</strong> and uses{' '}
            <strong className="mono">{plan.baseline.stats.vans - plan.optimized.stats.vans}</strong> fewer van
            {plan.baseline.stats.vans - plan.optimized.stats.vans === 1 ? '' : 's'} than the manual plan for the same {plan.n} orders. Simulated, not a
            customer result.
          </p>
        ) : (
          <p className="mono">Planning…</p>
        )}
      </LiveBox>

      <h2>Try it</h2>
      <p>
        Open the <Link to="/app/reports">reports</Link> to see all five for the manual plan, the planned day and the day as it ran, or change the
        scenario in <Link to="/app/settings">settings</Link> and watch which numbers move.
      </p>
    </Article>
  );
}
