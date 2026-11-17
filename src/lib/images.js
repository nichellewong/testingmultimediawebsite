// Responsive image generation with sharp.
//
// Every image used by the story gets resized into several WebP files (cached
// in .cache/img so repeat builds are fast) and rendered as
// <img srcset="..." sizes="...">.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ensureDir, copyIfNewer, shortHash, isUrl, escapeHtml } from './util.js';

export const DEFAULT_WIDTHS = [480, 800, 1200, 1600, 2000, 2400];
const DATA_URI = /^data:image\/([a-z0-9.+-]+);base64,([\s\S]+)$/i;
const DATA_EXT = { png: 'png', jpeg: 'jpg', jpg: 'jpg', gif: 'gif', webp: 'webp', 'svg+xml': 'svg', avif: 'avif' };

// Writes a base64 data: URI to .cache/inline/ and returns its path, so it can
// go through the same pipeline as a file in assets/.
function materializeDataUri(ctx, uri) {
  let decoded = uri;
  try { decoded = decodeURIComponent(uri); } catch { /* keep as is */ }
  const m = decoded.match(DATA_URI);
  if (!m) return null;
  const ext = DATA_EXT[m[1].toLowerCase()];
  if (!ext) return null;
  const data = m[2].replace(/\s+/g, '');
  const name = `pasted-${shortHash(data.length + ':' + data.slice(0, 2000) + data.slice(-2000))}.${ext}`;
  const dir = path.join(ctx.root, '.cache', 'inline');
  ensureDir(dir);
  const abs = path.join(dir, name);
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, Buffer.from(data, 'base64'));
  return { abs, clean: name };
}
const PASSTHROUGH = /\.(gif|svg|avif)$/i;
const SUPPORTED = /\.(jpe?g|png|webp|tiff?|heic|heif)$/i;

export function cleanAssetPath(rel) {
  return String(rel || '')
    .trim()
    .replace(/^\.?\//, '')
    .replace(/^assets\//, '');
}

export async function imageData(ctx, rel, { widths = DEFAULT_WIDTHS, quality = 80 } = {}) {
  if (isUrl(rel)) return { src: rel, srcset: '', width: 0, height: 0, external: true };

  let clean, abs, plainUrl;
  const pasted = /^data:/i.test(String(rel)) ? materializeDataUri(ctx, String(rel)) : null;
  if (pasted) {
    ({ abs, clean } = pasted);
    // Formats we do not resize are copied into the site as they are.
    ensureDir(path.join(ctx.outDir, 'assets', '_img'));
    copyIfNewer(abs, path.join(ctx.outDir, 'assets', '_img', clean));
    plainUrl = `assets/_img/${clean}`;
  } else if (/^data:/i.test(String(rel))) {
    ctx.warn('An image pasted into the document is in a format the build cannot read; it was skipped.');
    return { src: '', srcset: '', width: 0, height: 0, missing: true };
  } else {
    clean = cleanAssetPath(rel);
    abs = path.join(ctx.root, 'assets', clean);
    plainUrl = 'assets/' + clean.split('/').map(encodeURIComponent).join('/');
    if (!clean || !fs.existsSync(abs)) {
      ctx.warn(`Image not found: assets/${clean || '(empty)'}`);
      return { src: plainUrl, srcset: '', width: 0, height: 0, missing: true };
    }
  }
  if (PASSTHROUGH.test(clean) || !SUPPORTED.test(clean)) {
    return { src: plainUrl, srcset: '', width: 0, height: 0 };
  }

  const stat = fs.statSync(abs);
  const key = shortHash(`${clean}:${stat.mtimeMs}:${stat.size}`);
  const base = path.basename(clean, path.extname(clean)).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  const cacheDir = path.join(ctx.root, '.cache', 'img');
  const outDir = path.join(ctx.outDir, 'assets', '_img');
  ensureDir(cacheDir);
  ensureDir(outDir);

  let meta = ctx.imageMeta.get(key);
  if (!meta) {
    const m = await sharp(abs).metadata();
    const swap = (m.orientation || 1) >= 5;
    meta = { width: swap ? m.height : m.width, height: swap ? m.width : m.height };
    ctx.imageMeta.set(key, meta);
  }

  const maxWanted = Math.max(...widths);
  const targets = [...new Set([...widths.filter((w) => w < meta.width), Math.min(meta.width, maxWanted)])].sort((a, b) => a - b);

  const entries = [];
  for (const w of targets) {
    const name = `${base}-${key}-${w}.webp`;
    const cached = path.join(cacheDir, name);
    const final = path.join(outDir, name);
    if (!fs.existsSync(cached)) {
      // Several embeds may ask for the same file at once; share one job.
      let job = ctx.imageJobs.get(name);
      if (!job) {
        job = sharp(abs).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality }).toFile(cached);
        ctx.imageJobs.set(name, job);
      }
      await job;
    }
    copyIfNewer(cached, final);
    entries.push({ w, url: `assets/_img/${name}` });
  }

  const largest = entries[entries.length - 1];
  const fallback = entries.find((e) => e.w >= 1200) || largest;
  return {
    src: fallback.url,
    srcset: entries.map((e) => `${e.url} ${e.w}w`).join(', '),
    width: meta.width,
    height: meta.height,
    largest: largest.url,
    entries,
  };
}

export async function imageTag(ctx, rel, opts = {}) {
  const data = await imageData(ctx, rel, { widths: opts.widths });
  const attrs = [`src="${escapeHtml(data.src)}"`];
  if (data.srcset) {
    attrs.push(`srcset="${escapeHtml(data.srcset)}"`);
    attrs.push(`sizes="${escapeHtml(opts.sizes || '100vw')}"`);
  }
  if (data.width && data.height) attrs.push(`width="${data.width}" height="${data.height}"`);
  attrs.push(`alt="${escapeHtml(opts.alt || '')}"`);
  if (opts.classes) attrs.push(`class="${escapeHtml(opts.classes)}"`);
  attrs.push(`loading="${opts.loading || 'lazy'}"`);
  attrs.push(`decoding="${opts.decoding || 'async'}"`);
  if (opts.fetchpriority) attrs.push(`fetchpriority="${opts.fetchpriority}"`);
  if (opts.attrs) attrs.push(opts.attrs);
  return `<img ${attrs.join(' ')}>`;
}
