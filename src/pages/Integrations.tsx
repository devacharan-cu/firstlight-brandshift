import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Link, navigate } from '../router';
import { CSV_HEADER, downloadText, ordersToCsv, parseOrdersCsv, type CsvResult } from '../sim/csv';
import { clock, getCity, importOrders, requestPlan, scheduleOf, useSim } from '../sim/store';
import { PROFILE_UNIT } from '../sim/scenario';

const CONNECTORS = [
  { name: 'Storefronts and marketplaces', flow: 'Orders in · delivery status out', note: 'Pull paid orders with address and size; push “out for delivery” and “delivered”.' },
  { name: 'Order management and ERP', flow: 'Orders and depots in · plans out', note: 'Read tomorrow’s pick list and depot; write back van assignments and stop sequence.' },
  { name: 'Accounting', flow: 'Proof of delivery out', note: 'Send delivered drops with time and van, so invoicing can follow delivery.' },
  { name: 'Customer messaging', flow: 'Arrival windows out', note: 'SMS or WhatsApp Business messages through the operator’s own provider.' },
  { name: 'Telematics', flow: 'Positions in', note: 'Replace scheduled positions with live GPS where vans have trackers.' },
  { name: 'Spreadsheets and SFTP', flow: 'Orders in · plans out', note: 'The fallback that always works: CSV in, CSV out.', working: true },
];

const TEMPLATE = [
  CSV_HEADER.join(','),
  'KN-9001,Rao General Store,"12, Station Road",4.20,2.85,3',
  'KN-9002,Mehta Medicals,"88, Lake Road",6.10,3.40,2',
  'KN-9003,Hotel Sagar,"5, Ghat Road",7.75,5.90,5',
].join('\n');

function Webhook() {
  const live = useSim((s) => s.live);
  const scenario = useSim((s) => s.scenario);
  const json = useMemo(() => {
    if (!live || !scenario) return null;
    const s = scheduleOf(live, scenario).find((x) => x.stops.length);
    if (!s) return null;
    return JSON.stringify(
      {
        event: 'route.published',
        van: `VAN-${String(s.van + 1).padStart(2, '0')}`,
        departs: clock(s.start),
        returns: clock(s.end),
        distance_km: +(live.stats.routes[s.van].distance / 1000).toFixed(1),
        load: live.stats.routes[s.van].load,
        stops: s.stops.slice(0, 3).map((st, k) => ({
          sequence: k + 1,
          order_id: scenario.orders[st.order].id,
          eta: clock(st.arrive),
          units: scenario.orders[st.order].demand,
        })),
        more_stops: Math.max(0, s.stops.length - 3),
      },
      null,
      2,
    );
  }, [live, scenario]);
  return (
    <figure className="codecard">
      <figcaption className="mono">POST https://your-system.example/webhooks/firstlight</figcaption>
      <pre>
        <code>{json ?? '// planning the simulated day…'}</code>
      </pre>
    </figure>
  );
}

export default function Integrations() {
  const scenario = useSim((s) => s.scenario);
  const capacity = useSim((s) => s.settings.capacity);
  const profile = useSim((s) => s.settings.profile);
  const [, units] = PROFILE_UNIT[profile];
  const [text, setText] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tooBig, setTooBig] = useState(false);

  const result: CsvResult | null = useMemo(() => {
    if (!text.trim() || !scenario) return null;
    return parseOrdersCsv(getCity(), text, capacity, scenario.depotNode);
  }, [text, scenario, capacity]);

  const readFile = async (f: File) => {
    if (f.size > 2_000_000) {
      setSource(null);
      setText('');
      setTooBig(true);
      return;
    }
    setTooBig(false);
    setSource(f.name);
    setText(await f.text());
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) void readFile(f);
  };

  const load = () => {
    if (!result?.orders.length) return;
    importOrders(result.orders, `Imported ${result.orders.length} orders from ${source ?? 'pasted CSV'}`);
    void requestPlan().catch(() => {});
    void navigate('/app/planner');
  };

  return (
    <div className="integrations">
      <header className="pagehead">
        <div className="wrap">
          <p className="label">Integrations</p>
          <h1>Orders in, plans out, whatever you run today.</h1>
          <p className="pagehead__lede">
            A planner is only as good as the orders it gets and the systems it updates. These are the connections Firstlight is designed around.
            In this demonstration only one of them is real: CSV, and you can try it below.
          </p>
        </div>
      </header>

      <section className="wrap" aria-labelledby="conn-title">
        <h2 id="conn-title" className="sr-only">
          Designed connections
        </h2>
        <ul className="connectors">
          {CONNECTORS.map((c) => (
            <li key={c.name} className={`connector ${c.working ? 'is-working' : ''}`}>
              <p className="connector__status mono">{c.working ? 'Working in this demo' : 'Concept · not built'}</p>
              <p className="connector__name">{c.name}</p>
              <p className="connector__flow mono">{c.flow}</p>
              <p className="connector__note">{c.note}</p>
            </li>
          ))}
        </ul>
        <p className="fineprint">Firstlight is fictional: no connector to any third-party system exists, and none is implied.</p>
      </section>

      <section className="wrap integrations__api" aria-labelledby="api-title">
        <div>
          <p className="label">API and webhooks · illustrative</p>
          <h2 id="api-title" className="section-title">
            Every published route, as data.
          </h2>
          <p className="section-lede">
            When a route is published to a driver, Firstlight would post it to your systems. The payload on the right is generated from the live
            plan in this session; the endpoint doesn’t exist.
          </p>
          <Link to="/app/dispatch">Change the plan in Dispatch and come back →</Link>
        </div>
        <Webhook />
      </section>

      <section className="wrap csvimport" id="import" aria-labelledby="import-title">
        <p className="label">Try it · CSV import</p>
        <h2 id="import-title" className="section-title">
          Plan your own list of orders.
        </h2>
        <p className="section-lede">
          Kesarnagar is fictional, so positions are kilometres on its map (x from 0 to 12 going east, y from 0 to 8 going south) instead of
          addresses. Each row snaps to the nearest street junction. Units must fit in one van ({capacity} {units}).
        </p>
        <div className="csvimport__tools">
          <button className="btn btn--quiet btn--sm" onClick={() => downloadText('firstlight-template.csv', TEMPLATE + '\n')}>
            Download a template
          </button>
          <button className="btn btn--quiet btn--sm" onClick={() => scenario && downloadText('firstlight-orders.csv', ordersToCsv(getCity(), scenario.orders))} disabled={!scenario}>
            Download today’s {scenario?.orders.length ?? ''} orders
          </button>
          <button className="btn btn--quiet btn--sm" onClick={() => setText(TEMPLATE)}>
            Paste the template
          </button>
        </div>
        <div
          className={`dropzone ${drag ? 'is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <p>
            Drop a CSV file here, or{' '}
            <button className="linkish" onClick={() => fileRef.current?.click()}>
              choose a file
            </button>
            .
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Choose a CSV file of orders"
            onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
          />
          {source && <p className="mono muted">Loaded {source}</p>}
        </div>
        <label className="label" htmlFor="csv-text">
          Or paste CSV
        </label>
        <textarea
          id="csv-text"
          className="csvimport__text mono"
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSource(null);
          }}
          placeholder={TEMPLATE}
          spellCheck={false}
        />

        <div aria-live="polite">
          {tooBig && !text && <p className="notice notice--warn">That file is larger than 2 MB. This demo reads up to 500 orders.</p>}
          {result && (
            <div className="csvimport__result">
              <p className={result.orders.length ? 'notice' : 'notice notice--warn'}>
                {result.orders.length} of {result.rows} row{result.rows === 1 ? '' : 's'} ready to plan
                {result.issues.length ? `, ${result.issues.length} skipped` : ''}.
              </p>
              {result.issues.length > 0 && (
                <ul className="csvimport__issues">
                  {result.issues.slice(0, 8).map((i, k) => (
                    <li key={k}>
                      <span className="mono">Line {i.line}</span> {i.message}
                    </li>
                  ))}
                  {result.issues.length > 8 && <li>…and {result.issues.length - 8} more</li>}
                </ul>
              )}
              {result.orders.length > 0 && (
                <>
                  <div className="table-wrap">
                    <table className="dtable">
                      <caption className="sr-only">First rows of the import</caption>
                      <thead>
                        <tr>
                          <th scope="col">ID</th>
                          <th scope="col">Customer</th>
                          <th scope="col">Address</th>
                          <th scope="col" className="num">
                            Units
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.orders.slice(0, 6).map((o) => (
                          <tr key={o.id + o.node}>
                            <td className="mono">{o.id}</td>
                            <td>{o.name}</td>
                            <td>{o.street}</td>
                            <td className="num mono">{o.demand}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button className="btn btn--primary" onClick={load}>
                    Replace today’s orders with these {result.orders.length} and plan →
                  </button>
                  <p className="fineprint">Your file stays in this browser tab. Nothing is uploaded.</p>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
