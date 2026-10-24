import { useState } from 'react';
import { Disruption } from '../components/Disruption';
import { LiveMap } from '../components/LiveMap';
import { applyBreakdown, clearBreakdown, frozenCounts, requestBreakdown, useSim } from '../sim/store';
import { Link } from '../router';
import { clock, km, pad, Panel, Planning, useEnsurePlan, useSimSec, useUnits, VanChip } from './common';

function Breakdown() {
  const scenario = useSim((s) => s.scenario);
  const live = useSim((s) => s.live);
  const b = useSim((s) => s.breakdown);
  const status = useSim((s) => s.breakdownStatus);
  const t = useSimSec(1000);
  const [, units] = useUnits();
  const [van, setVan] = useState<number | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  if (!live || !scenario) return null;

  const used = live.routes.map((r, k) => ({ r, k })).filter((x) => x.r.length);
  const chosen = van ?? used[0]?.k ?? 0;
  const frozen = frozenCounts();
  const open = live.routes[chosen].length - (frozen[chosen] ?? 0);
  const result = b && b.van === chosen ? b : null;
  const shiftH = scenario.fleet.shiftSec / 3600;

  return (
    <div className="breakdown">
      <div className="breakdown__controls">
        <label className="label" htmlFor="bd-van">
          Van that can’t go out
        </label>
        <div className="breakdown__row">
          <select
            id="bd-van"
            className="select"
            value={chosen}
            onChange={(e) => {
              setVan(+e.target.value);
              clearBreakdown();
              setApplied(null);
            }}
          >
            {used.map(({ k, r }) => (
              <option key={k} value={k}>
                Van {pad(k + 1)} · {r.length - (frozen[k] ?? 0)} open drops
              </option>
            ))}
          </select>
          <button className="btn btn--primary" onClick={() => requestBreakdown(chosen)} disabled={status === 'solving' || open === 0}>
            {status === 'solving' ? 'Working it out…' : `Take Van ${pad(chosen + 1)} off the road`}
          </button>
        </div>
        <p className="muted">
          At {clock(t)} Van {pad(chosen + 1)} has {open} drop{open === 1 ? '' : 's'} still to do
          {frozen[chosen] ? ` (${frozen[chosen]} already done stay done)` : ''}.
        </p>

        <div aria-live="polite">
          {applied && <p className="notice">{applied}</p>}
          {result && (
            <>
              <ol className="options">
                <li className={`option ${result.redistribute.unserved.length ? 'is-blocked' : 'is-good'}`}>
                  <p className="option__name">Redistribute to running vans</p>
                  <p>
                    {result.redistribute.moved} of {open} drops fit on {result.redistribute.touched.length} van
                    {result.redistribute.touched.length === 1 ? '' : 's'}; fleet distance {result.redistribute.fleetDeltaMetres >= 0 ? '+' : '−'}
                    {km(Math.abs(result.redistribute.fleetDeltaMetres))} km.{' '}
                    {result.redistribute.unserved.length > 0 ? (
                      <strong className="warn">
                        {result.redistribute.unserved.length} drop{result.redistribute.unserved.length === 1 ? '' : 's'} fit nowhere within the limits.
                      </strong>
                    ) : (
                      'Every drop fits within capacity and shift.'
                    )}
                  </p>
                  {result.redistribute.touched.length > 0 && (
                    <p className="breakdown__vans">
                      {result.redistribute.touched.map((k) => (
                        <VanChip key={k} van={k} to={`/app/fleet?van=${k + 1}`} />
                      ))}
                    </p>
                  )}
                  <button
                    className="btn btn--sm btn--ink"
                    onClick={() => {
                      applyBreakdown('redistribute');
                      setApplied(`Van ${pad(chosen + 1)}’s drops are now on the running vans. Their drivers’ apps and customers’ ETAs have updated.`);
                    }}
                    disabled={result.redistribute.unserved.length > 0}
                  >
                    Apply
                  </button>
                </li>
                <li className={`option ${result.spare.available && !result.spare.overtime ? '' : 'is-blocked'}`}>
                  <p className="option__name">Send a spare van with everything</p>
                  <p>
                    {result.spare.available ? (
                      <>
                        Leaves {clock(result.spare.startSec)} ({result.spare.delayMin} min to prepare) with all {result.spare.stops} drops; back{' '}
                        {clock(result.spare.endSec)}
                        {result.spare.overtime ? <strong className="warn"> · beyond a {shiftH}-hour shift</strong> : ''}. Every customer on the
                        route arrives later.
                      </>
                    ) : (
                      <strong className="warn">No spare van: all {scenario.fleet.vans} are already on today’s plan.</strong>
                    )}
                  </p>
                </li>
                {result.hybrid && (
                  <li className={`option ${result.hybrid.overtime ? 'is-blocked' : 'is-good is-recommended'}`}>
                    <p className="option__name">
                      Both: running vans take what fits, a spare takes the rest <span className="tag">usual choice</span>
                    </p>
                    <p>
                      {result.redistribute.moved} drops onto running vans; spare Van {pad(result.hybrid.spareVan + 1)} leaves {clock(result.hybrid.startSec)}{' '}
                      with the other {result.hybrid.stops}, back {clock(result.hybrid.endSec)}
                      {result.hybrid.overtime ? <strong className="warn"> · overtime</strong> : ''}.
                    </p>
                    <button
                      className="btn btn--sm btn--primary"
                      onClick={() => {
                        applyBreakdown('hybrid');
                        setApplied(
                          `Done: ${result.redistribute.moved} drops moved to running vans and Van ${pad(result.hybrid!.spareVan + 1)} leaves at ${clock(result.hybrid!.startSec)} with ${result.hybrid!.stops}. See it in the control tower.`,
                        );
                      }}
                    >
                      Apply
                    </button>
                  </li>
                )}
              </ol>
              <div className="breakdown__row">
                <button className="btn btn--quiet btn--sm" onClick={clearBreakdown}>
                  Dismiss
                </button>
                <span className="fineprint">Computed in {result.ms.toFixed(0)} ms in the routing worker.</span>
              </div>
            </>
          )}
        </div>
      </div>
      <LiveMap
        view={result ? (result.hybrid?.view ?? result.redistribute.view) : live}
        scenario={scenario}
        highlight={result ? -1 : chosen}
        label={result ? 'The live plan with the broken van’s drops reassigned' : `Van ${chosen + 1}'s route`}
      />
      <p className="fineprint breakdown__unit">Loads are in {units}; limits are the scenario’s van capacity and shift length.</p>
    </div>
  );
}

export default function Disruptions() {
  useEnsurePlan();
  const live = useSim((s) => s.live);
  if (!live) return <Planning />;
  return (
    <div className="disruptions">
      <Panel title="A van breaks down" actions={<Link to="/app/fleet">Fleet →</Link>}>
        <Breakdown />
      </Panel>
      <Panel title="A bridge closes · what-if">
        <p className="muted disruptions__note">
          Closures are analysed against the morning plan, before vans leave. The comparison is a what-if; it doesn’t change the live plan.
        </p>
        <Disruption bare />
      </Panel>
    </div>
  );
}
