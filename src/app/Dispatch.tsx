import { useMemo, useState } from 'react';
import { LiveMap } from '../components/LiveMap';
import { assignOrder, getCity, getState, insertionOptionsFor, receiveOrder, unassignedOrders, useSim } from '../sim/store';
import { mulberry32 } from '../sim/rng';
import { nearestNode } from '../sim/city';
import { routeColor } from '../map/draw';
import { Link } from '../router';
import type { InsertionOption } from '../sim/ops';
import { clock, hrs, km, pad, Panel, Planning, useEnsurePlan, useSimSec, useUnits, VanChip } from './common';

interface Pending {
  order: number;
  options: InsertionOption[];
  at: number;
}

export default function Dispatch() {
  useEnsurePlan();
  const scenario = useSim((s) => s.scenario);
  const live = useSim((s) => s.live);
  const busy = useSim((s) => s.liveBusy);
  const dispatched = useSim((s) => s.dispatched);
  const t = useSimSec(1000);
  const [unit, units] = useUnits();
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const waiting = useMemo(() => (live ? unassignedOrders() : []), [live, scenario]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!live || !scenario) return <Planning />;
  const cap = scenario.fleet.capacity;
  const shift = scenario.fleet.shiftSec;

  const receiveAt = async (node: number) => {
    setError(null);
    setMessage(null);
    try {
      const sc = getState().scenario!;
      const used = new Set([sc.depotNode, ...sc.orders.map((o) => o.node)]);
      const free = used.has(node) ? nearestNode(getCity(), getCity().x[node], getCity().y[node], used) : node;
      const r = await receiveOrder(free);
      setPending({ ...r, at: getState().sim.sec });
      setPicking(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const simulate = () => {
    const city = getCity();
    const rand = mulberry32(31337 + dispatched);
    void receiveAt(nearestNode(city, city.width * (0.2 + rand() * 0.65), city.height * (0.15 + rand() * 0.7)));
  };

  const reconsider = async (order: number) => {
    setError(null);
    const options = await insertionOptionsFor(order);
    setPending({ order, options, at: getState().sim.sec });
  };

  const assign = async (o: InsertionOption) => {
    if (!pending) return;
    const id = scenario.orders[pending.order].id;
    await assignOrder(pending.order, o.van, o.position);
    setMessage(`${id} assigned to Van ${pad(o.van + 1)}: +${km(o.addedMetres)} km on that route. Its driver app and the customer’s ETA have updated.`);
    setPending(null);
  };

  const order = pending ? scenario.orders[pending.order] : null;
  const best = pending?.options.find((o) => o.capacityOk && o.shiftOk);

  return (
    <div className="dispatch">
      <div className="dispatch__grid">
        <Panel
          title={picking ? 'Click the map where the order is going' : 'Live plan'}
          actions={
            <>
              <button className="chip" onClick={simulate} disabled={busy || !!pending}>
                <span className="chip__ring" aria-hidden /> Simulate an urgent order
              </button>
              <button className={`chip ${picking ? 'is-on' : ''}`} aria-pressed={picking} onClick={() => setPicking((p) => !p)} disabled={busy || !!pending}>
                Place one on the map
              </button>
            </>
          }
        >
          <LiveMap
            view={live}
            scenario={scenario}
            onPick={picking ? (n) => void receiveAt(n) : undefined}
            marks={order ? [order.node] : waiting.map((o) => scenario.orders[o].node)}
            highlight={best && pending ? best.van : -1}
            label={`Live plan with ${live.stats.vans} vans${order ? `; new order ${order.id} marked` : ''}.`}
          />
          <p className="fineprint">
            New orders join the live plan without re-planning the day: a dispatcher’s real choice at {clock(t)}. Stops already done at that
            time stay where they are.
          </p>
        </Panel>

        <Panel title="Incoming" className="dispatch__incoming">
          <div aria-live="polite">
            {error && <p className="notice notice--warn">{error}</p>}
            {message && !pending && <p className="notice">{message}</p>}
          </div>
          {!pending && !message && (
            <p className="muted">
              No order waiting. Simulate one, or place one on the map, and Firstlight ranks every van by what taking it would add.
            </p>
          )}
          {pending && order && (
            <div className="incoming">
              <div className="incoming__card">
                <p className="mono muted">
                  Received {clock(pending.at)} · {order.id}
                </p>
                <p className="incoming__name">{order.name}</p>
                <p className="muted">{order.street}, Kesarnagar</p>
                <p className="mono">
                  {order.demand} {order.demand === 1 ? unit : units} · urgent
                </p>
              </div>
              <table className="dtable incoming__options">
                <caption className="sr-only">Vans ranked by distance added</caption>
                <thead>
                  <tr>
                    <th scope="col">Van</th>
                    <th scope="col" className="num">
                      Adds
                    </th>
                    <th scope="col" className="num">
                      Load after
                    </th>
                    <th scope="col" className="num">
                      Shift after
                    </th>
                    <th scope="col">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pending.options
                    .filter((o) => live.routes[o.van].length > 0)
                    .slice(0, 8)
                    .map((o) => {
                      const ok = o.capacityOk && o.shiftOk;
                      return (
                        <tr key={o.van} className={o === best ? 'is-selected' : ''}>
                          <th scope="row">
                            <VanChip van={o.van} />
                            {o === best && <span className="tag">best</span>}
                          </th>
                          <td className="num mono">+{km(o.addedMetres)} km</td>
                          <td className={`num mono ${o.capacityOk ? '' : 'warn'}`}>
                            {o.load}/{cap}
                          </td>
                          <td className={`num mono ${o.shiftOk ? '' : 'warn'}`}>
                            {hrs(o.duration)}/{shift / 3600} h
                          </td>
                          <td>
                            <button className={`btn btn--sm ${ok ? 'btn--primary' : 'btn--quiet'}`} onClick={() => assign(o)} disabled={busy}>
                              {ok ? 'Assign' : 'Assign anyway'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              <p className="fineprint">
                “Adds” is the extra distance on that van’s route at the cheapest point still ahead of it. Over-limit options stay available
                because dispatchers sometimes accept overtime, but they’re flagged.
              </p>
              <button className="linkish" onClick={() => setPending(null)}>
                Decide later (keep it waiting)
              </button>
            </div>
          )}
          {waiting.length > 0 && !pending && (
            <div className="waiting">
              <p className="label">Waiting for a van · {waiting.length}</p>
              <ul>
                {waiting.map((o) => (
                  <li key={o}>
                    <span>
                      {scenario.orders[o].id} · {scenario.orders[o].name}
                    </span>
                    <button className="btn btn--sm btn--quiet" onClick={() => reconsider(o)}>
                      Find a van
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Van balance" actions={<Link to="/app/fleet">Move stops in Fleet →</Link>}>
        <ul className="balance">
          {live.routes.map((r, k) => {
            if (!r.length) return null;
            const st = live.stats.routes[k];
            return (
              <li key={k}>
                <VanChip van={k} to={`/app/fleet?van=${k + 1}`} />
                <span className="balance__bars">
                  <span className="balance__bar" aria-label={`Load ${st.load} of ${cap} ${units}`}>
                    <span style={{ width: `${Math.min(100, (st.load / cap) * 100)}%`, background: routeColor(k) }} />
                  </span>
                  <span className="balance__bar balance__bar--shift" aria-label={`Shift ${hrs(st.duration)} of ${shift / 3600} hours`}>
                    <span style={{ width: `${Math.min(100, (st.duration / shift) * 100)}%` }} />
                  </span>
                </span>
                <span className={`mono ${st.load > cap ? 'warn' : ''}`}>
                  {st.load}/{cap}
                </span>
                <span className={`mono ${st.duration > shift ? 'warn' : ''}`}>{hrs(st.duration)} h</span>
              </li>
            );
          })}
        </ul>
        <p className="fineprint">
          Upper bar: load against van capacity. Lower bar: drive and service time against the {shift / 3600}-hour shift.
        </p>
      </Panel>
    </div>
  );
}
