// Shared HTML builders: the <figure> wrapper every embed uses, captions,
// error boxes, and the sizes="" attribute for responsive images.
import { escapeHtml, cssToPx } from './util.js';
import { parseSize } from './blocks.js';

export function buildCaption(ctx, caption, credit) {
  const parts = [];
  if (caption && String(caption).trim()) {
    parts.push(`<span class="story-embed__caption-text">${ctx.renderInline(caption)}</span>`);
  }
  if (credit && String(credit).trim()) {
    parts.push(`<span class="story-embed__credit">${ctx.renderInline(credit)}</span>`);
  }
  return parts.join(' ');
}

// A floated embed stays inside the text run (so paragraphs wrap around it)
// instead of being pulled out between paragraphs. wrap() marks it with this
// prefix and the build strips it again.
export const FLOAT_MARK = '<!--story-float-->';

export function parseFloat_(value) {
  const v = String(value || '').toLowerCase().trim();
  return v === 'left' || v === 'right' ? v : '';
}

// wrap(ctx, { size, caption, credit, id, embedName, classes, style, tag, float }, innerHtml)
export function wrap(ctx, opts, inner) {
  const size = parseSize(opts.size, opts.defaultSize || 'large');
  if (size.invalid) {
    ctx.warn(`Unknown size "${opts.size}" (use full, large, text, or a number like 120); using ${size.kind}`);
  }
  const classes = ['story-embed', `story-embed--${size.kind}`];
  if (opts.embedName) classes.push(`story-embed--${opts.embedName}`);
  const side = parseFloat_(opts.float);
  if (side) classes.push('story-embed--float', `story-embed--float-${side}`);
  if (opts.classes) classes.push(opts.classes);

  const style = [];
  if (size.kind === 'custom') style.push(`--embed-scale:${(size.percent / 100).toFixed(4)}`);
  if (opts.style) style.push(opts.style);

  const attrs = [`class="${classes.join(' ')}"`];
  if (opts.id) attrs.push(`id="${escapeHtml(opts.id)}"`);
  if (style.length) attrs.push(`style="${style.join(';')}"`);
  for (const [k, v] of Object.entries(opts.attrs || {})) attrs.push(`${k}="${escapeHtml(v)}"`);

  const tag = opts.tag || 'figure';
  const captionTag = tag === 'figure' ? 'figcaption' : 'div';
  const caption = buildCaption(ctx, opts.caption, opts.credit);

  return (
    (side ? FLOAT_MARK : '') +
    `<${tag} ${attrs.join(' ')}>\n` +
    `<div class="story-embed__media">${inner}</div>` +
    (caption ? `\n<${captionTag} class="story-embed__caption">${caption}</${captionTag}>` : '') +
    `\n</${tag}>`
  );
}

export function errorBox(message) {
  return `<div class="story-text"><div class="story-error" role="alert"><strong>Problem in content.md:</strong> ${escapeHtml(message)}</div></div>`;
}

// The browser needs to know roughly how wide an image will be displayed in
// order to pick the right file from srcset.
export function sizesAttr(ctx, sizeValue, fallback = 'large') {
  const size = parseSize(sizeValue, fallback);
  const text = cssToPx(ctx.settings.text.max_width, 640);
  const scale = Number(ctx.settings.embeds.large_scale) || 1.5;
  let px;
  switch (size.kind) {
    case 'full':
      return '100vw';
    case 'text':
      px = text;
      break;
    case 'custom':
      px = text * (size.percent / 100);
      break;
    default:
      px = text * scale;
  }
  return `(max-width: 767px) 100vw, min(100vw, ${Math.round(px)}px)`;
}

// Adds the student's "class:" and "style:" options to the outermost element
// of an embed's HTML (the <figure>, <section> or <div> that wraps it).
export function applyCustomAttrs(html, options = {}) {
  const cls = String(options.class || options.classes || '').replace(/[^\w\s-]/g, '').trim();
  const style = String(options.style || '').replace(/[<>"]/g, '').trim();
  if (!cls && !style) return html;
  return String(html).replace(/^(\s*)<([a-z][\w-]*)([^>]*)>/i, (m, lead, tag, attrs) => {
    let a = attrs;
    if (cls) {
      a = /\bclass="/.test(a) ? a.replace(/\bclass="([^"]*)"/, (_, v) => `class="${v} ${cls}"`) : `${a} class="${cls}"`;
    }
    if (style) {
      const add = style.endsWith(';') ? style : style + ';';
      a = /\bstyle="/.test(a) ? a.replace(/\bstyle="([^"]*)"/, (_, v) => `style="${v.trim().replace(/;?$/, ';')}${add}"`) : `${a} style="${add}"`;
    }
    return `${lead}<${tag}${a}>`;
  });
}
