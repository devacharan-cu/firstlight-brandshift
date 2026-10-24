/**
 * Accessibility behaviour checks (puppeteer-core + local Chrome):
 *  1. prefers-reduced-motion: the plan appears complete immediately, no scan animation
 *  2. keyboard only: Tab to "Plan routes", Enter; focus the depot, arrow key, re-plan
 *  3. booking form: empty submit shows errors and moves focus; valid submit says nothing was sent
 *
 * Usage: node scripts/a11y-check.mjs [url]
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const exe = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
]
  .filter(Boolean)
  .find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const statusText = (page) => page.$eval('#plan-status', (el) => el.textContent.trim());
const ready = (page) =>
  page.waitForFunction(() => /Ready to plan/.test(document.querySelector('#plan-status')?.textContent ?? ''), { timeout: 15000 });

try {
  // 1. reduced motion
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 860 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await ready(page);
    const t0 = Date.now();
    await page.click('.btn--plan');
    await page.waitForFunction(() => /Planned in/.test(document.querySelector('#plan-status')?.textContent ?? ''), { timeout: 15000 });
    const elapsed = Date.now() - t0;
    const scan = await page.$('.sheet__scan');
    const tweenFinal = await page.$eval('.compare__big', (el) => el.textContent);
    await new Promise((r) => setTimeout(r, 100));
    const tweenLater = await page.$eval('.compare__big', (el) => el.textContent);
    check('reduced motion: plan shown without the planning beat', elapsed < 1500, `${elapsed} ms to completed status`);
    check('reduced motion: numbers render final values (no tween)', tweenFinal === tweenLater, `${tweenFinal} → ${tweenLater}`);
    check('reduced motion: no scan overlay remains', !scan);
    await page.close();
  }

  // 2. keyboard only
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 860 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await ready(page);
    let reached = false;
    for (let i = 0; i < 25 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => document.activeElement?.classList.contains('btn--plan') ?? false);
    }
    check('keyboard: Plan routes reachable by Tab', reached);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => /Planned in/.test(document.querySelector('#plan-status')?.textContent ?? ''), { timeout: 15000 });
    const firstKm = await page.$eval('.compare__fl .compare__big', (el) => el.textContent);
    check('keyboard: Enter runs the planner', true, await statusText(page));
    await new Promise((r) => setTimeout(r, 300));
    const focusAfterPlan = await page.evaluate(() => document.activeElement?.textContent?.trim());
    check('keyboard: focus moves to the toolbar after planning', /Add urgent order/.test(focusAfterPlan ?? ''), String(focusAfterPlan));

    await page.focus('.depot');
    const before = await page.$eval('.depot', (el) => el.getAttribute('aria-label'));
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(
      (prev) => {
        const s = document.querySelector('#plan-status')?.textContent ?? '';
        const km = document.querySelector('.compare__fl .compare__big')?.textContent;
        return /Planned in/.test(s) && km !== prev;
      },
      { timeout: 15000 },
      firstKm,
    );
    await new Promise((r) => setTimeout(r, 2500));
    const after = await page.$eval('.depot', (el) => el.getAttribute('aria-label'));
    const secondKm = await page.$eval('.compare__fl .compare__big', (el) => el.textContent);
    const depotFocused = await page.evaluate(() => document.activeElement?.classList.contains('depot'));
    check('keyboard: depot keeps focus through re-planning', !!depotFocused);
    check('keyboard: arrow keys move the depot and re-plan', firstKm !== secondKm, `${before} → ${after}; ${firstKm} km → ${secondKm} km`);
    await page.close();
  }

  // 3. mobile menu
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.nav__menu');
    await page.click('.nav__menu');
    const open = await page.$eval('.nav__menu', (el) => el.getAttribute('aria-expanded'));
    const links = await page.$$eval('#menu-sheet a', (els) => els.map((a) => a.textContent.trim()));
    await page.keyboard.press('Escape');
    const closed = !(await page.$('#menu-sheet'));
    const focusBack = await page.evaluate(() => document.activeElement?.classList.contains('nav__menu'));
    check('mobile menu: opens, lists links, Escape closes and returns focus', open === 'true' && links.length >= 4 && closed && !!focusBack, links.join(' / '));
    await page.close();
  }

  // 4. deep link into a lazily rendered chapter
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 860 });
    await page.goto(`${url.replace(/#.*$/, '')}#pricing`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));
    const top = await page.evaluate(() => document.getElementById('pricing')?.getBoundingClientRect().top ?? -1);
    check('deep link: /#pricing lands on the pricing chapter', top >= 0 && top < 200, `pricing top at ${Math.round(top)} px`);
    await page.close();
  }

  // 5. booking form
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 860 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#book form');
    await page.click('.formcard__submit');
    const errs = await page.$$eval('.field__err', (els) => els.length);
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('name'));
    check('form: empty submit shows errors and focuses the first field', errs === 4 && focused === 'name', `${errs} errors, focus on ${focused}`);
    await page.type('#f-name', 'Asha Rao');
    await page.type('#f-email', 'asha@example.com');
    await page.type('#f-company', 'Example Distributors');
    await page.select('#f-fleet', '10–40');
    await page.click('.formcard__submit');
    const done = await page.$eval('.formcard__done', (el) => el.textContent);
    check('form: valid submit states nothing was sent', /Nothing was sent/.test(done), done.slice(0, 80));
    await page.close();
  }
} finally {
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
