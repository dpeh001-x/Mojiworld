#!/usr/bin/env node
// Boss Shackle QTE — the BREAK burst, regenerated (ludo.ai).
// =============================================================================
//   1) BASE  /assets/image          -> staged qte_break.webp
//   2) ANIM  /assets/sprite/animate -> staged qte_break_0..8.webp
//
//   node scripts/gen_qte_break_fx.mjs              # dry run, prints prompts
//   node scripts/gen_qte_break_fx.mjs --generate   # needs LUDO_API_KEY
//   node scripts/gen_qte_break_fx.mjs --install    # staged -> Sprites/fx(/anim)
//   flags: --tries N (default 3)
//
// Why a dedicated script rather than generate_qte_fx.mjs --only qte_break:
// that script is the SEVEN-sigil batch, and its shape fights a re-roll. It
// writes the base as .png while the shipped asset is .webp (so a regenerated
// base lands beside the live one instead of replacing it), it resumes by
// skipping anything that exists, and it overwrites Sprites/ directly with no
// review step and no gate — three re-rolls in this effect's history each
// shipped straight to disk. This one stages, gates, and only installs when
// told. The batch script stays exactly as it is for the six capture sigils.
//
// AUTHORED AS A ONE-SHOT. Every spawn site (killMonster, the shackle release,
// and the QTE resolve at life 34-44) plays the nine frames once across the
// burst's life — two stretch t->frame, one uses frameGap 4 which is ~one pass.
// So this is ignite -> peak -> dissipate, NOT a seamless loop: the last frame
// must be nearly gone or the burst ends with a pop.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = join(ROOT, 'scripts', '_style_pack', 'qte_break');
const FX_DIR = join(ROOT, 'Sprites', 'fx');
const ANIM_DIR = join(FX_DIR, 'anim');
const SIZE = 1024, FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const TRIES = Math.max(1, Number(arg('--tries') || 3));

const BASE_PROMPT =
  'A SHATTERING SHACKLE burst for a 2D anime action game: heavy golden chain ' +
  'links blown apart from the centre, thick broken shackle fragments and a ' +
  'snapped iron cuff tumbling outward in all directions, a white-hot core of ' +
  'freedom light at the centre with hard radiating light spikes, and bright ' +
  'sparks trailing behind the fragments. The pieces fly OUTWARD in a full ' +
  'circle, evenly all around the centre. Rich golds, warm amber and white-hot ' +
  'highlights on deep bronze shadow. Flat 2D cel-shaded anime game sprite, ' +
  'bold dark outlines, crisp readable shapes, additive glow. ' +
  'The whole burst is CENTRED with clear empty margin on all four sides and ' +
  'is NOT cropped at any edge. Fully TRANSPARENT background, alpha only. ' +
  'ABSOLUTELY NO TEXT, no letters, no numbers, no runes, no watermark, no UI, ' +
  'no character, no ground, no scene.';

const MOTION =
  'A one-shot shatter played start to finish across the nine frames, with ' +
  'visible change in every frame and NO looping back: the shackle BURSTS at ' +
  'the centre in a white-hot flash, the chain links and cuff fragments blow ' +
  'OUTWARD and keep travelling outward, tumbling and glinting as they go, ' +
  'while the central flash swells then collapses — and by the final frames ' +
  'the fragments have thinned to scattered sparks and a dim fading glow, ' +
  'almost gone. ' +
  'CRITICAL — LOCKED CAMERA: the framing never zooms, pans, crops, mirrors or ' +
  'rescales; the EXPANSION is drawn inside the frame and nothing leaves it. ' +
  'CRITICAL — DO NOT ROTATE the image as a whole; only the pieces move. ' +
  'Keep the exact same art style, palette (gold, amber, white-hot core), bold ' +
  'outlines and fully transparent background in every frame. ' +
  'No text, no character, no background.';

if (has('--install')) {
  if (!existsSync(join(STAGE, 'qte_break.webp'))) { console.error('ABORT: nothing staged'); process.exit(1); }
  await copyFile(join(STAGE, 'qte_break.webp'), join(FX_DIR, 'qte_break.webp'));
  let n = 0;
  while (existsSync(join(STAGE, `qte_break_${n}.webp`))) {
    await copyFile(join(STAGE, `qte_break_${n}.webp`), join(ANIM_DIR, `qte_break_${n}.webp`));
    n++;
  }
  console.log(`installed base + ${n} frames -> Sprites/fx/(anim/)`);
  console.log('NOW: node scripts/gen_sprite_frame_index.mjs && node scripts/gen_anim_manifest.mjs');
  process.exit(0);
}
if (!has('--generate')) {
  console.log('# QTE break burst — base, then nine one-shot frames\n');
  console.log('## base\n' + BASE_PROMPT + '\n');
  console.log('## motion\n' + MOTION + '\n');
  console.log('# Re-run with --generate (needs LUDO_API_KEY), review contact_sheet.png, then --install.');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', signal: AbortSignal.timeout(600000),
    headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Gate a base roll: it must be genuinely transparent (a burst that fills the
// canvas is a background, not an effect), roughly centred, and must clear the
// edges — the v0.30.333 note records a set that was cropped by its own canvas.
const score = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let op = 0, x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 24) {
      op++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const cov = op / (info.width * info.height);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const offC = Math.hypot(cx - info.width / 2, cy - info.height / 2) / info.width;
  const margin = Math.min(x0, y0, info.width - 1 - x1, info.height - 1 - y1) / info.width;
  return { cov, offC, margin, box: [x1 - x0 + 1, y1 - y0 + 1] };
};

await mkdir(STAGE, { recursive: true });
let best = null, bestS = null, bestScore = -1;
for (let attempt = 1; attempt <= TRIES; attempt++) {
  const data = await post('/assets/image', {
    image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1',
    n: 1, augment_prompt: false, prompt: BASE_PROMPT,
  });
  const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
  if (!url) { console.log(`roll ${attempt}: no url`); continue; }
  const img = await sharp(await fetchBuf(url)).ensureAlpha()
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 94, alphaQuality: 100 }).toBuffer();
  const s = await score(img);
  // want: real transparency (cov 0.15-0.55), centred (offC small), clear margin
  const v = (s.cov > 0.12 && s.cov < 0.60 ? 1 : 0) + (1 - Math.min(1, s.offC * 6)) + Math.min(1, s.margin * 12);
  console.log(`roll ${attempt}: coverage ${(s.cov * 100).toFixed(0)}%  off-centre ${(s.offC * 100).toFixed(1)}%  margin ${(s.margin * 100).toFixed(1)}%  score ${v.toFixed(2)}`);
  await writeFile(join(STAGE, `cand_${attempt}.webp`), img);
  if (v > bestScore) { bestScore = v; best = img; bestS = s; }
  if (s.cov > 0.15 && s.cov < 0.55 && s.offC < 0.04 && s.margin > 0.04) break;
}
if (!best) { console.error('ABORT: no base produced'); process.exit(2); }
await writeFile(join(STAGE, 'qte_break.webp'), best);
console.log(`kept base: coverage ${(bestS.cov * 100).toFixed(0)}%, margin ${(bestS.margin * 100).toFixed(1)}%, content ${bestS.box.join('x')}`);

// ---- nine one-shot frames ---------------------------------------------------
const anim = await post('/assets/sprite/animate', {
  initial_image: `data:image/webp;base64,${(await sharp(best).resize(990, 990, { fit: 'inside' }).webp({ quality: 94 }).toBuffer()).toString('base64')}`,
  motion_prompt: MOTION, frames: FRAMES, frame_size: -9,
  model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite',
});
let bufs = [];
if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
  const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata();
  const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
  for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++)
    for (let c = 0; c < anim.num_cols && bufs.length < FRAMES; c++)
      bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).webp({ quality: 94 }).toBuffer());
}
if (bufs.length < FRAMES && Array.isArray(anim.individual_frame_urls)) {
  bufs = []; for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
}
if (bufs.length < FRAMES) { console.error(`ABORT: got ${bufs.length}/${FRAMES} frames`); process.exit(2); }

console.log('\nframe  coverage  (a one-shot should FALL toward the end)');
for (let i = 0; i < FRAMES; i++) {
  const out = await sharp(bufs[i]).ensureAlpha()
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 94, alphaQuality: 100 }).toBuffer();
  await writeFile(join(STAGE, `qte_break_${i}.webp`), out);
  const s = await score(out);
  console.log(`  ${i}     ${(s.cov * 100).toFixed(1)}%`);
}

// contact sheet on a DARK ground — this effect only ever plays over an arena
const TH = 200, dark = { r: 24, g: 22, b: 40, alpha: 255 };
const all = ['qte_break.webp']; for (let i = 0; i < FRAMES; i++) all.push(`qte_break_${i}.webp`);
const tiles = [];
for (let i = 0; i < all.length; i++) {
  tiles.push({ input: await sharp(join(STAGE, all[i])).resize(TH, TH, { fit: 'contain', background: dark }).flatten({ background: dark }).png().toBuffer(),
               left: (i % 5) * TH, top: Math.floor(i / 5) * TH });
}
await sharp({ create: { width: TH * 5, height: TH * Math.ceil(all.length / 5), channels: 4, background: dark } })
  .composite(tiles).png().toFile(join(STAGE, 'contact_sheet.png'));
console.log('\nstaged in scripts/_style_pack/qte_break/ — review contact_sheet.png, then --install');
