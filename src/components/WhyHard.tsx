import { useMemo, useState } from 'react';
import { Chapter } from './Chapter';
import { mulberry32 } from '../sim/rng';

function log10Factorial(n: number): number {
  let s = 0;
  for (let k = 2; k <= n; k++) s += Math.log10(k);
  return s;
}

function exactFactorial(n: number): bigint {
  let f = 1n;
  for (let k = 2n; k <= BigInt(n); k++) f *= k;
  return f;
}

function sup(n: number) {
  return (
    <>
      10<sup>{n.toLocaleString('en-IN')}</sup>
    </>
  );
}

function durationText(log10Seconds: number) {
  const s = 10 ** log10Seconds;
  if (log10Seconds < 0) return 'less than a second';
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} seconds`;
  if (s < 3600) return `${(s / 60).toFixed(0)} minutes`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} hours`;
  if (s < 3.156e7) return `${(s / 86400).toFixed(0)} days`;
  const log10Years = log10Seconds - Math.log10(3.156e7);
  if (log10Years < 6) return `${Math.round(10 ** log10Years).toLocaleString('en-IN')} years`;
  const words: [number, string][] = [
    [12, 'trillion'],
    [9, 'billion'],
    [6, 'million'],
  ];
  for (const [exp, word] of words) {
    if (log10Years >= exp && log10Years < exp + 3) return `about ${Math.round(10 ** (log10Years - exp)).toLocaleString('en-IN')} ${word} years`;
  }
  return null; // render with superscript
}

// ── 7-stop puzzle ───────────────────────────────────────────────────────────
const W = 100;
const H = 62;
const DEPOT: [number, number] = [9, 31];
const PTS: [number, number][] = (() => {
  const rand = mulberry32(31);
  const out: [number, number][] = [];
  while (out.length < 7) {
    const p: [number, number] = [24 + rand() * 70, 6 + rand() * 50];
    if (out.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 15)) out.push(p);
  }
  return out;
})();
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const tourLen = (order: number[]) => {
  let d = 0;
  let prev = DEPOT;
  for (const i of order) {
    d += dist(prev, PTS[i]);
    prev = PTS[i];
  }
  return d + dist(prev, DEPOT);
};

function bestTour(): { order: number[]; len: number; checked: number } {
  const idx = PTS.map((_, i) => i);
  let best: number[] = idx;
  let bl = Infinity;
  let checked = 0;
  const permute = (arr: number[], k: number) => {
    if (k === arr.length) {
      checked++;
      const l = tourLen(arr);
      if (l < bl) {
        bl = l;
        best = arr.slice();
      }
      return;
    }
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      permute(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  permute(idx, 0);
  return { order: best, len: bl, checked };
}

const KM_PER_UNIT = 0.1;
const LETTERS = 'ABCDEFG';

export function WhyHard() {
  const [n, setN] = useState(25);
  const [order, setOrder] = useState<number[]>([]);
  const [showBest, setShowBest] = useState(false);
  const best = useMemo(bestTour, []);

  const lf = log10Factorial(n);
  const exact = n <= 27 ? exactFactorial(n) : null;
  const dur = durationText(lf - 9);
  const done = order.length === PTS.length;
  const mine = done ? tourLen(order) : 0;

  const pick = (i: number) => setOrder((o) => (o.includes(i) || o.length === PTS.length ? o : [...o, i]));

  const line = (o: number[], close: boolean) =>
    [DEPOT, ...o.map((i) => PTS[i]), ...(close ? [DEPOT] : [])].map((p) => p.join(',')).join(' ');

  return (
    <Chapter clock="05:55" note="Before the plan" title="Why a good dispatcher still can’t do this by hand.">
      <p className="chapter__lede">
        Every extra stop multiplies the number of possible routes. Nobody, human or computer, can check them all. Good planners use
        heuristics that find excellent routes without trying every one.
      </p>

      <div className="why">
        <div className="why__count">
          <label className="label" htmlFor="stops-range">
            Stops on one van
          </label>
          <div className="why__n mono">{n}</div>
          <input
            id="stops-range"
            type="range"
            min={3}
            max={300}
            value={n}
            onChange={(e) => setN(+e.target.value)}
            aria-valuetext={`${n} stops`}
          />
          <p className="why__result">
            can be visited in{' '}
            <strong className="mono">
              {exact !== null ? exact.toLocaleString('en-IN') : <>about {sup(Math.floor(lf))}</>}
            </strong>{' '}
            different orders.
          </p>
          <p className="why__result">
            Checking a billion orders a second would take{' '}
            <strong className="mono">{dur ?? <>about {sup(Math.floor(lf - 9 - Math.log10(3.156e7)))} years</>}</strong>.
            {lf - 9 - Math.log10(3.156e7) > 10.14 && <span className="why__aside"> The universe is about 13.8 billion years old.</span>}
          </p>
          <p className="fineprint">That’s for one van. Splitting stops across a fleet multiplies the choices again.</p>
        </div>

        <div className="puzzle">
          <div className="puzzle__head">
            <p className="label">Try it: 7 stops, one van</p>
            <p className="puzzle__hint">
              {done
                ? showBest
                  ? 'The dashed amber line is the shortest possible route.'
                  : 'Done. See how close you got.'
                : `Tap the stops in the order you’d drive them, starting from the depot. ${order.length}/7`}
            </p>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="puzzle__svg" role="group" aria-label="Seven delivery stops and a depot">
            <rect x="0.5" y="0.5" width={W - 1} height={H - 1} className="puzzle__frame" />
            {showBest && <polyline points={line(best.order, true)} className="puzzle__best" />}
            <polyline points={line(order, done)} className="puzzle__mine" />
            <rect x={DEPOT[0] - 2} y={DEPOT[1] - 2} width="4" height="4" className="puzzle__depot" />
            {PTS.map((p, i) => {
              const k = order.indexOf(i);
              return (
                <g
                  key={i}
                  className={`puzzle__pt ${k >= 0 ? 'is-picked' : ''}`}
                  role="button"
                  tabIndex={k >= 0 || done ? -1 : 0}
                  aria-label={k >= 0 ? `Stop ${LETTERS[i]}, visited ${k + 1}${['st', 'nd', 'rd'][k] ?? 'th'}` : `Stop ${LETTERS[i]}`}
                  aria-disabled={k >= 0 || done}
                  onClick={() => pick(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      pick(i);
                    }
                  }}
                >
                  <circle cx={p[0]} cy={p[1]} r="6" className="puzzle__hit" />
                  <circle cx={p[0]} cy={p[1]} r="1.7" />
                  <text x={p[0]} y={p[1] - 3.4}>{k >= 0 ? k + 1 : LETTERS[i]}</text>
                </g>
              );
            })}
          </svg>
          <div className="puzzle__foot" aria-live="polite">
            {done ? (
              <p>
                Your route: <strong className="mono">{(mine * KM_PER_UNIT).toFixed(2)} km</strong>. Shortest of all{' '}
                {best.checked.toLocaleString('en-IN')} orders: <strong className="mono">{(best.len * KM_PER_UNIT).toFixed(2)} km</strong>
                {mine - best.len < 1e-6 ? ' — you found it.' : ` — yours is ${(((mine - best.len) / best.len) * 100).toFixed(0)}% longer.`}
              </p>
            ) : (
              <p className="fineprint">Straight-line distances in this puzzle; the main map uses streets.</p>
            )}
            <div className="puzzle__btns">
              {done && (
                <button className="chip" onClick={() => setShowBest((b) => !b)} aria-pressed={showBest}>
                  {showBest ? 'Hide best route' : 'Show best route'}
                </button>
              )}
              {order.length > 0 && (
                <button
                  className="chip"
                  onClick={() => {
                    setOrder([]);
                    setShowBest(false);
                  }}
                >
                  ↺ Start over
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="why__bridge">
        Seven stops have 5,040 possible orders. Kesarnagar has 300 stops spread over up to 16 vans. Firstlight builds routes by
        merging the stops that save the most distance, then keeps swapping and reordering stops until no single change shortens the
        plan.
      </p>
    </Chapter>
  );
}
