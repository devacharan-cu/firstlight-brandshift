import { useState } from 'react';
import { Chapter } from './Chapter';
import { Link } from '../router';

type Currency = 'INR' | 'USD';

const TIERS = [
  {
    name: 'Dispatch',
    inr: 1400,
    usd: 17,
    blurb: 'For one depot moving off spreadsheets.',
    features: ['Route planner and dispatch sheet', 'Driver app with load sheets', 'CSV order import', 'Up to 40 vans'],
  },
  {
    name: 'Fleet',
    inr: 2300,
    usd: 28,
    blurb: 'For teams whose day changes by noon.',
    features: ['Everything in Dispatch', 'Live re-planning on disruptions', 'Customer ETA messages', 'API and webhooks'],
    featured: true,
  },
  {
    name: 'Network',
    inr: null,
    usd: null,
    blurb: 'For several depots and stricter promises.',
    features: ['Multiple depots', 'Delivery time windows', 'Single sign-on', 'Named onboarding lead'],
  },
] as const;

const fmt = (v: number, c: Currency) =>
  c === 'INR'
    ? `₹${Math.round(v).toLocaleString('en-IN')}`
    : `$${Math.round(v).toLocaleString('en-US')}`;

/** The calculator and tiers; used bare on the pricing page and inside a chapter elsewhere. */
export function PricingTool() {
  const [cur, setCur] = useState<Currency>('INR');
  const [vans, setVans] = useState(25);
  const [annual, setAnnual] = useState(true);
  const factor = annual ? 0.85 : 1;

  return (
      <div className="pricing">
        <div className="pricing__controls">
          <div className="field">
            <label className="label" htmlFor="van-count">
              Vans in your fleet
            </label>
            <div className="field__row">
              <input
                id="van-count"
                type="range"
                min={5}
                max={300}
                step={5}
                value={vans}
                onChange={(e) => setVans(+e.target.value)}
                aria-valuetext={`${vans} vans`}
              />
              <output className="mono pricing__vans" htmlFor="van-count">
                {vans}
              </output>
            </div>
          </div>
          <div className="seg" role="group" aria-label="Currency">
            <button aria-pressed={cur === 'INR'} onClick={() => setCur('INR')}>
              ₹ INR
            </button>
            <button aria-pressed={cur === 'USD'} onClick={() => setCur('USD')}>
              $ USD
            </button>
          </div>
          <div className="seg" role="group" aria-label="Billing period">
            <button aria-pressed={annual} onClick={() => setAnnual(true)}>
              Yearly, save 15%
            </button>
            <button aria-pressed={!annual} onClick={() => setAnnual(false)}>
              Monthly
            </button>
          </div>
        </div>

        <div className="tiers">
          {TIERS.map((t) => {
            const per = cur === 'INR' ? t.inr : t.usd;
            const over = t.name === 'Dispatch' && vans > 40;
            return (
              <article key={t.name} className={`tier ${'featured' in t && t.featured ? 'tier--featured' : ''}`}>
                {'featured' in t && t.featured && <p className="tier__flag mono">Most teams start here</p>}
                <h3>{t.name}</h3>
                <p className="tier__blurb">{t.blurb}</p>
                {per !== null ? (
                  <>
                    <p className="tier__price">
                      <span className="mono">{fmt(per * factor, cur)}</span> per van / month
                    </p>
                    <p className="tier__total mono" aria-live="polite">
                      {over ? 'Dispatch covers up to 40 vans' : `${fmt(per * factor * vans, cur)} / month for ${vans} vans`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="tier__price">
                      <span className="mono">Custom</span>
                    </p>
                    <p className="tier__total mono">Priced per depot</p>
                  </>
                )}
                <ul>
                  {t.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link className={`btn ${'featured' in t && t.featured ? 'btn--primary' : 'btn--quiet'}`} to="/demo">
                  {per === null ? 'Talk to us' : 'Book a walkthrough'}
                </Link>
              </article>
            );
          })}
        </div>
        <p className="fineprint">
          Illustrative pricing for a fictional product. USD prices are set separately, not converted live. Taxes not shown. Multiple
          depots and time windows are listed for completeness; they are not part of this demonstration’s solver.
        </p>
      </div>
  );
}

export function Pricing() {
  return (
    <Chapter id="pricing" clock="19:20" note="Pricing" title="Priced per van, so it grows with the fleet.">
      <p className="chapter__lede">
        Pay for the vans you plan, nothing per stop and nothing per driver. The prices below are illustrative: Firstlight is a
        fictional product.
      </p>
      <PricingTool />
    </Chapter>
  );
}
