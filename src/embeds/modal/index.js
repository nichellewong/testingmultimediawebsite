// embed: modal
//
// A pop-up window holding a video, an image, or any embed code. Opened with a
// button (label:) and/or a link in the text: [Watch](#modal:your-id)
//
// Options: id (required for links), label (button text; leave out for no button),
//          title, video, poster, audio, image, alt, width (default | large | xl | fullscreen),
//          autoplay (default: true for video), aspect (e.g. 16x9, 4x3; detected automatically),
//          resize (false keeps pasted embed code exactly as it is)
// Body: optional HTML (an iframe, for example)
import { escapeHtml, toBool, slugify, straightQuotes } from '../../lib/util.js';
import { imageTag, imageData } from '../../lib/images.js';
import { filterScripts, deferIframes } from '../../lib/scripts.js';
import { errorBox } from '../../lib/html.js';
import { aspectWrap, autoAspect } from '../html/index.js';
import { videoAspect } from '../../lib/frames.js';

const WIDTHS = { default: '', large: 'modal-lg', lg: 'modal-lg', xl: 'modal-xl', fullscreen: 'modal-fullscreen' };

export default {
  name: 'modal',
  aliases: ['popup', 'lightbox'],
  description: 'A pop-up window with a video, image, or embed',
  async render({ options: o, body }, ctx) {
    const id = `modal-${slugify(o.id || ctx.nextId('popup'))}`;
    let content = '';
    if (o.video) {
      const attrs = ['controls', 'playsinline', 'preload="metadata"'];
      if (o.poster) attrs.push(`poster="${escapeHtml((await imageData(ctx, o.poster, { widths: [1600] })).src)}"`);
      const video = `<video ${attrs.join(' ')} data-autoplay="${toBool(o.autoplay, true)}"><source src="${escapeHtml(ctx.assetUrl(o.video))}" type="video/mp4"></video>`;
      // Keep the video inside the pop-up: a fixed-aspect box sized from the
      // file itself (via ffprobe when available), or 16x9.
      content = aspectWrap(video, o.aspect || videoAspect(ctx, o.video) || '16x9');
    } else if (o.audio) {
      content = `<div class="story-modal__text"><audio controls preload="metadata" data-autoplay="${toBool(o.autoplay, true)}"><source src="${escapeHtml(ctx.assetUrl(o.audio))}"></audio></div>`;
    } else if (o.image) {
      content = await imageTag(ctx, o.image, { alt: o.alt || '', sizes: '(max-width: 991px) 100vw, 1100px', loading: 'lazy' });
    } else if (body.trim() && !body.trim().startsWith('<')) {
      // Plain text (Markdown) inside the pop-up.
      content = `<div class="story-modal__text">${ctx.renderMarkdown(body)}</div>`;
    } else if (body.trim()) {
      const html = deferIframes(filterScripts(straightQuotes(body), ctx));
      content = toBool(o.resize, true) ? aspectWrap(html, o.aspect || autoAspect(html)) : html;
    } else {
      return errorBox('A modal needs a "video:", "audio:", "image:", embed code, or text below the options.');
    }

    const width = WIDTHS[String(o.width || 'large').toLowerCase()] ?? 'modal-lg';
    const title = o.title ? ctx.renderInline(o.title) : '';
    const label = o.label || o.button || '';

    const trigger = label
      ? `<div class="story-text story-modal-trigger"><button type="button" class="btn btn-story" data-bs-toggle="modal" data-bs-target="#${id}">${ctx.renderInline(label)}</button></div>`
      : '';

    const modal =
      `<div class="modal fade story-modal" id="${id}" tabindex="-1" aria-labelledby="${id}-title" aria-hidden="true" data-embed="modal">` +
      `<div class="modal-dialog modal-dialog-centered ${width}"><div class="modal-content">` +
      `<div class="modal-header${title ? '' : ' story-modal__header--bare'}">` +
      `<h2 class="modal-title fs-5" id="${id}-title">${title || '<span class="visually-hidden">Media</span>'}</h2>` +
      `<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>` +
      `<div class="modal-body">${content}</div>` +
      `</div></div></div>`;

    return trigger + '\n' + modal;
  },
};
