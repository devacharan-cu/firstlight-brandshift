/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
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

export default defineConfig({
  plugins: [react(), inlineCss()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        caseStudy: resolve(import.meta.dirname, 'case-study.html'),
      },
      output: {
        manualChunks: (id) => (/node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'react' : undefined),
      },
    },
  },
  worker: { format: 'es' },
  test: { environment: 'node' },
});
