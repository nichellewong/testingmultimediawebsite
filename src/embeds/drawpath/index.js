// embed: drawpath  (a line drawn on scroll)
//
// An SVG with a stroked path (for example a route over a map) sticks to the
// screen while the reader scrolls, and the line draws itself from start to
// end. Every stroked shape in the file is animated; with sequence: true they
// draw one after another. Dashed strokes cannot be used (the drawing effect
// is itself a dash pattern).
//
// Options: source (an .svg in assets/; or paste the <svg> code as the body),
//          alt, length (screen heights of scrolling, default 2),
//          deadzone (percent of the scroll kept still at each end, default 10),
//          reverse (draw from the end), sequence (one shape after another),
//          dot (a dot at the tip of the line), dot_color, dot_size,
//          background (default: the page background), size, caption, credit, id,
//          position / card_* for text cards (see scrollvideo)
// Cards: --- separated steps with "at: 40" and text, as in scrollvideo.
import fs from 'node:fs';
import path from 'node:path';
import { splitSteps } from '../../lib/blocks.js';
import { cleanAssetPath } from '../../lib/images.js';
import { escapeHtml, toBool, toNumber, cssSize, jsonAttr, slugify } from '../../lib/util.js';
import { wrap, errorBox } from '../../lib/html.js';

const POSITIONS = { left: 'left', right: 'right', center: 'center', middle: 'center' };

// Makes an SVG file safe and responsive for inlining into the page.
function prepareSvg(ctx, raw, { id, alt, baseDir }) {
  let svg = String(raw)
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .trim();
  const open = svg.match(/<svg\b[^>]*>/i);
  if (!open) return { error: 'No <svg> element was found.' };
  let tag = open[0];

  // Responsive sizing: keep the viewBox, drop fixed width/height.
  if (!/\bviewBox=/i.test(tag)) {
    const w = tag.match(/\bwidth="([\d.]+)/i);
    const h = tag.match(/\bheight="([\d.]+)/i);
    if (w && h) tag = tag.replace(/<svg/i, `<svg viewBox="0 0 ${w[1]} ${h[1]}"`);
  }
  tag = tag.replace(/\s(width|height|id|class|role|aria-label)="[^"]*"/gi, '');
  tag = tag.replace(/<svg/i, `<svg id="${id}" class="drawpath__svg" role="img" aria-label="${escapeHtml(alt || '')}"`);
  svg = svg.replace(open[0], tag);

  // Pictures linked from the SVG live next to it in assets/; point at them
  // from the page instead.
  svg = svg.replace(/((?:xlink:)?href=")([^"#]+)"/gi, (m, pre, href) => {
    if (/^(data:|https?:|\/)/i.test(href)) return m;
    const rel = path.posix.normalize(path.posix.join(baseDir, href));
    if (!fs.existsSync(path.join(ctx.root, 'assets', rel))) ctx.warn(`The SVG links to "${href}" but assets/${rel} does not exist.`);
    return `${pre}${ctx.assetUrl(rel)}"`;
  });

  // Scope any <style> rules to this SVG so two files cannot restyle each other.
  svg = svg.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (m, attrs, css) => {
    const scoped = css.replace(/([^{}]+)\{/g, (r, sel) => sel.split(',').map((s) => `#${id} ${s.trim()}`).join(', ') + '{');
    return `<style${attrs}>${scoped}</style>`;
  });

  if (/stroke-dasharray/i.test(svg)) ctx.warn('The SVG uses a dashed stroke; dashes are replaced by the drawing effect.');
  if (!/<(path|polyline|line|polygon|circle|ellipse|rect)\b/i.test(svg)) ctx.warn('The SVG has no path or shape to draw.');
  return { svg };
}

export default {
  name: 'drawpath',
  aliases: ['draw-path', 'scroll-line', 'linedraw'],
  description: 'An SVG line (e.g. a route on a map) drawn as the reader scrolls',
  async render({ options: o, body }, ctx) {
    const id = `drawpath-${slugify(o.id || ctx.nextId('line'))}`;
    let chunks = splitSteps(body);
    let raw = '';
    let baseDir = '';
    if (o.source || o.src || o.file) {
      const clean = cleanAssetPath(o.source || o.src || o.file);
      const abs = path.join(ctx.root, 'assets', clean);
      if (!fs.existsSync(abs)) return errorBox(`SVG not found: assets/${clean}.`);
      raw = fs.readFileSync(abs, 'utf8');
      baseDir = path.posix.dirname(clean.split(path.sep).join('/'));
      if (baseDir === '.') baseDir = '';
    } else if (chunks.length && /^<svg/i.test(chunks[0].body.trim())) {
      raw = chunks[0].body.trim();
      chunks = chunks.slice(1);
    } else {
      return errorBox('A drawpath embed needs a "source:" line naming an .svg file in assets/ (or the <svg> code pasted below the options).');
    }
    const prepared = prepareSvg(ctx, raw, { id, alt: o.alt, baseDir });
    if (prepared.error) return errorBox(prepared.error);

    const cards = chunks.filter((s) => s.body.trim());
    const length = Math.max(1.2, toNumber(o.length, 2));
    const position = POSITIONS[String(o.position || 'center').toLowerCase()] || 'center';
    const cardHtml = cards
      .map((card, i) => {
        const at = Math.min(100, Math.max(0, toNumber(card.options.at, ((i + 1) / (cards.length + 1)) * 100)));
        const pos = POSITIONS[String(card.options.position || '').toLowerCase()] || position;
        return `<div class="drawpath__card" data-position="${pos}" style="--at:${(at / 100).toFixed(4)}"><div class="story-card">${ctx.renderMarkdown(card.body)}</div></div>`;
      })
      .join('');

    const config = {
      reverse: toBool(o.reverse, false),
      sequence: toBool(o.sequence, false),
      deadzone: Math.min(45, Math.max(0, toNumber(o.deadzone, 10))) / 100,
      dot: toBool(o.dot, false),
      dotColor: String(o.dot_color || '').replace(/[;"<>]/g, ''),
      dotSize: toNumber(o.dot_size, 0),
    };
    const style = [`--dp-length:${length}`];
    if (o.background) style.push(`--dp-bg:${String(o.background).replace(/[;"<>]/g, '')}`);
    if (o.card_background) style.push(`--card-bg:${o.card_background}`);
    if (o.card_color) style.push(`--card-color:${o.card_color}`);
    if (o.card_width) style.push(`--card-width:${cssSize(o.card_width)}`);

    const inner =
      `<div class="drawpath" data-embed="drawpath" data-config='${jsonAttr(config)}' style="${style.join(';')}">` +
      `<div class="drawpath__sticky"><div class="drawpath__frame">${prepared.svg}</div></div>` +
      (cardHtml ? `<div class="drawpath__track">${cardHtml}</div>` : '') +
      `</div>`;
    return wrap(ctx, { size: o.size, defaultSize: 'full', caption: o.caption, credit: o.credit, id: o.id, embedName: 'drawpath' }, inner);
  },
};
