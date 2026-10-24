/**
 * Builds web media from media/manifest.json:
 *  - photos  → graded AVIF + WebP at several widths, plus a tiny blurred placeholder
 *  - videos  → seamless crossfaded H.264 loops (desktop + mobile) and poster frames
 *  - panoramas → equirectangular WebP at two sizes
 * Writes public/media/* and src/media.gen.ts. Raw sources (assets-src/) are not committed.
 *
 * Usage: npm run media   (re-encodes only files that are missing; pass --force to redo all)
 */
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const force = process.argv.includes('--force');
const manifest = JSON.parse(readFileSync('media/manifest.json', 'utf8'));
const OUT = 'public/media';
mkdirSync(OUT, { recursive: true });
const need = (f) => force || !existsSync(f);
const kb = (f) => Math.round(statSync(f).size / 1024);

// A light, consistent grade so photographs from different sources sit together:
// slightly lower saturation, a touch of warmth in the shadows. Faithful, not stylised.
async function redacted(src, regions = []) {
  if (!regions.length) return src;
  const parts = [];
  for (const [left, top, width, height] of regions) {
    const blurred = await sharp(src).extract({ left, top, width, height }).blur(14).toBuffer();
    parts.push({ input: blurred, left, top });
  }
  return sharp(src).composite(parts).toBuffer();
}

async function graded(src, regions) {
  const base = sharp(await redacted(src, regions)).rotate().modulate({ saturation: 0.86 });
  const { width, height } = await base.metadata();
  const warm = await sharp({ create: { width, height, channels: 4, background: { r: 242, g: 169, b: 59, alpha: 0.07 } } })
    .png()
    .toBuffer();
  return sharp(await base.composite([{ input: warm, blend: 'soft-light' }]).toBuffer());
}

const photos = {};
for (const p of manifest.photos) {
  const meta = await sharp(p.src).metadata();
  const widths = [480, 960, 1600, 2400].filter((w) => w <= meta.width);
  const h = (w) => Math.round((meta.height / meta.width) * w);
  const img = await graded(p.src, p.redact);
  const buf = await img.toBuffer();
  for (const w of widths) {
    const avif = `${OUT}/${p.id}-${w}.avif`;
    const webp = `${OUT}/${p.id}-${w}.webp`;
    if (need(avif)) await sharp(buf).resize(w).avif({ quality: 52, effort: 6 }).toFile(avif);
    if (need(webp)) await sharp(buf).resize(w).webp({ quality: 74, effort: 5 }).toFile(webp);
  }
  const lqip = await sharp(buf).resize(24).blur(1.2).webp({ quality: 40 }).toBuffer();
  photos[p.id] = {
    alt: p.alt,
    credit: p.credit,
    page: p.page,
    licence: p.licence,
    focus: p.focus,
    width: meta.width,
    height: meta.height,
    widths,
    lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
  };
  console.log(`photo ${p.id}: ${widths.map((w) => `${w}w ${kb(`${OUT}/${p.id}-${w}.avif`)}KB`).join(', ')}`);
}

function ff(args) {
  execFileSync(ffmpeg, ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
}

const videos = {};
for (const v of manifest.videos) {
  const { start, length: L, fade: d } = v.clip;
  for (const [name, w, crf] of [
    ['desktop', 1600, 26],
    ['mobile', 854, 29],
  ]) {
    const out = `${OUT}/${v.id}-${name}.mp4`;
    if (need(out)) {
      // Seamless loop: the clip's tail cross-fades into its own head, so playback can wrap without a jump.
      const filter = [
        `[0:v]trim=start=${start}:duration=${L + d},setpts=PTS-STARTPTS,scale=${w}:-2:flags=lanczos,fps=25,format=yuv420p,split[a][b]`,
        `[a]trim=start=${d},setpts=PTS-STARTPTS[main]`,
        `[b]trim=duration=${d},setpts=PTS-STARTPTS[head]`,
        `[main][head]xfade=transition=fade:duration=${d}:offset=${L - d},format=yuv420p[v]`,
      ].join(';');
      ff(['-i', v.src, '-filter_complex', filter, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-movflags', '+faststart', out]);
    }
  }
  const posterJpg = `assets-src/${v.id}-poster.png`;
  if (need(posterJpg)) ff(['-ss', String(start + d), '-i', v.src, '-frames:v', '1', posterJpg]);
  for (const w of [960, 1600]) {
    const out = `${OUT}/${v.id}-poster-${w}.webp`;
    if (need(out)) await (await graded(posterJpg)).resize(w).webp({ quality: 72 }).toFile(out);
  }
  const lqip = await sharp(posterJpg).resize(24).blur(1.2).webp({ quality: 40 }).toBuffer();
  videos[v.id] = {
    alt: v.alt,
    credit: v.credit,
    page: v.page,
    licence: v.licence,
    seconds: L,
    lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
  };
  console.log(`video ${v.id}: desktop ${kb(`${OUT}/${v.id}-desktop.mp4`)}KB, mobile ${kb(`${OUT}/${v.id}-mobile.mp4`)}KB`);
}

const panoramas = {};
for (const p of manifest.panoramas) {
  for (const [w, q] of [
    [4096, 72],
    [2048, 70],
  ]) {
    const out = `${OUT}/${p.id}-${w}.webp`;
    if (need(out)) await sharp(p.src).resize(w, w / 2).webp({ quality: q, effort: 5 }).toFile(out);
  }
  const lqip = await sharp(p.src).resize(48, 24).blur(1).webp({ quality: 40 }).toBuffer();
  panoramas[p.id] = {
    alt: p.alt,
    credit: p.credit,
    page: p.page,
    licence: p.licence,
    lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
  };
  console.log(`panorama ${p.id}: 4096 ${kb(`${OUT}/${p.id}-4096.webp`)}KB, 2048 ${kb(`${OUT}/${p.id}-2048.webp`)}KB`);
}

const licences = Object.fromEntries(Object.entries(manifest.licences).map(([k, v]) => [k, { name: v.name, url: v.url }]));
writeFileSync(
  'src/media.gen.ts',
  `// Generated by scripts/media.mjs from media/manifest.json — do not edit by hand.\n` +
    `export const LICENCES = ${JSON.stringify(licences, null, 2)} as const;\n\n` +
    `export const PHOTOS = ${JSON.stringify(photos, null, 2)} as const;\n\n` +
    `export const VIDEOS = ${JSON.stringify(videos, null, 2)} as const;\n\n` +
    `export const PANORAMAS = ${JSON.stringify(panoramas, null, 2)} as const;\n\n` +
    `export type PhotoId = keyof typeof PHOTOS;\nexport type VideoId = keyof typeof VIDEOS;\n`,
);
console.log('wrote src/media.gen.ts');
