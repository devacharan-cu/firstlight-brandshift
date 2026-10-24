# Firstlight — a BrandShift flagship demonstration

Firstlight is a **fictional** route-planning product for delivery fleets. Its website is BrandShift's showcase: instead of
describing the product with screenshots, the site runs it. A real routing solver plans the day in the visitor's browser,
the home page tells one simulated delivery day in a single pinned scroll, and nine console screens let the visitor run
that day themselves.

> Firstlight, Kesarnagar (the city), its businesses, orders, pricing and customers are invented. Every number on the
> site comes from a simulation on generated data and is labelled as such. Photographs and footage are real, licensed and
> credited, and show unrelated places.

Research and decisions: [`research/brandshift-direction.md`](research/brandshift-direction.md) and
[`research/flagship-phase3.md`](research/flagship-phase3.md).

## Run it

Requires Node 20+ (built with Node 24).

```bash
npm install
npm run dev          # http://localhost:5173 — development server
npm run build        # typecheck → production build → prerender all 25 pages into dist/
npm run preview      # http://localhost:4173 — serve the production build (behaves like a static host)
```

`dist/` is a static site: every route has its own prerendered `index.html` with its own title and description, plus
`404.html`. It can be deployed to any static host. No server, environment variables or third-party services are needed.

## Checks

```bash
npm run typecheck      # TypeScript, strict
npm run lint           # ESLint
npm test               # 49 unit tests: solver, dispatch operations, CSV import
npm run bench          # solver quality and timing report → .bench.json
# with `npm run preview` running:
npm run check:sweep    # every page at 390 / 820 / 1440 px: overflow, console errors, failed requests,
                       # one h1, alt text, named controls, tap targets → screenshots in .shots/
npm run check:a11y     # 18 behaviour checks: reduced motion, keyboard, menus, navigation focus,
                       # console keyboard use, booking form, no-JavaScript rendering
npm run check:browser  # both of the above
npm run shots:case     # re-capture the case study's screenshots into public/media/case/
npm run media          # rebuild graded, responsive photos, loops and the panorama from assets-src/
```

The browser scripts use `puppeteer-core` with the locally installed Chrome. Set `CHROME_PATH` if Chrome isn't in a
standard location.

## The site

**Public pages (15):** home, platform, depot floor (360°), industries, pricing, integrations, routing engine, data &
security, resources and three guides, book a walkthrough, case study, credits. Every page ends with a "Where to next"
row so a first-time visitor always has an obvious next step.

**Home, top to bottom**
1. **Hero** — licensed dawn footage, the promise, and a three-step "how to explore this site".
2. **A day with Firstlight** — one long pinned scroll. The map stays in view while eight steps pass beside it: orders
   arrive, the manual plan tangles, Firstlight untangles it, vans are loaded last-drop-first, drivers set off, a bridge
   closes and only the affected vans are re-planned, a customer gets an arrival window, the day is reported. All of it is
   computed: the story runs its own fixed 120-order day through the routing worker.
3. **Your turn** — the Untangle: plan 300 orders (120 on phones) in the browser, drag the depot, add urgent orders.
4. Modules, the depot floor teaser, industries, and the close.

**Console (9 screens):** control tower, planner, dispatch, fleet, driver app, tracking, disruptions, reports, settings.
All share one simulated day on one clock. A five-step guided tour is offered once on a first visit (always skippable,
re-opened from the "Tour" button).

## Design system

- **Type:** Geist and Geist Mono (SIL OFL, self-hosted via Fontsource), with metric-matched local fallbacks and preloaded
  font files so text doesn't reflow when the web font arrives.
- **Colour:** one warm paper tone, one ink, one accent (amber) with a darker amber for small text (4.5:1 on paper), one
  cool signal colour (teal) and a validated 12-colour route palette for data. Tokens live in `src/styles/app.css`.
- **Shape and depth:** three radii, two soft shadows, pill buttons.
- **Motion:** one easing curve. Scroll reveals (opacity and transform only, never above the fold), card lifts on hover,
  sliding story cards, the route draw-on. Everything respects `prefers-reduced-motion`.

## How it works

```
src/sim/city.ts         seeded street graph: ~2,000 junctions, 3 road classes, diagonal avenues, river + 4 bridges
src/sim/graph.ts        Dijkstra (binary heap, typed arrays), cached shortest-path trees, distance matrix
src/sim/scenario.ts     generated orders, fleet settings, industry profiles
src/sim/solver.ts       manual baseline + Clarke–Wright savings (4 λ starts) + 2-opt, relocate, swap, 2-opt*, van elimination
src/sim/plan.ts         runs both plans, traces every leg back onto streets (drawn length == counted distance)
src/sim/ops.ts          live-plan operations: insert, move, breakdown (redistribute / spare van / hybrid), frozen stops
src/sim/disruption.ts   bridge closure: keep-and-detour vs targeted re-plan vs full re-plan
src/sim/worker.ts       all of the above off the main thread; src/sim/client.ts is the promise wrapper
src/sim/store.ts        the shared simulated day for every page and console screen (session-persisted)
src/components/DayStory.tsx   the home page's pinned story
src/components/PanoViewer.tsx WebGL 360° viewer with projected floor overlays
src/shell/Tour.tsx      the console tour
scripts/prerender.mjs   renders every route to static HTML at build time
```

- **Distance model.** Shortest paths along the generated street graph, in metres. Network distance on an invented city,
  not real-world driving distance. Drive time is distance ÷ 18 km/h.
- **Enforced constraints.** Van capacity, shift length (drive + service time), and every order served exactly once. A
  fleet that's too small is reported, not hidden.
- **Not modelled.** Delivery time windows, traffic, road speeds by type, turn restrictions, driver breaks, multiple
  depots, mixed vehicles.

## Measured results

See the case study (`/case-study`) for the current figures. They are produced by:

- Lighthouse 12 against `npm run preview` (mobile preset: simulated slow 4G and 4× CPU; and the desktop preset), with
  results in `.lh/`. Emulation is not a real phone; a CDN would change the network figures.
- `npm run check:sweep` and `npm run check:a11y` (75 page checks and 18 behaviour checks, all passing at last run).
- `npm test` (49 passing).

These are measurements of a simulation and a build, not customer outcomes.

## Demo-only and known limitations

- **No backend.** The booking form validates and then states that nothing was sent; nothing is stored. The console tour
  remembers that it was seen in this browser's local storage only.
- **Illustrative.** Customer messages, GPS positions (vans follow the planned schedule), integrations, prices.
- **Depot floor.** The lanes are an illustrative projection onto a real photograph; the floor's scale and the camera
  height are estimated.
- **Fonts on slow first visits.** On a very slow connection the fallback font may show briefly and a heading may re-wrap
  once when Geist arrives.
- **Performance** was measured with emulation and a local server only. Real-device testing is still to do.
- **Contact.** `BRANDSHIFT_CONTACT` in `src/pages/caseData.ts` is empty, so no BrandShift contact button renders. Set
  it before publishing.
- **Name.** "Firstlight" has not been checked for trademark conflicts.

## Deployment

**Not deployed.** Nothing has been published. To deploy, upload `dist/` to any static host after `npm run build`.

## Credits

Geist and Geist Mono by Vercel, SIL Open Font License. Photographs and footage from Pexels and Unsplash, and a CC0
panorama from Poly Haven: every source, photographer, licence and edit is listed in `media/manifest.json` and on
`/credits`.
