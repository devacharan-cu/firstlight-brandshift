import { Article, LiveBox } from './Article';
import { Link } from '../../router';
import { useSim } from '../../sim/store';

export default function BridgeCloses() {
  const d = useSim((s) => s.disruption);
  return (
    <Article slug="when-a-bridge-closes">
      <p className="prose__lead">
        Half an hour before the vans leave, a bridge is shut. Every route that crossed it is now wrong. There are four things a dispatcher can do,
        and the obvious one, re-planning everything, is usually the worst for the people involved.
      </p>

      <h2>1. Keep the routes and detour</h2>
      <p>
        Each van keeps its stops in the same order and simply drives around the closure. Nothing changes for drivers or customers except arrival
        times, and that is the problem: a detour that made sense for one leg can send a van back and forth across the river several times.
      </p>

      <h2>2. Re-sequence each affected van</h2>
      <p>
        Keep each van’s stops but change the order to suit the streets that are open. It sounds like the sensible middle ground. When we built
        Firstlight we tried exactly this first, for a van that had already been loaded mid-morning, and it barely helped: the route was already a
        good order for that set of stops, so re-ordering saved almost nothing over detouring. The stops were on the wrong van, not in the wrong
        order.
      </p>

      <h2>3. Re-plan only the vans that crossed it</h2>
      <p>
        Take every stop from the routes that used the bridge and plan them again, on those vans, on the streets that are still open. Stops can move
        between the affected vans; every other driver keeps the day they were handed. This is the default in Firstlight because it recovers most
        of the distance while changing the fewest people’s plans.
      </p>

      <h2>4. Re-plan everything</h2>
      <p>
        Mathematically it can be the shortest. Operationally it reshuffles every driver’s route and moves hundreds of customers’ arrival windows, for
        a small gain. Firstlight computes it as a reference so you can see what it would buy, and doesn’t apply it.
      </p>

      <LiveBox title={d ? `Your last closure: ${d.bridgeName}` : 'Try it on your plan'}>
        {d ? (
          <ul className="livebox__list">
            <li>
              As planned: <strong className="mono">{(d.planned.stats.distance / 1000).toFixed(1)} km</strong>
            </li>
            <li>
              Detouring: <strong className="mono">{(d.keep.stats.distance / 1000).toFixed(1)} km</strong>
            </li>
            <li>
              Re-planning the {d.crossing.length} affected van{d.crossing.length === 1 ? '' : 's'}:{' '}
              <strong className="mono">{(d.replan.stats.distance / 1000).toFixed(1)} km</strong>, with {d.changedEtas} customers’ arrival times
              moving 5 minutes or more
            </li>
            <li>
              Re-planning everything (reference): <strong className="mono">{(d.full.distance / 1000).toFixed(1)} km</strong>
            </li>
          </ul>
        ) : (
          <p>
            Close a bridge in the <Link to="/app/disruptions">disruptions</Link> console and the numbers for your own plan will appear here.
          </p>
        )}
      </LiveBox>

      <h2>What to tell customers</h2>
      <p>
        Whatever you choose, the customers whose windows moved should hear it from you before they notice. Because Firstlight knows every stop’s new
        arrival time, it can send corrected windows only to those customers, not a blanket apology to everyone. See it on the{' '}
        <Link to="/app/track">tracking page</Link>.
      </p>
    </Article>
  );
}
