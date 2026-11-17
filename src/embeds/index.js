// Loads every embed module in src/embeds/<name>/.
//
// Each module folder contains:
//   index.js   -> export default { name, description, vendor?, aliases?, render(block, ctx) }
//   client.js  -> (optional) browser code, bundled into site.js only when the embed is used
//   style.css  -> (optional) styles, bundled into site.css only when the embed is used
//
// To add a new embed type, create a new folder with those files. Nothing else
// needs to be registered.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readIfExists } from '../lib/util.js';

export async function loadEmbeds(root, { bust = false } = {}) {
  const dir = path.join(root, 'src', 'embeds');
  const registry = new Map();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(dir, entry.name);
    const indexFile = path.join(folder, 'index.js');
    if (!fs.existsSync(indexFile)) continue;
    const url = pathToFileURL(indexFile).href + (bust ? `?t=${Date.now()}` : '');
    const mod = (await import(url)).default;
    if (!mod || typeof mod.render !== 'function') {
      throw new Error(`src/embeds/${entry.name}/index.js must export default { render() }`);
    }
    const name = (mod.name || entry.name).toLowerCase();
    const def = {
      ...mod,
      name,
      folder,
      clientJs: readIfExists(path.join(folder, 'client.js')),
      styleCss: readIfExists(path.join(folder, 'style.css')),
      vendor: mod.vendor || [],
    };
    registry.set(name, def);
    for (const alias of mod.aliases || []) registry.set(String(alias).toLowerCase(), def);
  }
  return registry;
}
