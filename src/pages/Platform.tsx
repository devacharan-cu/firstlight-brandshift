import { Link } from '../router';
import { Plate } from '../components/media';
import { useSim } from '../sim/store';
import { useEnsurePlan } from '../app/common';
import type { PhotoId } from '../media.gen';

interface Module {
  id: string;
  no: string;
  name: string;
  claim: string;
  body: string;
  does: string[];
  to: string;
  cta: string;
  photo: PhotoId;
  plateTitle: string;
}

const MODULES: Module[] = [
  {
    id: 'plan',
    no: '01',
    name: 'Plan',
    claim: 'Tomorrow’s routes from today’s orders, in seconds.',
    body: 'Firstlight measures every road distance between your orders, builds routes that respect each van’s capacity and each driver’s shift, and shows them next to the plan you would have made by hand.',
    does: ['Road-network distances, not straight lines', 'Capacity and shift limits enforced', 'Side-by-side with a manual baseline', 'Move the depot or add an order and it re-plans'],
    to: '/app/planner',
    cta: 'Open the planner',
    photo: 'aisle-racks',
    plateTitle: 'Orders become a sequence',
  },
  {
    id: 'dispatch',
    no: '02',
    name: 'Dispatch',
    claim: 'The order that arrives at ten doesn’t wreck the day.',
    body: 'New urgent orders join the live plan without re-planning everything. Each van is ranked by what taking the order would add, at the cheapest point still ahead of it, with capacity and shift checked.',
    does: ['Ranked options, cheapest first', 'Only stops still ahead can change', 'Over-limit options flagged, not hidden', 'Stops can be moved between vans'],
    to: '/app/dispatch',
    cta: 'Open dispatch',
    photo: 'dock-door',
    plateTitle: 'Doors open at six',
  },
  {
    id: 'drive',
    no: '03',
    name: 'Drive',
    claim: 'The route, on the phone the driver already carries.',
    body: 'One screen per stop: who, where, how many, and a button for proof of delivery. The load sheet stacks the van last-drop-first, so the next delivery is always nearest the door.',
    does: ['Next stop first, everything else one tap away', 'Proof of delivery, recorded against the plan', 'Reverse-order load sheet', 'Works off the same live plan as dispatch'],
    to: '/app/driver',
    cta: 'Open the driver app',
    photo: 'courier',
    plateTitle: 'The plan, in a hand',
  },
  {
    id: 'track',
    no: '04',
    name: 'Track',
    claim: 'An arrival window you can actually keep.',
    body: 'Because every route is known stop by stop, every customer gets a thirty-minute window in the morning, and a corrected one if the day changes, instead of “today, nine to six”.',
    does: ['Window from the stop-level schedule', 'Updates when dispatch moves the stop', 'Shows stops ahead, not a vague progress bar', 'Proof of delivery closes the loop'],
    to: '/app/track',
    cta: 'Open tracking',
    photo: 'handover',
    plateTitle: 'The moment that counts',
  },
  {
    id: 'recover',
    no: '05',
    name: 'Recover',
    claim: 'When a bridge closes or a van won’t start.',
    body: 'Firstlight re-plans only the vans that are affected, so the rest of the fleet keeps the day it was handed. For a breakdown it compares redistribution, a spare van and both together, with times.',
    does: ['Targeted re-plans, not a full reshuffle', 'Delivered stops are never moved', 'Spare vans get their own departure time', 'Every option shows its cost before you apply it'],
    to: '/app/disruptions',
    cta: 'Open disruptions',
    photo: 'city-haze',
    plateTitle: 'The city, half awake',
  },
  {
    id: 'report',
    no: '06',
    name: 'Report',
    claim: 'The day in numbers, before anyone asks.',
    body: 'Distance, vans, van-hours, loads and shifts for the manual plan, the planned day and the day as it actually ran, computed from the plan itself and exportable as CSV.',
    does: ['Three plans compared like for like', 'Per-van breakdown', 'Routes, summary and event log as CSV', 'Generated in the browser, nothing uploaded'],
    to: '/app/reports',
    cta: 'Open reports',
    photo: 'ceiling',
    plateTitle: 'Counted, not estimated',
  },
];

function Flow() {
  // numbered as the modules below; orders arrive before any module runs
  const steps: [string, string][] = [['In', 'Orders'], ['01', 'Plan'], ['02', 'Dispatch'], ['03', 'Drive'], ['04', 'Track'], ['06', 'Report']];
  return (
    <figure className="flow" aria-label="How a day flows through Firstlight">
      <ol className="flow__steps">
        {steps.map(([no, s]) => (
          <li key={s}>
            <span className="mono flow__no">{no}</span>
            <span className="flow__name">{s}</span>
          </li>
        ))}
      </ol>
      <p className="flow__recover">
        <span className="mono">05 Recover</span> loops back into Dispatch whenever the day changes.
      </p>
    </figure>
  );
}

export default function Platform() {
  useEnsurePlan();
  const live = useSim((s) => s.live);
  const scenario = useSim((s) => s.scenario);
  const edits = useSim((s) => s.edits);
  const delivered = useSim((s) => Object.keys(s.delivered).length);
  const facts: Record<string, string> = live && scenario
    ? {
        plan: `${scenario.orders.length} orders on ${live.stats.vans} vans · ${(live.stats.distance / 1000).toFixed(1)} km`,
        dispatch: `${edits} change${edits === 1 ? '' : 's'} to the live plan this session`,
        drive: `${delivered} proof${delivered === 1 ? '' : 's'} of delivery recorded`,
        track: `${live.routes.flat().length} customers with a live window`,
        recover: 'Bridge closures and breakdowns',
        report: 'Routes, summary and events as CSV',
      }
    : {};

  return (
    <div className="platform">
      <header className="pagehead">
        <div className="wrap">
          <p className="label">The platform</p>
          <h1>One delivery day, six modules, one plan.</h1>
          <p className="pagehead__lede">
            Firstlight follows a day from the orders that arrive overnight to the report that closes it. Every module below is a working screen in
            the console, running on the same simulated orders, vans and plan.
          </p>
          <Flow />
        </div>
      </header>

      {MODULES.map((m, i) => (
        <section key={m.id} id={m.id} className={`modrow ${i % 2 ? 'modrow--flip' : ''}`} aria-labelledby={`${m.id}-title`}>
          <div className="wrap modrow__grid">
            <div className="modrow__text">
              <p className="label">
                {m.no} · {m.name}
              </p>
              <h2 id={`${m.id}-title`} className="modrow__claim">
                {m.claim}
              </h2>
              <p className="modrow__body">{m.body}</p>
              <ul className="modrow__does">
                {m.does.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <p className="modrow__fact mono">{facts[m.id] ?? 'Planning the simulated day…'}</p>
              <Link className="btn btn--ink" to={m.to}>
                {m.cta} →
              </Link>
            </div>
            <Plate id={m.photo} no={m.no} title={m.plateTitle} ratio="4 / 5" sizes="(min-width: 1080px) 40vw, 100vw" />
          </div>
        </section>
      ))}

      <section className="wrap platform__cta">
        <h2 className="section-title">See all six on one screen.</h2>
        <p className="section-lede">The control tower plays the simulated day with every van moving on its route.</p>
        <div className="hero-field__ctas">
          <Link className="btn btn--primary" to="/app">
            Open the control tower
          </Link>
          <Link className="btn btn--quiet" to="/demo">
            Book a walkthrough
          </Link>
        </div>
      </section>
    </div>
  );
}
