import { useMemo, useState, type FormEvent } from 'react';
import { LiveMap } from '../components/LiveMap';
import { etasFor, getState, scheduleOf, stopStatus, useSim } from '../sim/store';
import { navigate, useLocation, Link } from '../router';
import { Photo, Credit } from '../components/media';
import { clock, pad, Panel, Planning, useEnsurePlan, useSimSec, useUnits, VanChip } from './common';

const WINDOW = 30 * 60;

export default function Track() {
  useEnsurePlan();
  const loc = useLocation();
  const scenario = useSim((s) => s.scenario);
  const live = useSim((s) => s.live);
  const plan = useSim((s) => s.plan);
  const delivered = useSim((s) => s.delivered);
  const t = useSimSec(500);
  const [unit, units] = useUnits();
  const [query, setQuery] = useState('');
  const [notFound, setNotFound] = useState<string | null>(null);

  const sched = useMemo(() => (live && scenario ? scheduleOf(live, scenario) : []), [live, scenario]);
  if (!live || !scenario) return <Planning />;

  // which order: ?order=ID, else the next delivery due about an hour after the current time
  const wanted = loc.search.get('order');
  let orderIdx = wanted ? scenario.orders.findIndex((o) => o.id === wanted) : -1;
  if (orderIdx < 0) {
    let bd = Infinity;
    const target = getState().sim.sec + 3600;
    for (const s of sched) for (const st of s.stops) {
      const d = Math.abs(st.arrive - target);
      if (d < bd) {
        bd = d;
        orderIdx = st.order;
      }
    }
  }
  const order = scenario.orders[orderIdx];
  const s = sched.find((x) => x.stops.some((st) => st.order === orderIdx));

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const id = query.trim().toUpperCase();
    if (scenario.orders.some((o) => o.id === id)) {
      setNotFound(null);
      void navigate(`/app/track?order=${encodeURIComponent(id)}`, { keepScroll: true });
    } else setNotFound(id);
  };

  if (!order || !s) {
    return (
      <Panel title="Tracking">
        <p>{order ? `${order.id} is waiting for a van in Dispatch.` : 'No such order.'}</p>
        <Link to="/app/dispatch">Open Dispatch →</Link>
      </Panel>
    );
  }

  const k = s.stops.findIndex((st) => st.order === orderIdx);
  const st = s.stops[k];
  const status = stopStatus(s, k, t, delivered);
  const pod = delivered[orderIdx];
  const ahead = s.stops.slice(0, k).filter((_, i) => stopStatus(s, i, t, delivered) !== 'delivered').length;
  // planned ETA in the solver's plan, if this order was in it
  let plannedEta: number | null = null;
  if (plan) {
    for (let v = 0; v < plan.optimized.routes.length; v++) {
      const j = plan.optimized.routes[v].indexOf(orderIdx);
      if (j >= 0) plannedEta = etasFor(plan.optimized.geometry[v], scenario)[j];
    }
  }
  const moved = plannedEta !== null && Math.abs(plannedEta - st.arrive) >= 5 * 60;
  const firstWindow = Math.floor((plannedEta ?? st.arrive) / 600) * 600;
  const window = Math.floor(st.arrive / 600) * 600;

  let headline: string;
  if (status === 'delivered') headline = pod !== undefined ? `Delivered at ${clock(pod)}` : `Delivered at about ${clock(st.depart)}`;
  else if (status === 'at-stop') headline = 'The van is at your door';
  else if (t < s.start) headline = 'Your order is being loaded';
  else if (ahead === 0) headline = `You’re next · about ${clock(st.arrive)}`;
  else headline = `${ahead} stop${ahead === 1 ? '' : 's'} before yours · about ${clock(st.arrive)}`;

  return (
    <div className="track-app">
      <form className="track-app__search" onSubmit={onSearch} role="search">
        <label htmlFor="order-id" className="label">
          Find an order
        </label>
        <input
          id="order-id"
          list="order-ids"
          placeholder={order.id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          aria-describedby={notFound ? 'order-err' : undefined}
        />
        <datalist id="order-ids">
          {scenario.orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </datalist>
        <button className="btn btn--ink btn--sm" type="submit">
          Track
        </button>
        {notFound && (
          <p className="warn" id="order-err">
            No order “{notFound}” in today’s plan.
          </p>
        )}
      </form>

      <div className="track-app__grid">
        <div className="track-app__customer">
          <p className="label">What the customer sees</p>
          <div className="bubble">
            <p className="bubble__from mono">Kesarnagar Wholesale · {plannedEta !== null ? '07:30' : 'on confirmation'}</p>
            <p>
              Hello {order.name}, your order {order.id} ({order.demand} {order.demand === 1 ? unit : units}) is on today’s van. Expected{' '}
              <strong>
                {clock(firstWindow)}–{clock(firstWindow + WINDOW)}
              </strong>
              .
            </p>
          </div>
          {moved && (
            <div className="bubble bubble--update">
              <p className="bubble__from mono">Update</p>
              <p>
                Your delivery has been re-planned. New window: <strong>{clock(window)}–{clock(window + WINDOW)}</strong>.
              </p>
            </div>
          )}
          <div className="trackcard">
            <p className="mono trackcard__time">{clock(t)}</p>
            <p className="trackcard__status">{headline}</p>
            <div className="trackline" aria-hidden>
              {['Loaded', 'On the way', 'Nearby', 'Delivered'].map((label, i) => {
                const stage = status === 'delivered' ? 3 : status === 'at-stop' || ahead === 0 ? 2 : t >= s.start ? 1 : 0;
                return (
                  <span key={label} className={i <= stage ? 'is-on' : ''}>
                    {label}
                  </span>
                );
              })}
            </div>
            <p className="mono fineprint">
              {order.street} · stop {k + 1} of {s.stops.length} on this run
            </p>
          </div>
          <figure className="track-app__photo">
            <Photo id="handover" sizes="(min-width: 1080px) 30vw, 100vw" />
            <figcaption>
              <Credit kind="photo" id="handover" />
            </figcaption>
          </figure>
        </div>

        <div className="track-app__ops">
          <Panel title="Where the van is" actions={<VanChip van={s.van} to={`/app/fleet?van=${s.van + 1}`} />}>
            <LiveMap view={live} scenario={scenario} highlight={s.van} focusVan={s.van} marks={[order.node]} label={`Van ${s.van + 1}'s route with ${order.name} marked`} />
          </Panel>
          <Panel title="Behind the message">
            <dl className="facts">
              <div>
                <dt>Van</dt>
                <dd>
                  Van {pad(s.van + 1)}, stop {k + 1} of {s.stops.length}
                </dd>
              </div>
              <div>
                <dt>Live ETA</dt>
                <dd className="mono">{clock(st.arrive)}</dd>
              </div>
              <div>
                <dt>In the morning plan</dt>
                <dd className="mono">{plannedEta !== null ? clock(plannedEta) : 'Added after planning'}</dd>
              </div>
              <div>
                <dt>Window sent</dt>
                <dd className="mono">
                  {clock(window)}–{clock(window + WINDOW)}
                </dd>
              </div>
              <div>
                <dt>Proof of delivery</dt>
                <dd>{pod !== undefined ? `Confirmed in the driver app at ${clock(pod)}` : 'Not yet'}</dd>
              </div>
            </dl>
            <p className="fineprint">
              Messages are illustrative: a real deployment would send them through an SMS or WhatsApp Business provider, and none is connected
              here. The van’s position follows the plan’s schedule, not GPS. Drag the clock at the top to follow it.
            </p>
            <p className="driverpage__links">
              <Link to={`/app/driver?van=${s.van + 1}`}>Open this driver’s app →</Link>
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
