// embed: scrolly  (scroll stepper)
//
// A background image or video sticks to the screen while text cards scroll
// over it. Each card can swap in a new background.
//
// Section options: position (left | center | right, default right),
//                  fit (cover | contain), card_background, card_color, card_width, id
// Steps are separated by a line of three dashes (---). Each step has:
//                  background: image-or-video.mp4   (also "image:" / "video:")
//                  position:   (optional, overrides the section setting)
//                  alt:        (optional description of the image)
//                  then the card text in Markdown. A step with no text just
//                  shows its background.
import { splitSteps } from '../../lib/blocks.js';
import { imageTag, imageData } from '../../lib/images.js';
import { escapeHtml, cssSize } from '../../lib/util.js';
import { errorBox } from '../../lib/html.js';

const VIDEO = /\.(mp4|webm|m4v|mov)$/i;
const POSITIONS = { left: 'left', right: 'right', center: 'center', middle: 'center' };

export default {
  name: 'scrolly',
  aliases: ['scroll-stepper', 'stepper', 'scrollytelling'],
  description: 'Sticky backgrounds with scrolling text cards',
  async render({ options: o, body }, ctx) {
    const steps = splitSteps(body);
    if (!steps.length) return errorBox('A scrolly embed needs at least one step. Separate steps with a line of three dashes (---).');

    const position = POSITIONS[String(o.position || 'right').toLowerCase()] || 'right';
    const fit = /contain/i.test(o.fit || '') ? 'contain' : 'cover';
    const backgrounds = [];
    const cards = [];
    let lastBg = null;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const so = step.options;
      const media = so.background || so.image || so.video || so.media || '';
      if (media) {
        let html = '';
        if (VIDEO.test(media)) {
          const poster = so.poster ? ` poster="${escapeHtml((await imageData(ctx, so.poster, { widths: [1600] })).src)}"` : '';
          html = `<video muted loop playsinline preload="metadata"${poster} aria-hidden="true"><source src="${escapeHtml(ctx.assetUrl(media))}" type="video/mp4"></video>`;
        } else {
          html = await imageTag(ctx, media, { alt: so.alt || '', sizes: '100vw', loading: backgrounds.length === 0 ? 'eager' : 'lazy', widths: [800, 1200, 1600, 2000, 2400] });
        }
        lastBg = backgrounds.length;
        backgrounds.push(`<div class="scrolly__bg${lastBg === 0 ? ' is-active' : ''}" data-bg="${lastBg}">${html}</div>`);
      } else if (lastBg === null) {
        ctx.warn('scrolly: the first step needs a "background:" line');
      }
      const pos = POSITIONS[String(so.position || '').toLowerCase()] || position;
      const text = step.body.trim() ? `<div class="story-card">${ctx.renderMarkdown(step.body)}</div>` : '';
      cards.push(`<div class="scrolly__step" data-bg="${lastBg ?? 0}" data-position="${pos}">${text}</div>`);
    }

    const style = [`--scrolly-fit:${fit}`];
    if (o.card_background) style.push(`--card-bg:${o.card_background}`);
    if (o.card_color) style.push(`--card-color:${o.card_color}`);
    if (o.card_width) style.push(`--card-width:${cssSize(o.card_width)}`);
    const id = o.id ? ` id="${escapeHtml(o.id)}"` : '';

    return (
      `<section class="scrolly story-embed story-embed--full" data-embed="scrolly"${id} style="${style.join(';')}">\n` +
      `<div class="scrolly__sticky">${backgrounds.join('')}</div>\n` +
      `<div class="scrolly__steps">${cards.join('\n')}</div>\n` +
      `</section>`
    );
  },
};
