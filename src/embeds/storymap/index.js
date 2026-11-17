// embed: storymap  (StoryMapJS by Knight Lab, self-hosted)
//
// Options: source (the published.json file from the StoryMapJS authoring
//                  tool, saved somewhere in assets/),
//          media  (a folder in assets/ holding the pictures that were uploaded
//                  to the tool; every slide picture in the JSON is pointed at
//                  the file of the same name in that folder),
//          height (default 650), caption, credit, size, id
//          Other StoryMapJS options pass straight through (map_type, language...).
//
// A block with no source: line is skipped. If it holds pasted <iframe> code
// instead, it is treated as ordinary embed code (see lib/blocks.js).
//
// Note: map tiles are streamed from OpenStreetMap at view time; everything
// else is served from this site.
import fs from 'node:fs';
import path from 'node:path';
import { isUrl, cssSize, jsonAttr, passthroughOptions, ensureDir } from '../../lib/util.js';
import { wrap, errorBox } from '../../lib/html.js';
import { cleanAssetPath } from '../../lib/images.js';

const RESERVED = ['embed', 'type', 'source', 'src', 'file', 'media', 'height', 'size', 'caption', 'credit', 'id', 'width'];
const KNIGHTLAB_UPLOAD = /^(https?:)?\/\/uploads\.knightlab\.com\//i;

// "//uploads.knightlab.com/storymapjs/ID/name/_images/06.jpg" -> "06.jpg"
function fileNameOf(url) {
  const clean = String(url || '').split(/[?#]/)[0];
  const last = clean.split('/').pop() || '';
  try { return decodeURIComponent(last); } catch { return last; }
}

// Point every slide picture at assets/<folder>/<same file name> when that
// file exists. Anything else (YouTube links, pictures still on Knight Lab's
// servers that were not downloaded) is left alone.
export function relinkMedia(data, folder, ctx) {
  const slides = data?.storymap?.slides;
  if (!Array.isArray(slides)) return { swapped: 0, missing: [] };
  const dir = path.join(ctx.root, 'assets', folder);
  let swapped = 0;
  const missing = [];
  for (const slide of slides) {
    for (const key of ['media', 'background']) {
      const item = slide?.[key];
      if (!item || typeof item.url !== 'string' || !item.url) continue;
      if (!isUrl(item.url) && !item.url.startsWith('/')) continue; // already a local file
      const name = fileNameOf(item.url);
      if (name && fs.existsSync(path.join(dir, name))) {
        item.url = ['assets', ...folder.split('/'), name].map(encodeURIComponent).join('/');
        swapped++;
      } else if (KNIGHTLAB_UPLOAD.test(item.url)) {
        missing.push(name || item.url);
      }
    }
  }
  return { swapped, missing };
}

export default {
  name: 'storymap',
  aliases: ['storymapjs'],
  description: 'StoryMapJS slide-driven map',
  vendor: [{ dir: 'storymapjs', css: ['css/storymap.css'], js: ['js/storymap-min.js'] }],
  async render({ options: o }, ctx) {
    const source = o.source || o.src || o.file;
    if (!source) {
      ctx.warn('A storymap block has no "source:" line pointing to its published.json file, so it was skipped.');
      return '';
    }
    const id = ctx.nextId('storymap');
    let url = isUrl(source) ? source : ctx.assetUrl(source);

    const media = cleanAssetPath(o.media).replace(/\/+$/, '');
    if (media) {
      if (isUrl(source)) {
        ctx.warn(`Storymap "media:" only works when "source:" is a file in assets/, not a web address. The pictures were left as they are.`);
      } else {
        const clean = cleanAssetPath(source);
        const abs = path.join(ctx.root, 'assets', clean);
        if (!fs.existsSync(abs)) return errorBox(`Storymap file not found: assets/${clean}.`);
        if (!fs.existsSync(path.join(ctx.root, 'assets', media))) {
          ctx.warn(`Storymap "media: ${media}" is not a folder in assets/. The pictures were left as they are.`);
        } else {
          let data;
          try {
            data = JSON.parse(fs.readFileSync(abs, 'utf8'));
          } catch (err) {
            return errorBox(`assets/${clean} is not valid JSON (${err.message}). Save the published.json page again.`);
          }
          const { missing } = relinkMedia(data, media, ctx);
          if (missing.length) {
            ctx.warn(`Storymap pictures not found in assets/${media}/: ${missing.join(', ')}. Knight Lab's copies will be used instead.`);
          }
          // The rewritten copy lives beside the resized images, in _site only.
          const outRel = `assets/_storymap/${id}.json`;
          ensureDir(path.join(ctx.outDir, 'assets', '_storymap'));
          fs.writeFileSync(path.join(ctx.outDir, outRel), JSON.stringify(data));
          url = outRel;
        }
      }
    }

    const config = { source: url, options: { ...passthroughOptions(o, RESERVED) } };
    const inner = `<div id="${id}" class="storymap-embed" data-embed="storymap" data-config='${jsonAttr(config)}' style="height:${cssSize(o.height, '650px')}"></div>`;
    return wrap(ctx, { size: o.size, caption: o.caption, credit: o.credit, id: o.id, embedName: 'storymap' }, inner);
  },
};
