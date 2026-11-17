// The opener (hero) and the full HTML document.
import { escapeHtml, isUrl, toBool } from './util.js';
import { imageData } from './images.js';

const VIDEO = /\.(mp4|webm|m4v|mov)$/i;

const CHEVRON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>';

export async function renderOpener(ctx) {
  const { site, opener: o } = ctx.settings;
  let media = '';

  if (o.background && VIDEO.test(o.background)) {
    let poster = '';
    if (o.poster) {
      const p = await imageData(ctx, o.poster, { widths: [1280, 1920] });
      poster = p.src;
      ctx.shareImage = ctx.shareImage || p.largest || p.src;
    } else {
      ctx.warn('[opener] background is a video but no "poster" image is set. Phones in low-power mode will show a black screen until the video can play.');
    }
    media = `<video class="opener__video" autoplay muted loop playsinline preload="auto"${poster ? ` poster="${escapeHtml(poster)}"` : ''} aria-hidden="true"><source src="${escapeHtml(ctx.assetUrl(o.background))}" type="video/mp4"></video>`;
  } else if (o.background) {
    const data = await imageData(ctx, o.background, { widths: [768, 1280, 1920, 2560] });
    ctx.shareImage = ctx.shareImage || data.largest || data.src;
    media = `<img class="opener__image" src="${escapeHtml(data.src)}"${data.srcset ? ` srcset="${escapeHtml(data.srcset)}" sizes="100vw"` : ''} alt="" fetchpriority="high" decoding="async">`;
  }
  const solid = !media;

  let audioBtn = '';
  if (media && VIDEO.test(o.background) && toBool(o.audio, false)) {
    const pos = ['top-left', 'top-right', 'bottom-center'].includes(String(o.audio_position)) ? o.audio_position : 'bottom-center';
    const fade = toBool(o.fade_sound_after_scroll, true);
    audioBtn =
      `<button type="button" class="opener__audio opener__audio--${pos}${fade ? '' : ' opener__audio--fixed'}" aria-pressed="false" data-fade="${fade}" data-label-on="${escapeHtml(o.audio_label_on || 'Mute')}" data-label-off="${escapeHtml(o.audio_label || 'Click for audio')}">` +
      `<svg class="opener__audio-off" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>` +
      `<svg class="opener__audio-on" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>` +
      `<span class="opener__audio-label">${escapeHtml(o.audio_label || 'Click for audio')}</span></button>`;
  }
  const hide = toBool(o.hide_title, false);
  const scroll = toBool(o.scroll_indicator, true)
    ? `<a class="opener__scroll" href="#story" aria-label="Scroll down to the story">${CHEVRON}</a>`
    : '';

  return (
    `<header class="opener${solid ? ' opener--solid' : ''}" data-align="${escapeHtml(o.align)}">\n` +
    (solid ? '' : `<div class="opener__media">${media}</div>\n<div class="opener__screen"></div>\n`) +
    `<div class="opener__content"><div class="opener__inner">\n` +
    `<h1 class="opener__title${hide ? ' visually-hidden' : ''}">${escapeHtml(site.title)}</h1>\n` +
    (site.tagline ? `<p class="opener__tagline">${ctx.renderInline(site.tagline)}</p>\n` : '') +
    `</div></div>\n${audioBtn}${scroll}\n</header>`
  );
}

export function renderPage(ctx, { openerHtml, bodyHtml, vendorCss = [], vendorJs = [], customCss = false }) {
  const { site } = ctx.settings;
  const base = String(site.base_url || '').trim().replace(/\/+$/, '');
  const absolute = (u) => (u && base && !isUrl(u) ? `${base}/${u}` : u);
  const description = site.description || site.tagline || '';
  const share = site.share_image ? ctx.assetUrl(site.share_image) : ctx.shareImage;

  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeHtml(site.title)}</title>`,
    description ? `<meta name="description" content="${escapeHtml(description)}">` : '',
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${escapeHtml(site.title)}">`,
    description ? `<meta property="og:description" content="${escapeHtml(description)}">` : '',
    share ? `<meta property="og:image" content="${escapeHtml(absolute(share))}">` : '',
    base ? `<meta property="og:url" content="${escapeHtml(base + '/')}"><link rel="canonical" href="${escapeHtml(base + '/')}">` : '',
    `<meta name="twitter:card" content="${share ? 'summary_large_image' : 'summary'}">`,
    site.favicon ? `<link rel="icon" href="${escapeHtml(ctx.assetUrl(site.favicon))}">` : `<link rel="icon" href="data:,">`,
  ];

  // Preload the two main font files so text does not flash.
  for (const family of [...new Set([ctx.settings.text.font, ctx.settings.text.heading_font, ctx.settings.text.secondary_font])]) {
    const faces = ctx.fonts.filesFor(family);
    const face = faces.find((f) => f.weight === 400 && f.style === 'normal') || faces[0];
    if (face) head.push(`<link rel="preload" href="fonts/${encodeURI(face.file)}" as="font" type="font/${face.format === 'truetype' ? 'ttf' : face.format}" crossorigin>`);
  }

  head.push(`<link rel="stylesheet" href="vendor/bootstrap/css/bootstrap.min.css">`);
  for (const href of vendorCss) head.push(`<link rel="stylesheet" href="${href}">`);
  head.push(`<link rel="stylesheet" href="site.css">`);
  if (customCss) head.push(`<link rel="stylesheet" href="custom.css">`);

  const metaBits = [];
  if (site.byline) metaBits.push(`<p class="story-meta__byline">${ctx.renderInline(site.byline)}</p>`);
  if (site.date) metaBits.push(`<p class="story-meta__date"><time>${escapeHtml(site.date)}</time></p>`);
  const metaHtml = metaBits.length ? `<div class="story-text story-meta">${metaBits.join('')}</div>\n` : '';

  const footer = site.footer ? `<footer class="story-footer"><div class="story-footer__inner">${ctx.renderInline(site.footer)}</div></footer>` : '';

  const scripts = [`<script src="vendor/bootstrap/js/bootstrap.bundle.min.js"></script>`, ...vendorJs.map((src) => `<script src="${src}"></script>`), `<script src="site.js"></script>`];

  return (
    `<!doctype html>\n<html lang="${escapeHtml(site.language || 'en')}">\n<head>\n${head.filter(Boolean).join('\n')}\n</head>\n<body>\n` +
    `<a class="skip-link visually-hidden-focusable" href="#story">Skip to the story</a>\n` +
    `${openerHtml}\n` +
    `<main id="story" class="story">\n${metaHtml}${bodyHtml}\n</main>\n` +
    `${footer}\n` +
    `${scripts.join('\n')}\n</body>\n</html>\n`
  );
}
