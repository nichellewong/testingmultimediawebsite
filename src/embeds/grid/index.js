// embed: grid
//
// Several embeds side by side. Each cell is a complete embed written exactly
// as it would be on its own, separated by --- lines.
//
// Options: columns (2 to 4, default 2), gap (default 1rem), aspect (e.g. 3x2,
//          crops every photo or video in the grid to the same shape),
//          size (default large), caption, credit, id
import { splitSteps } from '../../lib/blocks.js';
import { toNumber, cssSize } from '../../lib/util.js';
import { wrap, errorBox } from '../../lib/html.js';

export default {
  name: 'grid',
  aliases: ['columns', 'row'],
  description: 'Two to four embeds side by side',
  async render({ options: o, body }, ctx) {
    const cells = splitSteps(body);
    if (!cells.length) return errorBox('A grid needs at least one embed inside it. Separate the embeds with --- lines.');
    const columns = Math.min(4, Math.max(1, Math.round(toNumber(o.columns, 2))));
    const style = [`--grid-cols:${columns}`, `--grid-gap:${cssSize(o.gap, '1rem')}`];
    const classes = ['story-grid'];
    if (o.aspect) {
      const a = String(o.aspect).toLowerCase().replace(/[:/]/, 'x').split('x').map(Number);
      if (a[0] > 0 && a[1] > 0) {
        style.push(`--grid-aspect:${a[0]} / ${a[1]}`);
        classes.push('story-grid--aspect');
      }
    }
    const rendered = [];
    for (const cell of cells) {
      const html = await ctx.renderChild(cell.options, cell.body);
      rendered.push(`<div class="story-grid__cell">${html}</div>`);
    }
    const inner = `<div class="${classes.join(' ')}" style="${style.join(';')}">${rendered.join('')}</div>`;
    return wrap(ctx, { size: o.size, caption: o.caption, credit: o.credit, id: o.id, embedName: 'grid' }, inner);
  },
};
