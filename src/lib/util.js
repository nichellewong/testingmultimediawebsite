// Small helpers shared by the build.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Google Docs and most word processors turn straight quotes into curly ones.
// Curly quotes break HTML attributes and TOML strings, so we straighten them
// wherever code is expected.
export function straightQuotes(value = '') {
  return String(value)
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‘’‚‛′]/g, "'");
}

export function isUrl(value = '') {
  return /^(https?:)?\/\//i.test(String(value));
}

export function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return /^(true|yes|on|1)$/i.test(String(value).trim());
}

export function toNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// "600" -> "600px", "40rem" -> "40rem", 1.5 -> "1.5px"
export function cssSize(value, fallback = '') {
  if (value === undefined || value === null || value === '') return fallback;
  const s = String(value).trim();
  return /^-?\d+(\.\d+)?$/.test(s) ? `${s}px` : s;
}

// Rough conversion of a CSS length to pixels, used for <img sizes="">.
export function cssToPx(value, fallback = 640) {
  const s = String(value ?? '').trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|vw)?$/);
  if (!m) return fallback;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case 'rem':
    case 'em':
      return n * 16;
    case 'vw':
      return (n / 100) * 1280;
    default:
      return n;
  }
}

// "#000" / "#000000" + alpha -> "rgba(0,0,0,0.45)". Anything else is passed through.
export function hexToRgba(hex, alpha = 1) {
  const s = String(hex ?? '').trim();
  const m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return s || 'rgba(0,0,0,0.45)';
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = Math.min(1, Math.max(0, toNumber(alpha, 1)));
  return `rgba(${r},${g},${b},${a})`;
}

export function titleCase(value = '') {
  return String(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function shortHash(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 8);
}

// JSON that is safe to drop inside a single-quoted HTML attribute.
export function jsonAttr(obj) {
  return JSON.stringify(obj)
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function copyIfNewer(src, dest) {
  const s = fs.statSync(src);
  let d = null;
  try {
    d = fs.statSync(dest);
  } catch {
    d = null;
  }
  if (!d || d.size !== s.size || d.mtimeMs < s.mtimeMs) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

const JUNK = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|\._.*)$/;

export function copyDirIfNewer(srcDir, destDir, filter = () => true) {
  if (!fs.existsSync(srcDir)) return 0;
  let copied = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (JUNK.test(entry.name)) continue;
    if (entry.isDirectory()) {
      copied += copyDirIfNewer(from, to, filter);
    } else if (entry.isFile() && filter(from)) {
      if (copyIfNewer(from, to)) copied++;
    }
  }
  return copied;
}

export function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

// Pick the keys of `options` that are NOT in the reserved list and coerce
// "true"/"false"/numbers. Used to pass extra options straight to a library.
export function passthroughOptions(options, reserved) {
  const out = {};
  for (const [key, raw] of Object.entries(options)) {
    if (reserved.includes(key)) continue;
    let value = raw;
    if (/^(true|false)$/i.test(raw)) value = /^true$/i.test(raw);
    else if (/^-?\d+(\.\d+)?$/.test(raw)) value = Number(raw);
    out[key] = value;
  }
  return out;
}
