#!/usr/bin/env node
// Sprites/ui/edicts_bg.webp — the backdrop behind the Edicts of the Weight-Bearer panel.
// ============================================================================
// Per user: "improve this HUD make it glass glossly and generate a good background image".
//
// WHAT THIS ART HAS TO DO, which is not the same as "look good on its own": it sits BEHIND a
// list of seven high-contrast rows of body text. A busy or bright plate would be a better
// picture and a worse backdrop, so the brief asks for a DIM, low-contrast one and the gates
// refuse anything else: mean luminance, the brightest patch and how much of the frame is bright
// are all measured before it is written, against numbers taken from the backdrops this game
// already ships rather than numbers I picked.
//
// The subject is the Weight-Bearer itself — the thing the panel is petitioning. A colossal
// seated figure with a world's worth of chain and stone across its shoulders, seen distantly
// through violet nebula, so the panel reads as an audience with something enormous.
//
//   node scripts/gen_edicts_backdrop.mjs                # dry run, prints the brief
//   node scripts/gen_edicts_backdrop.mjs --generate     # needs LUDO_API_KEY
//   flags: --rolls N
import sharp from 'sharp';
import { writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(repoRoot, 'Sprites', 'ui', 'edicts_bg.webp');
const W = 1024, H = 1024;
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const ROLLS = Number(argOf('--rolls', '5'));

const PROMPT =
  'A vast seated colossus carrying the weight of a world, seen from far below through drifting '
  + 'violet nebula — a titan of dark stone and old iron, shoulders bowed under heavy chains and a '
  + 'crushing mass of rock and dim stars. Its face is lost in shadow. Around it, deep indigo and '
  + 'purple space, faint magenta clouds, scattered small stars, and a few thin chains hanging away '
  + 'into the dark. '
  + 'This is a BACKGROUND PLATE for a dark user interface panel, so it must be DIM and QUIET: very '
  + 'dark overall, low contrast, no bright light source, no glare, no sunburst, no white areas, '
  + 'nothing sharp or busy. The detail sits in the middle of the frame and fades softly to near '
  + 'black at all four edges and especially toward the bottom, where text will sit over it. '
  + 'Muted painted illustration, soft edges, deep shadow, dark fantasy, moody and still. '
  + 'No text, no letters, no logo, no watermark, no characters in the foreground, no user '
  + 'interface elements, no frame or border.';

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

// ---- gates: a backdrop is judged by what it does to the text on top of it ----
async function stats(buf) {
  const { data, info } = await sharp(buf).removeAlpha().resize(256, 256, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const lum = [];
  for (let i = 0; i < data.length; i += 3) lum.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
  const sorted = lum.slice().sort((a, b) => a - b);
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const brightShare = 100 * lum.filter((v) => v > 120).length / lum.length;
  // edge falloff: the mean of the outer 12% ring against the mean of the middle
  let edge = 0, edgeN = 0, mid = 0, midN = 0;
  const S = 256, m = Math.round(S * 0.12);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = lum[y * S + x];
    if (x < m || y < m || x >= S - m || y >= S - m) { edge += v; edgeN++; }
    else if (x > S * 0.3 && x < S * 0.7 && y > S * 0.3 && y < S * 0.7) { mid += v; midN++; }
  }
  return { mean, p99, brightShare, edge: edge / edgeN, mid: mid / midN, info };
}
function gate(s) {
  const bad = [];
  // Calibrated by measuring the three backdrops the game already ships: means 19 / 46 / 1 and
  // p99s 78 / 181 / 50. The bar is set just above the brightest of them so the new plate has to
  // live in the same band rather than in whatever band the model felt like.
  if (s.mean > 60) bad.push(`too bright to sit under body text: mean luminance ${s.mean.toFixed(0)} (want <= 60)`);
  if (s.p99 > 200) bad.push(`a hot spot will fight the text: brightest 1% at ${s.p99.toFixed(0)} (want <= 200)`);
  if (s.brightShare > 12) bad.push(`${s.brightShare.toFixed(0)}% of the frame is bright (want <= 12%)`);
  // NO edge-versus-centre requirement. The first cut of this gate demanded the edges be darker
  // than the middle, which sounded obviously right and is contradicted by every backdrop the game
  // already ships: npc_dialog_bg measures edge/centre 1.25, qte_holy_bg 1.19, mojimon_bg has a
  // centre so near black the ratio is infinite. They are painted the other way round on purpose —
  // the text sits in the middle, so the middle is the part kept dark. A vignette is baked in by
  // seat() below regardless, so measuring falloff after applying my own falloff proved nothing.
  if (s.mean < 8) bad.push(`nothing to see: mean luminance ${s.mean.toFixed(0)} is effectively black`);
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
// A vignette is baked IN rather than left to CSS: the panel is translucent glass, so a CSS
// gradient over the art would also dim the glass, while a darkened plate keeps the glass clean.
async function seat(raw) {
  const base = await sharp(raw).resize(W, H, { fit: 'cover', position: 'centre' }).removeAlpha().toBuffer();
  const vig = Buffer.from(
    `<svg width="${W}" height="${H}"><defs><radialGradient id="v" cx="50%" cy="44%" r="72%">`
    + `<stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="58%" stop-color="#000" stop-opacity="0.18"/>`
    + `<stop offset="100%" stop-color="#000" stop-opacity="0.82"/></radialGradient>`
    + `<linearGradient id="b" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.55"/></linearGradient></defs>`
    + `<rect width="${W}" height="${H}" fill="url(#v)"/><rect width="${W}" height="${H}" fill="url(#b)"/></svg>`);
  return sharp(base).composite([{ input: vig, blend: 'over' }]).webp({ quality: 86 }).toBuffer();
}

if (!has('--generate')) {
  console.log('DRY RUN - brief only. Re-run with --generate (needs LUDO_API_KEY).\n');
  console.log(PROMPT + '\n');
  console.log('gate calibration, measured on the backdrops already in the game:');
  for (const f of ['Sprites/ui/npc_dialog_bg.webp', 'Sprites/ui/qte_holy_bg.webp', 'Sprites/ui/mojimon_bg.webp']) {
    try { const s = await stats(await sharp(join(repoRoot, f)).toBuffer());
      console.log(`  ${f.padEnd(34)} mean ${s.mean.toFixed(0).padStart(3)}  p99 ${s.p99.toFixed(0).padStart(3)}  bright ${s.brightShare.toFixed(0).padStart(2)}%  edge/centre ${(s.edge / s.mid).toFixed(2)}`);
    } catch (e) { console.log(`  ${f}: ${e.message}`); }
  }
  process.exit(0);
}
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
console.log('\n=== edicts_bg ===');
let chosen = null;
for (let roll = 1; roll <= ROLLS && !chosen; roll++) {
  const seated = await seat(await makeImage(PROMPT, `roll ${roll}`));
  const s = await stats(seated), bad = gate(s);
  console.log(`  roll ${roll}: mean ${s.mean.toFixed(0)}, p99 ${s.p99.toFixed(0)}, bright ${s.brightShare.toFixed(0)}%, edge/centre ${(s.edge / s.mid).toFixed(2)} - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
  if (!bad.length) { chosen = seated; await writeFile(OUT + '.tmp', seated); await rename(OUT + '.tmp', OUT); console.log(`  -> Sprites/ui/edicts_bg.webp (${Math.round(seated.length / 1024)}KB)`); }
}
if (!chosen) { console.error('edicts_bg: no roll passed the gates'); process.exit(2); }
console.log('\ndone.');
