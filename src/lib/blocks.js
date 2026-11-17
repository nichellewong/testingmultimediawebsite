// Parses the contents of a fenced code block in content.md.
//
//   embed: image            <- "key: value" option lines come first
//   source: photo.jpg
//   caption: A nice photo
//                           <- a blank line (or a line that is not an option) ends the options
//   <iframe ...></iframe>   <- everything after that is the "body"
import { straightQuotes } from './util.js';

const OPTION_RE = /^([a-z][a-z0-9_-]*):(?:[ \t]+(.*))?$/;
const STEP_RE = /^\s*-{3,}\s*$/;

export function parseBlock(raw = '') {
  const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  const options = {};
  for (; i < lines.length; i++) {
    const m = lines[i].match(OPTION_RE);
    if (!m) break;
    const key = m[1].replace(/-/g, '_');
    let value = straightQuotes((m[2] ?? '').trim());
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    options[key] = value;
  }

  while (i < lines.length && lines[i].trim() === '') i++;
  const body = lines.slice(i).join('\n').trimEnd();
  return { options, body };
}

// Splits a body into steps separated by lines of three or more dashes.
// Each step is parsed like a block of its own (options, then text).
export function splitSteps(body = '') {
  const chunks = String(body).split(new RegExp(STEP_RE.source, 'm'));
  return chunks
    .map((chunk) => parseBlock(chunk))
    .filter((step) => Object.keys(step.options).length > 0 || step.body.trim() !== '');
}

// size: full | large | text | <number>   (number = percent of the text width)
export function parseSize(value, fallback = 'large') {
  const v = String(value ?? '').toLowerCase().trim() || fallback;
  if (v === 'full' || v === 'large' || v === 'text') return { kind: v };
  if (v === 'wide') return { kind: 'large' };
  if (v === 'column' || v === 'narrow') return { kind: 'text' };
  const n = parseFloat(v);
  if (Number.isFinite(n) && n > 0) return { kind: 'custom', percent: n };
  return { kind: fallback, invalid: true };
}

export function detectEmbedName(block) {
  const o = block.options;
  if (o.embed) {
    const name = String(o.embed).toLowerCase().trim();
    // "embed: storymap" with Knight Lab's <iframe> code pasted in and no
    // source: file is just embed code, so show it like any other.
    if ((name === 'storymap' || name === 'storymapjs') && !(o.source || o.src || o.file) && block.body.trim().startsWith('<')) return 'html';
    return name;
  }
  if (o.type) return String(o.type).toLowerCase().trim();
  if (block.body.trim()) return 'html';
  if (o.source || o.src || o.file) return 'image';
  return '';
}
