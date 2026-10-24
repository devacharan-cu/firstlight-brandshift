# Firstlight flagship: Phase 3 research and decisions

Addendum to [`brandshift-direction.md`](brandshift-direction.md). Phase 3 turned the one-page Firstlight showcase into a
multi-page product website with a working console, built on real photography. This note records what we looked at,
what we concluded, and the rules the build follows. Evidence labels match the main document: **[V]** opened and
checked, **[S]** search snippet or secondary coverage only, **[I]** our interpretation.

## 1. What buyers of agency work look for

| Finding | Label | Source |
|---|---|---|
| Clutch 2020 survey of 451 recent buyers: 25% rank transparent cost information as the most important website element, 23% case studies or testimonials, 17% immediate access to information. | [V] via a republished Clutch press release | indrastra.com, Feb 2020 (link below) |
| TrustRadius 2026 B2B Buying Disconnect Report (1,862 tech buyers, fielded January 2026): buyers naming a compelling demo as a deciding factor rose from 13% to 18%. Vendor marketing collateral ranked last among resources used. | [V] from secondary coverage, not the report itself | marketscale.com |
| Hinge Research: 68% of buyers value specialised expertise most; 71% first ask friends and colleagues. | [S] full report is paywalled | hingemarketing.com |
| Gartner/CEB: buyers spend about 17% of buying time with suppliers. | [S] 2018–19 figures; Gartner's page blocked the fetch | via benchmarkemail.com |

**What we concluded [I].** Most of the decision is made before a call, so the case study and the site carry the sale.
The two things buyers say they want first, price and proof, are the two things agency sites most often hide. A working
demo is the agency equivalent of the product demo that buyers increasingly cite as decisive.

## 2. How strong case studies are built

- **Instrument (ServiceNow)** [V]: challenge → idea → system → result, with business metrics and a client quote.
  Their Uber for Business case uses the same template with no metrics, and is noticeably weaker.
- **Work & Co (VistaPrint)** [V]: numbered narrative chapters, the stack, the timeline (about two weeks), "what we did",
  then six outcome figures and two client quotes.
- **Lollypop (AGOG transport logistics platform)** [V]: the closest analogue in subject. It is a process walkthrough:
  brief, workshop, modules, IA, wireframes, screens. It has no numbers, no quote and no team, and it is tagged "MVP".

**Applied [I].** The Firstlight case study follows problem → approach → screenshots → decisions → measurements → what
is and isn't real → what carries over → price. It avoids the process-only pattern. Because Firstlight is fictional, it
reports **build measurements** (Lighthouse, paint timings, bundle sizes, test counts), never invented business results,
and it says so on the page.

## 3. Live website inspections (24 October 2026, desktop Chrome)

| Site | What we saw | Label | What we took from it |
|---|---|---|---|
| Samsara (fleet platform) | Strong responsive images (dozens of `<picture>`/`srcset` elements) and a solid mega-menu, but the hero video had no poster frame, leaving empty white space while it loaded. Lazy sections also flashed white. | [V] | Every video gets a graded poster and a blurred placeholder; no blank media boxes. |
| Flexport (logistics) | A real photograph in the hero with an explorable product UI embedded on the page. | [V] | The closest to our thesis: show the product working. We go further, because ours runs. |
| Anduril (industrial) | A black preloader still covering the page at about 4 s. A template bug left the literal placeholder "@[shortTitle]" in a heading. Imagery is largely CG. | [V] | No preloader; prerender every page; check rendered headings in tests (the sweep checks each page has exactly one `h1`). |
| Matterport (3D capture) | A digital-twin company whose homepage doesn't let you step into a twin. | [V] | A real 360° capture the visitor can look around, with the plan projected onto it, is a genuine differentiator. |

Screenshots of these inspections were taken during the session for reference and are not redistributed.

## 4. Photography and footage policy

The brief required authentic, licensed, real-world material, no AI-generated photographs and no crude 3D stand-ins.

- **Sources.** Pexels and Unsplash (both permit commercial use without attribution; we credit anyway) and Poly Haven
  (CC0) for the 360° warehouse. Licences were read on each source page; see `media/manifest.json` and `/credits`.
- **No false places.** Firstlight's city, Kesarnagar, is fictional. Photographs show unrelated real places and are
  never captioned as Kesarnagar, a customer or a Firstlight depot.
- **Rejected candidates.** Images with readable company signage, vehicle brand badges or number plates, an informal
  settlement used as "city texture", and a dashcam clip that was dropped from the final set.
- **Redaction.** One photograph (the loading-bay door) had a phone number and a fleet ID painted on a truck; both are
  blurred by the media pipeline, and the edit is listed on `/credits`.
- **No faked continuity.** Clips are trimmed into seamless loops of themselves. No sequence implies a continuous camera
  move between unrelated shots.
- **One grade.** Every image and clip gets the same light grade so different photographers' work sits together.

## 5. Decisions that followed

1. **Multi-page site plus console, one state model.** Public pages explain; the console proves. Both read the same
   simulated day, so a number on the website matches the screen behind it.
2. **Prerender every route.** Each page ships its own HTML, title and description, readable without JavaScript.
3. **The depot page uses the CC0 360° warehouse capture** with today's staging lanes projected in perspective,
   instead of a rendered warehouse.
4. **Honesty is a feature.** Every simulated element is labelled, the booking form says nothing was sent, prices are
   marked illustrative, and integrations are described as design intent, not live connections.

## Sources

- https://www.indrastra.com/2020/02/Clutch-s-Survey-B2B-Buyers-Concern-Cost-Transparency-006-02-2020-0044.html
- https://www.marketscale.com/industries/business-services/94-of-b2b-buyers-fact-check-ai-research-outputs-and-vendors-are-underestimating-how-far-trust-has-fallen
- https://hingemarketing.com/library/article/how_buyers_buy_professional_services_executive_summary
- https://www.benchmarkemail.com/in/b2b-sales-better-make-sure-your-digital-game-is-on-point/
- https://www.instrument.com/work/servicenow-rebrand
- https://www.instrument.com/work/uber-for-business
- https://work.co/clients/vistaprint/
- https://lollypop.design/projects/designing-an-end-to-end-transport-logistics-platform/
- https://www.samsara.com/ · https://www.flexport.com/ · https://www.anduril.com/ · https://matterport.com/
- https://polyhaven.com/a/empty_warehouse_01 (CC0 panorama)
