// The updated Astral Judgement frames load, animate, and their baked data matches.
// ============================================================================
// Post-art-drop check for Sprites/bosses/attack/aetherionastral_0..8:
//   1. all 9 frames decode in-engine (a 404 or broken frame shows as a hole
//      mid-cast and is invisible in a static file listing)
//   2. the set is uniform 1656x1325 — the renderer derives draw size from the
//      source long edge, so one odd frame would resize the boss mid-animation
//   3. the shipped edge table matches the art the engine actually loads
//      (stale entries feather the wrong spans)
//   4. the frame index still says 9, and the authored calib is intact
// Run: node scripts/aetherionastral_art_test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

// ---- baked data ------------------------------------------------------------
const idx = readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8');
const cnt = idx.match(/aetherionastral"\s*:\s*(\d+)/);
ok('the frame index still declares 9 frames', cnt && +cnt[1] === 9, `index says ${cnt ? cnt[1] : '?'}`);
const cal = readFileSync(path.join(ROOT, 'data', 'anim_calib.js'), 'utf8');
const ci = cal.indexOf('"aetherionastral"');
let blk = ''; { let d = 0, st = cal.indexOf('{', ci); for (let i = st; i < cal.length && ci >= 0; i++) { const c = cal[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { blk = cal.slice(ci, i + 1); break; } } } }
ok('the authored attack calibration is present and untouched', /"attack"/.test(blk) && /"s"\s*:\s*[0-9.]+/.test(blk),
   blk.replace(/\s+/g, ' ').slice(0, 90));

const PORT = Number(process.env.PORT || 11241);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const bad404 = [];
page.on('response', (r) => { if (r.status() >= 400 && /aetherionastral/.test(r.url())) bad404.push(r.url().split('/').pop()); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);

const R = await page.evaluate(async () => {
  // Load every frame the way the engine does and report decoded dimensions.
  const out = [];
  for (let i = 0; i < 9; i++) {
    const im = await new Promise((r) => {
      const x = new Image();
      x.onload = () => r(x); x.onerror = () => r(null);
      x.src = 'Sprites/bosses/attack/aetherionastral_' + i + '.webp';
    });
    out.push(im ? { i, w: im.naturalWidth, h: im.naturalHeight } : { i, w: 0, h: 0 });
  }
  // What does the runtime edge table answer for these frames?
  const tbl = (typeof window.LX_SPRITE_EDGES === 'object') ? window.LX_SPRITE_EDGES : null;
  const edges = {};
  if (tbl) for (let i = 0; i < 9; i++) edges[i] = tbl['bosses/attack/aetherionastral_' + i + '.webp'];
  // Same probe as scripts/gen_sprite_edges.mjs: 48x48 canvas, alpha>24, n>1.
  const S = 48;
  const cv = document.createElement("canvas"); cv.width = S; cv.height = S;
  const g = cv.getContext("2d", { willReadFrequently: true });
  const mismatch = [];
  for (let f = 0; f < 9; f++) {
    const im = out[f] && out[f].w ? await new Promise((r) => { const x = new Image(); x.onload = () => r(x); x.onerror = () => r(null); x.src = "Sprites/bosses/attack/aetherionastral_" + f + ".webp"; }) : null;
    if (!im) { mismatch.push("f" + f + ": did not decode"); continue; }
    g.clearRect(0, 0, S, S); g.drawImage(im, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data;
    const a = (x, y) => d[(y * S + x) * 4 + 3];
    const scan = (get) => { let n = 0, first = -1, last = -1; for (let k = 0; k < S; k++) if (get(k) > 24) { n++; if (first < 0) first = k; last = k; } return n > 1 ? (n + ":" + first + ":" + last) : ""; };
    const v = [scan((k) => a(0, k)), scan((k) => a(S - 1, k)), scan((k) => a(k, 0)), scan((k) => a(k, S - 1))].join("|");
    const now = (v === "|||") ? "" : v;
    if (edges[f] !== now) mismatch.push("f" + f + ": table " + JSON.stringify(edges[f]) + " vs art " + JSON.stringify(now));
  }
  return { frames: out, edges, hasTable: !!tbl, mismatch };
});
await browser.close(); server.kill();

const decoded = R.frames.filter((f) => f.w > 0);
const dims = [...new Set(decoded.map((f) => f.w + 'x' + f.h))];
console.log(`  decoded ${decoded.length}/9 frames, dimensions: ${dims.join(', ')}`);
console.log(`  runtime edge entries: ${JSON.stringify(R.edges)}`);
ok('all 9 frames decode in-engine', decoded.length === 9 && bad404.length === 0,
   `${decoded.length}/9 decoded${bad404.length ? ', 404s: ' + bad404.join(',') : ''}`);
ok('the set is dimensionally uniform (no mid-animation resize)', dims.length === 1, dims.join(' / '));
ok('CONTROL: the runtime actually loaded the edge table', R.hasTable);

// The table is generated by the BROWSER probe (canvas drawImage into 48x48).
// A sharp resample is a DIFFERENT resampler and disagrees by a pixel on
// borderline frames — the first version of this test called that "stale" and
// failed a correct table. Probe the same way the generator does, in-page.
ok("the shipped edge table matches a fresh in-browser probe (not stale)",
   R.mismatch.length === 0,
   R.mismatch.slice(0, 4).join("; ") || "all 9 frames agree under the generator's own probe");

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
