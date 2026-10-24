import { type City, nearestNode } from './city';
import { gaussian, mulberry32 } from './rng';

export interface Order {
  id: string;
  node: number;
  demand: number; // crates
  name: string;
  street: string;
  urgent?: boolean;
}

export interface Fleet {
  vans: number; // vehicles available
  capacity: number; // crates per van
  speedMps: number; // average urban speed used for drive time
  serviceSec: number; // time spent at each stop
  shiftSec: number; // maximum route duration (drive + service)
  shiftStartSec: number; // seconds after midnight
}

export interface Scenario {
  depotNode: number;
  orders: Order[];
  fleet: Fleet;
}

export const DEFAULT_FLEET: Fleet = {
  vans: 16,
  capacity: 90,
  speedMps: 5, // 18 km/h — dense-city average including junctions
  serviceSec: 6 * 60,
  shiftSec: 9 * 3600,
  shiftStartSec: 8 * 3600,
};

const SURNAMES = ['Iyer', 'Sharma', 'Patel', 'Khan', 'Reddy', 'Das', 'Menon', 'Gill', 'Rao', 'Bose', 'Joshi', 'Naidu', 'Kapoor', 'Fernandes', 'Shetty', 'Verma', 'Ali', 'Pillai', 'Mehta', 'Sinha'];
const KINDS = ['General Store', 'Provisions', 'Medicals', 'Kirana', 'Bakery', 'Traders', 'Mart', 'Stores', 'Chemists', 'Dairy', 'Supermarket', 'Tiffin Centre'];
const STREETS = ['Station Road', 'Mill Road', 'Temple Street', 'Bazaar Lane', 'Canal Road', 'Cantonment Road', 'Ghat Road', 'Lake Road', 'Market Street', 'Nehru Marg', 'Ring Road', 'Ferry Lane', 'Church Street', 'Old Post Office Road', 'Bagh Road', 'Colony Main Road'];

const CLUSTERS = [
  { x: 0.43, y: 0.37, sd: 950, w: 0.3 }, // Old Market
  { x: 0.78, y: 0.38, sd: 800, w: 0.14 }, // Cantonment
  { x: 0.3, y: 0.83, sd: 850, w: 0.16 }, // New Colony
  { x: 0.62, y: 0.82, sd: 750, w: 0.12 }, // Riverside
  { x: 0.7, y: 0.14, sd: 650, w: 0.08 }, // Station Ward
];

/** Order profile: what a typical drop looks like for a kind of business. */
export type Profile = 'mixed' | 'pharmacy' | 'grocery' | 'building';

/** Cumulative probability → units per drop, per profile. */
const DEMAND: Record<Profile, [number, number][]> = {
  // FMCG distribution, crates 1–6, mean ≈ 2.8
  mixed: [
    [0.15, 1],
    [0.45, 2],
    [0.7, 3],
    [0.85, 4],
    [0.95, 5],
    [1, 6],
  ],
  // pharmacy totes, mostly 1–2
  pharmacy: [
    [0.62, 1],
    [0.92, 2],
    [1, 3],
  ],
  // grocery replenishment, crates 2–5
  grocery: [
    [0.25, 2],
    [0.6, 3],
    [0.85, 4],
    [1, 5],
  ],
  // building supplies, bag/pallet units 4–12
  building: [
    [0.2, 4],
    [0.45, 6],
    [0.7, 8],
    [0.9, 10],
    [1, 12],
  ],
};

function demandFrom(r: number, profile: Profile): number {
  for (const [p, d] of DEMAND[profile]) if (r < p) return d;
  return DEMAND[profile][DEMAND[profile].length - 1][1];
}

export const PROFILE_UNIT: Record<Profile, [string, string]> = {
  mixed: ['crate', 'crates'],
  pharmacy: ['tote', 'totes'],
  grocery: ['crate', 'crates'],
  building: ['unit', 'units'],
};

export function makeOrder(node: number, rand: () => number, seq: number, urgent = false, profile: Profile = 'mixed'): Order {
  const name = `${SURNAMES[Math.floor(rand() * SURNAMES.length)]} ${KINDS[Math.floor(rand() * KINDS.length)]}`;
  const street = `${1 + Math.floor(rand() * 180)}, ${STREETS[Math.floor(rand() * STREETS.length)]}`;
  return {
    id: `${urgent ? 'UR' : 'KN'}-${String(1000 + seq)}`,
    node,
    demand: demandFrom(rand(), profile),
    name,
    street,
    urgent,
  };
}

/** Generated orders — fictional businesses on a fictional street network. */
export function generateOrders(city: City, count: number, seed = 7, profile: Profile = 'mixed'): Order[] {
  const rand = mulberry32(seed);
  const used = new Set<number>();
  const orders: Order[] = [];
  let guard = 0;
  while (orders.length < count && guard++ < count * 20) {
    let px: number;
    let py: number;
    const pick = rand();
    let acc = 0;
    let cluster = -1;
    for (let c = 0; c < CLUSTERS.length; c++) {
      acc += CLUSTERS[c].w;
      if (pick < acc) {
        cluster = c;
        break;
      }
    }
    if (cluster >= 0) {
      const c = CLUSTERS[cluster];
      px = c.x * city.width + gaussian(rand) * c.sd;
      py = c.y * city.height + gaussian(rand) * c.sd;
    } else {
      px = rand() * city.width;
      py = rand() * city.height;
    }
    const node = nearestNode(city, px, py, used);
    if (node < 0) break;
    // skip points that snapped very far (outside the city)
    if (Math.hypot(city.x[node] - px, city.y[node] - py) > 450) continue;
    used.add(node);
    orders.push(makeOrder(node, rand, orders.length, false, profile));
  }
  return orders;
}

export function defaultDepot(city: City): number {
  return nearestNode(city, city.width * 0.13, city.height * 0.43);
}

/** Everything a visitor can change about the simulated operation. */
export interface Settings {
  orders: number;
  vans: number;
  capacity: number;
  shiftHours: number;
  serviceMin: number;
  speedKmh: number;
  profile: Profile;
  seed: number;
}

export const DEFAULT_SETTINGS: Settings = {
  orders: 300,
  vans: DEFAULT_FLEET.vans,
  capacity: DEFAULT_FLEET.capacity,
  shiftHours: DEFAULT_FLEET.shiftSec / 3600,
  serviceMin: DEFAULT_FLEET.serviceSec / 60,
  speedKmh: DEFAULT_FLEET.speedMps * 3.6,
  profile: 'mixed',
  seed: 7,
};

export function fleetFrom(s: Settings): Fleet {
  return {
    vans: s.vans,
    capacity: s.capacity,
    speedMps: s.speedKmh / 3.6,
    serviceSec: s.serviceMin * 60,
    shiftSec: s.shiftHours * 3600,
    shiftStartSec: DEFAULT_FLEET.shiftStartSec,
  };
}

export function scenarioFrom(city: City, s: Settings, depotNode?: number): Scenario {
  return {
    depotNode: depotNode ?? defaultDepot(city),
    orders: generateOrders(city, s.orders, s.seed, s.profile),
    fleet: fleetFrom(s),
  };
}

export function defaultScenario(city: City, count: number): Scenario {
  return {
    depotNode: defaultDepot(city),
    orders: generateOrders(city, count),
    fleet: { ...DEFAULT_FLEET },
  };
}

export const ZONE_COLS = 3;
export const ZONE_ROWS = 2;

/** Delivery area used by the manual baseline: a fixed 3 × 2 grid over the city. */
export function zoneOf(city: City, node: number): number {
  const zx = Math.min(ZONE_COLS - 1, Math.floor((city.x[node] / city.width) * ZONE_COLS));
  const zy = Math.min(ZONE_ROWS - 1, Math.floor((city.y[node] / city.height) * ZONE_ROWS));
  return Math.max(0, zy) * ZONE_COLS + Math.max(0, zx);
}
