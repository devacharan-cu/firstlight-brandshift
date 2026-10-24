/**
 * Facts and measurements shown on the case study. Every figure here comes from a measurement or
 * a count in this repository (see README → Measured results). Update both together.
 */

/** Set to BrandShift's real contact URL (mailto: or booking link) before publishing. */
export const BRANDSHIFT_CONTACT = '';

/** Measured 24 Oct 2026 on the build machine against `npm run preview` (raw reports in .lh/p4/). */
export const METRICS: { v: string; k: string; n: string }[] = [
  { v: '89–90', k: 'Lighthouse performance, home, mobile', n: 'Simulated slow 4G and 4× CPU, three runs; 100 on desktop' },
  { v: '100', k: 'Lighthouse accessibility', n: 'Home, platform, case study, console and depot, mobile' },
  { v: '0', k: 'Cumulative layout shift', n: 'Every page measured, mobile and desktop' },
  { v: '2.2–2.7 s', k: 'Largest contentful paint, mobile', n: 'Slow-4G simulation; 0.5–0.6 s on desktop' },
  { v: '93 KB', k: 'JavaScript for the home page’s first view', n: 'Gzipped; everything else loads when it’s needed' },
  { v: '0.3 s', k: 'Planning 300 orders', n: 'In a Web Worker, headless Chrome on the build machine' },
  { v: '49', k: 'Unit tests', n: 'Solver, dispatch operations and CSV import, all passing' },
  { v: '93', k: 'Browser checks', n: '25 pages at three sizes, plus 18 keyboard and motion checks, all passing' },
];

export const COUNTS = {
  pages: 15,
  consoleScreens: 9,
  unitTests: 49,
  browserChecks: 93,
  photos: 14,
  clips: 3,
};

export interface Shot {
  file: string;
  title: string;
  note: string;
  /** what the image shows; the caption beside it says why it matters */
  alt: string;
  w: number;
  h: number;
  layout?: 'wide' | 'phone';
}

/** Captured from the production build by scripts/case-shots.mjs; re-run it after visual changes. */
export const SHOTS: Shot[] = [
  {
    file: 'untangle.webp',
    alt: 'Screenshot of the home page: a street map of Kesarnagar with ten coloured van routes, beside a table comparing 358.5 km on 12 vans with 269.0 km on 10.',
    title: 'The Untangle.',
    note: 'The home page’s signature: 300 orders planned in the browser, the manual plan beside it, every figure computed.',
    w: 1600,
    h: 1000,
    layout: 'wide',
  },
  {
    file: 'story.webp',
    alt: 'Screenshot of the home page story: step 3 of 8, the untangled routes on the city map with a card showing 206.6 km crossed out and 147.1 km beside it.',
    title: 'A day in one scroll.',
    note: 'The home page’s pinned story: the map follows one real simulated day while the steps scroll past beside it.',
    w: 1600,
    h: 1000,
    layout: 'wide',
  },
  {
    file: 'tower.webp',
    alt: 'Screenshot of the console control tower: five KPI tiles, a live map with van markers, and a feed of timestamped deliveries.',
    title: 'Control tower.',
    note: 'The simulated day at 11:20: vans moving on their planned schedules, deliveries logged as they happen.',
    w: 1600,
    h: 1000,
  },
  {
    file: 'disruption.webp',
    alt: 'Screenshot of the disruptions screen: Van 01 taken off the road, with recovery options listed beside a map of the remaining routes.',
    title: 'A van breaks down.',
    note: 'Three recovery options, each checked against capacity and shift limits, computed in the routing worker.',
    w: 1600,
    h: 1000,
  },
  {
    file: 'depot.webp',
    alt: 'Screenshot of the depot page: a 360° photograph of an empty warehouse with coloured, numbered staging lanes drawn on its concrete floor.',
    title: 'The depot floor.',
    note: 'A real 360° warehouse capture with the plan’s staging lanes projected onto the floor in perspective.',
    w: 1600,
    h: 1000,
    layout: 'wide',
  },
  {
    file: 'home-phone.webp',
    alt: 'Phone screenshot of the home page: the headline over a hazy dawn skyline, with two buttons below.',
    title: 'Home, on a phone.',
    note: 'Licensed dawn footage behind a prerendered headline that paints before any JavaScript.',
    w: 780,
    h: 1688,
    layout: 'phone',
  },
  {
    file: 'driver-phone.webp',
    alt: 'Phone screenshot of the driver app: the current stop, Shetty Bakery, with a Delivered button and the next stops listed with times.',
    title: 'Driver app.',
    note: 'The same plan on the driver’s phone: the stop at the door, then the rest of the route in order.',
    w: 780,
    h: 1688,
    layout: 'phone',
  },
];
