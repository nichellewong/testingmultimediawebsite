// Turns content.md into the story HTML.
//
// Prose is standard Markdown. Every fenced code block is handed to an embed
// module (see src/embeds/). Runs of prose are wrapped in <div class="story-text">
// so they sit in the narrow reading column while embeds can grow wider.
import MarkdownIt from 'markdown-it';
import { parseBlock, detectEmbedName } from './blocks.js';
import { imageTag } from './images.js';
import { errorBox } from './html.js';

const MARK_OPEN = '<!--story-embed-->';
const MARK_CLOSE = '<!--/story-embed-->';

export function createMarkdown(ctx) {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

  // Code blocks become embeds.
  const embedRule = (tokens, idx) => ctx.renderEmbedBlock(tokens[idx].content);
  md.renderer.rules.fence = embedRule;
  md.renderer.rules.code_block = embedRule;

  // ![alt](photo.jpg "Caption") also becomes an image embed.
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const t = tokens[idx];
    const src = t.attrGet('src') || '';
    let alt = self.renderInlineAsText(t.children, options, env);
    if (!alt && /^(assets\/)?pasted\//i.test(src)) alt = 'Image from the document';
    if (/^data:image\//i.test(src)) {
      // An image pasted straight into the Google Doc.
      if (!alt) alt = 'Image from the document';
      ctx.warn('An image is embedded as base64 text with no description. Save it to assets/ and use an image embed instead.');
    }
    if (t.meta?.inline) return ctx.defer(imageTag(ctx, src, { alt, sizes: '(max-width: 767px) 100vw, 640px', classes: 'story-inline-image' }));
    return ctx.renderEmbed({ embed: 'image', source: src, alt, caption: t.attrGet('title') || '' }, '');
  };

  // A line like {.table-large .table-striped} right after a table sets its
  // width (table-text, table-large, table-full, table-130) and adds classes.
  md.core.ruler.push('table_attributes', (state) => {
    const toks = state.tokens;
    const ATTR = /^\{([^}]*)\}$/;
    const parse = (text) => {
      const meta = { size: '', scale: 0, classes: [] };
      for (const name of text.split(/\s+/).map((c) => c.replace(/^\./, '')).filter(Boolean)) {
        const size = name.match(/^table-(text|large|full|(\d+))$/);
        if (size) {
          if (size[2]) { meta.size = 'custom'; meta.scale = Number(size[2]) / 100; } else meta.size = size[1];
        } else meta.classes.push(name.replace(/[^\w-]/g, ''));
      }
      return meta;
    };
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].type !== 'table_close') continue;
      let open = i;
      while (open >= 0 && toks[open].type !== 'table_open') open--;
      if (open < 0) continue;
      // Case 1: a paragraph "{...}" after a blank line.
      if (toks[i + 1]?.type === 'paragraph_open' && toks[i + 2]?.type === 'inline' && toks[i + 3]?.type === 'paragraph_close') {
        const m = toks[i + 2].content.trim().match(ATTR);
        if (m) { toks[open].meta = parse(m[1]); toks.splice(i + 1, 3); continue; }
      }
      // Case 2: "{...}" typed directly under the table, which Markdown reads
      // as one more row (first cell holds the text, the rest are empty).
      let trClose = i - 1;
      while (trClose > open && toks[trClose].type !== 'tr_close') trClose--;
      if (trClose <= open) continue;
      let trOpen = trClose;
      while (trOpen > open && toks[trOpen].type !== 'tr_open') trOpen--;
      const cells = toks.slice(trOpen, trClose).filter((t) => t.type === 'inline').map((t) => t.content.trim());
      const m = cells[0]?.match(ATTR);
      if (m && cells.slice(1).every((c) => c === '')) {
        toks[open].meta = parse(m[1]);
        toks.splice(trOpen, trClose - trOpen + 1);
        i = trOpen;
      }
    }
  });

  // Tables get the classes from settings.toml ([text] table_classes) and a
  // wrapper that scrolls sideways on narrow screens.
  md.renderer.rules.table_open = (tokens, idx) => {
    const meta = tokens[idx].meta || {};
    const classes = [String(ctx.settings.text.table_classes ?? 'table table-bordered').trim(), ...(meta.classes || [])].filter(Boolean).join(' ');
    const wrapClasses = ['table-responsive'];
    let style = '';
    if (meta.size && meta.size !== 'text') wrapClasses.push(`table-size--${meta.size}`);
    if (meta.size === 'custom') style = ` style="--table-scale:${meta.scale}"`;
    return `<div class="${wrapClasses.join(' ')}"${style}><table${classes ? ` class="${classes}"` : ''}>`;
  };
  md.renderer.rules.table_close = () => '</table></div>';

  // Images inside a table, list or quotation stay small and inline; only
  // free-standing images become full embeds.
  md.core.ruler.push('mark_inline_images', (state) => {
    let depth = 0;
    for (const tok of state.tokens) {
      if (/^(table|bullet_list|ordered_list|blockquote)_open$/.test(tok.type)) depth++;
      else if (/^(table|bullet_list|ordered_list|blockquote)_close$/.test(tok.type)) depth--;
      else if (tok.type === 'inline' && depth > 0) {
        for (const child of tok.children || []) if (child.type === 'image') child.meta = { ...(child.meta || {}), inline: true };
      }
    }
  });

  // A paragraph that holds only an image should not render <p></p> around it.
  md.core.ruler.push('unwrap_image_paragraphs', (state) => {
    const toks = state.tokens;
    for (let i = 0; i < toks.length - 2; i++) {
      if (toks[i].type !== 'paragraph_open' || toks[i + 1].type !== 'inline' || toks[i + 2].type !== 'paragraph_close') continue;
      const kids = (toks[i + 1].children || []).filter((c) => c.type !== 'softbreak' && !(c.type === 'text' && !c.content.trim()));
      if (kids.length === 1 && kids[0].type === 'image' && !kids[0].meta?.inline) {
        toks[i].hidden = true;
        toks[i + 2].hidden = true;
      }
    }
  });

  // [Watch the video](#modal:clip) opens the modal with id "clip".
  const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const t = tokens[idx];
    const m = (t.attrGet('href') || '').match(/^#modal:([\w-]+)$/i);
    if (m) {
      t.attrSet('href', `#modal-${m[1]}`);
      t.attrSet('data-bs-toggle', 'modal');
      t.attrSet('data-bs-target', `#modal-${m[1]}`);
      t.attrJoin('class', 'story-modal-link');
    } else if (/^https?:\/\//i.test(t.attrGet('href') || '')) {
      t.attrSet('target', '_blank');
      t.attrSet('rel', 'noopener');
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
}

// Tidies the quirks of Google Docs' Markdown export (also harmless on a
// hand-written content.md):
//  - the "gdoc_comments:" block Google appends when the doc has comments
//  - the invisible comment markers it leaves around commented text
//  - checklist items (- [ ] / - [x]) shown with a box glyph instead of brackets
//  - typed < and > characters, which arrive as \&lt; and \&gt;
// Empty paragraphs arrive as a line holding &nbsp; and are kept on purpose,
// so a blank line in the doc stays a blank line on the page.
export function cleanDocExport(text) {
  let s = text;
  s = s.replace(/\n---\n+gdoc_comments:\n[\s\S]*?\n---\s*$/, '\n');
  s = s.replace(/<!--\s*gdoc_comment_(?:begin|end):[^>]*-->/g, '');
  s = s.replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[ \]\s+/gm, '$1\u2610 ');
  s = s.replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[[xX]\]\s+/gm, '$1\u2611 ');
  s = s.replace(/\\&lt;/g, '\\<').replace(/\\&gt;/g, '\\>');
  // Google Docs cannot show an image typed as ![alt](url), so it exports the
  // text with every character escaped. Someone who typed that wants a picture,
  // so turn it back into one. An optional {.class .other} after it adds classes.
  const unescape = (v) => v.replace(/\\([^A-Za-z0-9])/g, '$1');
  const IMG = /\\!\\\[([^\]\n]*?)\\\]\(([^)\s]+?)\)(?:\{([^}\n]*)\})?/g;
  s = s.replace(/^[ \t]*\\!\\\[([^\]\n]*?)\\\]\(([^)\s]+?)\)(?:\{([^}\n]*)\})?[ \t]*$/gm, (m, alt, url, attrs) => {
    const classes = (attrs || '').split(/\s+/).filter((a) => a.startsWith('.')).map((a) => a.slice(1)).join(' ');
    return ['```', 'embed: image', `source: ${unescape(url)}`, `alt: ${unescape(alt)}`, classes ? `class: ${classes}` : '', '```'].filter(Boolean).join('\n');
  });
  s = s.replace(IMG, (m, alt, url) => `![${unescape(alt)}](${unescape(url)})`);
  return s;
}

export function markEmbed(html) {
  return `\n${MARK_OPEN}\n${html}\n${MARK_CLOSE}\n`;
}

// Wrap the prose between embeds in .story-text columns.
function wrapTextRuns(html) {
  const parts = html.split(new RegExp(`${MARK_OPEN}|${MARK_CLOSE}`, 'g'));
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // an embed
      return part.trim() ? `<div class="story-text">\n${part.trim()}\n</div>` : '';
    })
    .join('\n');
}

export async function renderContent(markdown, ctx) {
  const source = cleanDocExport(String(markdown).replace(/\r\n?/g, '\n'));
  let html = ctx.md.render(source);
  html = await ctx.resolveDeferred(html);
  return wrapTextRuns(html);
}

// Attached to ctx: parse a code block and dispatch it.
export function renderEmbedBlock(ctx, raw) {
  const block = parseBlock(raw);
  const name = detectEmbedName(block);
  if (!name) {
    ctx.warn('A code block in content.md is empty or has no "embed:" line');
    return markEmbed(errorBox('This code block is empty. Add an "embed:" line or paste embed code.'));
  }
  return ctx.renderEmbed(block.options, block.body, name);
}
