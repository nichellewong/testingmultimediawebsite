// embed: juxtapose  (JuxtaposeJS by Knight Lab, self-hosted before/after slider)
//
// Options: left, right (image files; "before"/"after" also work),
//          left_label, right_label, start (0-100, default 50),
//          orientation (horizontal | vertical), animate (default true),
//          caption, credit, size, id
import { toBool, toNumber, jsonAttr } from '../../lib/util.js';
import { imageData } from '../../lib/images.js';
import { wrap, errorBox } from '../../lib/html.js';

export default {
  name: 'juxtapose',
  aliases: ['before-after', 'compare'],
  description: 'JuxtaposeJS before/after image slider',
  vendor: [{ dir: 'juxtapose', css: ['css/juxtapose.css'], js: ['js/juxtapose.min.js'] }],
  async render({ options: o }, ctx) {
    const left = o.left || o.before;
    const right = o.right || o.after;
    if (!left || !right) return errorBox('A juxtapose embed needs "left:" and "right:" (or "before:" and "after:") image files.');
    const [a, b] = await Promise.all([imageData(ctx, left, { widths: [1600] }), imageData(ctx, right, { widths: [1600] })]);
    const id = ctx.nextId('juxtapose');
    const config = {
      images: [
        { src: a.src, label: o.left_label || o.before_label || '', alt: o.left_alt || '' },
        { src: b.src, label: o.right_label || o.after_label || '', alt: o.right_alt || '' },
      ],
      options: {
        startingPosition: `${Math.min(100, Math.max(0, toNumber(o.start, 50)))}%`,
        mode: /^vert/i.test(o.orientation || '') ? 'vertical' : 'horizontal',
        animate: toBool(o.animate, true),
        showLabels: true,
        showCredits: false,
        makeResponsive: true,
      },
    };
    const inner = `<div id="${id}" class="juxtapose-embed" data-embed="juxtapose" data-config='${jsonAttr(config)}'></div>`;
    return wrap(ctx, { size: o.size, caption: o.caption, credit: o.credit, id: o.id, embedName: 'juxtapose' }, inner);
  },
};
