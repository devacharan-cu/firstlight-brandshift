import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Chapter } from './Chapter';
import { MiniMap, type MapLayer, type MapMarker } from './MiniMap';
import { clearDisruption, getCity, requestDisruption, requestPlan, useSim } from '../sim/store';
import { routeColor } from '../map/draw';
import { fmtH, fmtKm, useNearViewport } from '../lib/hooks';
import type { PlanStats } from '../sim/solver';

const signedKm = (m: number) => `${m >= 0 ? '+' : '−'}${fmtKm(Math.abs(m))}`;

function Wrap({ bare, children }: { bare: boolean; children: ReactNode }) {
  if (bare) return <>{children}</>;
  return (
    <Chapter clock="07:30" note="Disruption" title="The bridge closes. The plan doesn’t fall over.">
      <p className="chapter__lede">
        Half an hour before the vans leave, a bridge is shut for repairs, and every route that crossed it is now wrong. Pick a
        crossing and close it. Firstlight re-plans only the vans that need it, on the streets that are still open.
      </p>
      {children}
    </Chapter>
  );
}

/** Bridge-closure what-if. On the home page it is a chapter; in the console it renders bare. */
export function Disruption({ bare = false }: { bare?: boolean }) {
  const city = getCity();
  const scenario = useSim((s) => s.scenario);
  const plan = useSim((s) => s.plan);
  const d = useSim((s) => s.disruption);
  const dStatus = useSim((s) => s.disruptionStatus);
  const [ref, near] = useNearViewport<HTMLDivElement>('400px');
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    if (near && !plan) requestPlan().catch(() => {});
  }, [near, plan]);

  const bridges = useMemo(() => plan?.bridgeUse ?? city.bridges.map((b) => ({ ...b, legs: 0 })), [plan, city]);
  const busiest = useMemo(() => [...bridges].sort((a, b) => b.legs - a.legs)[0]?.edge ?? null, [bridges]);
  const edge = chosen ?? busiest;
  const bridgeName = bridges.find((b) => b.edge === edge)?.name ?? 'the bridge';
  const result = d && d.closedEdge === edge ? d : null;

  const { layers, markers } = useMemo(() => {
    const layers: MapLayer[] = [];
    const markers: MapMarker[] = [];
    if (!scenario || edge === null) return { layers, markers };
    if (result) {
      result.crossing.forEach((k) =>
        layers.push({ path: result.planned.geometry[k].path, color: '#17140f', width: 1.4, dash: [4, 4], alpha: 0.7 }),
      );
      result.replan.geometry.forEach((g, k) => {
        const changed = result.crossing.includes(k) || k >= result.planned.routes.length;
        if (g.path.length > 1) layers.push({ path: g.path, color: routeColor(k), width: changed ? 2.8 : 1.5, alpha: changed ? 1 : 0.35 });
      });
    } else if (plan) {
      plan.optimized.geometry.forEach((g, k) => layers.push({ path: g.path, color: routeColor(k), width: 1.6, alpha: 0.55 }));
    }
    const a = city.edgeA[edge];
    const b = city.edgeB[edge];
    markers.push({ node: scenario.depotNode, kind: 'depot' });
    markers.push({
      node: a,
      kind: result ? 'closed' : 'target',
      at: [(city.x[a] + city.x[b]) / 2, (city.y[a] + city.y[b]) / 2],
    });
    return { layers, markers };
  }, [result, plan, scenario, edge, city]);

  const shift = scenario?.fleet.shiftSec ?? 9 * 3600;
  const over = (s: PlanStats) => s.routes.filter((r) => r.duration > shift).length;
  const longest = (s: PlanStats) => Math.max(...s.routes.map((r) => r.duration));

  const rows = result
    ? [
        { name: 'As planned, bridge open', s: result.planned.stats },
        { name: 'Same routes, detouring', s: result.keep.stats },
        { name: 'Firstlight: affected vans re-planned', s: result.replan.stats },
        { name: 'Every route re-planned (reference)', s: result.full },
      ]
    : [];

  return (
    <Wrap bare={bare}>
      <div className="disrupt" ref={ref}>
        <div className="disrupt__controls">
          <p className="label">Kesar River crossings</p>
          <div className="bridgepick" role="radiogroup" aria-label="Bridge to close">
            {bridges.map((b) => (
              <button
                key={b.edge}
                role="radio"
                aria-checked={b.edge === edge}
                className="bridgepick__btn"
                onClick={() => setChosen(b.edge)}
              >
                <span>{b.name}</span>
                <span className="mono">{plan ? `${b.legs} route leg${b.legs === 1 ? '' : 's'} today` : '…'}</span>
              </button>
            ))}
          </div>
          {!result ? (
            <button
              className="btn btn--primary"
              disabled={!plan || dStatus === 'solving' || edge === null}
              onClick={() => edge !== null && requestDisruption(edge)}
            >
              {dStatus === 'solving' ? 'Re-planning…' : `Close ${bridgeName}`}
            </button>
          ) : (
            <button className="btn btn--quiet" onClick={clearDisruption}>
              Reopen {bridgeName}
            </button>
          )}

          <div aria-live="polite">
            {result && (
              <div className="disrupt__result">
                {result.crossing.length === 0 ? (
                  <p>No route used {result.bridgeName} today, so nothing needs to change. Try a busier crossing.</p>
                ) : (
                  <>
                    <dl className="tiles">
                      <div>
                        <dt>Routes that crossed it</dt>
                        <dd className="mono">{result.crossing.length}</dd>
                      </div>
                      <div>
                        <dt>Customers with an ETA moved 5+ min</dt>
                        <dd className="mono">{result.changedEtas}</dd>
                      </div>
                      <div>
                        <dt>Keep the routes, detour</dt>
                        <dd className="mono">{signedKm(result.keep.stats.distance - result.planned.stats.distance)} km</dd>
                      </div>
                      <div>
                        <dt>Re-plan the affected vans</dt>
                        <dd className="mono">{signedKm(result.replan.stats.distance - result.planned.stats.distance)} km</dd>
                      </div>
                    </dl>
                    <p className="disrupt__summary">
                      Re-planning saves <strong>{fmtKm(result.keep.stats.distance - result.replan.stats.distance)} km</strong>{' '}
                      compared with sending those vans the long way round, and only {result.crossing.length} driver
                      {result.crossing.length > 1 ? 's get' : ' gets'} a new route: the other{' '}
                      {result.planned.routes.length - result.crossing.length} keep the day they were handed at 06:15.{' '}
                      {over(result.keep.stats) > 0 &&
                        `Detouring would push ${over(result.keep.stats)} van${over(result.keep.stats) > 1 ? 's' : ''} past the 9-hour shift. `}
                      {result.replan.stats.feasible
                        ? 'The re-planned day fits every crate limit and shift.'
                        : 'The re-planned day still breaks a limit; Firstlight flags it rather than hiding it.'}{' '}
                      Solved in {result.ms.toFixed(0)} ms.
                    </p>
                    <table className="mini-table">
                      <caption className="sr-only">Three plans for the same orders</caption>
                      <thead>
                        <tr>
                          <th scope="col">Plan</th>
                          <th scope="col">Distance</th>
                          <th scope="col">Vans</th>
                          <th scope="col">Longest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.name}>
                            <th scope="row">{r.name}</th>
                            <td className="mono">{fmtKm(r.s.distance)} km</td>
                            <td className="mono">{r.s.vans}</td>
                            <td className="mono">
                              {fmtH(longest(r.s))} h{longest(r.s) > shift ? ' · over' : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <figure className="disrupt__map">
          <MiniMap
            layers={layers}
            markers={markers}
            label={
              result
                ? `${bridgeName} closed. Dashed lines are the ${result.crossing.length} routes that would have crossed it; coloured lines are the re-planned day.`
                : `Today's routes, with ${bridgeName} marked.`
            }
          />
          <figcaption className="fineprint">
            {result ? (
              <>
                <span className="legend-line legend-line--dash" /> routes that relied on {bridgeName}{' '}
                <span className="legend-line" /> re-planned routes; faded routes are unchanged. Every plan in the table uses the same
                orders, vans and street graph.
              </>
            ) : (
              'Route legs crossing each bridge are counted from your plan at the top of the page.'
            )}
          </figcaption>
        </figure>
      </div>
    </Wrap>
  );
}
