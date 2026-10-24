/**
 * Browser checks with the locally installed Chrome (puppeteer-core):
 *  - horizontal overflow and console errors at phone / tablet / desktop sizes
 *  - runs "Plan routes" and captures frames through the Untangle animation
 *  - full-page screenshots into .shots/
 *
 * Usage: node scripts/shoot.mjs [url]   (default http://127.0.0.1:4173/)
 * Set CHROME_PATH if Chrome is not in a standard location.
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error('Chrome not found; set CHROME_PATH');

mkdirSync('.shots', { recursive: true });

const viewports = [
  { name: 'phone', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
];

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-first-run'] });
const report = [];
try {
  for (const vp of viewports) {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.setViewport(vp);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => /Ready to plan/.test(document.querySelector('#plan-status')?.textContent ?? ''), {
      timeout: 15000,
    });
    await page.screenshot({ path: `.shots/${vp.name}-01-hero.png` });

    // run the planner and sample the animation
    const t0 = Date.now();
    await page.click('.btn--plan');
    await page.waitForFunction(() => document.querySelector('.untangle')?.classList.contains('is-lit'), { timeout: 15000 });
    const litAt = Date.now() - t0;
    const animStart = Date.now();
    for (const ms of [150, 700, 1400, 2600]) {
      await new Promise((r) => setTimeout(r, Math.max(0, ms - (Date.now() - animStart))));
      const at = Date.now() - animStart;
      await page.screenshot({ path: `.shots/${vp.name}-02-anim-${String(at).padStart(4, '0')}ms.png` });
    }
    const status = await page.$eval('#plan-status', (el) => el.textContent);

    // overflow + layout facts across the whole page
    const facts = await page.evaluate(() => {
      const doc = document.documentElement;
      const wide = [...document.querySelectorAll('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > doc.clientWidth + 1 || r.left < -1);
        })
        .filter((el) => !el.closest('.sheet__map, .minimap, .sr-only, .skip'))
        .slice(0, 8)
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
      const smallTargets = [...document.querySelectorAll('button, a, input, select, summary, [role="button"]')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24) && !el.closest('.sr-only, .skip');
        })
        .slice(0, 10)
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, overflowX: doc.scrollWidth > doc.clientWidth, wide, smallTargets };
    });

    await page.screenshot({ path: `.shots/${vp.name}-03-full.png`, fullPage: true });

    // each chapter at viewport size
    const ids = await page.$$eval('[data-clock]', (els) => els.map((el, i) => (el.id ||= `chapter-${i}`)));
    for (const [i, id] of ids.entries()) {
      await page.evaluate((sel) => document.getElementById(sel)?.scrollIntoView({ behavior: 'instant' }), id);
      await new Promise((r) => setTimeout(r, 900));
      await page.screenshot({ path: `.shots/${vp.name}-04-${String(i).padStart(2, '0')}-${id}.png` });
    }
    report.push({ viewport: vp.name, litAfterMs: litAt, status: status?.trim(), ...facts, errors });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
