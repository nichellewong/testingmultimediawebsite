#!/usr/bin/env node
// Local preview with live reload.
//
//   npm start      then open http://localhost:8080
//
// Rebuilds whenever content.md, settings.toml, assets/, fonts/ or src/ change
// and refreshes the browser automatically.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { PROJECT_ROOT } from './build.js';

const root = PROJECT_ROOT;
const outDir = path.join(root, '_site');
const port = Number(process.env.PORT) || 8080;
const WATCHED = ['content.md', 'settings.toml', 'custom.css', 'assets', 'fonts', 'src', 'vendor'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

const clients = new Set();
let building = false;
let queued = null;
let lastWarnings = [];
let lastError = '';

// The build runs in a separate Node process so that edits to src/ are picked
// up without restarting the preview.
function runBuild() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, 'src', 'build.js'), '--dev'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const warnings = [];
    let errorText = '';
    let remote = 'off';
    const onLine = (line) => {
      const m = line.match(/^\s*! (.*)$/);
      if (m) warnings.push(m[1]);
      else if (/^\s*remote: /.test(line)) remote = line.trim().replace('remote: ', '');
      else if (/^Build failed: /.test(line)) errorText = line.replace(/^Build failed: /, '');
      else if (line.trim() && !/^(Building|Done in|\d+ warning)|story read from Google Docs/.test(line)) console.log('  ' + line);
    };
    let buf = '';
    const consume = (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach(onLine);
    };
    child.stdout.setEncoding('utf8').on('data', consume);
    child.stderr.setEncoding('utf8').on('data', consume);
    child.on('close', (code) => {
      if (buf) onLine(buf);
      resolve({ ok: code === 0, warnings, remote, error: code === 0 ? '' : errorText || `build exited with code ${code}` });
    });
  });
}

let remoteLinked = false;

async function rebuild(reason, { quiet = false } = {}) {
  if (building) {
    queued = reason;
    return;
  }
  building = true;
  const started = Date.now();
  const result = await runBuild();
  remoteLinked = result.remote !== 'off';
  // A quiet (polling) rebuild only reloads the browser when the doc changed.
  const changed = !quiet || result.remote === 'updated' || !result.ok;
  if (changed) {
    lastWarnings = result.warnings;
    lastError = result.error;
  }
  if (!result.ok) console.error(`  build failed: ${result.error}`);
  else if (!quiet) console.log(`  rebuilt in ${Date.now() - started} ms (${reason})${result.warnings.length ? `, ${result.warnings.length} warning(s)` : ''}${result.remote !== 'off' ? ` [story read from Google Docs: ${result.remote}]` : ''}`);
  else if (result.remote === 'updated') console.log(`  Google Doc changed, page refreshed`);
  building = false;
  if (changed) for (const res of clients) res.write('data: reload\n\n');
  if (queued) {
    const next = queued;
    queued = null;
    rebuild(next);
  }
}

function overlay() {
  const items = [...(lastError ? [`Build failed: ${lastError}`] : []), ...lastWarnings];
  const refresh = remoteLinked
    ? `<button onclick="fetch('/__refresh');this.textContent='Refreshing...'" style="position:fixed;right:1rem;top:1rem;z-index:100000;font:14px system-ui,sans-serif;padding:.5rem .9rem;border:0;border-radius:4px;background:#1f1f1f;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.3);cursor:pointer">Re-download Google Doc</button>`
    : '';
  const list = items.length
    ? `<div id="dev-warnings" style="position:fixed;left:0;right:0;bottom:0;z-index:99999;max-height:40vh;overflow:auto;background:#fff3cd;color:#664d03;font:14px/1.4 system-ui,sans-serif;padding:.75rem 1rem;border-top:3px solid #ffc107;box-shadow:0 -4px 20px rgba(0,0,0,.15)">` +
      `<strong>Build warnings (only shown in local preview):</strong> <button onclick="this.parentNode.remove()" style="float:right">hide</button>` +
      `<ul style="margin:.5rem 0 0;padding-left:1.25rem">${items.map((w) => `<li>${w.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('')}</ul></div>`
    : '';
  return `${refresh}${list}<script>new EventSource('/__reload').onmessage=function(e){if(e.data==='reload')location.reload()};</script>`;
}

function serve(req, res) {
  try {
    serveFile(req, res);
  } catch (err) {
    console.error(`  request failed (${req.url}): ${err.message}`);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error: ' + err.message);
  }
}

function serveFile(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Bad request');
    return;
  }
  if (urlPath === '/__refresh') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('refreshing');
    rebuild(remoteLinked ? 'refresh button, Google Doc re-downloaded' : 'refresh button');
    return;
  }
  if (urlPath === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('data: connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let file = path.join(outDir, urlPath);
  if (!file.startsWith(outDir)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`Not found: ${urlPath}`);
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  if (ext === '.html') {
    const html = fs.readFileSync(file, 'utf8').replace('</body>', `${overlay()}\n</body>`);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(html);
    return;
  }
  // Videos need range requests so the browser can seek.
  const stat = fs.statSync(file);
  const range = req.headers.range;
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10) || 0;
    const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store' });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

console.log('Building the story...');
await rebuild('startup');

let timer = null;
fs.watch(root, { recursive: true }, (event, file) => {
  if (!file) return;
  const top = file.split(path.sep)[0];
  if (!WATCHED.includes(top)) return;
  if (/(^|\/)(\.DS_Store|.*~|\.#.*|.*\.swp)$/.test(file)) return;
  clearTimeout(timer);
  timer = setTimeout(() => rebuild(file), 200);
});

// Manual refresh: press Enter in the terminal (re-downloads a linked Google Doc).
if (process.stdin.isTTY) {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', () => rebuild(remoteLinked ? 'manual refresh, Google Doc re-downloaded' : 'manual refresh'));
  process.stdin.resume();
}

http.createServer(serve).listen(port, () => {
  console.log(`\nPreview your story at  http://localhost:${port}\n`);
  console.log('Edit content.md or settings.toml and the page refreshes by itself. Press Ctrl+C to stop.');
  if (remoteLinked) console.log('The story is linked to a Google Doc: press Enter here (or the button in the preview) to download it again.');
  console.log('');
});
