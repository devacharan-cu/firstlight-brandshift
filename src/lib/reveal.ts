/**
 * Scroll reveals: content blocks fade and rise into place as they enter the viewport, siblings in
 * a short stagger. Only elements that start below the fold are hidden first, so the prerendered
 * first screen never flashes or shifts, and the page reads the same without JavaScript.
 * Transforms and opacity only: no layout shift.
 */
const TARGETS = [
  '.section-title',
  '.section-lede',
  '.pagehead__lede',
  '.modules__grid > li',
  '.ind-strip__grid > li',
  '.modrow__grid > *',
  '.connectors > li',
  '.guides > li',
  '.tier',
  '.faq > *',
  '.rules > li',
  '.flow__steps > li',
  '.security__card',
  '.credits__grid > li',
  '.case__process > li',
  '.case__decisions > li',
  '.case__carry > li',
  '.case__metrics > div',
  '.shots > li',
  '.depot-teaser__content > *',
  '.home-close__content > *',
  '.hero__intro > *',
  '.next__list > li',
  '[data-reveal]',
].join(', ');

let io: IntersectionObserver | null = null;

export function refreshReveal() {
  if (typeof window === 'undefined') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  io?.disconnect();
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('rv-in');
        io?.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  const fold = window.innerHeight;
  const els = document.querySelectorAll<HTMLElement>(`main :is(${TARGETS})`);
  els.forEach((el) => {
    if (el.classList.contains('rv-in')) return;
    // already waiting from an earlier pass: the old observer is gone, so watch it again
    if (el.classList.contains('rv')) {
      io!.observe(el);
      return;
    }
    if (el.getBoundingClientRect().top < fold) return;
    // stagger among siblings that reveal together
    const parent = el.parentElement;
    const i = parent ? [...parent.children].indexOf(el) : 0;
    el.style.setProperty('--rv-i', String(Math.min(i, 6)));
    el.classList.add('rv');
    io!.observe(el);
  });
}
