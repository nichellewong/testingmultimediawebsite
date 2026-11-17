// embed: scrollvideo  (video that plays as you scroll)
//
// The video sticks to the screen and scrubs forward/backward with the scroll
// position. Optional text cards float over it.
//
// Options: source (an .mp4 in assets/), poster, length (how many screen
//          heights the section scrolls for; default 3 or cards + 1),
//          position (left | center | right for the cards),
//          mode (video | frames), fps, max_frames, frame_width (frames mode only),
//          card_background, card_color, card_width, id
// Cards are separated by a line of three dashes (---). Each card may start
// with "at: 40" (percent through the scroll where the card is centered).
import { splitSteps } from '../../lib/blocks.js';
import { extractFrames } from '../../lib/frames.js';
import { imageData, cleanAssetPath } from '../../lib/images.js';
import { escapeHtml, cssSize, toNumber, jsonAttr } from '../../lib/util.js';
import { errorBox } from '../../lib/html.js';

const POSITIONS = { left: 'left', right: 'right', center: 'center', middle: 'center' };

export default {
  name: 'scrollvideo',
  aliases: ['scroll-video', 'video-scrubber', 'scrub'],
  description: 'A video that scrubs as the reader scrolls',
  async render({ options: o, body }, ctx) {
    const source = o.source || o.src || o.video || o.file;
    if (!source) return errorBox('A scrollvideo embed needs a "source:" line pointing to an .mp4 in assets/.');
    const clean = cleanAssetPath(source);
    const cards = splitSteps(body).filter((s) => s.body.trim());
    const length = Math.max(1.5, toNumber(o.length, Math.max(3, cards.length + 1)));
    const position = POSITIONS[String(o.position || 'center').toLowerCase()] || 'center';

    let mode = String(o.mode || 'video').toLowerCase();
    let frames = null;
    if (mode === 'frames') {
      frames = extractFrames(ctx, clean, { fps: toNumber(o.fps, 8), maxFrames: toNumber(o.max_frames, 400), width: toNumber(o.frame_width, 1280) });
      if (!frames) mode = 'video';
    }

    const poster = o.poster ? await imageData(ctx, o.poster, { widths: [1600] }) : null;
    const media =
      mode === 'frames'
        ? `<canvas class="scrollvideo__canvas"${poster ? ` style="background-image:url('${escapeHtml(poster.src)}')"` : ''} aria-hidden="true"></canvas>`
        : `<video muted playsinline preload="auto"${poster ? ` poster="${escapeHtml(poster.src)}"` : ''} aria-hidden="true"><source src="${escapeHtml(ctx.assetUrl(clean))}" type="video/mp4"></video>`;

    const cardHtml = cards
      .map((card, i) => {
        const at = Math.min(100, Math.max(0, toNumber(card.options.at, ((i + 1) / (cards.length + 1)) * 100)));
        const pos = POSITIONS[String(card.options.position || '').toLowerCase()] || position;
        return `<div class="scrollvideo__card" data-position="${pos}" style="--at:${(at / 100).toFixed(4)}"><div class="story-card">${ctx.renderMarkdown(card.body)}</div></div>`;
      })
      .join('\n');

    const style = [`--sv-length:${length}`];
    if (o.card_background) style.push(`--card-bg:${o.card_background}`);
    if (o.card_color) style.push(`--card-color:${o.card_color}`);
    if (o.card_width) style.push(`--card-width:${cssSize(o.card_width)}`);
    const id = o.id ? ` id="${escapeHtml(o.id)}"` : '';

    return (
      `<section class="scrollvideo story-embed story-embed--full" data-embed="scrollvideo"${id} data-config='${jsonAttr({ mode, frames })}' style="${style.join(';')}">\n` +
      `<div class="scrollvideo__sticky">${media}</div>\n` +
      `<div class="scrollvideo__track">${cardHtml}</div>\n` +
      `</section>`
    );
  },
};
