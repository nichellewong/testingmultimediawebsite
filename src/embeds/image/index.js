// embed: image
//
// Options: source (required), alt, caption, credit, size, link, id,
//          float (left | right: text wraps around the picture)
import { imageTag, imageData, cleanAssetPath } from '../../lib/images.js';
import { wrap, errorBox, sizesAttr } from '../../lib/html.js';
import { escapeHtml } from '../../lib/util.js';

export default {
  name: 'image',
  aliases: ['photo', 'img'],
  description: 'A responsive photo or graphic from the assets folder',
  async render({ options: o }, ctx) {
    const source = o.source || o.src || o.file;
    if (!source) return errorBox('An image embed needs a "source:" line, for example "source: photo.jpg".');
    if (!o.alt) ctx.warn(`Image "${source}" has no alt: text. Screen readers need a short description of the picture.`);
    const data = await imageData(ctx, source);
    if (data.missing) return errorBox(`Image not found: assets/${cleanAssetPath(source)}. Check the file name (capital letters matter) and that it was uploaded to the assets folder.`);
    const floated = !!o.float;
    const img = await imageTag(ctx, source, { alt: o.alt || '', sizes: floated ? '(max-width: 767px) 45vw, 480px' : sizesAttr(ctx, o.size), widths: floated ? [480, 800, 1200] : undefined });
    const inner = o.link ? `<a href="${escapeHtml(o.link)}">${img}</a>` : img;
    return wrap(ctx, { size: o.size, caption: o.caption, credit: o.credit, id: o.id, embedName: 'image', float: o.float }, inner);
  },
};
