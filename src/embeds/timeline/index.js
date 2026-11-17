// embed: timeline  (TimelineJS by Knight Lab, self-hosted)
//
// Options: source (a .json file in assets/ or a published Google Sheet link),
//          height (default 650), caption, credit, size, id
//          Any other TimelineJS option passes straight through, e.g.
//          start_at_end: true, hash_bookmark: false, timenav_position: top
import { isUrl, cssSize, jsonAttr, passthroughOptions } from '../../lib/util.js';
import { wrap, errorBox } from '../../lib/html.js';

const RESERVED = ['embed', 'type', 'source', 'src', 'file', 'height', 'size', 'caption', 'credit', 'id', 'width'];

export default {
  name: 'timeline',
  aliases: ['timelinejs'],
  description: 'TimelineJS interactive timeline',
  vendor: [{ dir: 'timelinejs', css: ['css/timeline.css'], js: ['js/timeline.js'] }],
  async render({ options: o }, ctx) {
    const source = o.source || o.src || o.file;
    if (!source) return errorBox('A timeline needs a "source:" line pointing to a .json file in assets/ or a published Google Sheet link.');
    const url = isUrl(source) ? source : ctx.assetUrl(source);
    const id = ctx.nextId('timeline');
    const config = {
      source: url,
      options: { font: '', hash_bookmark: false, ...passthroughOptions(o, RESERVED) },
    };
    const inner = `<div id="${id}" class="timeline-embed" data-embed="timeline" data-config='${jsonAttr(config)}' style="height:${cssSize(o.height, '650px')}"></div>`;
    return wrap(ctx, { size: o.size, caption: o.caption, credit: o.credit, id: o.id, embedName: 'timeline' }, inner);
  },
};
