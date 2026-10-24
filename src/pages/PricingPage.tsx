import { PricingTool } from '../components/Pricing';
import { Link } from '../router';

const ROWS: { area: string; items: { name: string; d: boolean | string; f: boolean | string; n: boolean | string; note?: string }[] }[] = [
  {
    area: 'Planning',
    items: [
      { name: 'Route planning with capacity and shift limits', d: true, f: true, n: true },
      { name: 'Manual-plan comparison on every run', d: true, f: true, n: true },
      { name: 'Industry scenarios and saved settings', d: true, f: true, n: true },
      { name: 'Delivery time windows', d: false, f: false, n: true, note: 'Not in this demonstration’s solver' },
      { name: 'Multiple depots', d: false, f: false, n: true, note: 'Not in this demonstration’s solver' },
    ],
  },
  {
    area: 'Running the day',
    items: [
      { name: 'Dispatch board and stop moves', d: true, f: true, n: true },
      { name: 'Urgent orders ranked by added distance', d: false, f: true, n: true },
      { name: 'Closure and breakdown re-planning', d: false, f: true, n: true },
      { name: 'Driver app with load sheets', d: true, f: true, n: true },
      { name: 'Proof of delivery', d: true, f: true, n: true },
    ],
  },
  {
    area: 'Customers and data',
    items: [
      { name: 'Customer arrival windows', d: false, f: true, n: true },
      { name: 'CSV import and export', d: true, f: true, n: true },
      { name: 'API and webhooks', d: false, f: true, n: true },
      { name: 'Single sign-on', d: false, f: false, n: true },
      { name: 'Support', d: 'Email', f: 'Email and chat', n: 'Named lead' },
    ],
  },
];

const FAQ = [
  {
    q: 'Is Firstlight a real product?',
    a: 'No. Firstlight is a fictional product that BrandShift designed and built to show what a product website can do when the product itself is on the page. The routing engine, the console and every number it shows are real computations on a simulated city, but there is no company, no subscription and nothing to buy.',
  },
  {
    q: 'Why per van, not per stop?',
    a: 'Fleets grow in vans, and per-stop pricing punishes exactly the improvement the product is for: more drops per van. Per-van pricing keeps the bill predictable when volumes swing day to day.',
  },
  {
    q: 'How do the INR and USD prices relate?',
    a: 'They’re set separately for each market rather than converted at a live exchange rate, which is common for B2B software sold in India and abroad. Both are illustrative.',
  },
  {
    q: 'What does the planner not model?',
    a: 'Delivery time windows, live traffic, road speeds by street type, driver breaks, multiple depots and mixed vehicle types. The engine page lists exactly what is enforced and what isn’t.',
  },
  {
    q: 'Can I see it on my own orders?',
    a: 'In this demonstration, yes, in the browser: export the sample orders as CSV, edit them, and import them on the integrations page. Positions are kilometres on the fictional city’s map rather than real addresses.',
  },
  {
    q: 'Who built this, and can they build one for us?',
    a: 'BrandShift, a web studio working with B2B and SaaS teams in India and abroad. The case study explains what was built, how, and what was measured.',
  },
];

const mark = (v: boolean | string) => (v === true ? <span aria-label="Included">●</span> : v === false ? <span aria-label="Not included" className="muted">—</span> : v);

export default function PricingPage() {
  return (
    <div className="pricingpage">
      <header className="pagehead">
        <div className="wrap">
          <p className="label">Pricing · illustrative</p>
          <h1>Priced per van, so it grows with the fleet.</h1>
          <p className="pagehead__lede">
            Pay for the vans you plan: nothing per stop, nothing per driver. Every price on this page is illustrative, because Firstlight is a
            fictional product.
          </p>
        </div>
      </header>
      <section className="wrap" aria-labelledby="plans-title">
        <h2 id="plans-title" className="sr-only">
          Plans and calculator
        </h2>
        <PricingTool />
      </section>

      <section className="wrap pricingpage__compare" aria-labelledby="compare-title">
        <h2 id="compare-title" className="section-title">
          What each plan includes
        </h2>
        <div className="table-wrap">
          <table className="dtable compare-table">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Dispatch</th>
                <th scope="col">Fleet</th>
                <th scope="col">Network</th>
              </tr>
            </thead>
            {ROWS.map((g) => (
              <tbody key={g.area}>
                <tr className="compare-table__group">
                  <th scope="rowgroup" colSpan={4}>
                    {g.area}
                  </th>
                </tr>
                {g.items.map((r) => (
                  <tr key={r.name}>
                    <th scope="row">
                      {r.name}
                      {r.note && <span className="compare-table__note">{r.note}</span>}
                    </th>
                    <td>{mark(r.d)}</td>
                    <td>{mark(r.f)}</td>
                    <td>{mark(r.n)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="fineprint">Features marked as outside this demonstration’s solver are listed to show a plausible roadmap; they are not implemented here.</p>
      </section>

      <section className="wrap pricingpage__faq" aria-labelledby="faq-title">
        <h2 id="faq-title" className="section-title">
          Questions
        </h2>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q} className="faq__item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="wrap platform__cta">
        <h2 className="section-title">Try it before you price it.</h2>
        <div className="hero-field__ctas">
          <Link className="btn btn--primary" to="/app/planner">
            Open the planner
          </Link>
          <Link className="btn btn--quiet" to="/demo">
            Book a walkthrough
          </Link>
          <Link className="btn btn--quiet" to="/case-study">
            Read the case study
          </Link>
        </div>
      </section>
    </div>
  );
}
