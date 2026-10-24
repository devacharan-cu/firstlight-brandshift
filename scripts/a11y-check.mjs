/**
 * Accessibility behaviour checks (puppeteer-core + local Chrome) against the production build:
 *  1. prefers-reduced-motion: the plan appears complete immediately, no scan animation
 *  2. keyboard only: Tab to "Plan routes", Enter; focus the depot, arrow key, re-plan
 *  3. mobile menu: opens, lists links, Escape closes and returns focus
 *  4. Product menu: opens from the keyboard, Escape closes and returns focus
 *  5. client-side navigation: title updates, focus moves to the page, the change is announced
 *  6. console: keyboard navigation between screens lands focus on the new screen
 *  7. booking form: empty submit shows errors and moves focus; valid submit says nothing was sent
 *  8. a page without JavaScript still shows its prerendered content
 *
 * Usage: node scripts/a11y-check.mjs [base-url]   (default http://127.0.0.1:4173)
 */
import puppeteer from 'puppeteer-core';
import { base, chromePath, sleep } from './chrome.mjs';

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const statusText = (page) => page.$eval('#plan-status', (el) => el.textContent.trim());
const ready = (page) =>
  page.waitForFunction(() => /Ready to plan/.test(document.querySelector('#plan-status')?.textContent ?? ''), { timeout: 20000 });
const planned = (page) =>
  page.waitForFunction(() => /Planned in/.test(document.querySelector('#plan-status')?.textContent ?? ''), { timeout: 20000 });
const fresh = async (vp = { width: 1280, height: 860 }) => {
  const page = await browser.newPage();
  await page.setViewport(vp);
  return page;
};
const tabUntil = async (page, test, max = 40) => {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(test)) return true;
  }
  return false;
};

try {
  // 1. reduced motion
  {
    const page = await fresh();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await ready(page);
    const t0 = Date.now();
    await page.click('.btn--plan');
    await planned(page);
    const elapsed = Date.now() - t0;
    const scan = await page.$('.sheet__scan');
    const tweenFinal = await page.$eval('.compare__big', (el) => el.textContent);
    await sleep(100);
    const tweenLater = await page.$eval('.compare__big', (el) => el.textContent);
    const videosPlaying = await page.$$eval('video', (vs) => vs.filter((v) => !v.paused).length);
    check('reduced motion: plan shown without the planning beat', elapsed < 1500, `${elapsed} ms to completed status`);
    check('reduced motion: numbers render final values (no tween)', tweenFinal === tweenLater, `${tweenFinal} → ${tweenLater}`);
    check('reduced motion: no scan overlay remains', !scan);
    check('reduced motion: background video does not autoplay', videosPlaying === 0, `${videosPlaying} playing`);
    await page.close();
  }

  // 2. keyboard only, on the home page's Untangle
  {
    const page = await fresh();
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await ready(page);
    const reached = await tabUntil(page, () => document.activeElement?.classList.contains('btn--plan') ?? false);
    check('keyboard: Plan routes reachable by Tab', reached);
    await page.keyboard.press('Enter');
    await planned(page);
    await sleep(2500); // let the numbers finish counting
    const firstKm = await page.$eval('.compare__fl .compare__big', (el) => el.textContent);
    check('keyboard: Enter runs the planner', true, await statusText(page));
    await sleep(300);
    const focusAfterPlan = await page.evaluate(() => document.activeElement?.textContent?.trim());
    check('keyboard: focus moves to the toolbar after planning', /Add urgent order/.test(focusAfterPlan ?? ''), String(focusAfterPlan));

    await page.focus('.untangle .depot');
    const before = await page.$eval('.untangle .depot', (el) => el.getAttribute('aria-label'));
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await page.waitForFunction(
      (prev) => {
        const s = document.querySelector('#plan-status')?.textContent ?? '';
        const km = document.querySelector('.compare__fl .compare__big')?.textContent;
        return /Planned in/.test(s) && km !== prev;
      },
      { timeout: 20000 },
      firstKm,
    );
    await sleep(2500);
    const after = await page.$eval('.untangle .depot', (el) => el.getAttribute('aria-label'));
    const secondKm = await page.$eval('.compare__fl .compare__big', (el) => el.textContent);
    const depotFocused = await page.evaluate(() => document.activeElement?.classList.contains('depot'));
    check('keyboard: depot keeps focus through re-planning', !!depotFocused);
    check('keyboard: arrow keys move the depot and re-plan', firstKm !== secondKm, `${before} → ${after}; ${firstKm} km → ${secondKm} km`);
    await page.close();
  }

  // 3. mobile menu
  {
    const page = await fresh({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(`${base}/platform`, { waitUntil: 'load' });
    await page.waitForSelector('.nav__menu');
    await page.click('.nav__menu');
    const open = await page.$eval('.nav__menu', (el) => el.getAttribute('aria-expanded'));
    const links = await page.$$eval('#menu-sheet a', (els) => els.map((a) => a.textContent.trim()));
    await page.keyboard.press('Escape');
    await sleep(100);
    const closed = !(await page.$('#menu-sheet'));
    const focusBack = await page.evaluate(() => document.activeElement?.classList.contains('nav__menu'));
    check('mobile menu: opens, lists links, Escape closes and returns focus', open === 'true' && links.length >= 4 && closed && !!focusBack, `${links.length} links`);
    await page.close();
  }

  // 4. Product menu from the keyboard
  {
    const page = await fresh();
    await page.goto(`${base}/pricing`, { waitUntil: 'load' });
    await sleep(800);
    const reached = await tabUntil(page, () => document.activeElement?.classList.contains('nav__mega-btn') ?? false);
    await page.keyboard.press('Enter');
    await sleep(100);
    const expanded = await page.$eval('.nav__mega-btn', (el) => el.getAttribute('aria-expanded'));
    const items = await page.$$eval('#mega a', (els) => els.length);
    await page.keyboard.press('Tab');
    const intoMenu = await page.evaluate(() => !!document.activeElement?.closest('#mega'));
    await page.keyboard.press('Escape');
    await sleep(100);
    const collapsed = await page.$eval('.nav__mega-btn', (el) => el.getAttribute('aria-expanded'));
    const focusBack = await page.evaluate(() => document.activeElement?.classList.contains('nav__mega-btn'));
    check(
      'product menu: Enter opens, Tab enters it, Escape closes and returns focus',
      reached && expanded === 'true' && items > 4 && intoMenu && collapsed === 'false' && !!focusBack,
      `${items} links`,
    );
    // Tabbing off the end of the panel continues to the next item in the nav.
    await page.keyboard.press('Enter');
    await sleep(100);
    for (let i = 0; i <= items; i++) await page.keyboard.press('Tab'); // into the first link, through the rest, then out
    const after = await page.evaluate(() => ({ text: document.activeElement?.textContent, open: !!document.getElementById('mega') }));
    check('product menu: Tab past the last link moves on to the next nav item', after.text === 'Industries' && !after.open, JSON.stringify(after));
    await page.close();
  }

  // 5. client-side navigation
  {
    const page = await fresh();
    await page.goto(`${base}/platform`, { waitUntil: 'load' });
    await sleep(800);
    await page.click('.nav__links a[href="/pricing"]');
    await page.waitForFunction(() => location.pathname === '/pricing' && document.title.startsWith('Pricing'), { timeout: 8000 });
    await sleep(600);
    const state = await page.evaluate(() => ({
      focus: document.activeElement?.id,
      announced: document.querySelector('[aria-live="polite"].sr-only')?.textContent,
      h1: document.querySelector('main h1')?.textContent,
      current: document.querySelector('.nav__links a[aria-current="page"]')?.textContent,
      desc: document.querySelector('meta[name="description"]')?.getAttribute('content'),
    }));
    check(
      'navigation: title, description, focus, announcement and current link update',
      state.focus === 'main' && /Pricing/.test(state.announced ?? '') && state.current === 'Pricing' && /pricing/i.test(state.desc ?? ''),
      JSON.stringify(state).slice(0, 160),
    );
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/platform', { timeout: 8000 });
    await sleep(400);
    check('navigation: Back returns to the previous page', await page.evaluate(() => document.title.startsWith('Platform')));
    await page.close();
  }

  // 6. console keyboard navigation
  {
    const page = await fresh();
    await page.goto(`${base}/app`, { waitUntil: 'load' });
    await page.waitForSelector('.console__link');
    const reached = await tabUntil(page, () => document.activeElement?.getAttribute('href') === '/app/dispatch');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.pathname === '/app/dispatch', { timeout: 8000 });
    await sleep(600);
    const state = await page.evaluate(() => ({
      focus: document.activeElement?.id,
      title: document.querySelector('.console__title')?.textContent,
      current: document.querySelector('.console__link[aria-current="page"]')?.textContent?.trim(),
    }));
    check('console: keyboard reaches a screen and focus lands on it', reached && state.focus === 'console-main' && /Dispatch/.test(state.current ?? ''), JSON.stringify(state));
    await page.close();
  }

  // 7. booking form
  {
    const page = await fresh();
    await page.goto(`${base}/demo`, { waitUntil: 'load' });
    await page.waitForSelector('form.formcard');
    await sleep(500);
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

  // 8. without JavaScript
  {
    const page = await fresh();
    await page.setJavaScriptEnabled(false);
    const pages = ['/', '/platform', '/engine', '/case-study', '/resources/when-a-bridge-closes'];
    const found = [];
    for (const p of pages) {
      await page.goto(`${base}${p}`, { waitUntil: 'load' });
      found.push(await page.evaluate(() => [document.querySelectorAll('h1').length, document.body.innerText.length]));
    }
    check(
      'no JavaScript: prerendered pages show a heading and their text',
      found.every(([h1, len]) => h1 === 1 && len > 600),
      found.map(([, len], i) => `${pages[i]} ${len} chars`).join(', '),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
