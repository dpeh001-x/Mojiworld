// The nav icons are SHIPPED, not merely committed: served over HTTP, listed in
// the offline cache-warm manifest, and inside the Electron build's file filter.
// Per user: "ensure the icons get shipped".
// Run: node scripts/nav_icons_ship_test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PORT = 9195;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1400));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
const KEYS = ['map', 'quest', 'codex', 'mojidex'];

// 1. served over HTTP as real image bytes
const served = [];
for (const k of KEYS) {
  try {
    const r = await fetch(`http://localhost:${PORT}/Sprites/ui/nav/${k}.webp`);
    const buf = Buffer.from(await r.arrayBuffer());
    // RIFF....WEBP magic — proves it is an image, not an HTML 404 page
    const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
    served.push({ k, status: r.status, bytes: buf.length, isWebp });
  } catch (e) { served.push({ k, status: 'ERR', bytes: 0, isWebp: false }); }
}
ok('all four are served over HTTP as real WebP bytes',
   served.every(s => s.status === 200 && s.isWebp && s.bytes > 2000),
   served.map(s => `${s.k}:${s.status}/${s.bytes}b`).join(' '));

// 2. in the offline cache-warm manifest
const man = JSON.parse(readFileSync(path.join(ROOT, 'data', 'assets_manifest.json'), 'utf8'));
ok('all four are in data/assets_manifest.json (offline pre-cache)',
   KEYS.every(k => man.includes(`Sprites/ui/nav/${k}.webp`)),
   man.filter(p => p.includes('ui/nav/')).length + ' of 4 listed, manifest has ' + man.length + ' assets');
ok('the manifest carries no stale entries and no backup files',
   man.every(p => !p.split('/').some(s => s.startsWith('_'))),
   man.filter(p => p.split('/').some(s => s.startsWith('_'))).length + ' backup paths');

// 3. inside the Electron/Steam build filter
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'steam', 'package.json'), 'utf8'));
const extra = (pkg.build && pkg.build.extraResources) || [];
const appRes = extra.find(e => e && e.to === 'app');
const filt = (appRes && appRes.filter) || [];
ok('the desktop build ships Sprites/** (covers the new directory)',
   filt.includes('Sprites/**'), filt.filter(f => /Sprites/.test(f)).join(', ') || 'NOT FOUND');
ok('the desktop build ships data/assets_manifest.json',
   filt.includes('data/assets_manifest.json'), String(filt.includes('data/assets_manifest.json')));

// 4. the game references exactly these paths
const html = readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
ok('the game references all four by their shipped path',
   KEYS.every(k => html.includes(`Sprites/ui/nav/${k}.webp`)),
   KEYS.filter(k => html.includes(`Sprites/ui/nav/${k}.webp`)).join(', '));

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
server.kill();
process.exit(failed ? 1 : 0);
