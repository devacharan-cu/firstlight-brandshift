import type { ComponentType } from 'react';

export type Chrome = 'site' | 'app';

export interface RouteDef {
  path: string;
  title: string;
  description: string;
  chrome: Chrome;
  load: () => Promise<{ default: ComponentType }>;
}

const T = (s: string) => `${s} — Firstlight`;

export const ROUTES: RouteDef[] = [
  {
    path: '/',
    title: 'Firstlight — Route planning for delivery fleets',
    description:
      'Firstlight plans delivery routes that respect every van’s capacity and every driver’s shift. A fictional product and working routing simulation built by BrandShift.',
    chrome: 'site',
    load: () => import('./pages/Home'),
  },
  {
    path: '/platform',
    title: T('Platform'),
    description: 'Plan, dispatch, drive, track, recover and report: how Firstlight runs a delivery fleet’s day, module by module.',
    chrome: 'site',
    load: () => import('./pages/Platform'),
  },
  {
    path: '/depot',
    title: T('The depot floor'),
    description: 'Step into a real warehouse captured in 360° and see your simulated plan laid out as staging lanes.',
    chrome: 'site',
    load: () => import('./pages/Depot'),
  },
  {
    path: '/industries',
    title: T('Industries'),
    description: 'FMCG distribution, pharmacy, grocery and building supplies: four delivery operations, four scenarios you can plan.',
    chrome: 'site',
    load: () => import('./pages/Industries'),
  },
  {
    path: '/pricing',
    title: T('Pricing'),
    description: 'Illustrative per-van pricing for a fictional product, with a calculator and a full feature comparison.',
    chrome: 'site',
    load: () => import('./pages/PricingPage'),
  },
  {
    path: '/integrations',
    title: T('Integrations'),
    description: 'The systems Firstlight is designed to connect with, and a working CSV import you can try in the browser.',
    chrome: 'site',
    load: () => import('./pages/Integrations'),
  },
  {
    path: '/engine',
    title: T('The routing engine'),
    description: 'What the planner computes, how, and what it does not model: distances, savings, local search and constraints.',
    chrome: 'site',
    load: () => import('./pages/Engine'),
  },
  {
    path: '/security',
    title: T('Data & security'),
    description: 'How Firstlight is designed to handle order and location data. A design-intent page for a fictional product.',
    chrome: 'site',
    load: () => import('./pages/Security'),
  },
  {
    path: '/resources',
    title: T('Resources'),
    description: 'Practical guides for dispatchers and operations leads: reading a route plan, capacity versus shifts, handling disruptions.',
    chrome: 'site',
    load: () => import('./pages/Resources'),
  },
  {
    path: '/resources/reading-a-route-plan',
    title: T('Reading a route plan'),
    description: 'Five numbers that tell you whether a delivery plan is good, and how to check them.',
    chrome: 'site',
    load: () => import('./pages/guides/ReadingAPlan'),
  },
  {
    path: '/resources/capacity-or-shift',
    title: T('Capacity or shift: which limit is binding?'),
    description: 'Why the same orders need different fleets, and how to tell which constraint is costing you vans.',
    chrome: 'site',
    load: () => import('./pages/guides/CapacityOrShift'),
  },
  {
    path: '/resources/when-a-bridge-closes',
    title: T('When a bridge closes'),
    description: 'Detour, re-sequence or re-plan? A practical guide to replanning around a closure without upsetting every driver.',
    chrome: 'site',
    load: () => import('./pages/guides/BridgeCloses'),
  },
  {
    path: '/demo',
    title: T('Book a walkthrough'),
    description: 'Request a 30-minute walkthrough of Firstlight. Demonstration form: nothing is sent.',
    chrome: 'site',
    load: () => import('./pages/Demo'),
  },
  {
    path: '/case-study',
    title: 'Case study — Firstlight, built by BrandShift',
    description: 'How BrandShift researched, designed and engineered Firstlight: a fictional logistics product with a working routing engine.',
    chrome: 'site',
    load: () => import('./pages/CaseStudyPage'),
  },
  // ── the console ──────────────────────────────────────────────────────────
  {
    path: '/app',
    title: T('Control tower'),
    description: 'The live day: every van, every drop, on a simulated clock.',
    chrome: 'app',
    load: () => import('./app/Tower'),
  },
  {
    path: '/app/planner',
    title: T('Planner'),
    description: 'Plan routes, compare against the manual plan, move the depot and add urgent orders.',
    chrome: 'app',
    load: () => import('./app/Planner'),
  },
  {
    path: '/app/fleet',
    title: T('Fleet'),
    description: 'Every van’s route, load and timeline, with stop reassignment.',
    chrome: 'app',
    load: () => import('./app/Fleet'),
  },
  {
    path: '/app/dispatch',
    title: T('Dispatch'),
    description: 'Assign urgent orders, rebalance vans and publish routes to drivers.',
    chrome: 'app',
    load: () => import('./app/Dispatch'),
  },
  {
    path: '/app/driver',
    title: T('Driver app'),
    description: 'The route on the driver’s phone: next stop, load sheet and proof of delivery.',
    chrome: 'app',
    load: () => import('./app/DriverApp'),
  },
  {
    path: '/app/track',
    title: T('Delivery tracking'),
    description: 'What a customer sees: an honest arrival window and the van’s progress.',
    chrome: 'app',
    load: () => import('./app/Track'),
  },
  {
    path: '/app/disruptions',
    title: T('Disruptions'),
    description: 'Close a bridge or take a van off the road and see what Firstlight re-plans.',
    chrome: 'app',
    load: () => import('./app/Disruptions'),
  },
  {
    path: '/app/reports',
    title: T('Reports'),
    description: 'The day in numbers, computed from the plan, with CSV export.',
    chrome: 'app',
    load: () => import('./app/Reports'),
  },
  {
    path: '/app/settings',
    title: T('Scenario settings'),
    description: 'Fleet size, van capacity, shift length, service time and order volume for the simulation.',
    chrome: 'app',
    load: () => import('./app/Settings'),
  },
];

export const NOT_FOUND: RouteDef = {
  path: '*',
  title: T('Page not found'),
  description: 'This page does not exist.',
  chrome: 'site',
  load: () => import('./pages/NotFound'),
};

export function findRoute(path: string): RouteDef {
  return ROUTES.find((r) => r.path === path) ?? NOT_FOUND;
}

const loaded = new Map<string, ComponentType>();

export function getLoaded(path: string): ComponentType | undefined {
  return loaded.get(findRoute(path).path);
}

export function registerLoaded(path: string, c: ComponentType) {
  loaded.set(path, c);
}

export async function preload(path: string): Promise<void> {
  const r = findRoute(path);
  if (loaded.has(r.path)) return;
  const mod = await r.load();
  loaded.set(r.path, mod.default);
}
