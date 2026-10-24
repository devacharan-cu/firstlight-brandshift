import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`].find(existsSync);
const b = await puppeteer.launch({ executablePath: exe, headless: true });
for (const cpu of [1, 4]) {
  for (let run = 0; run < 2; run++) {
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
    if (process.env.NOFONT) {
      await p.setRequestInterception(true);
      p.on('request', (r) => (r.resourceType() === 'font' ? r.abort() : r.continue()));
    }
    if (process.env.NOJS) await p.setJavaScriptEnabled(false);
    if (process.env.STRIP) {
      const html = (await (await fetch('http://127.0.0.1:4173/')).text()).replace(new RegExp(process.env.STRIP, 's'), '');
      await p.setRequestInterception(true);
      p.on('request', (r) => (r.resourceType() === 'document' ? r.respond({ status: 200, contentType: 'text/html', body: html }) : r.continue()));
    }
    const cdp = await p.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await p.goto('http://127.0.0.1:4173/', { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 1500));
    if (process.env.NOJS) await p.setJavaScriptEnabled(true);
    const t = await p.evaluate(() => {
      const paint = Object.fromEntries(performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)]));
      const lcp = new Promise((res) => new PerformanceObserver((l) => { const e = l.getEntries(); res(Math.round(e[e.length - 1].startTime)); }).observe({ type: 'largest-contentful-paint', buffered: true }));
      const nav = performance.getEntriesByType('navigation')[0];
      return lcp.then((l) => ({ ...paint, lcp: l, dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) }));
    });
    console.log(`cpu x${cpu}`, JSON.stringify(t));
    await p.close();
  }
}
await b.close();
