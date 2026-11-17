// Keeps <script src="..."> tags only when their domain is listed under
// [embeds] trusted_script_domains in settings.toml. Inline scripts (the kind
// Datawrapper adds to make charts responsive) are always kept.
import { escapeHtml } from './util.js';

export function filterScripts(html, ctx) {
  const allowed = (ctx.settings.embeds.trusted_script_domains || []).map((d) => String(d).toLowerCase().trim());
  return String(html).replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, (full, attrs) => {
    const m = attrs.match(/\bsrc\s*=\s*["']?([^"'\s>]+)/i);
    if (!m) return full;
    let host = '';
    try {
      host = new URL(m[1], 'https://relative.invalid').hostname.toLowerCase();
    } catch {
      host = '';
    }
    const ok = host && host !== 'relative.invalid' && allowed.some((d) => host === d || host.endsWith('.' + d));
    if (ok) return full;
    ctx.warn(`Removed <script src="${m[1]}">: its domain "${host || m[1]}" is not in [embeds] trusted_script_domains in settings.toml`);
    return `<!-- script removed (untrusted domain): ${escapeHtml(m[1])} -->`;
  });
}

// Turns src= into data-src= on iframes so they only load when needed
// (used by modals).
export function deferIframes(html) {
  return String(html).replace(/<iframe\b([^>]*?)\ssrc=/gi, '<iframe$1 data-src=');
}
