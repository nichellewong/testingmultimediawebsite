// Reads settings.toml, fills in defaults, and warns about typos.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'smol-toml';
import { straightQuotes } from './util.js';

export const DEFAULTS = {
  site: {
    title: 'Untitled story',
    tagline: '',
    byline: '',
    date: '',
    description: '',
    language: 'en',
    base_url: '',
    share_image: '',
    favicon: '',
    footer: '',
    content_url: '',
  },
  fonts: {
    custom: [],
  },
  opener: {
    background: '',
    poster: '',
    background_position: 'center',
    screen_color: '#000000',
    screen_opacity: 0.45,
    align: 'middle-center',
    title_font: '',
    title_size: '5rem',
    title_weight: 700,
    title_color: '#ffffff',
    hide_title: false,
    tagline_font: '',
    tagline_size: '1.4rem',
    tagline_color: '#ffffff',
    text_shadow: true,
    max_width: '75vw',
    height: '100vh',
    scroll_indicator: true,
    scroll_indicator_color: '',
    audio: false,
    audio_position: 'bottom-center',
    audio_label: 'Click for audio',
    audio_label_on: 'Mute',
    fade_sound_after_scroll: true,
  },
  text: {
    font: '',
    heading_font: '',
    secondary_font: '',
    font_size: '1.25rem',
    line_height: 1.6,
    color: '#222222',
    background: '#ffffff',
    heading_color: '',
    link_color: '#0d6efd',
    max_width: '40rem',
    paragraph_spacing: '1.25em',
    blockquote_color: '',
    pullquote_font: '',
    pullquote_size: '2rem',
    pullquote_color: '',
    table_classes: 'table table-bordered',
  },
  embeds: {
    gutter: '3rem',
    large_scale: 1.5,
    caption_font: '',
    caption_size: '0.9rem',
    caption_color: '#666666',
    button_color: '',
    trusted_script_domains: [],
  },
};

const ALIGNMENTS = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function merge(defaults, user, warn, trail = '') {
  const out = { ...defaults };
  for (const [key, value] of Object.entries(user || {})) {
    const here = trail ? `${trail}.${key}` : key;
    if (!(key in defaults)) {
      // Unknown keys are kept (future-proof) but flagged, since they are
      // usually typos.
      warn(`settings.toml: "${here}" is not a known setting (check the spelling)`);
      out[key] = value;
      continue;
    }
    if (isPlainObject(defaults[key]) && isPlainObject(value)) {
      out[key] = merge(defaults[key], value, warn, here);
    } else if (typeof value === 'string') {
      // Straighten curly quotes that sneak in from word processors.
      out[key] = key.endsWith('_color') || key.includes('font') ? straightQuotes(value) : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function loadSettings(root, warn = () => {}) {
  const file = path.join(root, 'settings.toml');
  let user = {};
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, 'utf8');
    try {
      user = parse(text);
    } catch (err) {
      // A settings file that went through a word processor may have curly
      // quotes around its strings. TOML needs straight ones, so try again.
      try {
        user = parse(straightQuotes(text));
        warn('settings.toml had curly quotes (\u201c \u201d) around values; they were read as straight quotes');
      } catch {
        throw new Error(`settings.toml could not be read: ${err.message}`);
      }
    }
  } else {
    warn('settings.toml not found, using defaults');
  }

  const settings = merge(DEFAULTS, user, warn);

  if (!settings.site.title) warn('settings.toml: [site] title is empty');

  let align = String(settings.opener.align || 'middle-center').toLowerCase().trim();
  if (align === 'center' || align === 'middle') align = 'middle-center';
  if (align === 'top') align = 'top-center';
  if (align === 'bottom') align = 'bottom-center';
  if (!ALIGNMENTS.includes(align)) {
    warn(`settings.toml: [opener] align = "${settings.opener.align}" is not one of ${ALIGNMENTS.join(', ')}; using middle-center`);
    align = 'middle-center';
  }
  settings.opener.align = align;

  const opacity = Number(settings.opener.screen_opacity);
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    warn('settings.toml: [opener] screen_opacity should be a number between 0 and 1');
    settings.opener.screen_opacity = 0.45;
  }

  if (!Array.isArray(settings.embeds.trusted_script_domains)) {
    warn('settings.toml: [embeds] trusted_script_domains should be a list like ["example.com", "other.org"]');
    settings.embeds.trusted_script_domains = [];
  }

  return settings;
}
