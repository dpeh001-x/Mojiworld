#!/usr/bin/env node
// Sprites/ui/cs_preview_bg.webp — the backdrop inside the character-creation preview box.
// ============================================================================
// Per user, on seeing the first attempt in game: "Background looks weird, remake it to fit the UI
// Background theme, change the concept to something more appropriate".
//
// WHAT WAS WRONG WITH THE MUSHROOM GROVE (scripts/gen_cs_throne_backdrop.mjs, never shipped).
// It was a good picture of the wrong thing. The panel it sits in is deep violet glass with a
// single gold hairline and gold lettering; the grove answered that with warm reds and leaf greens,
// so the box read as a window cut into a different game. It was also busy in exactly the band
// where a chibi stands, and red is the one hue a dark-haired character cannot separate from at
// 240px. The concept is replaced rather than recoloured - a red-capped toadstool with the red
// taken out is not a toadstool.
//
// THE CONCEPT NOW. A shrine niche: an arched alcove of dark violet stone with gold filigree worked
// into the walls, a low stone dais across the bottom for the figure to stand on, and a night sky
// with an aurora showing through the arch behind. It borrows the panel's own two colours, it is
// symmetric so it does not fight a centred figure, its middle is empty sky by construction, and
// an alcove is what a rounded square wants to be. It is also the right IDEA for the screen: this
// is where a hero is chosen, so the hero should be standing somewhere that means something.
//
// WHAT IT SITS BEHIND. .cs-look-preview-wrap is a 240x240 rounded square (158 on mobile) with the
// hero canvas centred on top, so the figure stands dead centre with its feet near the bottom. The
// art has to be interesting at the edges and get out of the way through the middle.
//
//   node scripts/gen_cs_preview_backdrop.mjs                # print the brief
//   node scripts/gen_cs_preview_backdrop.mjs --generate     # needs LUDO_API_KEY
//   flags: --rolls N   --rescrim=<kept roll>
import sharp from 'sharp';
import { writeFile, rename } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'Sprites', 'ui', 'cs_preview_bg.webp');
const S = 512;
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const ROLLS = Number(argOf('--rolls', '5'));

const PROMPT =
  'A moonlit SHRINE NICHE painted as a full square scene that fills the whole picture edge to edge. '
  + 'A tall stone archway of deep violet-grey stone frames the view, its pillars running down both '
  + 'side edges and its arch curving across the top, carved all over with fine GOLD filigree - thin '
  + 'gold scrollwork, small gold stars, a gold band around the arch. Along the bottom a low, wide '
  + 'stone dais of three shallow steps, with worn gold inlay in the stone. Through the archway '
  + 'behind, a deep indigo night sky with a soft violet aurora, distant stars, and tiny gold motes '
  + 'of light drifting upward. '
  + 'The colours are ONLY deep violet, indigo, dark blue-grey stone and pale gold. No red, no '
  + 'orange, no green, no foliage, no plants, no mushrooms. '
  + 'The middle of the picture is OPEN and quiet - just sky and soft light between the pillars, '
  + 'nothing painted in the centre, nothing standing on the dais. '
  + 'Every corner of the picture has stone, carving or sky painted in it, nothing left as plain '
  + 'empty background. '
  + 'Storybook game art, bold clean shapes, soft painted light, calm and reverent. '
  + 'No character, no person, no creature, no statue. No text, no letters, no watermark, no user '
  + 'interface, no picture frame or border around the edge.';

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

// The ground, keyed to .cs-look-preview-wrap's own gradient so a cut-out with transparent margins
// - which is what this endpoint reliably returns - can never land off-palette.
const GROUND = Buffer.from(
  `<svg width="${S}" height="${S}">`
  + `<defs><radialGradient id="g" cx="50%" cy="30%" r="82%">`
  + `<stop offset="0%" stop-color="#6a53a8"/><stop offset="78%" stop-color="#2b1c52"/><stop offset="100%" stop-color="#1d1240"/></radialGradient></defs>`
  + `<rect width="${S}" height="${S}" fill="url(#g)"/></svg>`);

async function px(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}
async function seat(raw) {
  const trimmed = await sharp(raw).trim({ threshold: 8 }).png().toBuffer().catch(() => sharp(raw).png().toBuffer());
  // COVER, not inside: the square is filled by construction, so no roll can leave bare corners.
  const art = await sharp(trimmed).resize(S, S, { fit: 'cover', position: 'centre' }).png().toBuffer();
  // THE HERO SCRIM. A busy picture behind a sprite is a legibility problem before it is a nice
  // picture; this darkens the band the figure stands in so a black-haired chibi separates from it.
  const HERO = Buffer.from(
    `<svg width="${S}" height="${S}"><defs><radialGradient id="h" cx="50%" cy="56%" r="42%">`
    + `<stop offset="0%" stop-color="#160c2c" stop-opacity="0.52"/>`
    + `<stop offset="62%" stop-color="#160c2c" stop-opacity="0.34"/>`
    + `<stop offset="100%" stop-color="#160c2c" stop-opacity="0"/></radialGradient></defs>`
    + `<rect width="${S}" height="${S}" fill="url(#h)"/></svg>`);
  return sharp(GROUND).composite([{ input: art, left: 0, top: 0 }, { input: HERO }]).webp({ quality: 90 }).toBuffer();
}
function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: mx ? d / mx : 0, v: mx / 255 };
}
async function stats(buf) {
  // PALETTE IS MEASURED AT FULL RESOLUTION, and that is not a detail. The first cut of this gate
  // read the colours off the same 96x96 thumbnail as the brightness, and rejected six rolls out of
  // six for having "no gold" - while every one of them was covered in gold filigree. Filigree is
  // one- and two-pixel scrollwork on dark stone; downsampled 5x it averages into its violet
  // background and stops being gold at all. The thresholds are loose for the same reason: an
  // anti-aliased gold line spends most of its pixels part-way to the stone behind it.
  const f = await px(buf);
  let gold = 0, off = 0;
  for (let i = 0; i < f.d.length; i += 4) {
    const c = hsv(f.d[i], f.d[i + 1], f.d[i + 2]);
    if (c.s > 0.18 && c.v > 0.18) {
      if (c.h >= 30 && c.h <= 68) gold++;                       // gold
      else if (c.h >= 225 && c.h <= 305) { /* violet/indigo */ }
      else off++;                                                // neither: off the panel's palette
    }
  }
  const fullN = f.w * f.h;
  gold = 100 * gold / fullN; off = 100 * off / fullN;
  const p = await px(await sharp(buf).resize(96, 96, { fit: 'fill' }).toBuffer());
  const lum = (i) => 0.299 * p.d[i] + 0.587 * p.d[i + 1] + 0.114 * p.d[i + 2];
  let mid = 0, midN = 0, all = 0, allN = 0;
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const i = (y * 96 + x) * 4, v = lum(i);
    all += v; allN++;
    if (x > 30 && x < 66 && y > 12 && y < 72) { mid += v; midN++; }
  }
  let cd = 0;
  for (const [ox, oy] of [[3, 3], [75, 3], [3, 75], [75, 75]]) {
    const vals = [];
    for (let y = oy; y < oy + 18; y++) for (let x = ox; x < ox + 18; x++) vals.push(lum((y * 96 + x) * 4));
    const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
    cd += vals.reduce((a, b) => a + Math.abs(b - mu), 0) / vals.length;
  }
  return { mean: all / allN, centre: mid / midN, goldPct: gold, offPct: off, cornerDetail: cd / 4 };
}
function gate(s) {
  const bad = [];
  // "fit the UI Background theme" (per user), made checkable rather than hoped for.
  if (s.offPct > 5) bad.push(`off the panel's palette: ${s.offPct.toFixed(1)}% of the picture is saturated colour that is neither violet nor gold (want <= 5%) — this is what made the mushroom grove read as a different game`);
  if (s.goldPct < 0.35) bad.push(`no gold in it (${s.goldPct.toFixed(1)}%) — the panel's only accent is a gold hairline and gold lettering, so the art has to answer it`);
  // FILLS THE ENTIRE SQUARE (per user, earlier): each corner patch must carry real variation. A
  // plain gradient corner measures near zero; painted stone, carving or sky measures well above it.
  if (s.cornerDetail < 3.2) bad.push(`the corners are empty ground, not art: detail ${s.cornerDetail.toFixed(1)} of 255 (want >= 3.2) — the square is not filled`);
  if (s.mean > 96) bad.push(`too bright behind a character: mean ${s.mean.toFixed(0)} (want <= 96)`);
  // ABSOLUTE, NOT A RATIO. The ratio form was wrong twice on the previous concept: a centred
  // subject inside a vignette is ALWAYS brighter than its own corners, so the ratio can never be
  // satisfied without ruining the picture. What matters is whether a dark chibi separates from
  // what is behind it, and that is an absolute number.
  if (s.centre > 100) bad.push(`the middle is too bright to stand a dark character against: ${s.centre.toFixed(0)} of 255 (want <= 100)`);
  return bad;
}
async function makeImage(prompt, label) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      process.stdout.write(`  ${label} attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000), body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt }) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0] && data[0].url : (data && (data.url || (data.images && data.images[0] && data.images[0].url)));
      if (!url) throw new Error('no url in the response');
      console.log('ok'); return await fetchBuf(url);
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} FAILED: ${last && last.message}`);
}
const line = (t, s) => `${t}: mean ${s.mean.toFixed(0)}, centre ${s.centre.toFixed(0)}, gold ${s.goldPct.toFixed(1)}%, off-palette ${s.offPct.toFixed(1)}%, corners ${s.cornerDetail.toFixed(1)}`;

// --rescrim=<kept roll>: re-run a saved composite through the CURRENT seat(), so the shipped file
// stays a product of the committed script rather than of a lucky interactive session.
const _reFrom = (process.argv.find((x) => x.startsWith('--rescrim=')) || '').split('=')[1];
if (_reFrom) {
  const buf = await seat(await sharp(_reFrom).png().toBuffer());
  const st = await stats(buf), bad = gate(st);
  console.log(`${line('rescrim ' + _reFrom, st)} - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
  if (bad.length) process.exit(2);
  await writeFile(OUT + '.tmp', buf); await rename(OUT + '.tmp', OUT);
  console.log(`  -> ${OUT} (${Math.round(buf.length / 1024)}KB)`); process.exit(0);
}
// --keep=<kept roll>: ship a roll this script already seated, re-judged by the CURRENT gates.
// Not the same as --rescrim: a kept roll is post-seat, so re-seating would paint the ground and
// the hero scrim on a second time and darken the middle twice. This ships the bytes the run
// produced, which is what reproducibility actually means here.
const _keep = (process.argv.find((x) => x.startsWith('--keep=')) || '').split('=')[1];
if (_keep) {
  const buf = await sharp(_keep).webp({ quality: 90 }).toBuffer();
  const st = await stats(buf), bad = gate(st);
  console.log(`${line('keep ' + _keep, st)} - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
  if (bad.length) process.exit(2);
  await writeFile(OUT + '.tmp', buf); await rename(OUT + '.tmp', OUT);
  console.log(`  -> ${OUT} (${Math.round(buf.length / 1024)}KB)`); process.exit(0);
}
if (!has('--generate')) { console.log('DRY RUN.\n\n' + PROMPT + '\n'); process.exit(0); }
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
mkdirSync(join(ROOT, 'scripts', '_tmp_csbg'), { recursive: true });
console.log('=== cs_preview_bg ===');
let best = null;
for (let roll = 1; roll <= ROLLS && !best; roll++) {
  const buf = await seat(await makeImage(PROMPT, `roll ${roll}`));
  await writeFile(join(ROOT, 'scripts', '_tmp_csbg', `roll${roll}.webp`), buf);
  const st = await stats(buf), bad = gate(st);
  console.log(`  ${line('roll ' + roll, st)} - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
  if (!bad.length) { best = buf; await writeFile(OUT + '.tmp', buf); await rename(OUT + '.tmp', OUT); console.log(`  -> Sprites/ui/cs_preview_bg.webp (${Math.round(buf.length / 1024)}KB)`); }
}
if (!best) { console.error('no roll passed the gates'); process.exit(2); }
console.log('\ndone.');
