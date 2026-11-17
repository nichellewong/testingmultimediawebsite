// Turns settings.toml values into CSS custom properties.
import { cssSize, hexToRgba, toBool } from './util.js';

export function cssVars(ctx) {
  const { settings: s, fonts } = ctx;
  const t = s.text;
  const o = s.opener;
  const e = s.embeds;

  const bodyFont = fonts.stack(t.font, '[text] font');
  const headingFont = fonts.stack(t.heading_font || t.font, '[text] heading_font');
  // Captions, bylines, footer and other small text. Sans-serif fallback.
  const secondaryFont = t.secondary_font ? fonts.stack(t.secondary_font, '[text] secondary_font', 'sans') : headingFont;

  const vars = {
    'font-body': bodyFont,
    'font-heading': headingFont,
    'font-secondary': secondaryFont,
    'text-size': cssSize(t.font_size, '1.25rem'),
    'text-lh': t.line_height || 1.6,
    'text-color': t.color || '#222',
    'text-bg': t.background || '#fff',
    'heading-color': t.heading_color || t.color || '#222',
    'link-color': t.link_color || '#0d6efd',
    'text-width': cssSize(t.max_width, '40rem'),
    'paragraph-spacing': cssSize(t.paragraph_spacing, '1.25em'),
    'blockquote-color': t.blockquote_color || t.link_color || '#0d6efd',
    'pullquote-font': t.pullquote_font ? fonts.stack(t.pullquote_font, '[text] pullquote_font') : headingFont,
    'pullquote-size': cssSize(t.pullquote_size, '2rem'),
    'pullquote-color': t.pullquote_color || t.heading_color || t.color || '#222',
    'gutter': cssSize(e.gutter, '3rem'),
    'large-scale': e.large_scale || 1.5,
    'caption-font': e.caption_font ? fonts.stack(e.caption_font, '[embeds] caption_font', 'sans') : secondaryFont,
    'caption-size': cssSize(e.caption_size, '0.9rem'),
    'caption-color': e.caption_color || '#666',
    'button-color': e.button_color || t.link_color || '#0d6efd',
    'page-gutter': '1rem',
    'opener-height': cssSize(o.height, '100vh'),
    'opener-screen': hexToRgba(o.screen_color, o.screen_opacity),
    'opener-solid': o.screen_color || '#000000',
    'opener-title-font': o.title_font ? fonts.stack(o.title_font, '[opener] title_font') : headingFont,
    'opener-title-size': cssSize(o.title_size, '5rem'),
    'opener-title-weight': o.title_weight || 700,
    'opener-title-color': o.title_color || '#fff',
    'opener-tagline-font': o.tagline_font ? fonts.stack(o.tagline_font, '[opener] tagline_font') : bodyFont,
    'opener-tagline-size': cssSize(o.tagline_size, '1.4rem'),
    'opener-tagline-color': o.tagline_color || o.title_color || '#fff',
    'opener-shadow': toBool(o.text_shadow, true) ? '0 2px 20px rgba(0,0,0,0.5)' : 'none',
    'opener-max-width': cssSize(o.max_width, '75vw'),
    'opener-bg-position': o.background_position || 'center',
    'opener-scroll-color': o.scroll_indicator_color || o.title_color || '#fff',
  };

  return `:root {\n${Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`;
}
