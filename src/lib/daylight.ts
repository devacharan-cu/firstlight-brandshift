/**
 * The day is the story: sections carry data-clock="HH:MM". As the reader scrolls,
 * the clock advances between section times and the paper colour follows the light.
 * Only CSS custom properties change — no layout work, no React renders.
 */

type RGB = [number, number, number];

const KEYS: { min: number; paper: RGB; deep: RGB; wash: RGB }[] = [
  { min: 5 * 60, paper: [220, 224, 223], deep: [208, 213, 213], wash: [176, 192, 204] },
  { min: 6 * 60 + 30, paper: [236, 232, 222], deep: [225, 220, 208], wash: [240, 200, 140] },
  { min: 9 * 60, paper: [244, 239, 228], deep: [234, 227, 212], wash: [245, 230, 200] },
  { min: 15 * 60, paper: [244, 238, 224], deep: [234, 225, 207], wash: [245, 222, 180] },
  { min: 18 * 60, paper: [242, 227, 200], deep: [232, 213, 181], wash: [240, 180, 110] },
  { min: 19 * 60 + 30, paper: [236, 214, 178], deep: [225, 199, 158], wash: [226, 150, 80] },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c: RGB) => `rgb(${c.map((v) => Math.round(v)).join(' ')})`;

export function paletteAt(minutes: number) {
  if (minutes <= KEYS[0].min) return KEYS[0];
  for (let i = 1; i < KEYS.length; i++) {
    if (minutes <= KEYS[i].min) {
      const a = KEYS[i - 1];
      const b = KEYS[i];
      const t = (minutes - a.min) / (b.min - a.min);
      return { min: minutes, paper: mix(a.paper, b.paper, t), deep: mix(a.deep, b.deep, t), wash: mix(a.wash, b.wash, t) };
    }
  }
  return KEYS[KEYS.length - 1];
}

const parse = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

let paperNow = 'rgb(220 224 223)';
export const currentPaper = () => paperNow;

let refresh: () => void = () => {};
/** Re-reads the page after a route change (new sections, new clock). */
export function refreshDaylight() {
  refresh();
}

export function startDaylight() {
  const root = document.documentElement;
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
    const p = paletteAt(minutes);
    paperNow = css(p.paper);
    root.style.setProperty('--paper', paperNow);
    root.style.setProperty('--paper-deep', css(p.deep));
    root.style.setProperty('--wash', css(p.wash));
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
