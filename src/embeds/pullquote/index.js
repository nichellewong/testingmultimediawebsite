// embed: pullquote
//
// A big quotation pulled out of the story.
// Options: cite (who said it), size (default: large), id
// Body: the quote itself (Markdown allowed)
import { wrap, errorBox } from '../../lib/html.js';

export default {
  name: 'pullquote',
  aliases: ['quote'],
  description: 'A large pulled quotation',
  async render({ options: o, body }, ctx) {
    const text = (body || o.quote || o.text || '').trim();
    if (!text) return errorBox('A pullquote needs the quote text below the option lines.');
    const cite = o.cite || o.credit || o.source || '';
    const inner =
      `<blockquote class="pullquote"><p>${ctx.renderInline(text.replace(/\n+/g, ' '))}</p>` +
      (cite ? `<footer class="pullquote__cite">${ctx.renderInline(cite)}</footer>` : '') +
      `</blockquote>`;
    return wrap(ctx, { size: o.size, defaultSize: 'large', id: o.id, embedName: 'pullquote' }, inner);
  },
};
