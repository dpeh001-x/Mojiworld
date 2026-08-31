// Post-art-drop verification for any boss animation set.
// ============================================================================
// An art drop invalidates baked data, and the failures are invisible in a file
// listing: a frame that 404s is a hole mid-cast, one odd-sized frame resizes
// the boss mid-animation (the renderer derives draw size from the source long
// edge), and a stale edge entry feathers the wrong span.
//
// Checks, per set named in LX_SETS (comma separated, default the gravitos2
// pair):
//   1. every frame the frame-index promises actually decodes in-engine
//   2. the set is dimensionally uniform
//   3. the frame index count matches the files on disk
//   4. the shipped edge table matches a fresh probe run THE SAME WAY the
//      generator runs it — in-page canvas, not a sharp resample. The two
//      resamplers disagree by a pixel on borderline frames, which once made
//      this suite call a correct table stale.
// Run: node scripts/art_drop_test.mjs
//      LX_SETS=gravitos2laser,gravitos2punch node scripts/art_drop_test.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SETS = (process.env.LX_SETS || 'gravitos2laser,gravitos2punch').split(',').map((s) => s.trim()).filter(Boolean);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

const idx = readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8');
const onDisk = {};
for (const set of SETS) {
  let n = 0;
  while (existsSync(path.join(ROOT, 'Sprites', 'bosses', 'attack', `${set}_${n}.webp`))) n++;
  onDisk[set] = n;
  // String.raw + JSON.stringify: a heredoc-written '\\s' collapses to '\s',
  // which in a plain JS string is just 's' — the pattern silently became
  // s*:*(d+) and reported every present key as ABSENT.
  const m = idx.match(new RegExp(JSON.stringify(set) + String.raw`\s*:\s*(\d+)`));
  ok(`${set}: frame index matches the files on disk`, m && +m[1] === n,
     `index ${m ? m[1] : 'ABSENT'} vs ${n} files (an absent key makes _lxFrameCount return 0 — the set would never load)`);
}

const PORT = Number(process.env.PORT || 11251);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const bad = [];
page.on('response', (r) => { if (r.status() >= 400 && SETS.some((s) => r.url().includes(s))) bad.push(r.url().split('/').pop()); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);

const R = await page.evaluate(async ({ SETS, onDisk }) => {
  const S = 48;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const tbl = (typeof window.LX_SPRITE_EDGES === 'object') ? window.LX_SPRITE_EDGES : null;
  const out = {};
  for (const set of SETS) {
    const dims = new Set(); const missing = []; const mismatch = [];
    for (let f = 0; f < onDisk[set]; f++) {
      const rel = 'bosses/attack/' + set + '_' + f + '.webp';
      const im = await new Promise((r) => { const x = new Image(); x.onload = () => r(x); x.onerror = () => r(null); x.src = 'Sprites/' + rel; });
      if (!im || !im.naturalWidth) { missing.push(f); continue; }
      dims.add(im.naturalWidth + 'x' + im.naturalHeight);
      g.clearRect(0, 0, S, S); g.drawImage(im, 0, 0, S, S);
      const d = g.getImageData(0, 0, S, S).data;
      const a = (x, y) => d[(y * S + x) * 4 + 3];
      const scan = (get) => { let n = 0, first = -1, last = -1; for (let k = 0; k < S; k++) if (get(k) > 24) { n++; if (first < 0) first = k; last = k; } return n > 1 ? (n + ':' + first + ':' + last) : ''; };
      const v = [scan((k) => a(0, k)), scan((k) => a(S - 1, k)), scan((k) => a(k, 0)), scan((k) => a(k, S - 1))].join('|');
      const now = (v === '|||') ? '' : v;
      if (tbl && tbl[rel] !== now) mismatch.push(`f${f}: table ${JSON.stringify(tbl[rel])} vs art ${JSON.stringify(now)}`);
    }
    out[set] = { dims: [...dims], missing, mismatch };
  }
  return { out, hasTable: !!tbl };
}, { SETS, onDisk });
await browser.close(); server.kill();

ok('CONTROL: the runtime loaded the edge table', R.hasTable);
for (const set of SETS) {
  const o = R.out[set];
  console.log(`  ${set}: ${onDisk[set]} frames, dims ${o.dims.join('/')}, missing [${o.missing.join(',')}], edge mismatches ${o.mismatch.length}`);
  ok(`${set}: every frame decodes in-engine`, o.missing.length === 0 && !bad.some((b) => b.includes(set)),
     o.missing.length ? 'frames ' + o.missing.join(',') + ' failed to decode' : 'all decode');
  ok(`${set}: dimensionally uniform (no mid-animation resize)`, o.dims.length === 1, o.dims.join(' / '));
  ok(`${set}: edge table matches the art (generator's own probe)`, o.mismatch.length === 0,
     o.mismatch.slice(0, 3).join('; ') || 'all frames agree');
}

let n = 0;
for (const r of res) { if (!r.pass) n++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(n ? `\n${n}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(n ? 1 : 0);
