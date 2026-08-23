#!/usr/bin/env node
// Precompute the sprite EDGE-FEATHER probe into data/sprite_edges.js.
//
// WHY: _lxEdgesTouched costs 832 ms of main-thread time in the first six
// seconds after entering the forest -- the largest single contributor to
// map-entry stutter, and the reason a fresh map runs ~33 ms/frame for about
// four seconds before settling to the 16.7 ms floor. The probe already reads
// only 48x48; the cost is the drawImage(img, 0,0,48,48) resample of a 768 px
// webp, which in software costs ~13 ms per cold sprite and cannot be made
// cheap without changing the answer.
//
// WHY THIS IS NOW POSSIBLE. gen_sprite_bbox.mjs states that edge data is
// deliberately NOT precomputed, because "that probe downscales to 48x48
// through the browser's own resampler, and sharp's resize would not match it
// pixel for pixel. Wrong feather is a visible regression." That objection is
// correct and was verified independently: off-thread createImageBitmap resizes
// shift the severity fraction on ~5% of sprites even on rendered edges.
//
// The objection is specific to resampling with sharp. This generator runs the
// probe in headless Chromium using THE SAME drawImage + getImageData path the
// game uses, so the table is what the runtime would have computed, not an
// approximation of it. On Chromium -- the web build and the Electron/Steam
// build -- that is exact by construction. Other engines fall back to their own
// live probe for anything not in the table.
//
//   node scripts/gen_sprite_edges.mjs           # write data/sprite_edges.js
//   node scripts/gen_sprite_edges.mjs --check   # exit 1 if the table is stale
//
// ENCODING. Values are stored as the raw 48-sample integers the probe derives
// f/a/b from, not as floats: f = n/48, a = first/48, b = (last+1)/48. Integers
// round-trip exactly, so the table cannot drift from the live probe through
// decimal truncation. Per sprite: "L|R|T|B", each edge "n:first:last" or empty
// when that edge is clean. A sprite with no cut edges stores "". A sprite
// ABSENT from the table is unknown, not clean, and still probes live.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = 'C:/Users/dpeh0/Mojiworld';
const OUT = join(ROOT, 'data', 'sprite_edges.js');
const CHECK = process.argv.includes('--check');
// Every tree whose sprites can reach the feather probe.
const DIRS = ['monsters', 'bosses', 'objects', 'npc', 'fx', 'vfx', 'projectiles', 'summons'];
const SKIP = (n) => n.startsWith('_') || /backup/i.test(n) || /^pre_\d/.test(n) || n === 'Todo list';

const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (SKIP(e.name)) continue;
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.webp') || e.name.endsWith('.png')) files.push(p);
  }
};
for (const d of DIRS) { const p = join(ROOT, 'Sprites', d); if (existsSync(p)) walk(p); }
files.sort();
const keys = files.map((f) => f.split('\\').join('/').split('Sprites/')[1]);
console.log('sprites to probe: ' + keys.length);

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.goto('file:///C:/Users/dpeh0/Mojiworld/data/', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.setContent('<body></body>');

const CHUNK = 150;
const table = {};
for (let i = 0; i < keys.length; i += CHUNK) {
  const batch = keys.slice(i, i + CHUNK);
  const got = await page.evaluate(async (batch) => {
    const S = 48;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: true });
    // Replicated EXACTLY from _lxEdgesTouched in mojiworld_game.html: same 48px
    // probe, same alpha threshold of 24, same "more than one sample" rule.
    const probe = (img) => {
      g.clearRect(0, 0, S, S);
      g.drawImage(img, 0, 0, S, S);
      const d = g.getImageData(0, 0, S, S).data;
      const a = (x, y) => d[(y * S + x) * 4 + 3];
      const scan = (get) => {
        let n = 0, first = -1, last = -1;
        for (let i = 0; i < S; i++) if (get(i) > 24) { n++; if (first < 0) first = i; last = i; }
        return n > 1 ? (n + ':' + first + ':' + last) : '';
      };
      return [scan((i) => a(0, i)), scan((i) => a(S - 1, i)),
              scan((i) => a(i, 0)), scan((i) => a(i, S - 1))].join('|');
    };
    const out = {};
    for (const rel of batch) {
      const img = await new Promise((r) => {
        const im = new Image();
        im.onload = () => r(im); im.onerror = () => r(null);
        im.src = 'file:///C:/Users/dpeh0/Mojiworld/Sprites/' + rel;
      });
      if (!img || !img.naturalWidth) continue;      // 404 / broken: leave absent
      try { if (img.decode) await img.decode(); } catch (e) {}
      const v = probe(img);
      out[rel] = (v === '|||') ? '' : v;            // no cut edges -> clean
    }
    return out;
  }, batch);
  Object.assign(table, got);
  process.stdout.write('  probed ' + Math.min(i + CHUNK, keys.length) + '/' + keys.length + '\r');
}
await browser.close();
console.log('\nprobed ' + Object.keys(table).length + ' sprites; ' +
            Object.values(table).filter((v) => v === '').length + ' clean');

const body = '// GENERATED by scripts/gen_sprite_edges.mjs — do not hand-edit.\n' +
  '// Edge-feather probe results per sprite: "L|R|T|B", each edge "n:first:last"\n' +
  '// on a 48-sample border scan (f = n/48, a = first/48, b = (last+1)/48), empty\n' +
  '// when that edge is not cut. "" means no cut edges at all. A sprite ABSENT\n' +
  '// from this table is unknown, not clean, and still probes live at runtime.\n' +
  '// Runtime reads this instead of a per-sprite getImageData probe; see\n' +
  '// _lxEdgesTouched in mojiworld_game.html. Regenerate after any art drop under\n' +
  '// Sprites/{monsters,bosses,objects,npc,fx,vfx,projectiles,summons}:\n' +
  '//   node scripts/gen_sprite_edges.mjs\n' +
  'window.LX_SPRITE_EDGES = ' + JSON.stringify(table) + ';\n';

if (CHECK) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur !== body) { console.error('data/sprite_edges.js is STALE — run: node scripts/gen_sprite_edges.mjs'); process.exit(1); }
  console.log('data/sprite_edges.js is up to date.');
} else {
  writeFileSync(OUT + '.tmp', body, 'utf8');
  const { renameSync } = await import('node:fs');
  renameSync(OUT + '.tmp', OUT);
  console.log('wrote ' + OUT + '  (' + (body.length / 1024).toFixed(0) + ' KB)');
}
