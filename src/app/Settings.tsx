import { useEffect, useState, type FormEvent } from 'react';
import { applySettings, getCity, useSim } from '../sim/store';
import { DEFAULT_SETTINGS, PROFILE_UNIT, type Profile, type Settings as S } from '../sim/scenario';
import { PRESETS, presetOf } from '../sim/presets';
import { downloadText, ordersToCsv } from '../sim/csv';
import { Link } from '../router';
import { Photo } from '../components/media';
import { Panel } from './common';

const FIELDS: { key: keyof S; label: string; min: number; max: number; step: number; unit: (s: S) => string; note: string }[] = [
  { key: 'orders', label: 'Orders for the day', min: 40, max: 500, step: 10, unit: () => 'orders', note: 'More orders take longer to plan; 500 stays under a couple of seconds on a laptop.' },
  { key: 'vans', label: 'Vans available', min: 4, max: 30, step: 1, unit: () => 'vans', note: 'Plans that need more vans than this are reported, not hidden.' },
  { key: 'capacity', label: 'Van capacity', min: 20, max: 200, step: 5, unit: (s) => PROFILE_UNIT[s.profile][1], note: 'Per van, in the profile’s unit.' },
  { key: 'shiftHours', label: 'Shift length', min: 4, max: 12, step: 0.5, unit: () => 'hours', note: 'Driving plus time at doors.' },
  { key: 'serviceMin', label: 'Time at each door', min: 2, max: 20, step: 1, unit: () => 'minutes', note: 'Unloading and handover per stop.' },
  { key: 'speedKmh', label: 'Average speed', min: 10, max: 35, step: 1, unit: () => 'km/h', note: 'Average including junctions; there is no traffic model.' },
];

const PROFILES: { v: Profile; label: string }[] = [
  { v: 'mixed', label: 'FMCG crates (1–6 per drop)' },
  { v: 'pharmacy', label: 'Pharmacy totes (1–3 per drop)' },
  { v: 'grocery', label: 'Grocery crates (2–5 per drop)' },
  { v: 'building', label: 'Building supplies (4–12 units per drop)' },
];

export default function Settings() {
  const settings = useSim((s) => s.settings);
  const scenario = useSim((s) => s.scenario);
  const [draft, setDraft] = useState<S>(settings);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => setDraft(settings), [settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const valid = FIELDS.every((f) => Number.isFinite(draft[f.key] as number) && (draft[f.key] as number) >= f.min && (draft[f.key] as number) <= f.max) && Number.isInteger(draft.seed);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    applySettings(draft, 'Scenario settings changed');
    setSaved('Applied. A new day of orders was generated and is being planned.');
  };

  const resetAll = () => {
    try {
      sessionStorage.removeItem('firstlight:v2');
    } catch {
      /* ignore */
    }
    applySettings(DEFAULT_SETTINGS, 'Reset to the default day');
    setSaved('Everything reset: default scenario, no edits, no deliveries.');
  };

  const active = presetOf(settings);

  return (
    <div className="settings">
      <Panel title="Load an industry scenario">
        <ul className="presets">
          {PRESETS.map((p) => (
            <li key={p.id}>
              <button
                className={`preset ${active?.id === p.id ? 'is-active' : ''}`}
                onClick={() => {
                  applySettings(p.settings, `Loaded the ${p.name} scenario`);
                  setSaved(`${p.name} loaded.`);
                }}
                aria-pressed={active?.id === p.id}
              >
                <Photo id={p.photo} sizes="240px" />
                <span className="preset__name">{p.name}</span>
                <span className="preset__note">{p.short}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="settings__grid">
        <Panel title="Fine-tune the day">
          <form className="settings__form" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="s-profile">Kind of drop</label>
              <select id="s-profile" className="select select--block" value={draft.profile} onChange={(e) => setDraft({ ...draft, profile: e.target.value as Profile })}>
                {PROFILES.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {FIELDS.map((f) => (
              <div className="field field--range" key={f.key}>
                <label htmlFor={`s-${f.key}`}>
                  {f.label}{' '}
                  <output className="mono" htmlFor={`s-${f.key}`}>
                    {draft[f.key]} {f.unit(draft)}
                  </output>
                </label>
                <input
                  id={`s-${f.key}`}
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={draft[f.key] as number}
                  onChange={(e) => setDraft({ ...draft, [f.key]: +e.target.value })}
                  aria-describedby={`s-${f.key}-note`}
                />
                <p className="field__note" id={`s-${f.key}-note`}>
                  {f.note}
                </p>
              </div>
            ))}
            <div className="field">
              <label htmlFor="s-seed">Order seed</label>
              <div className="field__inline">
                <input
                  id="s-seed"
                  type="number"
                  className="input"
                  value={draft.seed}
                  onChange={(e) => setDraft({ ...draft, seed: Math.round(+e.target.value) })}
                  aria-describedby="s-seed-note"
                />
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => setDraft({ ...draft, seed: Math.floor(Math.random() * 100000) })}>
                  New seed
                </button>
              </div>
              <p className="field__note" id="s-seed-note">
                The same seed always generates the same orders, so a scenario can be reproduced exactly.
              </p>
            </div>
            <div className="settings__actions">
              <button className="btn btn--primary" type="submit" disabled={!dirty || !valid}>
                Apply and re-plan
              </button>
              <button className="btn btn--quiet" type="button" onClick={() => setDraft(settings)} disabled={!dirty}>
                Discard changes
              </button>
            </div>
            <p aria-live="polite" className="settings__saved">
              {saved && (
                <>
                  {saved} <Link to="/app/planner">Open the planner →</Link>
                </>
              )}
            </p>
          </form>
        </Panel>

        <div className="settings__side">
          <Panel title="Today’s orders">
            <p className="muted">
              {scenario?.orders.length ?? 0} orders on Kesarnagar. Export them, edit them in a spreadsheet and bring them back through the CSV import.
            </p>
            <div className="exports">
              <button className="btn btn--ink btn--sm" onClick={() => scenario && downloadText('firstlight-orders.csv', ordersToCsv(getCity(), scenario.orders))} disabled={!scenario}>
                Download orders (CSV)
              </button>
              <Link className="btn btn--quiet btn--sm" to="/integrations#import">
                Import orders
              </Link>
            </div>
          </Panel>
          <Panel title="Start over">
            <p className="muted">Clears this session’s edits, deliveries and log, and returns to the default day.</p>
            <button className="btn btn--quiet btn--sm" onClick={resetAll}>
              Reset everything
            </button>
          </Panel>
          <p className="fineprint">
            Settings live in this browser tab only (session storage). Close the tab and the day starts fresh.
          </p>
        </div>
      </div>
    </div>
  );
}
