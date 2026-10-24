/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Inline the (small, ~8 KB gzip) stylesheet into each HTML page so first paint
 * doesn't wait for an extra render-blocking request on slow mobile networks.
 */
function inlineCss(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const css = Object.values(bundle).filter((f) => f.type === 'asset' && f.fileName.endsWith('.css'));
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue;
        let html = String(file.source);
        for (const c of css) {
          if (c.type !== 'asset') continue;
          const tag = new RegExp(`<link rel="stylesheet"[^>]*href="/${c.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`);
          if (tag.test(html)) html = html.replace(tag, () => `<style>${String(c.source)}</style>`);
        }
        file.source = html;
      }
    },
  };
}

/**
 * Make `vite preview` serve the prerendered pages the way a static host does: /platform reads
 * dist/platform/index.html, and an unknown path gets dist/404.html with a 404 status.
 */
function staticPages(): Plugin {
  return {
    name: 'static-pages',
    configurePreviewServer(server) {
      const dist = resolve(import.meta.dirname, 'dist');
      server.middlewares.use((req, res, next) => {        const url = new URL(req.url ?? '/', 'http://x');
        const path = decodeURIComponent(url.pathname).replace(/\/$/, '');
        if (req.method !== 'GET' || path === '' || /\.[a-z0-9]+$/i.test(path)) return next();
        const page = resolve(dist, `.${path}/index.html`);
        if (page.startsWith(dist) && existsSync(page)) {
          req.url = `${path}/index.html${url.search}`;
          return next();
        }
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        res.end(readFileSync(resolve(dist, '404.html')));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineCss(), staticPages()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html') },
      output: {
        manualChunks: (id) => (/node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'react' : undefined),
      },
    },
  },
  worker: { format: 'es' },
  test: { environment: 'node' },
});
