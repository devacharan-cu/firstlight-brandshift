/**
 * Captures the case study's screenshots from the running production build and writes them to
 * public/media/case/ as WebP. They are real renders of the site, not mock-ups; re-run after visual
 * changes, then rebuild.
 *
 * Usage: npm run build && npm run preview, then node scripts/case-shots.mjs [base-url]
 */
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { base, chromePath, sleep } from './chrome.mjs';

const OUT = 'public/media/case';
mkdirSync(OUT, { recursive: true });

const desktop = { width: 1440, height: 900, deviceScaleFactor: 1 };
const phone = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** Set the console's simulated clock through its range input, as a user dragging it would. */
const setClock = (page, sec) =>
  page.$eval(
    '#sim-time',
    (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    sec,
  );
const consoleReady = (page) => page.waitForFunction(() => !document.querySelector('#sim-time')?.disabled, { timeout: 30000 });

const shots = [
  {
    file: 'home-hero.webp',
    vp: desktop,
    path: '/',
    width: 1600,
    run: async () => {
      await sleep(2500);
    },
  },
  {
    file: 'untangle.webp',
    vp: desktop,
    path: '/',
    width: 1600,
    run: async (page) => {
      await page.waitForFunction(() => /Ready to plan/.test(document.querySelector('#plan-status')?.textContent ?? ''), { timeout: 30000 });
      await page.$eval('.untangle', (el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.click('.btn--plan');
      await page.waitForFunction(() => /Planned in/.test(document.querySelector('#plan-status')?.textContent ?? ''), { timeout: 30000 });
      await sleep(3500);
    },
  },
  {
    file: 'story.webp',
    vp: desktop,
    path: '/',
    width: 1600,
    run: async (page) => {
      // step 3 of 8, mid-step: the routes have untangled and the distance card has updated
      await page.evaluate(() => {
        const li = document.querySelectorAll('.story__step')[2];
        const b = li.getBoundingClientRect();
        // the step's text at the reading line, with the routes fully drawn
        window.scrollTo(0, b.top + window.scrollY + b.height * 0.8 - innerHeight * 0.55);
      });
      await page.waitForSelector('.scard.is-on', { timeout: 30000 });
      await sleep(2500);
    },
  },
  {
    file: 'tower.webp',
    vp: desktop,
    path: '/app',
    width: 1600,
    run: async (page) => {
      await consoleReady(page);
      await setClock(page, 11 * 3600 + 20 * 60);
      await sleep(1500);
    },
  },
  {
    file: 'depot.webp',
    vp: desktop,
    path: '/depot',
    width: 1600,
    run: async (page) => {
      await page.waitForSelector('.pano canvas', { timeout: 30000 });
      await page.$eval('.pano', (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await sleep(3000);
    },
  },
  {
    file: 'disruption.webp',
    vp: desktop,
    path: '/app/disruptions',
    width: 1600,
    run: async (page) => {
      await consoleReady(page);
      await setClock(page, 10 * 3600 + 30 * 60);
      await sleep(800);
      // Take the first van off the road and wait for the three recovery options.
      await page.$$eval('.console__page .btn--primary', (els) => els.find((b) => /off the road/.test(b.textContent))?.click());
      await page.waitForSelector('.option', { timeout: 30000 });
      await sleep(1200);
    },
  },
  {
    file: 'driver-phone.webp',
    vp: phone,
    path: '/app/driver?van=2',
    width: 780,
    run: async (page) => {
      await consoleReady(page);
      await setClock(page, 9 * 3600 + 40 * 60);
      await sleep(1500);
    },
  },
  {
    file: 'home-phone.webp',
    vp: phone,
    path: '/',
    width: 780,
    run: async () => {
      await sleep(2500);
    },
  },
];

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (const s of shots) {
    const page = await browser.newPage();
    await page.setViewport(s.vp);
    // the console offers its tour to first-time visitors; keep it out of the screenshots
    await page.evaluateOnNewDocument(() => localStorage.setItem('firstlight:tour', 'done'));
    await page.goto(`${base}${s.path}`, { waitUntil: 'load' });
    await s.run(page);
    const png = await page.screenshot({ type: 'png' });
    const info = await sharp(png).resize({ width: s.width }).webp({ quality: 80, effort: 6 }).toFile(`${OUT}/${s.file}`);
    console.log(`${s.file.padEnd(22)} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB`);
    await page.close();
  }
} finally {
  await browser.close();
}
