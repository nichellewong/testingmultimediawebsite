// embed: hotspots
//
// A photo with clickable markers. Hovering (or a first tap) shows a small
// info window; clicking (or a second tap) opens a pop-up with more media.
// Build the code block with tools/hotspots.html rather than by hand.
//
// Block options:  source (required), alt, caption, credit, size, id,
//                 marker (custom marker image for all markers),
//                 marker_size (px, default 28), marker_color (fill, hex),
//                 marker_opacity (0 to 1, default 0.35), marker_border (ring
//                 color, hex), numbered (true/false),
//                 pulse (true/false, default true), legend (true/false)
// Each marker (separated by --- lines):
//                 x, y (percent of the picture's width and height),
//                 title, text, thumbnail, marker (override),
//                 detail media: video (+ poster), audio, image (+ alt),
//                 pasted iframe code, or plain text as the body;
//                 modal_title, width (large | xl | fullscreen)
import { splitSteps } from '../../lib/blocks.js';
import { imageTag, imageData } from '../../lib/images.js';
import { escapeHtml, toBool, toNumber, slugify, hexToRgba } from '../../lib/util.js';

// Fill color for a marker: a hex color plus an opacity (default 0.35), or any
// CSS color passed through as is.
function fillColor(color, opacity) {
  const c = String(color || '').trim();
  const o = toNumber(opacity, 0.35);
  if (!c) return opacity !== undefined && opacity !== '' ? hexToRgba('#ffffff', o) : '';
  return /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c) ? hexToRgba(c.startsWith('#') ? c : '#' + c, o) : c.replace(/[;"<>]/g, '');
}
import { wrap, errorBox, sizesAttr } from '../../lib/html.js';

export default {
  name: 'hotspots',
  aliases: ['hotspot', 'markers'],
  description: 'A photo with hover/tap markers that open info windows and pop-ups',
  async render({ options: o, body }, ctx) {
    const source = o.source || o.src || o.image || o.file;
    if (!source) return errorBox('A hotspots embed needs a "source:" line naming the photo.');
    const data = await imageData(ctx, source);
    if (data.missing) return errorBox(`Image not found: assets/${source}.`);
    const markers = splitSteps(body).filter((m) => m.options.x !== undefined && m.options.y !== undefined);
    if (!markers.length) return errorBox('A hotspots embed needs at least one marker with "x:" and "y:" lines. Use the builder page (tools/hotspots.html) to make them.');

    const modalDef = ctx.embeds.get('modal');
    const baseId = slugify(o.id || ctx.nextId('hotspots'));
    const numbered = toBool(o.numbered, false);
    const pulse = toBool(o.pulse, true);
    const legend = toBool(o.legend, false);
    const style = [];
    if (o.marker_size) style.push(`--hotspot-size:${toNumber(o.marker_size, 28)}px`);
    const fill = fillColor(o.marker_color, o.marker_opacity);
    if (fill) style.push(`--hotspot-color:${fill}`);
    if (o.marker_border) style.push(`--hotspot-border:${o.marker_border.replace(/[;"<>]/g, '')}`);

    const img = await imageTag(ctx, source, { alt: o.alt || '', sizes: sizesAttr(ctx, o.size) });
    const buttons = [];
    const templates = [];
    const modals = [];
    const legendItems = [];

    for (let i = 0; i < markers.length; i++) {
      const m = markers[i].options;
      const mbody = markers[i].body.trim();
      const n = i + 1;
      const id = `${baseId}-${n}`;
      const x = Math.min(100, Math.max(0, toNumber(m.x, 50)));
      const y = Math.min(100, Math.max(0, toNumber(m.y, 50)));
      const title = m.title || '';
      const label = title || `Marker ${n}`;

      // Detail pop-up (reuses the modal embed)
      let modalSel = '';
      const hasDetail = m.video || m.audio || m.image || mbody;
      if (hasDetail && modalDef) {
        ctx.use('modal');
        const detailBody = mbody && !mbody.startsWith('<') ? `<div class="story-modal__text">${ctx.renderMarkdown(mbody)}</div>` : mbody;
        const html = await modalDef.render(
          { options: { id, title: m.modal_title || title, video: m.video, poster: m.poster, audio: m.audio, image: m.image, alt: m.alt || title, width: m.width, autoplay: m.autoplay, aspect: m.aspect, resize: m.resize }, body: detailBody },
          ctx
        );
        modals.push(html);
        modalSel = `#modal-${id}`;
      }

      // Info window
      const parts = [];
      if (m.thumbnail) {
        const thumb = await imageData(ctx, m.thumbnail, { widths: [480] });
        if (!thumb.missing) parts.push(`<img class="hotspot-popover__thumb" src="${escapeHtml(thumb.src)}" alt="">`);
      }
      if (title) parts.push(`<p class="hotspot-popover__title">${ctx.renderInline(title)}</p>`);
      if (m.text) parts.push(`<p class="hotspot-popover__text">${ctx.renderInline(m.text)}</p>`);
      if (modalSel) parts.push(`<span class="hotspot-popover__more">Click or tap again for more</span>`);
      const hasPopover = parts.length > 0;
      if (hasPopover) templates.push(`<template id="${id}-info">${parts.join('')}</template>`);

      // Marker
      const custom = m.marker || o.marker;
      let markerInner;
      if (custom) {
        const mk = await imageData(ctx, custom, { widths: [200] });
        markerInner = `<span class="hotspot__marker hotspot__marker--custom"><img src="${escapeHtml(mk.src)}" alt=""></span>`;
      } else {
        markerInner = `<span class="hotspot__marker">${numbered ? n : ''}</span>`;
      }
      const mstyle = [`left:${x}%`, `top:${y}%`];
      const mfill = fillColor(m.marker_color, m.marker_opacity !== undefined ? m.marker_opacity : o.marker_opacity);
      if (m.marker_color || m.marker_opacity !== undefined) mstyle.push(`--hotspot-color:${mfill}`);
      if (m.marker_border) mstyle.push(`--hotspot-border:${m.marker_border.replace(/[;"<>]/g, '')}`);
      buttons.push(
        `<button type="button" class="hotspot${pulse ? ' hotspot--pulse' : ''}" style="${mstyle.join(';')}" aria-label="${escapeHtml(label)}"` +
          (hasPopover ? ` data-info="${id}-info"` : '') +
          (modalSel ? ` data-modal="${modalSel}" aria-haspopup="dialog"` : '') +
          `>${markerInner}</button>`
      );
      legendItems.push(`<li><button type="button" class="hotspots__legend-item" data-target="${n - 1}">${numbered ? `<span class="hotspots__legend-num">${n}</span>` : ''}${ctx.renderInline(label)}</button></li>`);
    }

    const inner =
      `<div class="hotspots" data-embed="hotspots"${style.length ? ` style="${style.join(';')}"` : ''}>${img}${buttons.join('')}${templates.join('')}</div>` +
      (legend ? `<ol class="hotspots__legend">${legendItems.join('')}</ol>` : '');

    const figure = wrap(ctx, { size: o.size, caption: o.caption, credit: o.credit, id: o.id, embedName: 'hotspots' }, inner);
    return figure + '\n' + modals.join('\n');
  },
};
