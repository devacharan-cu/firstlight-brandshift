/**
 * Browser sweep with the locally installed Chrome (puppeteer-core), over every prerendered page at
 * phone, tablet and desktop sizes:
 *  - horizontal overflow, console errors and warnings, uncaught errors, failed requests
 *  - one <h1>, a page title, images with alt text and loaded pixels, controls with accessible names
 *  - undersized tap targets (reported, not failed: inline text links are allowed to be small)
 *  - a viewport screenshot of each page into .shots/<viewport>/ (FULL=1 for full-page shots)
 * Then it runs "Plan routes" on the home page and samples the Untangle animation.
 *
 * Usage: npm run build && npm run preview, then node scripts/shoot.mjs [base-url]
 * Exit code is non-zero if any page fails a check.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { base, builtRoutes, chromePath, sleep } from './chrome.mjs';

const viewports = [
  { name: 'phone', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
];
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const routes = [...builtRoutes(), '/no-such-page'].filter((r) => !only || only.test(r));
const slug = (r) => (r === '/' ? 'home' : r.slice(1).replace(/\//g, '__'));

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ['--no-first-run', '--autoplay-policy=no-user-gesture-required'] });
const rows = [];
let failures = 0;

async function sweep(vp, route) {
  const page = await browser.newPage();
  const problems = [];
  page.on('console', (m) => {
    // the not-found page is meant to arrive with a 404 status, which Chrome logs
    if (route === '/no-such-page' && /status of 404/.test(m.text()) && m.location()?.url?.endsWith('/no-such-page')) return;
    if (m.type() === 'error' || m.type() === 'warn' || m.type() === 'warning') problems.push(`console ${m.type()}: ${m.text().slice(0, 160)}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on('requestfailed', (r) => {
    // media elements cancel range requests as they buffer; that is not a failure
    if (!/net::ERR_ABORTED/.test(r.failure()?.errorText ?? '')) problems.push(`request failed: ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    const expected404 = route === '/no-such-page' && r.url().endsWith('/no-such-page');
    if (r.status() >= 400 && !expected404) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  await page.setViewport(vp);
  // Each page starts from a fresh simulation, as a first visit would.
  await page.goto(`${base}${route}`, { waitUntil: 'load' });
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${base}${route}`, { waitUntil: 'load' });
  await sleep(1200);
  // Scroll through so lazy sections, images and the console's live views all render.
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 140));
    }
    await new Promise((r) => setTimeout(r, 600));
  });
  const facts = await page.evaluate(() => {
    const doc = document.documentElement;
    const desc = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${[...el.classList].slice(0, 2).join('.')}`;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const wide = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!(r.width > 0 && (r.right > doc.clientWidth + 1 || r.left < -1))) return false;
        // content inside its own horizontal scroller is fine
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return false;
        }
        return !el.closest('.sr-only, .skip');
      })
      .slice(0, 6)
      .map(desc);
    const imgs = [...document.querySelectorAll('img')];
    const noAlt = imgs.filter((i) => !i.hasAttribute('alt')).map((i) => i.currentSrc || i.src);
    const broken = imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').map((i) => i.currentSrc || i.src);
    const name = (el) =>
      (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent || el.getAttribute('title') || '').trim() ||
      (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()) ||
      el.closest('label')?.textContent?.trim() ||
      el.querySelector('img[alt]')?.getAttribute('alt');
    const unnamed = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=slider]')]
      .filter((el) => visible(el) && !name(el))
      .slice(0, 6)
      .map(desc);
    const small = [...document.querySelectorAll('button, a[href], input, select, summary, [role=button]')]
      .filter((el) => {
        if (!visible(el) || el.closest('.sr-only, .skip, p, li p, dd, figcaption, td')) return false;
        const r = el.getBoundingClientRect();
        return r.height < 24 || r.width < 24;
      })
      .slice(0, 6)
      .map((el) => `${desc(el)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    return {
      title: document.title,
      h1: document.querySelectorAll('h1').length,
      height: doc.scrollHeight,
      overflowX: doc.scrollWidth > doc.clientWidth,
      wide,
      noAlt,
      broken,
      unnamed,
      small,
    };
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  mkdirSync(`.shots/${vp.name}`, { recursive: true });
  await page.screenshot({ path: `.shots/${vp.name}/${slug(route)}.png`, fullPage: !!process.env.FULL });
  await page.close();

  if (facts.overflowX) problems.push(`horizontal overflow: ${facts.wide.join(', ') || '(no single culprit)'}`);
  if (facts.h1 !== 1) problems.push(`${facts.h1} h1 elements`);
  if (!facts.title) problems.push('empty title');
  if (facts.noAlt.length) problems.push(`img without alt: ${facts.noAlt.join(', ')}`);
  if (facts.broken.length) problems.push(`broken img: ${facts.broken.join(', ')}`);
  if (facts.unnamed.length) problems.push(`controls without a name: ${facts.unnamed.join(', ')}`);
  return { problems, facts };
}

try {
  for (const vp of viewports) {
    for (const route of routes) {
      const { problems, facts } = await sweep(vp, route);
      failures += problems.length ? 1 : 0;
      rows.push({ vp: vp.name, route, problems, small: facts.small, height: facts.height });
      console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${vp.name.padEnd(8)} ${route.padEnd(36)} ${String(facts.height).padStart(6)} px${problems.map((p) => `\n        - ${p}`).join('')}`);
    }
  }

  // The signature interaction: plan, then sample the animation.
  if (!only || only.test('/')) {
    for (const vp of [viewports[0], viewports[2]]) {
      const page = await browser.newPage();
      await page.setViewport(vp);
      await page.goto(`${base}/`, { waitUntil: 'load' });
      await page.waitForFunction(() => /Ready to plan/.test(document.querySelector('#plan-status')?.textContent ?? ''), { timeout: 20000 });
      await page.$eval('.btn--plan', (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const t0 = Date.now();
      await page.click('.btn--plan');
      await page.waitForFunction(() => document.querySelector('.untangle')?.classList.contains('is-lit'), { timeout: 20000 });
      const litAt = Date.now() - t0;
      const start = Date.now();
      for (const ms of [150, 700, 1400, 2600]) {
        await sleep(Math.max(0, ms - (Date.now() - start)));
        await page.screenshot({ path: `.shots/${vp.name}/home-untangle-${String(Date.now() - start).padStart(4, '0')}ms.png` });
      }
      const status = await page.$eval('#plan-status', (el) => el.textContent.trim());
      console.log(`untangle ${vp.name}: lit after ${litAt} ms · ${status}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const small = rows.filter((r) => r.small.length);
if (small.length) {
  console.log(`\nSmall tap targets (under 24 px; review, not failures):`);
  for (const r of small) console.log(`  ${r.vp.padEnd(8)} ${r.route.padEnd(36)} ${r.small.join(' · ')}`);
}
console.log(`\n${rows.length - failures}/${rows.length} page checks passed`);
process.exitCode = failures ? 1 : 0;
