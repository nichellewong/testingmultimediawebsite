// embed: audio
//
// A self-hosted audio clip with the browser's own player.
// Options: source (required), title, image (+ alt: a picture above the player),
//          caption, credit, size (default: text), float (left | right), id
import { escapeHtml } from '../../lib/util.js';
import { wrap, errorBox, sizesAttr } from '../../lib/html.js';
import { imageTag } from '../../lib/images.js';

export function audioTag(ctx, source, extra = '') {
  return `<audio controls preload="metadata" ${extra}><source src="${escapeHtml(ctx.assetUrl(source))}">Your browser does not support audio.</audio>`;
}

export default {
  name: 'audio',
  aliases: ['sound', 'mp3'],
  description: 'A self-hosted audio clip with player controls',
  async render({ options: o }, ctx) {
    const source = o.source || o.src || o.file;
    if (!source) return errorBox('An audio embed needs a "source:" line, for example "source: interview.mp3".');
    const title = o.title ? `<p class="audio-player__title">${ctx.renderInline(o.title)}</p>` : '';
    let picture = '';
    if (o.image) {
      if (!o.alt) ctx.warn(`Audio embed picture "${o.image}" has no alt: text.`);
      picture = await imageTag(ctx, o.image, { alt: o.alt || '', classes: 'audio-player__image', sizes: o.float ? '(max-width: 767px) 45vw, 480px' : sizesAttr(ctx, o.size, 'text') });
    }
    const inner = `<div class="audio-player${picture ? ' audio-player--with-image' : ''}">${picture}<div class="audio-player__body">${title}${audioTag(ctx, source)}</div></div>`;
    return wrap(ctx, { size: o.size, defaultSize: 'text', caption: o.caption, credit: o.credit, id: o.id, embedName: 'audio', float: o.float }, inner);
  },
};
