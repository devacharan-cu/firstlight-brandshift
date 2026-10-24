/** Shared setup for the browser scripts: find the locally installed Chrome and list the built pages. */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function chromePath() {
  const exe = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ]
    .filter(Boolean)
    .find((p) => existsSync(p));
  if (!exe) throw new Error('Chrome not found; set CHROME_PATH');
  return exe;
}

/** Every prerendered route in dist/, as URL paths ('/', '/platform', …). Run `npm run build` first. */
export function builtRoutes(dir = 'dist') {
  const out = [];
  const walk = (d, path) => {
    if (existsSync(join(d, 'index.html'))) out.push(path || '/');
    for (const name of readdirSync(d)) {
      if (name === 'assets' || name === 'media' || name === 'fonts') continue;
      if (statSync(join(d, name)).isDirectory()) walk(join(d, name), `${path}/${name}`);
    }
  };
  walk(dir, '');
  return out.sort();
}

export const base = (process.argv[2] ?? 'http://127.0.0.1:4173').replace(/\/$/, '');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
