// embed: html  (the default when a code block starts with "<")
//
// Pastes third-party embed code (Datawrapper, Flourish, YouTube, Google Maps...)
// straight into the page.
//
// Options: size, caption, credit, id,
//          aspect (16x9, 4x3, 1x1, 21x9 or any "WxH"; detected from the iframe's
//          width/height attributes when not given; "none" leaves the code alone),
//          resize (default true; "false" or "no" keeps the pasted width and height),
//          lock_scroll (true: the frame ignores the mouse until clicked, so
//          scrolling over a map scrolls the page instead of the map)
import { straightQuotes, toBool } from '../../lib/util.js';
import { filterScripts } from '../../lib/scripts.js';
import { wrap, errorBox } from '../../lib/html.js';

const BOOTSTRAP_RATIOS = ['1x1', '4x3', '16x9', '21x9'];
const NEEDS_RATIO = /<iframe[^>]+src=["'][^"']*(youtube\.com\/embed|youtube-nocookie\.com\/embed|player\.vimeo\.com\/video)/i;

export function aspectWrap(body, aspect) {
  if (!aspect || String(aspect).toLowerCase() === 'none') return body;
  const a = String(aspect).toLowerCase().replace(/[:/]/, 'x').replace(/\s+/g, '');
  if (BOOTSTRAP_RATIOS.includes(a)) return `<div class="ratio ratio-${a}">${body}</div>`;
  const [w, h] = a.split('x').map(Number);
  if (w > 0 && h > 0) return `<div class="ratio" style="--bs-aspect-ratio:${((h / w) * 100).toFixed(3)}%">${body}</div>`;
  return body;
}

// An iframe with fixed width="640" height="480" attributes (Google My Maps,
// Google Forms, many others) would otherwise stay 640px wide no matter what
// size: is asked for. Use its proportions as the aspect ratio so it scales.
export function detectAspect(html) {
  const m = html.match(/<iframe\b[^>]*>/i);
  if (!m) return '';
  const tag = m[0];
  if (/\bstyle\s*=\s*["'][^"']*\bwidth\s*:/i.test(tag)) return '';
  // Only pixel sizes count. width="100%" (SoundCloud, Spotify...) means
  // "fill the space, keep the given height", so no box is needed.
  const w = tag.match(/\bwidth\s*=\s*["']?(\d+)(?:px)?["'\s>]/i);
  const h = tag.match(/\bheight\s*=\s*["']?(\d+)(?:px)?["'\s>]/i);
  if (!w || !h) return '';
  return `${w[1]}x${h[1]}`;
}

// The shape to use for pasted code when none is given: 16x9 for video
// players, the iframe's own pixel proportions when it has them, else none.
export function autoAspect(html) {
  return NEEDS_RATIO.test(html) ? '16x9' : detectAspect(html);
}

export default {
  name: 'html',
  aliases: ['embed-code', 'iframe', 'code'],
  description: 'Raw HTML or embed code from another service',
  async render({ options: o, body }, ctx) {
    if (!body.trim()) return errorBox('This code block has no embed code in it.');
    let html = filterScripts(straightQuotes(body), ctx);
    // resize: false (or no / off / 0) keeps the pasted code at its own size.
    const resize = toBool(o.resize, true);
    const aspect = resize ? o.aspect || autoAspect(html) : '';
    html = aspectWrap(html, aspect);
    const lock = toBool(o.lock_scroll, false) || /^lock$/i.test(o.scroll || '');
    if (lock) html += `<button type="button" class="story-lock__hint" aria-label="Click to interact with this embed">Click to interact</button>`;
    const classes = [resize ? '' : 'story-embed--noresize', lock ? 'story-embed--lock' : ''].filter(Boolean).join(' ');
    return wrap(ctx, { size: o.size, caption: o.caption, credit: o.credit, id: o.id, embedName: 'html', classes }, html);
  },
};
