#!/usr/bin/env node
// Sprites/vfx/sovereign_drain_pillar.webp — the Sovereign's HP/MP drain column, redrawn cel-shaded.
// ============================================================================
// Per user, with a screenshot of the pillar in B10: "using ludo.ai generate a better sprite for this
// column that suits the game aesthetic better".
//
// WHAT IT IS. The Sovereign of the Spire raises three drain pillars; anything they touch has its HP
// and MP set to 1. The engine draws this file stretched into the pillar band - h.w (90 px) wide by
// the full screen height - and paints the pulsing edge lines, the golden particle rain and the
// HP/MP->1 label itself. So the sprite is the column body only, and it is squashed roughly 2.5x
// narrower than it is authored: the motif has to be vertical bands that survive that.
//
// WHY THE SHIPPED ONE READS WRONG. v0.29.316 authored it as "golden ribbons siphoned upward with a
// bright crown of light at the top", and that is what it is - but rendered as soft, photoreal light:
// hair-thin ribbons, airbrushed glow, no outline, no colour steps. Every other effect in the game is
// cel-shaded: bold flat colour bands, hard-edged steps, a dark rim. The measurable difference is
// CONCENTRATION: flat fills put most of a column's interior pixels into a few luminance levels
// (the committed painterly file: 25% of them in its four commonest levels; the cel-shaded roll that
// replaced it: 48%). A first cut of this gate counted hard EDGES instead and pointed the wrong way -
// hair-thin ribbons produce more edges per pixel than bold bands do - and rejected six correct rolls.
// The stretch also turns thin ribbons into threads, which is the other half of why the screenshot
// looked like a shower of hair rather than a column.
//
// A SEPARATE FILE from scripts/generate_field_fx.mjs, which owns this entry and eleven others; that
// script is the shared recipe and is not touched. The recipe itself - ar_9_16, 512x1152, content
// fitted inside 92% of the canvas, the same STYLE suffix - is reproduced here so the result still
// belongs to the family.
//
//   node scripts/gen_sovereign_drain_pillar.mjs              # print the brief + measure the shipped file
//   node scripts/gen_sovereign_drain_pillar.mjs --generate   # needs LUDO_API_KEY
//   flags: --rolls N   --keep=<roll file>
import sharp from 'sharp';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'Sprites', 'vfx', 'sovereign_drain_pillar.webp');
const CW = 512, CH = 1152, FILL = 0.92;
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const ROLLS = Number(argOf('--rolls', '6'));

// the family suffix, verbatim from generate_field_fx.mjs so the pillar still belongs to the set
const STYLE = ' for a 2D side-scroller RPG, high quality cel-shaded anime game art, crisp banded light with clean hard-edged colour steps, glowing but not blurry, bold confident shapes, no character, no person, no creature, no weapon, no text, no UI frame, effect only, fades out softly before the image border, nothing clipped by the frame edge, transparent background';
const PROMPT =
  'A tall vertical COLUMN OF DRAINING GOLDEN ENERGY drawn in bold cel-shaded cartoon style, running '
  + 'the full height of the image. The column is built from THICK flat vertical ribbons of light in '
  + 'three clean colour steps - pale cream, warm gold, deep amber - each ribbon a solid hard-edged '
  + 'band with a dark amber outline, twisting gently as they rise. At the very TOP the ribbons gather '
  + 'into a bright CROWN OF LIGHT: a bold flat starburst with chunky rays and a small crown shape at '
  + 'its heart, the brightest part of the whole image. Small bold sparks and motes drift UPWARD along '
  + 'the ribbons, so the whole column reads as energy being pulled up and away. The centre between the '
  + 'ribbons is a darker hollow. Colours ONLY cream, gold and amber with dark amber outlines - no red, '
  + 'no blue, no purple, no green. Bold graphic shapes, flat fills, hard edges, thick outlines, '
  + 'nothing soft or airbrushed, nothing photographic,' + STYLE;

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
  return { h: (h + 360) % 360, s: mx ? d / mx : 0, v: mx / 255 };
}
async function px(buf) { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; }
async function stats(buf) {
  const p = await px(buf);
  const A = (x, y) => p.d[(y * p.w + x) * 4 + 3];
  const L = (x, y) => { const i = (y * p.w + x) * 4; return 0.299 * p.d[i] + 0.587 * p.d[i + 1] + 0.114 * p.d[i + 2]; };
  let border = 0;
  for (let x = 0; x < p.w; x++) { if (A(x, 0) > 16) border++; if (A(x, p.h - 1) > 16) border++; }
  for (let y = 0; y < p.h; y++) { if (A(0, y) > 16) border++; if (A(p.w - 1, y) > 16) border++; }
  // THREE GATES REWRITTEN AFTER LOOKING. The first cut rejected six rolls that were exactly the brief:
  //   - "off-palette" was counting AMBER (hue 10-25) as off, when amber is one of the three colours asked for;
  //   - "brightness centroid <= 42%" assumed the shipped file's sparse bottom. A full-height column
  //     of even brightness has its centroid at ~50% BY CONSTRUCTION; the crown is a PEAK at the top,
  //     so the peak row is what to measure;
  //   - "hard edges" pointed the wrong way: hair-thin painterly ribbons produce MORE luminance steps
  //     per pixel than bold flat bands do. The cel-shading signal is the opposite - concentration:
  //     flat fills put most interior pixels into a few luminance levels, gradients spread them.
  let lit = 0, gold = 0, off = 0;
  const rowL = new Array(p.h).fill(0), rowN = new Array(p.h).fill(0), hist = new Array(32).fill(0); let interior = 0;
  for (let y = 1; y < p.h - 1; y++) for (let x = 1; x < p.w - 1; x++) {
    const a = A(x, y); if (a <= 16) continue; lit++;
    const c = hsv(p.d[(y * p.w + x) * 4], p.d[(y * p.w + x) * 4 + 1], p.d[(y * p.w + x) * 4 + 2]);
    if (c.s > 0.18 && c.v > 0.2) { if (c.h >= 8 && c.h <= 62) gold++; else off++; }
    const l = L(x, y); rowL[y] += l; rowN[y]++;
    if (a > 200) { interior++; hist[Math.min(31, Math.floor(l / 8))]++; }
  }
  // the brightest band: mean luminance per row, smoothed over 3% of the height, peak position
  const win = Math.max(1, Math.round(p.h * 0.03)); let bestY = 0, bestV = -1;
  for (let y = 0; y < p.h; y++) { let s = 0, n = 0; for (let k = -win; k <= win; k++) { const yy = y + k; if (yy < 0 || yy >= p.h || !rowN[yy]) continue; s += rowL[yy] / rowN[yy]; n++; } const v = n ? s / n : 0; if (v > bestV) { bestV = v; bestY = y; } }
  // concentration: the share of interior pixels that sit in the four most-used of 32 luminance bins
  const top4 = [...hist].sort((a, b) => b - a).slice(0, 4).reduce((a, b) => a + b, 0);
  return { border, transparentPct: 100 * (1 - lit / (p.w * p.h)), concentrationPct: 100 * top4 / Math.max(1, interior),
    goldPct: 100 * gold / Math.max(1, lit), offPct: 100 * off / Math.max(1, lit), peakY: bestY / p.h };
}
let BASE_CONC = 30;   // replaced by the shipped file's own reading at run time
function gate(s) {
  const bad = [];
  if (s.border > 0) bad.push(`ink on the canvas border (${s.border} px) - the column would be clipped by the frame`);
  if (s.transparentPct < 15 || s.transparentPct > 80) bad.push(`transparent ${s.transparentPct.toFixed(0)}% - a column should leave 15-80% of the canvas clear`);
  if (s.offPct > 6) bad.push(`off-palette ${s.offPct.toFixed(1)}% (want <= 6%: cream, gold, amber only)`);
  if (s.goldPct < 20) bad.push(`not gold enough (${s.goldPct.toFixed(0)}% of the lit pixels)`);
  if (s.peakY > 0.30) bad.push(`the brightest band is ${(100 * s.peakY).toFixed(0)}% of the way down (want the crown in the top 30%) - the crown is what says "siphoned upward"`);
  if (s.concentrationPct < BASE_CONC * 1.35) bad.push(`still painterly: ${s.concentrationPct.toFixed(0)}% of interior pixels in the four commonest luminance levels vs ${BASE_CONC.toFixed(0)}% on the shipped file (want >= ${(BASE_CONC * 1.35).toFixed(0)}%, i.e. flat cel fills)`);
  return bad;
}
const line = (t, s) => `${t}: transparent ${s.transparentPct.toFixed(0)}%, concentration ${s.concentrationPct.toFixed(0)}%, gold ${s.goldPct.toFixed(0)}%, off-palette ${s.offPct.toFixed(1)}%, brightest band ${(100 * s.peakY).toFixed(0)}% down, border ${s.border}`;

// the family's seat: trim, fit inside 92% of the 512x1152 canvas, centre, feather the last 5% so
// nothing ever sits on the border
async function seat(raw) {
  let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
  const inner = await sharp(content).resize(Math.round(CW * FILL), Math.round(CH * FILL), { fit: 'inside' }).png().toBuffer();
  const canvas = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: inner, gravity: 'centre' }]).png().toBuffer();
  const { data, info } = await sharp(canvas).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const fx = Math.round(CW * 0.05), fy = Math.round(CH * 0.04);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const dx = Math.min(x, CW - 1 - x), dy = Math.min(y, CH - 1 - y); let k = 1;
    if (dx < fx) k = Math.min(k, dx / fx); if (dy < fy) k = Math.min(k, dy / fy); if (dx === 0 || dy === 0) k = 0;
    if (k < 1) { const i = (y * CW + x) * info.channels + 3; data[i] = Math.round(data[i] * k); }
  }
  return sharp(data, { raw: { width: CW, height: CH, channels: info.channels } }).webp({ quality: 94, alphaQuality: 100 }).toBuffer();
}
// 2026-09-11: /assets/image began answering 202 with a JOB ({id, status:'running', poll_after_ms})
// instead of the image. The finished job at GET /assets/jobs/<id> carries result: [{url}]. Four
// "no url" retries in a row is what that looked like from here; the contract below is the one
// scripts/gen_bossbar_ui.mjs (v0.30.565) already uses, kept identical on purpose.
async function pollJob(job, label) {
  const t0 = Date.now();
  for (;;) {
    await sleep(Math.min(15000, Math.max(2000, Number(job.poll_after_ms) || 5000)));
    const r = await fetch(`${API}/assets/jobs/${job.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`job ${job.id}: ${r.status}`);
    job = await r.json();
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed' || job.status === 'cancelled') throw new Error(`job ${job.id} ${job.status}: ${JSON.stringify(job).slice(0, 160)}`);
    if (Date.now() - t0 > 240000) throw new Error(`job ${job.id} still ${job.status} after 240s`);
    process.stdout.write(`(${job.status}) `);
  }
}
async function makeImage(label) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const ar = a >= 3 ? 'ar_1_1' : 'ar_9_16';   // the family's fallback: the tall ratio first, square if it keeps failing
      process.stdout.write(`  ${label} attempt ${a} (${ar}) ... `);
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000), body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: ar, n: 1, augment_prompt: false, prompt: PROMPT }) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      let data = await res.json();
      if (res.status === 202 || (data && data.id && data.status && !data.url && !data.result)) data = await pollJob(data, label);
      const url = Array.isArray(data) ? data[0] && data[0].url
        : (data && (data.url || (data.images && data.images[0] && data.images[0].url) || (Array.isArray(data.result) && data.result[0] && data.result[0].url)));
      if (!url) throw new Error('no url in the response: ' + JSON.stringify(data).slice(0, 120)); console.log('ok'); return await fetchBuf(url);
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} FAILED: ${last && last.message}`);
}

// THE BASELINE IS THE COMMITTED FILE, read from git - not whatever is on disk. Measuring the on-disk
// file was a drift bug: the first --keep that passed overwrote it, and every later --keep was then
// compared against the winner (48%) instead of the painterly original (25%), rejecting five rolls
// that all clear the real bar. origin/main first, HEAD as the fallback for a checkout with no remote.
{
  let base = null;
  for (const ref of ['origin/main', 'HEAD']) {
    try { base = (await import('node:child_process')).execFileSync('git', ['show', `${ref}:Sprites/vfx/sovereign_drain_pillar.webp`], { cwd: ROOT, maxBuffer: 1 << 26 }); break; } catch (e) {}
  }
  if (base) { const s0 = await stats(base); BASE_CONC = Math.max(5, s0.concentrationPct); console.log(line('committed file', s0)); }
  else console.log('no committed file to measure - using the default baseline of ' + BASE_CONC + '%');
}
const _keep = (process.argv.find((x) => x.startsWith('--keep=')) || '').split('=')[1];
if (_keep) {
  const buf = await readFile(_keep); const s = await stats(buf), bad = gate(s);
  console.log(`${line('keep ' + _keep, s)} - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
  if (bad.length) process.exit(2);
  await writeFile(OUT + '.tmp', buf); await rename(OUT + '.tmp', OUT); console.log('  -> ' + OUT); process.exit(0);
}
if (!has('--generate')) { console.log('\nDRY RUN.\n\n' + PROMPT + '\n'); process.exit(0); }
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
await mkdir(join(ROOT, 'scripts', '_tmp_drain'), { recursive: true });
let best = null;
for (let roll = 1; roll <= ROLLS && !best; roll++) {
  const buf = await seat(await makeImage(`roll ${roll}`));
  await writeFile(join(ROOT, 'scripts', '_tmp_drain', `roll${roll}.webp`), buf);
  const s = await stats(buf), bad = gate(s);
  console.log(`  ${line('roll ' + roll, s)} - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
  if (!bad.length) { best = buf; await writeFile(OUT + '.tmp', buf); await rename(OUT + '.tmp', OUT); console.log(`  -> Sprites/vfx/sovereign_drain_pillar.webp (${Math.round(buf.length / 1024)}KB)`); }
}
if (!best) { console.error('no roll passed the gates'); process.exit(2); }
console.log('\ndone.');
