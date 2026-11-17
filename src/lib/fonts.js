// Finds font files in fonts/ and builds the @font-face CSS.
//
// Files named the way google-webfonts-helper names them are understood
// automatically:
//   quattrocento-v24-latin-700.woff2      -> "Quattrocento", weight 700
//   fanwood-text-v17-latin-italic.woff2   -> "Fanwood Text", italic
// Anything else can be declared in settings.toml under [[fonts.custom]].
import fs from 'node:fs';
import path from 'node:path';
import { titleCase } from './util.js';

const FORMATS = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };

export function parseFontFile(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const base = path.basename(file, path.extname(file));
  const tokens = base.split('-');
  const vi = tokens.findIndex((t) => /^v\d+$/i.test(t));
  if (vi < 1) {
    return { family: titleCase(base), file, weight: 400, style: 'normal', format: FORMATS[ext], guessed: true };
  }
  const family = titleCase(tokens.slice(0, vi).join(' '));
  const variant = tokens[tokens.length - 1].toLowerCase();
  let weight = 400;
  let style = 'normal';
  if (variant !== 'regular') {
    const w = variant.match(/^(\d{3})/);
    if (w) weight = Number(w[1]);
    if (/italic$/.test(variant)) style = 'italic';
  }
  return { family, file, weight, style, format: FORMATS[ext] };
}

export function loadFonts(root, settings, warn = () => {}) {
  const dir = path.join(root, 'fonts');
  const faces = [];

  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir).sort()) {
      const ext = path.extname(file).slice(1).toLowerCase();
      if (!FORMATS[ext]) continue;
      faces.push(parseFontFile(file));
    }
  }

  for (const custom of settings.fonts?.custom || []) {
    if (!custom.family || !custom.file) {
      warn('settings.toml: each [[fonts.custom]] entry needs "family" and "file"');
      continue;
    }
    if (!fs.existsSync(path.join(dir, custom.file))) {
      warn(`settings.toml: font file fonts/${custom.file} does not exist`);
      continue;
    }
    const ext = path.extname(custom.file).slice(1).toLowerCase();
    faces.push({
      family: String(custom.family),
      file: custom.file,
      weight: Number(custom.weight) || 400,
      style: custom.style || 'normal',
      format: FORMATS[ext] || 'woff2',
      custom: true,
    });
  }

  // When the same face exists as .woff2 and .woff, keep only the best one.
  const rank = { woff2: 3, woff: 2, truetype: 1, opentype: 1 };
  const best = new Map();
  for (const face of faces) {
    const key = `${face.family}|${face.weight}|${face.style}`;
    const prev = best.get(key);
    if (!prev || rank[face.format] > rank[prev.format]) best.set(key, face);
  }

  const css = [...best.values()]
    .map(
      (f) =>
        `@font-face{font-family:"${f.family}";src:url("fonts/${encodeURI(f.file)}") format("${f.format}");` +
        `font-weight:${f.weight};font-style:${f.style};font-display:swap}`
    )
    .join('\n');

  const families = [...new Set([...best.values()].map((f) => f.family))];
  const lower = new Map(families.map((f) => [f.toLowerCase(), f]));

  // Returns a CSS font stack for a family name from settings.toml, warning
  // when the family has no files in fonts/.
  function stack(name, label = '', kind = 'serif') {
    const fallback = kind === 'sans' ? 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif' : 'Georgia, "Times New Roman", serif';
    const wanted = String(name || '').trim();
    if (!wanted) return fallback;
    const found = lower.get(wanted.toLowerCase());
    if (!found) {
      warn(`Font "${wanted}"${label ? ` (${label})` : ''} has no files in the fonts/ folder; the browser will fall back to a system serif`);
    }
    return `"${found || wanted}", ${fallback}`;
  }

  function filesFor(name) {
    return [...best.values()].filter((f) => f.family.toLowerCase() === String(name || '').toLowerCase());
  }

  return { css, families, faces: [...best.values()], stack, filesFor };
}
