# Firstlight — a BrandShift flagship demonstration

Firstlight is a **fictional** route-planning product for delivery fleets. Its website is BrandShift's showcase: instead of
describing the product with screenshots, the page runs it. A real routing solver plans 300 generated orders in the
visitor's browser, and the routes visibly untangle.

> Firstlight, Kesarnagar (the city), its businesses, orders, pricing and customers are invented. All numbers on the
> site come from a simulation on generated data and are labelled as such.

Direction and research: [`research/brandshift-direction.md`](research/brandshift-direction.md).

## Run it

Requires Node 20+ (built with Node 24).

```bash
npm install
npm run dev          # http://localhost:5173 — development server
npm run build        # typecheck → production build → prerender first viewport into dist/
npm run preview      # http://localhost:4173 — serve the production build
```

`dist/` is a static site (two pages: `/` and `/case-study.html`). It can be deployed to any static host. No server or
environment variables are needed.

## Checks

```bash
npm run typecheck      # TypeScript, strict
npm run lint           # ESLint
npm test               # 20 unit tests: solver, distances, constraints, disruption
npm run bench          # quality + timing report in Node → .bench.json
# with `npm run preview` running:
npm run check:browser  # overflow / console errors / animation frames at 390, 820, 1440 px → .shots/
                       # then reduced motion, keyboard, mobile menu, deep link, booking form
npm run check:paint    # paint timings at 1× and 4× CPU
```

The browser scripts use `puppeteer-core` with the locally installed Chrome. Set `CHROME_PATH` if Chrome isn't in a
standard location.

## What's on the page

| Time  | Chapter | What actually works |
|-------|---------|---------------------|
| 05:40 | **The Untangle** (hero) | The manual plan loads as a tangle; **Plan routes** runs the solver in a Web Worker and animates the result. Drag the depot (or focus it and use arrow keys), add urgent orders by clicking the map, compare Manual and Firstlight, reset. Hover a stop for van, sequence and ETA. |
| 05:50 | Dispatch sheet | Every van, stop, crate count and ETA for either plan. This is also the map's text alternative. |
| 05:55 | Why it's hard | Live count of possible orders for 3–300 stops, and a 7-stop puzzle scored against the true optimum (all 5,040 orders checked). |
| 06:15 | Driver hand-off | A driver-app screen built from the visitor's plan: next stop, *Mark delivered*, and a reverse-order load sheet. |
| 07:30 | Disruption | Close any bridge. Firstlight re-plans only the vans that crossed it, and the page compares *as planned*, *same routes detouring*, *affected vans re-planned* and *everything re-planned*. |
| 14:00 | Customer view | A real stop's ETA window, the closure update if one ran, and a time scrubber moving the van along its actual route. |
| 19:00 | Day report | Tiles, small-multiple load charts and a time split, all computed from the current plans. |
| —     | Pricing, How it works, Booking | Illustrative per-van pricing with a calculator; the pipeline with timings from the visitor's last run; a validated booking form that says plainly nothing was sent. |

The page's paper colour follows a scroll-driven clock, from pre-dawn grey through daylight to evening amber, ending in a
night-time closing section.

## How it works

```
src/sim/city.ts         seeded street graph: ~2,000 junctions, 3 road classes, diagonal avenues, river + 4 bridges
src/sim/graph.ts        Dijkstra (binary heap, typed arrays), cached shortest-path trees, distance matrix
src/sim/scenario.ts     generated orders (crates 1–6), fleet: 16 vans × 90 crates, 9-h shift, 6 min/stop, 18 km/h
src/sim/solver.ts       manual baseline + Clarke–Wright savings (4 λ starts) + 2-opt, relocate, swap, 2-opt*, van elimination
src/sim/plan.ts         runs both plans, traces every leg back onto streets (drawn length == counted distance)
src/sim/disruption.ts   bridge closure: keep-and-detour vs targeted re-plan vs full re-plan
src/sim/worker.ts       all of the above off the main thread; src/sim/client.ts is the promise wrapper
src/sim/store.ts        shared simulation state for every chapter (useSyncExternalStore)
src/map/draw.ts         Canvas 2D: cached base cartography + dash-based route reveals; validated route palette
src/lib/daylight.ts     scroll clock → CSS custom properties (no React renders)
scripts/prerender.mjs   renders the masthead + hero to static HTML at build time
```

- **Distance model.** Shortest paths along the generated street graph, in metres. This is network distance on an
  invented city, not real-world driving distance. Drive time is distance ÷ 18 km/h.
- **Enforced constraints.** Van capacity, shift length (drive + service time), and every order served exactly once.
  A fleet that's too small is *reported* (`fleetOk: false`), not hidden.
- **Not modelled.** Delivery time windows, traffic, road speeds by type, turn restrictions, driver breaks, multiple
  depots, mixed vehicles.
- **Baseline.** Orders grouped into 6 fixed delivery areas (3 × 2), with each van loaded nearest-next from the depot
  until a crate or shift limit. It's explicit and reproducible, and deliberately a *careful* dispatcher, not a straw man.
- **Determinism.** The city, orders and solver are all seeded, so the same inputs always produce the same plan
  (covered by tests).

## Measured results

Measured 23 Oct 2026 on the build machine against `npm run preview` (local, uncompressed by a CDN). Emulation is not a
real phone.

| Measure | Result |
|---|---|
| Lighthouse 12.8, mobile (simulated slow 4G, 4× CPU), 3 runs | Performance **93–94**, Accessibility **100**, Best practices **100**, SEO **100** |
| Mobile FCP / LCP / TBT / CLS | 2.0–2.1 s / 2.1–2.3 s / 180–220 ms / ≤ 0.002 |
| Lighthouse desktop preset | 100 / 100 / 100 / 100; FCP & LCP 0.5 s, TBT 0 ms |
| Case-study page, mobile | Performance 98, others 100 |
| Paint timing (Puppeteer, 4× CPU, no network throttling) | FCP/LCP ≈ 470 ms (≈ 1,000 ms before prerendering) |
| JavaScript (gzip) | ≈ 100 KB total: hero 15 KB, chapters 15 KB (lazy), React 68 KB, shared 1 KB; worker 7 KB on demand |
| HTML incl. inlined CSS (gzip) | ≈ 10 KB |
| Solver, 300 orders (headless Chrome, round trip) | 0.12–0.31 s across runs; Node benchmark 315 ms incl. distance matrix |
| Solver, 120 orders (phone viewport) | 0.03–0.05 s |
| Default scenario result | 300 orders: manual 358.5 km on 12 vans → 269.0 km on 10 vans (25% shorter). 120 orders: 206.6 km / 7 → 147.1 km / 5 |
| Mill Bridge closure (300 orders) | detour +26.9 km; targeted re-plan +13.0 km; only 2 of 10 drivers' routes change |
| Unit tests | 20 / 20 passing |
| Browser checks | 12 / 12 passing; no horizontal overflow and no console errors at 390 / 820 / 1440 px |

These are measurements of a simulation and a build, not customer outcomes.

## Demo-only and known limitations

- **No backend.** The booking form validates and then states that nothing was sent; nothing is stored.
- **Illustrative.** Customer messages, the driver app, GPS positions (they follow the planned schedule), integrations,
  multi-depot and time-window features in pricing, and the prices themselves.
- **The 07:30 closure** is modelled before vans depart. Mid-route disruption (crates already on board) isn't modelled.
  A first attempt showed that re-ordering only each van's remaining stops barely beats detouring, so the page tells the
  pre-departure story honestly instead.
- **Map interaction** is click/drag/keyboard; there is no pan or zoom. Phones use 120 orders (decided once per visit).
- **Performance** was measured with emulation and a local server only. Real-device testing (a mid-range Android and
  an iPhone) is still to do, as is a run behind the production CDN.
- **Contact.** `BRANDSHIFT_CONTACT` in `src/components/CaseStudy.tsx` is empty, so no BrandShift contact button
  renders. Set it before publishing.
- **Name.** "Firstlight" has not been checked for trademark conflicts (see the research document).

## Deployment

**Not deployed.** Nothing has been published. To deploy, upload `dist/` to any static host after `npm run build`.

## Credits

Overpass and Overpass Mono, SIL Open Font License (self-hosted via Fontsource). No map data, imagery or third-party
runtime services are used.
