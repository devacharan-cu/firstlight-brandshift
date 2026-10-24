import { DEFAULT_SETTINGS, type Settings } from './scenario';
import type { PhotoId } from '../media.gen';

export interface Preset {
  id: 'fmcg' | 'pharmacy' | 'grocery' | 'building';
  name: string;
  short: string;
  photo: PhotoId;
  settings: Settings;
  /** what a day looks like, in the operator's words */
  day: string;
  /** what tends to bind: helps explain the result */
  binding: string;
}

/** Four kinds of delivery day on the same fictional city. Figures are simulation inputs, not industry data. */
export const PRESETS: Preset[] = [
  {
    id: 'fmcg',
    name: 'FMCG distribution',
    short: 'Crates to kiranas and modern trade',
    photo: 'crates',
    settings: { ...DEFAULT_SETTINGS, profile: 'mixed', orders: 300, vans: 16, capacity: 90, serviceMin: 6, shiftHours: 9 },
    day: 'Three hundred shops expecting one to six crates each, a 90-crate van and a nine-hour shift.',
    binding: 'Van capacity fills before the shift does, so the fight is over how many vans leave the gate.',
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy supply',
    short: 'Small totes, many drops, tight shifts',
    photo: 'boxes',
    settings: { ...DEFAULT_SETTINGS, profile: 'pharmacy', orders: 360, vans: 16, capacity: 60, serviceMin: 4, shiftHours: 8 },
    day: 'Hundreds of chemists, one or two totes each, quick handovers and an eight-hour shift.',
    binding: 'Totes are light, so time runs out before space does: the shift is the binding limit.',
  },
  {
    id: 'grocery',
    name: 'Grocery replenishment',
    short: 'Dense, early, time-critical',
    photo: 'loader',
    settings: { ...DEFAULT_SETTINGS, profile: 'grocery', orders: 260, vans: 16, capacity: 80, serviceMin: 5, shiftHours: 8 },
    day: 'Neighbourhood stores restocked before opening: two to five crates, packed streets, early finish.',
    binding: 'Both limits bite: dense clusters keep driving short, but early finishes cap the day.',
  },
  {
    id: 'building',
    name: 'Building supplies',
    short: 'Heavy units, long service stops',
    photo: 'forklift',
    settings: { ...DEFAULT_SETTINGS, profile: 'building', orders: 110, vans: 14, capacity: 120, serviceMin: 12, shiftHours: 9 },
    day: 'Fewer, heavier drops (cement, tiles, fittings) with long unloading at each site.',
    binding: 'Unloading time dominates; distance matters less than how stops are shared out.',
  },
];

export function presetOf(s: Settings): Preset | undefined {
  return PRESETS.find((p) => p.settings.profile === s.profile && p.settings.orders === s.orders && p.settings.capacity === s.capacity && p.settings.vans === s.vans);
}
