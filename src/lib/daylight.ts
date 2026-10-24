/**
 * The day is the story: sections carry data-clock="HH:MM". As the reader scrolls,
 * the clock readouts in the header advance between section times. Only text nodes change:
 * no layout work, no React renders.
 */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const parse = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

// The page keeps one paper tone (the design system's); only the clock readouts follow the day.
const paperNow = 'rgb(247 245 240)';
export const currentPaper = () => paperNow;

let refresh: () => void = () => {};
/** Re-reads the page after a route change (new sections, new clock). */
export function refreshDaylight() {
  refresh();
}

export function startDaylight() {
  const clockEls = () => document.querySelectorAll<HTMLElement>('[data-live-clock]');
  let last = -1;
  let raf = 0;
  const update = () => {
    raf = 0;
    const sections = [...document.querySelectorAll<HTMLElement>('[data-clock]')];
    if (!sections.length) return;
    const probe = window.innerHeight * 0.45;
    let minutes = parse(sections[0].dataset.clock!);
    for (let i = 0; i < sections.length; i++) {
      const r = sections[i].getBoundingClientRect();
      if (r.top <= probe) {
        const a = parse(sections[i].dataset.clock!);
        const next = sections[i + 1];
        const b = next ? parse(next.dataset.clock!) : a;
        const t = Math.min(1, Math.max(0, (probe - r.top) / Math.max(1, r.height)));
        minutes = lerp(a, b, t);
      }
    }
    const rounded = Math.round(minutes);
    if (rounded === last) return;
    last = rounded;
    const label = `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
    clockEls().forEach((el) => (el.textContent = label));
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  refresh = () => {
    last = -1;
    update();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}
