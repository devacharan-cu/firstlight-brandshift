import { Link } from '../router';

const HOLDS = [
  { k: 'Orders', v: 'Customer names, delivery addresses, sizes and times' },
  { k: 'People', v: 'Dispatcher and driver accounts, and who changed what' },
  { k: 'Movement', v: 'Planned routes, and live positions where vans have trackers' },
  { k: 'Proof', v: 'When and by whom each delivery was confirmed' },
];

const INTENT = [
  {
    t: 'Collect less',
    d: 'A route needs a location and a size, not a life story. Customer phone numbers would be used to send arrival windows and never shown in the driver app; positions would be kept only as long as an operator chooses.',
  },
  {
    t: 'Separate roles',
    d: 'Dispatchers change plans, drivers see their own route, viewers read reports. A driver would never see another van’s customers.',
  },
  {
    t: 'Keep a trail',
    d: 'Every change to a live plan is recorded with time and author. The console’s event log is the working version of this idea: every move, assignment and breakdown appears there.',
  },
  {
    t: 'Standard protection',
    d: 'Encryption in transit and at rest, regular backups and a documented deletion process would be baseline expectations, not features.',
  },
  {
    t: 'Choose where data lives',
    d: 'Indian operators often prefer data hosted in India. A real deployment would offer a regional choice and say plainly which sub-processors handle what.',
  },
  {
    t: 'Leave cleanly',
    d: 'Full export of orders, plans and proofs of delivery in open formats, and deletion on request.',
  },
];

export default function Security() {
  return (
    <div className="security">
      <header className="pagehead">
        <div className="wrap">
          <p className="label">Data & security · design intent</p>
          <h1>What a delivery planner should do with your data.</h1>
          <p className="pagehead__lede">
            Firstlight is fictional, so it has no infrastructure, audits or certifications, and this page claims none. It sets out how the product
            is designed to handle data, and exactly what this demonstration does with yours.
          </p>
        </div>
      </header>

      <section className="wrap security__holds" aria-labelledby="holds-title">
        <h2 id="holds-title" className="section-title">
          What it would hold
        </h2>
        <dl className="holds">
          {HOLDS.map((h) => (
            <div key={h.k}>
              <dt>{h.k}</dt>
              <dd>{h.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="wrap security__intent" aria-labelledby="intent-title">
        <h2 id="intent-title" className="section-title">
          How it is designed to handle it
        </h2>
        <ol className="rules">
          {INTENT.map((i) => (
            <li key={i.t}>
              <h3>{i.t}</h3>
              <p>{i.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap security__demo" aria-labelledby="demo-title">
        <div className="security__card">
          <p className="label">Verifiable today</p>
          <h2 id="demo-title">What this demonstration does with your data</h2>
          <ul>
            <li>Everything runs in your browser. The routing engine is a Web Worker on this page, and no server receives your orders or edits.</li>
            <li>Your simulated day is kept in session storage for this tab only, and disappears when the tab closes. Settings → Reset clears it now.</li>
            <li>CSV files you import are read in the browser and never uploaded. Exports are generated locally.</li>
            <li>The booking form validates what you type and then tells you plainly that nothing was sent.</li>
            <li>No cookies, no analytics, no third-party scripts or fonts. Photographs and footage are served from this site.</li>
          </ul>
          <p className="fineprint">You can check all of this in your browser’s developer tools: the network panel shows no request leaving this site.</p>
        </div>
        <div className="security__card security__card--plain">
          <p className="label">Not claimed</p>
          <p>
            No ISO 27001, SOC 2 or other certification; no penetration test; no uptime figures. A real product would earn and publish these, and a
            website shouldn’t borrow them.
          </p>
          <Link to="/engine">How the engine works →</Link>
        </div>
      </section>
    </div>
  );
}
