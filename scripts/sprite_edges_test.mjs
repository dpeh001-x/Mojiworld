#!/usr/bin/env node
// Prove data/sprite_edges.js is a drop-in answer, not an approximation.
//
// The whole premise of precomputing this table is that generating it in
// headless Chromium with the game's own drawImage+getImageData path reproduces
// what the live probe would compute -- unlike sharp, whose resampler differs
// (which is why gen_sprite_bbox.mjs deliberately left edge data out).
//
// This runs the LIVE probe in a FRESH browser launch and compares against the
// stored table. A mismatch means the premise is wrong and the table must not
// ship. Sampling is spread across the whole sorted file list so every sprite
// tree is represented.
//
//   node scripts/sprite_edges_test.mjs [--n=400]
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const N = +((process.argv.find((a) => a.startsWith('--n=')) || '').split('=')[1] || 400);
const src = readFileSync('C:/Users/dpeh0/Mojiworld/data/sprite_edges.js', 'utf8');
// Anchor on the assignment: the header comment contains braces of its own
// (the Sprites/{monsters,bosses,...} regenerate hint), so indexOf('{') lands
// inside a comment rather than on the payload.
const MARK = 'window.LX_SPRITE_EDGES = ';
const TABLE = JSON.parse(src.slice(src.indexOf(MARK) + MARK.length, src.lastIndexOf('}') + 1));
const allKeys = Object.keys(TABLE);
const step = Math.max(1, Math.floor(allKeys.length / N));
const keys = [];
for (let i = 0; i < allKeys.length && keys.length < N; i += step) keys.push(allKeys[i]);
console.log('table entries: ' + allKeys.length + ', verifying ' + keys.length + ' in a fresh browser');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
// A page created with setContent alone has no file:// origin, so every
// file:/// image load is blocked and the probe silently reads nothing.
// Navigate to a real file URL first (this is what the generator does).
await page.goto('file:///C:/Users/dpeh0/Mojiworld/data/', { waitUntil: 'domcontentloaded' }).catch(() => {});

const CHUNK = 150;
const live = {};
for (let i = 0; i < keys.length; i += CHUNK) {
  const got = await page.evaluate(async (batch) => {
    const S = 48;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: true });
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
      if (!img || !img.naturalWidth) { out[rel] = '__MISSING__'; continue; }
      try { if (img.decode) await img.decode(); } catch (e) {}
      const v = probe(img);
      out[rel] = (v === '|||') ? '' : v;
    }
    return out;
  }, keys.slice(i, i + CHUNK));
  Object.assign(live, got);
}
await browser.close();

let ok = 0, bad = 0, missing = 0;
const diffs = [];
for (const k of keys) {
  const l = live[k], t = TABLE[k];
  if (l === '__MISSING__') { missing++; continue; }
  if (l === t) ok++;
  else { bad++; if (diffs.length < 10) diffs.push({ k, table: t, live: l }); }
}
console.log('\n  identical : ' + ok);
console.log('  differing : ' + bad);
console.log('  unreadable: ' + missing);
for (const d of diffs) console.log('    ' + d.k + '\n      table ' + JSON.stringify(d.table) + '\n      live  ' + JSON.stringify(d.live));
if (bad) { console.error('\nFAIL — the table does not reproduce the live probe.'); process.exit(1); }
console.log('\nPASS — the table reproduces the live probe exactly.');
