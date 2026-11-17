// Optional: read the story from a Google Doc instead of content.md.
//
// settings.toml:  [site] content_url = "https://docs.google.com/document/d/.../edit?usp=sharing"
//
// The doc must be shared as "Anyone with the link". Every successful download
// is saved to content.remote.md, which becomes the fallback if a later download
// fails. Removing content_url goes back to content.md.
import fs from 'node:fs';
import path from 'node:path';
import { cleanDocExport } from './content.js';
import { ensureDir, shortHash } from './util.js';

export const PASTED_DIR = 'pasted'; // inside assets/
const DATA_EXT = { png: 'png', jpeg: 'jpg', jpg: 'jpg', gif: 'gif', webp: 'webp' };

// Pictures pasted into a Google Doc arrive as huge base64 text. Save each one
// as a real file in assets/pasted/ and point the Markdown at it, so the cached
// copy stays small and the pictures become ordinary assets.
export function extractPastedImages(root, markdown, warn) {
  let count = 0;
  const out = markdown.replace(/<?data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)>?/gi, (m, type, b64) => {
    const ext = DATA_EXT[type.toLowerCase()];
    if (!ext) return m;
    const data = b64.replace(/\s+/g, '');
    const name = `pasted-${shortHash(data.length + ':' + data.slice(0, 2000) + data.slice(-2000))}.${ext}`;
    const dir = path.join(root, 'assets', PASTED_DIR);
    ensureDir(dir);
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(data, 'base64'));
    count++;
    return `${PASTED_DIR}/${name}`;
  });
  if (count) warn(`${count} picture(s) pasted into the Google Doc were saved to assets/${PASTED_DIR}/. For captions and alt text, use an image embed with those file names.`);
  return out;
}

export const REMOTE_FILE = 'content.remote.md';
const TIMEOUT_MS = 20000;

// Turns a share link into a direct Markdown download address.
export function resolveContentUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  let m = s.match(/docs\.google\.com\/document\/d\/e\//i);
  if (m) throw new Error('that is a "Publish to the web" link; use the Share link from the Share button instead');
  m = s.match(/docs\.google\.com\/document\/d\/([\w-]+)/i) || s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([\w-]+)/i);
  if (m) return `https://docs.google.com/document/d/${m[1]}/export?format=md`;
  if (/^https?:\/\//i.test(s)) return s; // any direct link to a .md file
  throw new Error('content_url should be a Google Docs share link or a web address starting with https://');
}

export async function fetchRemoteContent(url, root, warn = () => {}) {
  const exportUrl = resolveContentUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(exportUrl, { signal: controller.signal, redirect: 'follow', headers: { accept: 'text/markdown, text/plain, */*' } });
    if (!res.ok) throw new Error(`Google answered ${res.status} ${res.statusText} (is the document shared as "Anyone with the link"?)`);
    const text = await res.text();
    if (/<html[\s>]/i.test(text.slice(0, 500))) throw new Error('Google sent a web page instead of the document (is it shared as "Anyone with the link"?)');
    if (!text.trim()) throw new Error('the document is empty');
    // Strip Google's comment block and markers before caching, so the saved
    // copy is stable (comment tokens change on every download) and never
    // carries comment text into the repository.
    const cleaned = cleanDocExport(text.replace(/\r\n?/g, '\n'));
    return root ? extractPastedImages(root, cleaned, warn) : cleaned;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`timed out after ${TIMEOUT_MS / 1000} seconds`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Decides which Markdown the build uses. Returns { markdown, source, status }.
//   source: 'remote' | 'remote-cache' | 'local'
//   status: 'updated' | 'unchanged' | 'failed' | 'off'
export async function loadContent(root, settings, warn) {
  const localFile = path.join(root, 'content.md');
  const remoteFile = path.join(root, REMOTE_FILE);
  const url = String(settings.site.content_url || '').trim();
  const readLocal = () => (fs.existsSync(localFile) ? fs.readFileSync(localFile, 'utf8') : (warn('content.md not found; the story is empty'), ''));

  if (!url) return { markdown: readLocal(), source: 'local', status: 'off' };

  const cached = fs.existsSync(remoteFile) ? fs.readFileSync(remoteFile, 'utf8') : null;
  try {
    const markdown = await fetchRemoteContent(url, root, warn);
    const changed = markdown !== cached;
    if (changed) fs.writeFileSync(remoteFile, markdown);
    console.log(`  story read from Google Docs (${changed ? 'updated' : 'unchanged'}); edits to content.md are ignored while content_url is set`);
    return { markdown, source: 'remote', status: changed ? 'updated' : 'unchanged' };
  } catch (err) {
    if (cached !== null) {
      warn(`Could not download the Google Doc (${err.message}). Using the last copy that did download, ${REMOTE_FILE}.`);
      return { markdown: cached, source: 'remote-cache', status: 'failed' };
    }
    warn(`Could not download the Google Doc (${err.message}) and no earlier copy exists. Using content.md instead.`);
    return { markdown: readLocal(), source: 'local', status: 'failed' };
  }
}
