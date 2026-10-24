/**
 * Build-time prerender: renders every route's React tree to static HTML and writes it to
 * dist/<path>/index.html (plus dist/404.html), each with its own title and description, so text
 * paints before any JavaScript arrives. The client then mounts over it (createRoot replaces the
 * markup with the identical live tree).
 */
import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

// Minimal browser stubs for code that reads media queries during render.
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// Absolute URLs for canonical links, social cards and the sitemap. On Vercel the production
// domain is provided at build time; SITE_URL overrides it.
const SITE = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://firstlight-brandshift.vercel.app')
).replace(/\/$/, '');

const jsonLd = (route) =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'Firstlight',
        url: `${SITE}/`,
        description: 'A fictional route-planning product for delivery fleets, with a working routing simulation. Built by BrandShift.',
        publisher: { '@type': 'Organization', name: 'BrandShift' },
      },
      {
        '@type': 'WebPage',
        name: route.title,
        description: route.description,
        url: `${SITE}${route.path === '/' ? '/' : route.path}`,
        isPartOf: { '@type': 'WebSite', url: `${SITE}/` },
      },
    ],
  }).replace(/</g, '\\u003c');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const template = readFileSync('dist/index.html', 'utf8');
if (!template.includes('<div id="root"></div>')) throw new Error('dist/index.html: empty root not found');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { App } = await vite.ssrLoadModule('/src/App.tsx');
  const { setServerPath } = await vite.ssrLoadModule('/src/router.tsx');
  const { ROUTES, NOT_FOUND, registerLoaded } = await vite.ssrLoadModule('/src/routes.ts');

  const pages = [...ROUTES.map((r) => ({ route: r, out: r.path === '/' ? 'dist/index.html' : `dist${r.path}/index.html` }))];
  pages.push({ route: NOT_FOUND, out: 'dist/404.html', path: '/404' });

  let total = 0;
  for (const { route, out, path = route.path } of pages) {
    const mod = await route.load();
    registerLoaded(route.path, mod.default);
    setServerPath(path);
    // Lazy sections inside a page (such as the home page's chapters) render their Suspense
    // fallback here, which keeps first paint cheap on slow phones.
    const markup = renderToString(createElement(App));
    const html = template
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(route.title)}</title>`)
      .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(route.description)}" />`)
      .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(route.title)}" />`)
      .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(route.description)}" />`)
      .replace('<meta property="og:image" content="/og.jpg" />', `<meta property="og:image" content="${SITE}/og.jpg" />`)
      .replace('<!--canonical-->', () =>
        route === NOT_FOUND
          ? '<meta name="robots" content="noindex" />'
          : `<link rel="canonical" href="${SITE}${route.path}" /><meta property="og:url" content="${SITE}${route.path}" /><script type="application/ld+json">${jsonLd(route)}</script>`,
      )
      .replace('<div id="root"></div>', () => `<div id="root">${markup}</div>`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    total++;
    console.log(`prerendered ${out.padEnd(48)} ${(markup.length / 1024).toFixed(1).padStart(6)} KB`);
  }
  // Sitemap and robots: public pages only; the console screens are app views, not landing pages.
  const urls = ROUTES.filter((r) => !r.path.startsWith('/app')).map((r) => `  <url><loc>${SITE}${r.path}</loc></url>`);
  writeFileSync(
    'dist/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
  );
  writeFileSync('dist/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`sitemap: ${urls.length} pages for ${SITE}`);
  // The old single-file URL keeps working on static hosts that don't map /case-study to a folder.
  writeFileSync('dist/case-study.html', readFileSync('dist/case-study/index.html'));
  console.log(`prerendered ${total} pages`);
} finally {
  await vite.close();
}
