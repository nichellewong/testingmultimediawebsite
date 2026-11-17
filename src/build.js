#!/usr/bin/env node
// Builds the story into _site/.
//
//   npm run build        -> one build (used by GitHub Actions)
//   npm start            -> build, watch, and preview (see src/dev.js)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import MarkdownIt from 'markdown-it';
import { loadSettings } from './lib/settings.js';
import { loadFonts } from './lib/fonts.js';
import { loadEmbeds } from './embeds/index.js';
import { createMarkdown, renderContent, renderEmbedBlock, markEmbed } from './lib/content.js';
import { detectEmbedName } from './lib/blocks.js';
import { errorBox, applyCustomAttrs, FLOAT_MARK } from './lib/html.js';
import { cleanAssetPath } from './lib/images.js';
import { renderOpener, renderPage } from './lib/page.js';
import { cssVars } from './lib/theme.js';
import { ensureDir, copyDirIfNewer, copyIfNewer, readIfExists } from './lib/util.js';
import { loadContent } from './lib/remote.js';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function build({ root = PROJECT_ROOT, dev = false, clean = false } = {}) {
  const outDir = path.join(root, '_site');
  const warnings = [];
  const warn = (message) => {
    if (warnings.includes(message)) return;
    warnings.push(message);
    console.warn(`  ! ${message}`);
  };

  if (clean) fs.rmSync(outDir, { recursive: true, force: true });
  ensureDir(outDir);

  const settings = loadSettings(root, warn);
  const fonts = loadFonts(root, settings, warn);
  const embeds = await loadEmbeds(root, { bust: dev });
  const plainMd = new MarkdownIt({ html: true, linkify: true, typographer: true });

  const ctx = {
    root,
    outDir,
    dev,
    settings,
    fonts,
    embeds,
    warn,
    warnings,
    used: new Set(),
    counters: {},
    deferred: [],
    imageMeta: new Map(),
    imageJobs: new Map(),
    shareImage: '',

    use(name) {
      this.used.add(name);
    },
    nextId(prefix) {
      this.counters[prefix] = (this.counters[prefix] || 0) + 1;
      return `${prefix}-${this.counters[prefix]}`;
    },
    // URL for a file in assets/, with a warning if it does not exist.
    assetUrl(rel) {
      const clean = cleanAssetPath(rel);
      if (!clean || !fs.existsSync(path.join(root, 'assets', clean))) warn(`File not found: assets/${clean || '(empty)'}`);
      return 'assets/' + clean.split('/').map(encodeURIComponent).join('/');
    },
    renderInline(text) {
      return plainMd.renderInline(String(text ?? ''));
    },
    renderMarkdown(text) {
      return plainMd.render(String(text ?? ''));
    },
    // Embed rendering is async (image resizing); markdown-it is not.
    // Each embed leaves a placeholder that is filled in afterwards.
    defer(promise) {
      const i = this.deferred.push(promise) - 1;
      return `<!--deferred:${i}-->`;
    },
    async resolveDeferred(html) {
      const results = await Promise.all(this.deferred);
      return html.replace(/<!--deferred:(\d+)-->/g, (_, i) => results[Number(i)]);
    },
    renderEmbed(options, body, name) {
      name = name || detectEmbedName({ options, body });
      const def = embeds.get(name);
      if (!def) {
        warn(`Unknown embed type "${name}". Available: ${[...new Set([...embeds.values()].map((d) => d.name))].join(', ')}`);
        return markEmbed(errorBox(`"${name}" is not an embed type this template knows.`));
      }
      this.use(def.name);
      return this.defer(
        (async () => {
          try {
            let html = await def.render({ options, body, name: def.name }, this);
            const floated = html.startsWith(FLOAT_MARK);
            if (floated) html = html.slice(FLOAT_MARK.length);
            html = applyCustomAttrs(html, options);
            // Floated embeds stay inside the text run so paragraphs wrap them.
            return floated ? html : markEmbed(html);
          } catch (err) {
            warn(`The ${def.name} embed failed: ${err.message}`);
            if (dev) console.error(err);
            return markEmbed(errorBox(`The ${def.name} embed could not be built: ${err.message}`));
          }
        })()
      );
    },
    renderEmbedBlock(raw) {
      return renderEmbedBlock(this, raw);
    },
    // Renders one embed for use inside another (grid cells). Returns plain
    // HTML with no markers or placeholders.
    async renderChild(options, body) {
      const name = detectEmbedName({ options, body });
      const def = embeds.get(name);
      if (!def) {
        warn(`Unknown embed type "${name}" inside a grid`);
        return errorBox(`"${name}" is not an embed type this template knows.`);
      }
      this.use(def.name);
      try {
        let html = await def.render({ options, body, name: def.name }, this);
        if (html.startsWith(FLOAT_MARK)) html = html.slice(FLOAT_MARK.length);
        return applyCustomAttrs(html, options);
      } catch (err) {
        warn(`The ${def.name} embed inside a grid failed: ${err.message}`);
        return errorBox(`The ${def.name} embed could not be built: ${err.message}`);
      }
    },
  };
  ctx.md = createMarkdown(ctx);

  // 1. Content: content.md, or a Google Doc when [site] content_url is set
  const content = await loadContent(root, settings, warn);
  const markdown = content.markdown;
  console.log(`  remote: ${content.status}`);

  const openerHtml = await renderOpener(ctx);
  const bodyHtml = await renderContent(markdown, ctx);

  // 2. Static files
  copyDirIfNewer(path.join(root, 'assets'), path.join(outDir, 'assets'));
  copyDirIfNewer(path.join(root, 'fonts'), path.join(outDir, 'fonts'));
  copyDirIfNewer(path.join(root, 'vendor', 'bootstrap'), path.join(outDir, 'vendor', 'bootstrap'));

  const usedDefs = [...new Set([...ctx.used].map((n) => embeds.get(n)))].filter(Boolean);
  const vendorCss = [];
  const vendorJs = [];
  for (const def of usedDefs) {
    for (const v of def.vendor) {
      copyDirIfNewer(path.join(root, 'vendor', v.dir), path.join(outDir, 'vendor', v.dir));
      vendorCss.push(...(v.css || []).map((f) => `vendor/${v.dir}/${f}`));
      vendorJs.push(...(v.js || []).map((f) => `vendor/${v.dir}/${f}`));
    }
  }

  // 3. CSS and JS bundles (only the embeds that are actually used are included)
  const css = [
    '/* Generated by src/build.js. Edit settings.toml or src/theme/base.css instead. */',
    fonts.css,
    cssVars(ctx),
    readIfExists(path.join(root, 'src', 'theme', 'base.css')),
    ...usedDefs.filter((d) => d.styleCss).map((d) => `/* embed: ${d.name} */\n${d.styleCss}`),
  ]
    .filter(Boolean)
    .join('\n\n');

  const js = [
    '/* Generated by src/build.js. */',
    readIfExists(path.join(root, 'src', 'theme', 'base.js')),
    ...usedDefs.filter((d) => d.clientJs).map((d) => `/* embed: ${d.name} */\n(function () {\n${d.clientJs}\n})();`),
  ].join('\n\n');

  fs.writeFileSync(path.join(outDir, 'site.css'), css);
  fs.writeFileSync(path.join(outDir, 'site.js'), js);

  // Optional custom.css written by the student, linked after everything else.
  const customCss = path.join(root, 'custom.css');
  const hasCustomCss = fs.existsSync(customCss);
  if (hasCustomCss) fs.copyFileSync(customCss, path.join(outDir, 'custom.css'));

  // Builder pages in src/tools/ are published at /tools/. Placeholders let
  // them share the site's fonts, variables and embed styles.
  const toolsDir = path.join(root, 'src', 'tools');
  if (fs.existsSync(toolsDir)) {
    const siteCss = [fonts.css, cssVars(ctx)].join('\n').replace(/url\("fonts\//g, 'url("../fonts/');
    ensureDir(path.join(outDir, 'tools'));
    for (const file of fs.readdirSync(toolsDir)) {
      const from = path.join(toolsDir, file);
      if (!fs.statSync(from).isFile()) continue;
      if (file.endsWith('.html')) {
        let page = fs.readFileSync(from, 'utf8');
        page = page.replace('<!-- @site-css -->', `<style>${siteCss}</style>`);
        page = page.replace(/<!-- @embed-style (\w+) -->/g, (m, name) => `<style>${embeds.get(name)?.styleCss || ''}</style>`);
        fs.writeFileSync(path.join(outDir, 'tools', file), page);
      } else {
        copyIfNewer(from, path.join(outDir, 'tools', file));
      }
    }
  }

  // 4. The page
  const html = renderPage(ctx, { openerHtml, bodyHtml, vendorCss, vendorJs, customCss: hasCustomCss });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

  return { warnings, used: usedDefs.map((d) => d.name), outDir, content: { source: content.source, status: content.status } };
}

const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  const started = Date.now();
  console.log('Building the story...');
  const dev = process.argv.includes('--dev');
  build({ clean: !dev, dev })
    .then((result) => {
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`Done in ${secs}s. Embeds used: ${result.used.join(', ') || 'none'}.`);
      if (result.warnings.length) console.log(`${result.warnings.length} warning(s) above are worth a look, but the site still built.`);
    })
    .catch((err) => {
      console.error('\nBuild failed: ' + err.message);
      process.exit(1);
    });
}
