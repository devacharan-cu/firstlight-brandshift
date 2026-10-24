import { Chapter } from './Chapter';
import { getCity, useSim } from '../sim/store';
import { LAMBDAS } from '../sim/solver';
import { ZONE_COLS, ZONE_ROWS } from '../sim/scenario';

export function HowItWorks() {
  const city = getCity();
  const plan = useSim((s) => s.plan);
  const scenario = useSim((s) => s.scenario);
  const roundTrip = useSim((s) => s.roundTripMs);
  const baselineMs = useSim((s) => s.baseline?.ms);
  const n = scenario?.orders.length ?? 0;
  const f = scenario?.fleet;
  const c = plan?.counters;
  const ms = (v?: number) => (v === undefined ? '—' : `${v.toFixed(0)} ms`);

  return (
    <Chapter id="how" clock="19:30" note="Under the hood" title="What the planner actually does, and what it doesn’t.">
      <p className="chapter__lede">
        No black box and no fake AI. The demo above runs the same code described here, inside a Web Worker in your browser, so the
        page stays responsive while it thinks.
      </p>

      <ol className="pipeline" aria-label="Planning pipeline with timings from your last run">
        <li>
          <span className="pipeline__ms mono">{ms(plan?.timings.matrixMs)}</span>
          <strong>Road distances</strong>
          <span>
            Dijkstra’s shortest paths from each of {n + 1} locations over {city.nodeCount.toLocaleString('en-IN')} junctions and{' '}
            {city.edgeCount.toLocaleString('en-IN')} street segments: {((n + 1) ** 2).toLocaleString('en-IN')} distances.
          </span>
        </li>
        <li>
          <span className="pipeline__ms mono">{ms(plan?.timings.baselineMs)}</span>
          <strong>Manual baseline</strong>
          <span>
            Orders grouped into {ZONE_COLS * ZONE_ROWS} fixed delivery areas; vans loaded nearest-next from the depot until a crate
            or shift limit is reached.
          </span>
        </li>
        <li>
          <span className="pipeline__ms mono">{ms(plan?.timings.optimizeMs)}</span>
          <strong>Savings, then local search</strong>
          <span>
            Clarke–Wright savings from {LAMBDAS.length} starts (λ = {LAMBDAS.join(', ')}), each improved by 2-opt, relocate, swap,
            tail exchange between vans and van elimination until no move helps.
            {c && ` Last run: ${c.twoOpt + c.relocate + c.swap + c.twoOptStar + c.eliminated} improving moves, best start λ = ${plan!.chosenLambda}.`}
          </span>
        </li>
        <li>
          <span className="pipeline__ms mono">{ms(plan?.timings.geometryMs)}</span>
          <strong>Back onto streets</strong>
          <span>Every leg is traced along its shortest path, so the lines you see are the distances that were counted.</span>
        </li>
      </ol>
      <p className="fineprint">
        {plan
          ? `Measured in the worker on this device. Round trip including messaging: ${ms(roundTrip ?? undefined)}. Shortest-path trees are cached once computed, so road distances are fast after the first load${baselineMs !== undefined ? ` (first load, including the manual plan: ${ms(baselineMs)})` : ''}.`
          : 'Timings appear after the planner has run.'}
      </p>

      <div className="ledger">
        <section>
          <h3>Enforced</h3>
          <ul>
            <li>Van capacity: {f?.capacity ?? 90} crates</li>
            <li>
              Shift length: {f ? f.shiftSec / 3600 : 9} hours, counting driving at 18 km/h and {f ? f.serviceSec / 60 : 6} minutes at each stop
            </li>
            <li>Fleet size: {f?.vans ?? 16} vans. Plans that need more are reported, not hidden.</li>
            <li>Every order served exactly once, in both plans</li>
          </ul>
        </section>
        <section>
          <h3>Not modelled here</h3>
          <ul>
            <li>Delivery time windows and customer opening hours</li>
            <li>Traffic, road speeds by type, turn restrictions</li>
            <li>Driver breaks, multiple depots, mixed vehicle types</li>
            <li>Real geography: Kesarnagar is generated, and distances are along its invented streets</li>
          </ul>
        </section>
        <section>
          <h3>Reproducible</h3>
          <ul>
            <li>Seeded city, seeded orders: the same inputs always give the same plan</li>
            <li>Results are heuristic, so good plans, not proven-optimal ones</li>
            <li>Savings are the difference between two plans of the same orders, never a customer outcome</li>
          </ul>
        </section>
      </div>
    </Chapter>
  );
}
