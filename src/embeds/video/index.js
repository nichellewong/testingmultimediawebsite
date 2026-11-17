// embed: video
//
// A short self-hosted video with the browser's own controls.
// Options: source (required), poster, caption, credit, size, autoplay, loop, muted, controls, id
import { toBool, escapeHtml } from '../../lib/util.js';
import { imageData } from '../../lib/images.js';
import { wrap, errorBox } from '../../lib/html.js';

export default {
  name: 'video',
  description: 'A self-hosted MP4 video with player controls',
  async render({ options: o }, ctx) {
    const source = o.source || o.src || o.file;
    if (!source) return errorBox('A video embed needs a "source:" line, for example "source: clip.mp4".');
    const url = ctx.assetUrl(source);
    const autoplay = toBool(o.autoplay, false);
    const attrs = ['playsinline', 'preload="metadata"'];
    if (toBool(o.controls, !autoplay)) attrs.push('controls');
    if (autoplay) attrs.push('autoplay', 'muted');
    else if (toBool(o.muted, false)) attrs.push('muted');
    if (toBool(o.loop, autoplay)) attrs.push('loop');
    if (o.poster) {
      const poster = await imageData(ctx, o.poster, { widths: [1600] });
      attrs.push(`poster="${escapeHtml(poster.src)}"`);
    }
    const inner = `<video ${attrs.join(' ')}><source src="${escapeHtml(url)}" type="video/mp4">Your browser does not support video.</video>`;
    return wrap(ctx, { size: o.size, caption: o.caption, credit: o.credit, id: o.id, embedName: 'video' }, inner);
  },
};
