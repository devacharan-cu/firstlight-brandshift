/**
 * Build-time prerender: renders each page's React tree to static HTML and writes it
 * into dist/*.html, so text paints before any JavaScript arrives. The client then
 * mounts over it (createRoot replaces the markup with the identical live tree).
 */
import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

// Minimal browser stubs for code that reads media queries during render.
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const pages = [
    // The chapters below the hero are a lazy chunk, so only the first viewport is prerendered
    // (their Suspense fallback renders in its place), which keeps first paint cheap on slow phones.
    { html: 'dist/index.html', module: '/src/App.tsx', exportName: 'App' },
    { html: 'dist/case-study.html', module: '/src/components/CaseStudy.tsx', exportName: 'CaseStudy' },
  ];
  for (const p of pages) {
    const mod = await vite.ssrLoadModule(p.module);
    const markup = renderToString(createElement(mod[p.exportName]));
    const file = readFileSync(p.html, 'utf8');
    if (!file.includes('<div id="root"></div>')) throw new Error(`${p.html}: root not found`);
    writeFileSync(p.html, file.replace('<div id="root"></div>', `<div id="root">${markup}</div>`));
    console.log(`prerendered ${p.html} (${(markup.length / 1024).toFixed(1)} KB)`);
  }
} finally {
  await vite.close();
}
