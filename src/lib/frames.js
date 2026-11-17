// Extracts JPEG frames from a video with ffmpeg (for scroll-video "frames" mode).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ensureDir, copyDirIfNewer, shortHash } from './util.js';

function has(cmd) {
  const r = spawnSync(cmd, ['-version'], { stdio: 'ignore' });
  return !r.error && r.status === 0;
}

export function videoDuration(abs) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', abs], { encoding: 'utf8' });
  const n = parseFloat(r.stdout);
  return Number.isFinite(n) ? n : 0;
}

export function extractFrames(ctx, clean, { fps = 8, maxFrames = 400, width = 1280 } = {}) {
  const abs = path.join(ctx.root, 'assets', clean);
  if (!has('ffmpeg') || !has('ffprobe')) {
    ctx.warn(`mode: frames needs ffmpeg installed on the computer that builds the site; falling back to video mode for ${clean}`);
    return null;
  }
  const duration = videoDuration(abs);
  if (!duration) {
    ctx.warn(`Could not read the length of ${clean}; falling back to video mode`);
    return null;
  }
  let useFps = fps;
  if (duration * fps > maxFrames) {
    useFps = Math.max(1, Math.floor((maxFrames / duration) * 100) / 100);
    ctx.warn(`${clean} is ${duration.toFixed(1)}s long; lowered frame rate to ${useFps} fps to stay under max_frames: ${maxFrames}`);
  }
  const stat = fs.statSync(abs);
  const key = `${path.basename(clean, path.extname(clean)).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}-${shortHash(`${clean}:${stat.mtimeMs}:${stat.size}:${useFps}:${width}`)}`;
  const cacheDir = path.join(ctx.root, '.cache', 'frames', key);
  const outDir = path.join(ctx.outDir, 'assets', '_frames', key);

  if (!fs.existsSync(cacheDir) || fs.readdirSync(cacheDir).length === 0) {
    ensureDir(cacheDir);
    console.log(`  extracting frames from ${clean} at ${useFps} fps (one-time, cached in .cache/)`);
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', abs, '-vf', `fps=${useFps},scale=${width}:-2`, '-q:v', '4', '-start_number', '1', path.join(cacheDir, '%04d.jpg')], { encoding: 'utf8' });
    if (r.status !== 0) {
      ctx.warn(`ffmpeg failed on ${clean}: ${(r.stderr || '').trim()}`);
      fs.rmSync(cacheDir, { recursive: true, force: true });
      return null;
    }
  }
  copyDirIfNewer(cacheDir, outDir);
  const count = fs.readdirSync(cacheDir).filter((f) => f.endsWith('.jpg')).length;
  return { base: `assets/_frames/${key}`, count, pad: 4, ext: 'jpg', fps: useFps, duration };
}

// "1920x1080" for a video in assets/, or "" when ffprobe is not available.
export function videoAspect(ctx, rel) {
  const clean = String(rel || '').replace(/^\.?\//, '').replace(/^assets\//, '');
  const abs = path.join(ctx.root, 'assets', clean);
  if (!fs.existsSync(abs) || !has('ffprobe')) return '';
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', abs], { encoding: 'utf8' });
  const m = (r.stdout || '').trim().match(/^(\d+),(\d+)/);
  return m ? `${m[1]}x${m[2]}` : '';
}
