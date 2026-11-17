// embed: slideshow  (Bootstrap carousel)
//
// One slide per step (separated by --- lines), each with:
//   image (or source), alt, caption, credit
// Options: indicators (true), arrows (true), captions (true), counter (false),
//          autoplay (false), interval (seconds, 5), pause_on_hover (true),
//          fade (false), loop (true), aspect (3x2), background (#000000),
//          size, caption, credit, id
//
// Every slide sits in a box of the same shape (aspect) with the photo
// contained inside it, so vertical and horizontal photos never resize the
// slideshow.
import { splitSteps } from '../../lib/blocks.js';
import { imageTag } from '../../lib/images.js';
import { escapeHtml, toBool, toNumber, jsonAttr } from '../../lib/util.js';
import { wrap, errorBox, sizesAttr } from '../../lib/html.js';

function aspectPercent(value) {
  const a = String(value || '3x2').toLowerCase().replace(/[:/]/, 'x');
  const [w, h] = a.split('x').map(Number);
  return w > 0 && h > 0 ? ((h / w) * 100).toFixed(3) : '66.667';
}

export default {
  name: 'slideshow',
  aliases: ['carousel', 'gallery'],
  description: 'A photo slideshow with arrows, dots and captions',
  async render({ options: o, body }, ctx) {
    const slides = splitSteps(body).filter((s) => s.options.image || s.options.source || s.options.src);
    if (!slides.length) return errorBox('A slideshow needs at least one slide: a line with "image: photo.jpg" after a --- line.');

    const id = ctx.nextId('slideshow');
    const showIndicators = toBool(o.indicators, true);
    const showArrows = toBool(o.arrows, true);
    const showCaptions = toBool(o.captions, true);
    const showCounter = toBool(o.counter, false);
    const autoplay = toBool(o.autoplay, false);
    const config = {
      autoplay,
      interval: Math.max(1, toNumber(o.interval, 5)) * 1000,
      pause: toBool(o.pause_on_hover, true),
      wrap: toBool(o.loop, true),
    };
    const sizes = sizesAttr(ctx, o.size);
    const bg = String(o.background || '#000000').replace(/[;"<>]/g, '');

    const items = [];
    const captions = [];
    const indicators = [];
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i].options;
      const file = s.image || s.source || s.src;
      if (!s.alt) ctx.warn(`Slideshow picture "${file}" has no alt: text.`);
      const img = await imageTag(ctx, file, { alt: s.alt || '', sizes, loading: i === 0 ? 'eager' : 'lazy' });
      items.push(`<div class="carousel-item${i === 0 ? ' active' : ''}"><div class="slideshow__frame">${img}</div></div>`);
      const cap = [];
      if (s.caption) cap.push(`<span class="story-embed__caption-text">${ctx.renderInline(s.caption)}</span>`);
      if (s.credit) cap.push(`<span class="story-embed__credit">${ctx.renderInline(s.credit)}</span>`);
      captions.push(`<div class="slideshow__cap${i === 0 ? ' is-active' : ''}" data-slide="${i}">${cap.join(' ')}</div>`);
      indicators.push(`<button type="button" data-bs-target="#${id}" data-bs-slide-to="${i}"${i === 0 ? ' class="active" aria-current="true"' : ''} aria-label="Slide ${i + 1}"></button>`);
    }

    const inner =
      `<div id="${id}" class="carousel slide${toBool(o.fade, false) ? ' carousel-fade' : ''}" data-embed="slideshow" data-config='${jsonAttr(config)}' style="--slideshow-aspect:${aspectPercent(o.aspect)}%;--slideshow-bg:${bg}">` +
      (showIndicators && slides.length > 1 ? `<div class="carousel-indicators">${indicators.join('')}</div>` : '') +
      `<div class="carousel-inner">${items.join('')}</div>` +
      (showCounter ? `<div class="slideshow__counter" aria-hidden="true"><span class="slideshow__counter-now">1</span> / ${slides.length}</div>` : '') +
      (showArrows && slides.length > 1
        ? `<button class="carousel-control-prev" type="button" data-bs-target="#${id}" data-bs-slide="prev"><span class="carousel-control-prev-icon" aria-hidden="true"></span><span class="visually-hidden">Previous</span></button>` +
          `<button class="carousel-control-next" type="button" data-bs-target="#${id}" data-bs-slide="next"><span class="carousel-control-next-icon" aria-hidden="true"></span><span class="visually-hidden">Next</span></button>`
        : '') +
      `</div>` +
      (showCaptions && captions.some((c) => c.includes('story-embed__')) ? `<div class="slideshow__captions" aria-live="polite">${captions.join('')}</div>` : '');

    return wrap(ctx, { size: o.size, caption: o.caption, credit: o.credit, id: o.id, embedName: 'slideshow' }, inner);
  },
};
