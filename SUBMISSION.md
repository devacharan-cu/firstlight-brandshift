# Firstlight — challenge submission

**Project:** Firstlight, a fictional route-planning product for delivery fleets, built as a BrandShift flagship.
**Category:** B2B SaaS website.
**Live link:** _to add once it's deployed (`dist/` is a static site that works on any static host)._
**Repository:** _to add once it's pushed (local git history is complete)._

## Short description

Firstlight's website doesn't describe the product; it runs it. The home page tells one delivery day in a single pinned
scroll on a real computed plan. Visitors can then plan 300 orders in their own browser and open a nine-screen console
where the whole day runs on a simulated clock. Fifteen public pages cover the product, industries, pricing,
integrations, the routing engine, security, guides and a case study. All photography is real, licensed and credited.

## How it answers the judging framework

| # | Category | What to look at |
|---|---|---|
| 1 | Visual design (12) | Geist and Geist Mono; one tokenised palette (paper, ink, amber, teal) and a validated route palette; three radii, two shadows, pill buttons; licensed photography graded to match; the hero's dawn footage. |
| 2 | User experience (10) | The hero's "how to explore" three steps; the eight-step story with clickable progress ticks; "Where to next" at the end of every page; the Product mega-menu; a five-step console tour (skippable, re-openable). |
| 3 | Functionality (15) | A real solver: plan, drag the depot, add urgent orders, move stops between vans, close a bridge, break down a van (three recovery options), driver app, customer tracking, reports with CSV export, CSV import with row-level errors, a booking form with validation. |
| 4 | Frontend engineering (10) | React 19 + strict TypeScript; the solver runs in a Web Worker; one shared state store across 24 routes; a custom router with View Transitions; every route prerendered; reusable components (map, 360° viewer, media, tour). |
| 5 | Responsiveness (10) | Checked automatically at 390, 820 and 1440 px on all 25 pages: no horizontal overflow anywhere. Phone-specific story layout, console navigation, and a landscape 360° view. |
| 6 | Performance (8) | Lighthouse mobile performance of 89–97 across the pages measured, 100 on desktop; CLS 0; 93 KB of JavaScript for the home page's first view; prerendered HTML; responsive AVIF/WebP images; lazy media with placeholders. |
| 7 | Accessibility (6) | Lighthouse accessibility 100 on the pages measured. 18 automated behaviour checks cover keyboard planning, menus, focus on navigation, reduced motion and no-JavaScript rendering. Labelled forms and a text alternative for every map. |
| 8 | Security (5) | No backend, no cookies, no trackers, no third-party requests. Input is validated client-side, and nothing leaves the browser; the site says so wherever a real product would send data. The `/security` page sets out the design intent honestly. |
| 9 | Innovation (7) | A product site whose demo is the real product; a pinned story driven by a live plan; the 2D planning shown on a real 360° warehouse capture in WebGL; disruption handling that re-plans only the vans affected. |
| 10 | Business value (8) | A clear value proposition, per-van pricing with a calculator, a demo-booking flow, industry scenarios, and a case study with measured results and the BrandShift price point. |
| 11 | SEO (4) | Every route prerendered with its own title, description and Open Graph tags; one `h1` per page (checked); semantic headings; a 404 page (`dist/404.html`, which `npm run preview` serves with a 404 status). |
| 12 | Presentation (5) | This document, the README, the case study (`/case-study`), the research notes in `research/`, and the honest limitations below. |

## Main features

Pinned story of the day · interactive 300-order planner · nine-screen console (control tower, planner, dispatch, fleet,
driver app, tracking, disruptions, reports, settings) · console tour · 360° depot floor with projected staging lanes ·
CSV import and export · pricing calculator · validated booking form · three practical guides · case study · full
credits page.

## Technology

React 19, TypeScript (strict), Vite. Canvas 2D for maps, WebGL for the 360° viewer, a Web Worker for routing. No map,
animation or UI libraries. Fonts self-hosted. Tests use Vitest and puppeteer-core; measurements use Lighthouse 12.

## Testing and performance (24 Oct 2026, local production build)

- **Unit tests:** 49 of 49 passing.
- **Browser sweep:** 75 of 75 page checks passing (25 pages × 3 screen sizes). It checks for no overflow, no console
  errors and no failed requests, plus exactly one `h1`, alt text and named controls on every page.
- **Accessibility:** 18 of 18 behaviour checks passing.
- **Lighthouse, mobile (slow 4G, 4× CPU):**
  - Home: performance 89–90, accessibility 100, best practices 100, SEO 100.
  - Platform 97, case study 95, console 92, depot 78 (performance scores).
- **Lighthouse, desktop:** 100 / 100 / 100 / 100 on home, console and case study.
- **Layout shift:** CLS 0 on every page measured.

## Third-party credits

Photographs and footage come from Pexels and Unsplash photographers. The 360° warehouse capture is CC0 from Poly Haven
(Sergej Majboroda). Fonts are Geist and Geist Mono by Vercel (SIL OFL). Every source and edit is listed on `/credits`
and in `media/manifest.json`.

## Known limitations

- Firstlight, its city, customers and prices are fictional. All numbers come from a simulation.
- There is no backend: messaging, GPS, integrations and bookings are demonstrated, not connected.
- The depot lanes are an illustrative projection onto a real photograph; the floor scale is estimated.
- On mobile the depot page scores 78 for performance, because React renders all its lane and stop tables when the plan
  arrives.
- Performance was measured with emulation on a local server, not on real phones behind a CDN.

## Future improvements

- Render the depot tables lazily to bring its mobile score in line with the other pages.
- Test on real devices (a mid-range Android phone and an iPhone).
- Add a real backend for demo bookings, with consent and storage disclosures.
- Run a trademark check on the name.
- Translate the site into Hindi.
