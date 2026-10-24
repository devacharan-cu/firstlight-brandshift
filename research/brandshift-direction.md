# BrandShift Flagship — Direction Document (Phase 1)

*Prepared 23 Oct 2026. Discovery phase only: no website code has been written.*

**Evidence labels:** **[V]** verified (I opened the source or inspected the site live) · **[CR]** company-reported · **[S]** secondary or snippet-level, not primary-verified · **[I]** inference or hypothesis.

---

## 0. Decision in one paragraph

We keep the B2B SaaS category and narrow it to **last-mile dispatch and route optimization**. The fictional product is **Firstlight** (working name). It plans tomorrow's delivery routes for mid-market Indian and international distributors in minutes.

The homepage tells the story of one dispatcher's working day, from 05:40 to 19:00, on a living city map. Its signature moment, **"The Untangle"**, runs a real route optimizer in the visitor's browser. The visitor sees a messy, spreadsheet-style dispatch plan collapse into clean, colour-coded routes, with every number computed live.

Why this direction:
- No logistics competitor I inspected shows its product actually working on the homepage.
- The core idea, "the computer finds shorter routes", is understandable in 3 seconds by any client we pitch, in any industry.
- It shows the exact skill a ₹80k+ SaaS client is paying for: making a complicated product legible and convincing.

---

## 1. Commercial opportunity

### Why B2B SaaS still holds
- **[V]** Tracxn (page updated 2 Oct 2026) lists:
  - 45,653 SaaS startups in India; its FAQ says 37,858 are active, so the page contradicts itself.
  - 4,100 funded companies and 1,118 at Series A or later.
  - Funding of $3.37B in 2024, $2.87B in 2025 and $2.93B in 2026 to date.
  - Source: [tracxn.com/d/explore/saas-startups-in-india](https://tracxn.com/d/explore/saas-startups-in-india/__tiPN56JiWzxgJ8waREJOEFNqn9n0tsWv5RLE38yWlW0)
- **[I]** That suggests roughly 1–2K funded Indian SaaS companies are realistic buyers of a premium website. This is my estimate from those counts, not a published number.
- **[I]** International SaaS buyers (US/EU seed to Series B) widen the pool.

### Why logistics and route optimization as the niche
- **[V]** locus.sh shows a live banner: "INGKA GROUP ACQUIRES LOCUS". Coverage reports the deal on 7 Oct 2025 with terms undisclosed ([Retail Insight Network](https://www.retail-insight-network.com/news/ingka-group-buys-locus/), [PYMNTS](https://www.pymnts.com/cpi-posts/ikea-turns-to-ai-with-locus-acquisition-to-boost-delivery/)).
- **[V]** The category is active and recognised:
  - Onfleet shows a Frost & Sullivan "2026 North American Company of the Year in Smart Logistics" banner.
  - Shipsy (now redirecting to shipsy.ai) shows a "2026 Gartner Market Guide" banner.
  - Positioning shifts and analyst recognition are typical moments when companies reinvest in their websites **[I]**.
- **[S]** A 2026 ranking article citing Tracxn puts Indian logistics tech at about 3,448 companies, 140 of them at Series A+. I did not confirm this against Tracxn directly.
- **[I]** The biggest gap: route optimization is the clearest case where a static screenshot (a map with lines) undersells the product and a live demo makes it obvious. The demo can be honest, using a real heuristic solver and real arithmetic with no fake AI.
- **[I]** It also travels internationally. Onfleet, Routific and Circuit serve the US and EU, and Locus and Shipsy sell globally.

### Niches considered and rejected
| Niche | Evidence | Why not first |
|---|---|---|
| ESG / BRSR carbon accounting | **[V]** SEBI's BRSR Core assurance phases in for the top listed companies ([SEBI circular PDF](https://ca2013.com/wp-content/uploads/2023/07/SEBI-Circular_12.07.2023.pdf)). Funding is small: **[V]** Sprih raised a $3M seed in 2024; **[S]** others raised sub-$1M rounds. | The demo would be forms, a calculator and a Sankey chart. It's credible but visually and emotionally flat. Buyers are early-stage with thin budgets. This is the strongest *second* showcase. |
| Predictive maintenance | **[S, widely reported]** Infinite Uptime raised a $35M Series C on 10 Mar 2025 for US expansion ([TechCrunch](https://techcrunch.com/2025/03/10/infinite-uptime-bags-35m-to-help-factories-optimize-equipment-usage)). | The demo needs simulated sensor data, which is less honest. The buyer pool is thin. 3D machinery adds a lot of weight. |
| AP automation / GST reconciliation | **[S]** Last Indian rounds found were in 2022 (CashFlo, Volopay, Peakflo). | Crowded by Zoho and ClearTax. The visuals are tables, so it's the weakest showcase for frontend craft. |

### The ₹80,000 assumption (challenged)
- **[S, vendor-published, self-interested]** Indian pricing guides put freelancers at ₹80K–2L, small agencies at ₹2–6L and custom SaaS sites at ₹2.5–10L+ ([ColorWhistle](https://colorwhistle.com/webflow-development-cost-india/), [Hostinger IN](https://www.hostinger.com/in/tutorials/website-cost)). Clutch India minimum project sizes run from about $1K to $10K+ (self-reported).
- **[I] Recommendation:** a site at this quality level supports **₹2L+ for SaaS work**. Keep ₹80K as a "focused landing page" entry tier. Leading with ₹80K risks signalling "freelancer" to Series A buyers. This is a pricing hypothesis to test, not a finding.

### Buyer objections the showcase must answer
These come from agency and blog opinion; I found no survey data.
- "Have you done my industry?"
- "Will it perform and convert, or just look nice?"
- "Can my team maintain it?"
- "Will it ship on time?"

Answer them through a companion **"How we built it"** case-study page that documents performance numbers, the architecture and the CMS hand-off.

---

## 2. Live website inspections

I inspected each site in Chrome at 1440px. At each one I scrolled the page and checked its fonts, scripts and page weight with injected JavaScript. Mobile captures used headless Chrome with an iPhone user-agent at a 390px target.

**Limitation:** headless Chrome enforces a minimum window width, so the right-edge clipping in the mobile PNGs is probably a capture artifact. I used those images only for layout structure and overlay intrusions, not for overflow verdicts.

Screenshots are in `research/screenshots/`.

| Site | Observed | Technique worth learning | What we'd do differently |
|---|---|---|---|
| **locus.sh** (category leader) | Dark purple hero with a decorative line-streak image and the headline "Transform Your Transportation Network". An "Agentic TMS" claim. Big stat counters. A scroll-driven **"combinatorial problem"** explainer: as you scroll, rows highlight ("Where it ships from ×5 / Who moves it ×6…"), a counter climbs ("5 → 29 ways to fulfil one order") and SVG curves fan out from a dot cluster. Stack: jQuery, Bootstrap, Swiper, Lottie and 5+ marketing scripts; about 7.8 MB transferred by mid-scroll. On mobile, a cookie banner covers about 25% of the first screen. | The explainer is the best idea in the category: it makes complexity feel physical. | It's still *illustrative*: the visitor watches, never acts. We let the visitor create the complexity, then solve it. And no multi-MB script pile. |
| **onfleet.com** | Hero with tilted dashboard screenshots over a map texture, "Talk to a delivery expert" plus "Start free trial", and a ratings strip. Tabbed feature panels with an isometric screenshot. **A horizontal scrollbar is visible at 1440px**, which suggests overflow. 10 `<video>` elements. On mobile, an AI chat widget with 4 suggestion pills covers the first scroll. | Dual CTA (sales plus self-serve trial) suits a mid-market buyer. | Static, tilted screenshots are the generic SaaS default. Ship zero overflow and no intrusive overlays. |
| **shipsy.ai** (Indian) | Stock-photo warehouse hero, "AI that runs logistics." Glass stat cards and a large greyed logo wall. The screenshot caught a counter **mid-animation reading "39.6% uptime SLA"** (final value 99.9%). No interactive demo or tour on the homepage. | The trust stack (analyst banner, stats, logos) is what enterprise buyers expect. | Count-up animations can freeze at absurd values in screenshots and for slow devices. Render final values; animate only the decoration. |
| **linear.app** | Near-black (#08090A) background, Inter Variable at weight 510 with −1.4px tracking at 64px, and Berkeley Mono for labels. **The product UI is rebuilt in live DOM and SVG**: 233 SVGs, 0 canvas, 0 video. Sections pair a short headline with a working-looking fragment of the product (Slack thread → Kanban). **44 `prefers-reduced-motion` rules.** Next.js. | Real UI rendered as code: crisp at any DPR, themable and animatable. Restraint, plus a disciplined type system. | Linear's look is endlessly imitated; copying it reads as "AI template". Take the method, not the aesthetic. |
| **felt.com** (map-native SaaS) | Warm paper background, GT Alpina serif headlines and Atlas Grotesk body. A **live telemetry bar** (LAT/LON/BRG/ZOOM/scale) pinned above the nav. A hand-illustrated watercolour map carousel with floating UI cards. A product video plays with a **scripted cursor** opening menus. On mobile the map moves below the CTAs and turns into a natural-language prompt card. | The telemetry HUD as brand texture. Editorial typography makes a technical product feel premium. | Felt owns "paper and watercolour cartography", so we must not echo it. Our map should be *procedural and ink-drawn*, and the visitor drives it, not a scripted cursor. |
| **lusion.co** (WebGL studio) | Black preloader still at **~5–6% after ~8s**; the hero rendered around 15–18s on my connection. Then a superb physically lit 3D scene (Three.js, WebGL2, DPR 1.5 canvas at 2551×1404). | Lighting and material quality; scroll-coupled 3D. | **A loading gate is unacceptable for a B2B buyer.** Our hero must paint text first; any graphics stream in after. |

### Pattern across the category [V observed, I interpreted]
Every logistics site I inspected says "AI/agentic". Each relies on stock photos, tilted screenshots or decorative video, and none lets the visitor *do* anything. The aesthetics cluster around dark navy or purple gradients. **The open space is real, visible product behaviour in a light, editorial register.**

---

## 3. Creative directions considered (for the chosen niche)

| Direction | Verdict |
|---|---|
| **Night-ops control room**: dark UI, neon routes, glowing HUD | Rejected. It's what Locus and Shipsy already look like, and it's the default AI-SaaS look. |
| **Illustrated cartography**: watercolour city | Rejected. It's Felt's territory and needs illustration budget the project doesn't have. |
| **Isometric 3D city** in Three.js | Rejected. Heavy, costly on mobile, and 3D *reduces* route legibility (occlusion). The Lusion lesson applies. |
| **"Dispatch Day"**: survey-sheet cartography, signage typography, light that moves with the clock | **Selected** |

---

## 4. Selected concept: Firstlight

### 4.1 Product, audience, problem
- **Product:** Firstlight, a route-planning and dispatch platform. Upload tomorrow's orders, and it builds routes that respect vehicle capacity, delivery windows and driver shifts. It re-plans live when the day breaks the plan, and sends customers accurate ETAs.
- **Audience:**
  - **Economic buyer:** head of operations or supply chain at a mid-market distributor running 15–300 own vehicles. Examples: FMCG and pharma distributors, D2C brands with captive fleets, grocery, building supplies.
  - **Daily user:** the dispatcher.
  - **Influencer:** the CFO, who cares about cost per drop.
- **Core problem [I]:** routes are still built every morning by an experienced dispatcher in spreadsheets, on WhatsApp and from memory. The result is overlapping routes, missed windows, under-loaded vans, and planning that collapses when that person is away.
- **Positioning against the real market [I]:** enterprise players (Locus, Shipsy) are demo-gated and enterprise-priced. Firstlight is self-serve, with transparent per-vehicle pricing. Its promise: *"Tomorrow's routes, planned before the first chai."*

### 4.2 Why it's a credible B2B SaaS concept
- It mirrors a real, funded, consolidating category. **[V]** The Ingka–Locus acquisition and analyst coverage are recent.
- It has a clear ROI language: km, fuel, vehicles per day, on-time %. Buyers already think in those units.
- It has a credible mid-market wedge (self-serve plus transparency) that real competitors leave open **[I]**.
- It works for both Indian and international visitors.

### 4.3 Visual identity and creative thesis
**Thesis: "The city is the interface, and the day is the story."** The site is a dispatcher's working day, told on a living map. Precision and calm are the brand: the product's job is to turn chaos into order, so the design should *perform* that transformation rather than decorate it.

- **Surface:** warm survey-sheet off-white (paper, not beige SaaS). Streets are drawn as fine ink linework with subtle hatching for parks and water. Procedural and code-drawn, not illustrated.
- **Light as narrative:** the page's ambient palette shifts with scroll:
  - pre-dawn blue-grey at 05:40
  - full daylight paper
  - amber evening at 19:00

  A pinned mono **clock and telemetry HUD** (time, orders, vehicles, km) advances as you scroll. This is borrowed in spirit from Felt's HUD, but it carries the *story*, not coordinates.
- **Colour:** ink near-black (text and streets), paper, and one **signal amber** (high-vis vest, the "planned" state). Route colours come from a restrained, colour-blind-checked palette of 6–8 hues, used only on data.
- **Type:**
  - **Overpass** for display and UI. It's an open-source face derived from US highway signage (Highway Gothic), so the typography itself is about roads.
  - **Overpass Mono** for telemetry.
  - Tight, large, confident headlines. No gradient text.
- **Motion principle:** things move only when they mean something: vehicles drive, routes resolve, the clock advances. No floating cards, parallax blobs or decorative particles.

### 4.4 Hero and opening experience
1. **First paint (<1s):** paper background, headline and CTAs as real HTML text, plus an ink city drawn progressively, street by street (a cheap stroke animation). **No preloader.**
2. **05:40, the problem appears:** about 300 order pins rain onto the city, with the headline *"412 deliveries tomorrow. One dispatcher. Planned before chai."*. Then a dense, tangled web of grey lines shows a typical manual plan, built in code by zone and nearest-next.
3. **The invitation:** one primary control, **"Plan routes"** (amber), next to the HUD showing the *manual* plan's km and vehicles.
   - CTAs: "Try it with your orders" (primary) and "See pricing" (secondary).

### 4.5 Signature interaction: "The Untangle"
- **Click "Plan routes":**
  - A real solver runs in a Web Worker: Clarke-Wright savings, then 2-opt and relocate, with capacity and time-window checks.
  - It typically finishes in under 300ms for about 300 stops **[I — to be benchmarked]**.
  - The grey tangle animates into 8–12 clean, coloured loops: each segment morphs from its old route to its new one, staggered by vehicle.
  - The HUD counts the *simulated* difference between the two plans (km, vehicles, late windows).
- **Then the visitor can break things**, and the plan re-solves live each time:
  - drag the depot
  - drop an urgent order
  - close a road
  - take a van off the road
- **Honesty line, always visible:** "Live solver running in your browser on a simulated city. Figures compare two plans in this simulation; they are not customer results."
- **Why it's the right signature:** the interaction *is* the value proposition. A prospect who drags the depot and watches 12 routes re-form understands the product, and BrandShift's craft, without reading a word.

### 4.6 Rest of the homepage (scroll = the working day)
| Clock | Section | What it shows (all UI rebuilt as live DOM/SVG, the Linear method) |
|---|---|---|
| 05:40 | Hero / Untangle | As above |
| 05:55 | **"Why it's hard"** | An interactive explorable. A slider for stops (5 → 400) shows possible route orders growing factorially, compared against everyday quantities. It's our answer to Locus's explainer: they watch, ours you control. |
| 06:15 | **Dispatch to drivers** | A phone-frame driver app: the route hand-off, turn list and proof-of-delivery capture. It's interactive (tap through the stops). |
| 11:30 | **Disruption** | A road closure and a breakdown arrive as alerts. The map re-plans, and affected customers' ETAs update, shown on a customer tracking page that is a real component. |
| 14:00 | **Customer experience** | A WhatsApp/SMS-style ETA message and a tracking page with a live moving van. The message templates are illustrative and labelled as such. |
| 19:00 | **Day report** | Evening amber light. The day's charts (on-time %, km per drop, utilisation) come *from the simulation the visitor just ran*. |
| — | **Fits your stack** | Integration chips (Shopify, Unicommerce, Zoho, Tally, SAP B1, CSV). Labelled "planned integrations" because the product is fictional. |
| — | **Pricing** | Transparent per-vehicle/month with an INR/USD toggle and a vehicle-count slider. |
| — | **Close** | "Upload tomorrow's orders" with a sample CSV, leading to the full sandbox. |

**Credibility rules:** no fake logos, testimonials, certifications or customer numbers. The trust blocks are the honest kind: how the solver works, data handling *as designed*, and an "early access" framing.

### 4.7 Supporting pages and conversion path
- **/planner (sandbox):** a full-screen Untangle with CSV upload. The sample format is provided, and parsing happens entirely client-side. This is where a "wow" turns into "I want this for my data".
- **/pricing:** tiers, an FAQ and a comparison against "spreadsheet plus dispatcher".
- **/how-it-works:** an honest technical explainer of the solver, constraints and limits. Its main job is to build trust with ops buyers.
- **/security:** a design-intent page with no claimed certifications; it states what *would* be required.
- **/book:** onboarding call booking. The form is front-end only in the portfolio build.
- **BrandShift case study (/built-by-brandshift):** performance numbers, architecture and design decisions. This page sells the agency.

**Conversion path:** Hero → Untangle (aha) → Day scroll (depth) → Pricing (feasibility) → Planner with your CSV (commitment) → Book onboarding.

---

## 5. Technical recommendation

| Need | Choice | Why / trade-off |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript**, statically exported | It's what SaaS clients expect to inherit, it has file-based pages, and the result is reusable as the agency's base. Astro islands would ship less JavaScript, but Next.js wins on client familiarity. Revisit only if the JS budget fails. |
| Styling | **Tailwind CSS v4 + CSS custom-property tokens** | Fast to build. The tokens drive the time-of-day palette shift through a single scroll-driven variable set. |
| Map rendering | **Canvas 2D** (DPR capped at 2) for streets and routes; **SVG/DOM** for pins, labels and UI | About 3–5K street segments plus 12 animated routes is well within Canvas 2D. Escalate to a lean WebGL layer (OGL/regl) **only if profiling** shows dropped frames. No Three.js: 3D adds weight and hurts legibility. |
| Solver | **Web Worker**, custom TypeScript heuristics (savings → 2-opt/relocate), deterministic seeds | Real logic, nothing on the main thread, and no dependency. It runs the same in the sandbox and the hero. |
| City data | **Primary:** a stylised OpenStreetMap extract of one real Indian city district, preprocessed at build time into a compact graph and distance matrix. **Fallback:** a seeded procedural street generator. | OSM looks authentic to Indian buyers and gives real road distances, but needs **ODbL attribution** (**[V]** [osm.org/copyright](https://www.openstreetmap.org/copyright)) and preprocessing work. The fallback de-risks the schedule. |
| Scroll choreography | **GSAP + ScrollTrigger**, the single animation system | **[V]** GSAP is now free for commercial use, including the formerly paid plugins ([Webflow announcement](https://webflow.com/blog/gsap-becomes-free)). No Framer Motion as well, since two animation systems would overlap. CSS handles micro-interactions. **No scroll-jacking or smooth-scroll library**; native scroll is kept. |
| Accessibility | Reduced-motion path (instant state swaps with a crossfade); keyboard controls for the map (add order, move depot, run); a text and table alternative for every visual result; AA contrast on paper | This follows the Linear evidence (44 reduced-motion rules) and is required for the "engineering" half of the pitch. |
| Performance budget | **LCP < 2.0s** on a mid-range Android over 4G; **initial JS ≤ 170KB gzip**; solver and map data lazy-loaded after first paint; **no preloader**; CLS ≈ 0 | This follows the Lusion lesson. We will publish the real numbers on the case-study page. |
| Mobile | The map fills the top ~60% and controls sit in a bottom sheet. 120 stops instead of 300. Tap adds an order; long-press closes a road. The HUD collapses to one line. | The Untangle must be *the* mobile moment too, not a desktop-only trick. |

### Major risks
1. **Solver quality vs. speed on low-end phones.** Mitigation: benchmark in Milestone 1, cap stops on mobile, and run the solver in a worker with a time budget.
2. **OSM preprocessing effort and street legibility at small sizes.** Mitigation: time-box to one day, then fall back to procedural streets.
3. **Morph animation of hundreds of segments.** Mitigation: animate route polylines, not individual segments, and batch Canvas draws.
4. **"No AI" could read as dated in 2026** **[I]**. Mitigation: position the product as "explainable optimization", and add one honest AI touch only if it's real (e.g., natural-language constraints parsed with rules), clearly scoped.
5. **Scope creep across the day sections.** Mitigation: the Untangle and hero ship first; each day section must earn its place.

---

## 6. Concept comparison (scores 1–5)

| Criterion | **A. Firstlight / Untangle** | B. Carbon / BRSR ledger | C. Predictive maintenance | D. GST reconciliation |
|---|---|---|---|---|
| Commercial relevance and buyer plausibility | 5 | 4 | 3 | 3 |
| Visual and interactive distinctiveness | 5 | 3 | 4 | 2 |
| Strength of an honest demo | 5 (real solver) | 4 (real calculator) | 2 (simulated sensors) | 4 (real matching) |
| Live-demo "wow" for a prospect | 5 | 3 | 4 | 2 |
| Technical feasibility in time | 4 | 5 | 3 | 5 |
| Mobile and performance | 4 | 5 | 2 | 5 |
| Reusability for client work | 4 (map and data-viz kit, day-scroll system) | 4 | 3 | 4 |
| **Total** | **32** | 28 | 21 | 25 |

These scores are my judgment, not measurements. B's strength is that it's the easiest to build; that's not enough for a flagship.

---

## 7. What still needs validation
- **Buyer reaction:** show the Milestone-1 prototype to 3–5 real SaaS founders or marketing leads. Ask: does it make them want *this level of quality*? Is the logistics subject a distraction for non-logistics SaaS prospects?
- **Pricing:** does ₹2L+ hold for funded Indian SaaS? I recommend keeping ₹80K as an entry tier. Test this in real sales conversations.
- **Name:** run a trademark and domain check on "Firstlight" (it's a working name and similar names likely exist).
- **Solver benchmarks** on a real mid-range Android, not just an emulator.
- **OSM city choice and attribution** placement.
- **Mobile captures:** repeat them on real devices. My headless captures can't settle overflow questions.
- **Stated competitor facts:** most market numbers came through a research pass over search results. Only the items marked **[V]** were checked directly.

---

## 8. Implementation priorities

**Milestone 1, "Untangle Proof" (build first, about 2–3 days):** a single standalone page containing:
1. The city map rendered from an OSM extract (or the procedural fallback), with progressive ink drawing.
2. About 300 seeded orders, a naive "manual" plan, and the optimized plan solved in a Web Worker.
3. The tangle → routes morph animation, plus the HUD numbers computed live.
4. Two interactions: drag the depot and add an urgent order, both re-solving live.
5. A reduced-motion path and keyboard control.
6. Measured results: solver time, FPS and LCP on desktop and a mid-range Android profile.

**Gate:** if the Untangle isn't genuinely impressive and smooth at the end of Milestone 1, re-evaluate before building the rest of the site.

**Then, in order:**
1. Hero and typography system (Overpass, tokens, time-of-day palette)
2. Day-scroll sections (05:55 → 19:00)
3. Pricing
4. /planner sandbox with CSV
5. Supporting pages
6. BrandShift case-study page
7. Performance and accessibility pass, then real-device QA

---

## Sources
- Live inspections: https://locus.sh · https://onfleet.com · https://www.shipsy.ai (from shipsy.io) · https://linear.app · https://felt.com · https://lusion.co
- Tracxn India SaaS: https://tracxn.com/d/explore/saas-startups-in-india/__tiPN56JiWzxgJ8waREJOEFNqn9n0tsWv5RLE38yWlW0
- Ingka–Locus: https://www.retail-insight-network.com/news/ingka-group-buys-locus/ · https://www.pymnts.com/cpi-posts/ikea-turns-to-ai-with-locus-acquisition-to-boost-delivery/
- Infinite Uptime: https://techcrunch.com/2025/03/10/infinite-uptime-bags-35m-to-help-factories-optimize-equipment-usage
- SEBI BRSR Core: https://ca2013.com/wp-content/uploads/2023/07/SEBI-Circular_12.07.2023.pdf
- Sprih seed: https://www.outlookbusiness.com/corporate/climate-tech-start-up-sprih-secures-3-million-in-seed-funding-led-by-leo-capital
- Pricing guides: https://colorwhistle.com/webflow-development-cost-india/ · https://www.hostinger.com/in/tutorials/website-cost · https://upgrowth.in/website-design-cost-guide-in-india/
- GSAP licence: https://webflow.com/blog/gsap-becomes-free
- OSM licence: https://www.openstreetmap.org/copyright

## Screenshots (`research/screenshots/`)
- **Desktop:**
  - desktop-locus-hero.jpg
  - desktop-locus-combinatorial-explainer.jpg
  - desktop-onfleet-hero.jpg
  - desktop-onfleet-tabs-hscroll.jpg
  - desktop-shipsy-hero.jpg
  - desktop-shipsy-stats-countup-midframe.jpg
  - desktop-linear-hero.jpg
  - desktop-linear-dom-product-ui.jpg
  - desktop-felt-hero.jpg
  - desktop-felt-scripted-cursor-demo.jpg
  - desktop-lusion-preloader-8s.jpg
  - desktop-lusion-hero-loaded.jpg
- **Mobile (headless, see the limitation in §2):**
  - mobile-locus.png
  - mobile-onfleet.png
  - mobile-felt.png
  - mobile-linear.png

---

**Phase 3 addendum:** buyer evidence, case-study patterns, live inspections and the photography policy for the multi-page flagship are in [`flagship-phase3.md`](flagship-phase3.md).
