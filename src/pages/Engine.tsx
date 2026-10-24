import { WhyHard } from '../components/WhyHard';
import { HowItWorks } from '../components/HowItWorks';
import { Link } from '../router';
import { useEnsurePlan } from '../app/common';

const RULES = [
  {
    t: 'Done stops are frozen',
    d: 'Once the simulated clock passes a drop, or the driver confirms it, that stop and everything before it on the route are locked. Moves, insertions and re-plans only touch what is still ahead.',
    to: '/app/fleet',
    link: 'Move a stop in Fleet',
  },
  {
    t: 'New orders are inserted, not re-planned',
    d: 'An urgent order is offered to every van at its cheapest position after that van’s done stops. The ranking shows the extra kilometres and the load and shift that would result; limits are flagged, not hidden.',
    to: '/app/dispatch',
    link: 'Receive an urgent order',
  },
  {
    t: 'Disruptions re-plan as little as possible',
    d: 'For a closed bridge, only routes that crossed it are re-solved on the remaining streets; for a breakdown, the van’s open drops are offered to running vans first and a spare van takes what is left.',
    to: '/app/disruptions',
    link: 'Close a bridge',
  },
  {
    t: 'Late vans keep their own clock',
    d: 'A spare van that leaves at 10:23 is scheduled from 10:23. Arrival windows, positions and shift checks all use each van’s own departure time.',
    to: '/app',
    link: 'Watch it in the control tower',
  },
];

export default function Engine() {
  useEnsurePlan();
  return (
    <div className="engine">
      <header className="pagehead">
        <div className="wrap">
          <p className="label">The routing engine</p>
          <h1>What the planner computes, how, and where it stops.</h1>
          <p className="pagehead__lede">
            No black box and no borrowed AI. Everything on this site runs on one solver written for it, inside a Web Worker in your browser. This page
            explains the method, shows live timings from your session, and lists what isn’t modelled.
          </p>
        </div>
      </header>
      <WhyHard />
      <HowItWorks />
      <section className="chapter" data-clock="19:40" aria-labelledby="live-rules">
        <div className="wrap chapter__grid">
          <p className="chapter__time" aria-hidden>
            Live
            <small>During the day</small>
          </p>
          <div className="chapter__body">
            <h2 id="live-rules">Four rules once the vans have left.</h2>
            <p className="chapter__lede">The morning plan is only the start. These rules keep every change made during the day physically possible.</p>
            <ol className="rules">
              {RULES.map((r) => (
                <li key={r.t}>
                  <h3>{r.t}</h3>
                  <p>{r.d}</p>
                  <Link to={r.to}>{r.link} →</Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
