#!/usr/bin/env node
// Cancer gets black kawaii eyes (ludo.ai image edit).
//
//   *** REJECTED — DO NOT RUN WITHOUT ASKING FIRST. ***
//
// This shipped as v0.30.711 and was reverted in full the same day. Per user,
// after seeing it in play: "then remove the kawaii eyes it looks too artificial
// and weird". Two things went wrong that are not visible in a still frame:
//   - the eyes read as pasted on rather than drawn with the character;
//   - regenerating the loops from the edited base moved them. In the attack
//     loop the eyes drifted up the shell onto the feeler bases across frames
//     1-7 of nine, so she appeared to sprout eyes on her antennae — the user's
//     words: "sometimes the cancer boss eyes pops up at the tip of the feelers".
// Her art is back to the pre-change bytes; scripts/cancer_eyes_test.mjs now
// asserts exactly that. The file is kept as the record of what was tried and
// why it was dropped — running it again would re-break her.
// ============================================================================
// Per user, originally: "for zodiac cancer the eyes are also a little weird,
// please do the same with black kawaii eyes".
//
// HER EYES ARE IN THE BASE SPRITE, not in one loop. Aquarius only needed her
// idle re-rolled because her base was already right and a prompt turned her
// eyes into slits. Cancer is the other case: the two eyes on the front of her
// shell are blank pupil-less cream discs inside amber rings, and that is what
// Sprites/bosses/zodiac/cancer.webp itself holds — so every frame of every loop
// inherits them. The base has to change first, then the three loops get
// regenerated from it.
//
//   node scripts/gen_cancer_eyes.mjs                 # show the prompt
//   node scripts/gen_cancer_eyes.mjs --generate      # 3 candidates -> scratch
//   node scripts/gen_cancer_eyes.mjs --generate --tries 5
//
// Candidates are written to a staging dir and SCORED, never straight over the
// base: an image edit can quietly return a different crab, a crab in a
// different pose, or a crab on a white background, and any of those would be
// far worse than the eyes it was sent to fix. Promote a candidate by hand once
// it has been looked at.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(ROOT, 'Sprites', 'bosses', 'zodiac', 'cancer.webp');
const STAGE = process.env.LX_CANCER_STAGE || path.join(ROOT, '_cancer_stage');
const has = (f) => process.argv.includes(f);
const argOf = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };

// Say what to keep before saying what to change: an edit prompt that leads with
// the change tends to redraw the whole character around it.
const PROMPT =
  'Keep this exact crab character completely unchanged — the same pose, the same coral-pink and red '
  + 'colours, the same shell shape and its pearl bubbles and swirl markings, the same two raised '
  + 'claws, the same legs, the same dark horns on top of the shell, the same thick dark outline and '
  + 'cel-shaded cartoon style, the same size, position and framing, and a fully TRANSPARENT '
  + 'background. '
  + 'CHANGE ONLY THE TWO EYES on the front of the shell. They are currently blank pale cream discs '
  + 'ringed in amber, with no pupils, which looks lifeless and unsettling. Replace each one with a '
  + 'big, round, glossy BLACK kawaii eye — a large solid black iris filling the eye, one big white '
  + 'sparkle highlight at the upper left and a smaller white glint at the lower right, with a soft '
  + 'thin lighter rim. The two eyes are large, perfectly round, symmetrical and the same size as '
  + 'each other, looking straight forward. The expression is sweet, friendly and adorable — a cute '
  + 'chibi mascot crab. '
  + 'NO amber or orange ring around the eyes, NO blank white or cream discs, NO pupil-less stare, '
  + 'NO angry or menacing expression, NO glowing eyes. Nothing else about the crab changes.';

if (!has('--generate')) {
  console.log('# edit ' + path.relative(ROOT, BASE) + '\n');
  console.log(PROMPT + '\n\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TRIES = Number(argOf('--tries') || 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
// ludo.ai's job API (2026-09-11): the POST answers a receipt and the image
// arrives from GET /assets/jobs/<id> once it succeeds.
async function awaitJob(data) {
  if (!data || !data.id || data.status === 'succeeded') return data;
  const t0 = Date.now();
  let wait = Number(data.poll_after_ms) || 5000;
  for (;;) {
    await sleep(Math.max(2500, Math.min(15000, wait)));
    const r = await fetch(`${API}/assets/jobs/${data.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) });
    if (r.status === 429) { wait = Math.min(30000, wait * 2 + Math.random() * 3000); continue; }
    if (!r.ok) throw new Error(`job ${data.id}: ${r.status}`);
    const j = await r.json();
    if (j.status === 'succeeded') return j;
    if (j.status === 'failed' || j.status === 'cancelled') throw new Error('job ' + j.status + (j.error ? ': ' + String(j.error).slice(0, 120) : ''));
    if (Date.now() - t0 > 900000) throw new Error('job still running after 900 s');
    wait = Number(j.poll_after_ms) || 6000;
  }
}
const urlOf = (d) => (Array.isArray(d) ? (d[0] && d[0].url)
  : (d && (d.url || (d.images && d.images[0] && d.images[0].url) || (Array.isArray(d.result) && d.result[0] && d.result[0].url))));

// ---- scoring ---------------------------------------------------------------
// Silhouette agreement with the original, so "it is still the same crab, in the
// same place" is measured rather than hoped for.
async function mask(buf, W, H) {
  const { data, info } = await sharp(buf).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = new Uint8Array(W * H);
  for (let i = 0, p = 0; p < data.length; p += info.channels, i++) m[i] = data[p + 3] > 64 ? 1 : 0;
  return m;
}
function iou(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] | b[i]) uni++; if (a[i] & b[i]) inter++; }
  return uni ? inter / uni : 0;
}
// The eye band on the 1417 canvas, measured off the shipped art.
const EYE = { left: 580, top: 940, width: 380, height: 180 };
// How much of the eye band is SOLID BLACK. The first cut of this measured the
// darkest 8% of the band instead, which scored 3.1 on the untouched base and
// 0.0 on every candidate — useless, because the darkest pixels in that crop are
// the character's black outline, present either way. Coverage is the right
// question: the blank cream discs are large, so replacing them with black eyes
// moves this a long way (measured: base 20.6% -> 38-43% across three rolls)
// while the outline contributes the same amount to both.
async function eyeBlack(buf) {
  const { data, info } = await sharp(buf).extract(EYE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let black = 0, tot = 0;
  for (let p = 0; p < data.length; p += info.channels) {
    if (data[p + 3] < 128) continue;
    tot++;
    if (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2] < 40) black++;
  }
  return tot ? (100 * black / tot) : 0;
}
async function alphaFrac(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let on = 0, tot = 0;
  for (let p = 0; p < data.length; p += info.channels) { tot++; if (data[p + 3] > 64) on++; }
  return on / tot;
}

const baseBuf = await readFile(BASE);
const meta = await sharp(baseBuf).metadata();
const W = meta.width, H = meta.height;
console.log(`base ${W}x${H}`);
const baseMask = await mask(baseBuf, 256, 256);
const baseBlack = await eyeBlack(baseBuf);
const baseAlpha = await alphaFrac(baseBuf);
console.log(`base: eye band is ${baseBlack.toFixed(1)}% solid black, ink covers ${(baseAlpha * 100).toFixed(1)}% of canvas`);

await mkdir(STAGE, { recursive: true });
const uri = 'data:image/png;base64,' + (await sharp(baseBuf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');

const rows = [];
for (let t = 1; t <= TRIES; t++) {
  process.stdout.write(`candidate ${t}/${TRIES} ... `);
  try {
    const res = await fetch(`${API}/assets/image/edit`, {
      method: 'POST',
      headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(600000),
      body: JSON.stringify({ image: uri, prompt: PROMPT, n: 1, augment_prompt: false }),
    });
    if (res.status === 402) throw new Error('OUT OF CREDITS (402)');
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
    let data = await res.json();
    if (!urlOf(data)) data = await awaitJob(data);
    const url = urlOf(data);
    if (!url) throw new Error('no url');
    // Back onto the exact base canvas so it drops straight into the animator.
    const img = await sharp(await fetchBuf(url)).ensureAlpha()
      .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 95 }).toBuffer();
    const out = path.join(STAGE, `cancer_cand_${t}.webp`);
    await writeFile(out, img);
    const m = await mask(img, 256, 256);
    const row = { t, file: out, iou: iou(baseMask, m), black: await eyeBlack(img), alpha: await alphaFrac(img) };
    rows.push(row);
    console.log(`ok  silhouette IoU ${row.iou.toFixed(3)}  eye-black ${row.black.toFixed(1)}%  ink ${(row.alpha * 100).toFixed(1)}%`);
  } catch (e) { console.log('fail: ' + e.message); }
  if (t < TRIES) await sleep(2500);
}

if (!rows.length) { console.error('no candidates produced'); process.exit(1); }
console.log('\n-- ranked (want: high IoU = same crab in the same place, HIGH eye-black = the discs became black eyes) --');
// IoU first, because a beautiful pair of eyes on the wrong crab is a worse
// outcome than the blank discs we started with.
rows.sort((a, b) => (b.iou - a.iou) || (b.black - a.black));
for (const r of rows) {
  const warn = [];
  if (r.iou < 0.90) warn.push('SILHOUETTE DRIFT');
  if (r.black < baseBlack + 10) warn.push('EYES NOT BLACKER');
  if (r.alpha > baseAlpha * 1.6) warn.push('BACKGROUND FILLED IN');
  console.log(`  ${path.relative(ROOT, r.file)}  IoU ${r.iou.toFixed(3)}  eye-black ${r.black.toFixed(1)}% (base ${baseBlack.toFixed(1)}%)  ink ${(r.alpha * 100).toFixed(1)}%  ${warn.join(' + ') || 'ok'}`);
}
console.log('\nLook at them before promoting. To promote:');
console.log(`  cp "${path.relative(ROOT, rows[0].file)}" "${path.relative(ROOT, BASE)}"`);
