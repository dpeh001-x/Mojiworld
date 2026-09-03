#!/usr/bin/env node
// Reforge Bench panel background - Persona 5 punk, same family as the shop /
// enhance-forge plates (ludo.ai). Output -> Sprites/ui/panel_p5_reforge.webp,
// 1200x670 full-colour art baked at a flat 20% alpha (A=51/255) exactly like
// panel_p5_shop / panel_p5_enhance, so the CSS stacks it over the modal's dark
// radial base and the body text stays legible.
//
// Per user (with a screenshot of the plain confirm box): "generate a nice
// background similar to the persona 5 style we have been using for this".
//
// GATES (a roll failing any is re-rolled, never shipped):
//   DECODE  1200x670, alpha present, flat 20%
//   CALM    the centre 56% x 50% of the plate (where the text sits) must be
//           markedly quieter than the corners - stddev of luminance in the
//           centre <= 0.55x the corners' - so the art stays out of the copy.
//   node scripts/gen_reforge_panel_bg.mjs             # dry-run (prints prompt)
//   node scripts/gen_reforge_panel_bg.mjs --generate  # needs LUDO_API_KEY
//   flags: --force  --tries N
import sharp from 'sharp';
import { writeFile, rename, mkdir, access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'ui');
const dest = join(DIR, 'panel_p5_reforge.webp');
const STAGE = join(repoRoot, 'scripts', '_style_pack', 'reforge_panel');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const arg = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const TRIES = Math.max(1, Number(arg('--tries') || 3));
const W = 1200, H = 670, ALPHA = 0.20;

const PROMPT =
  'Painted video-game menu panel background artwork in PERSONA 5 graphic punk style, for a ' +
  'REFORGE BENCH where gear affixes are re-rolled. FULL-BLEED painting filling the entire ' +
  'canvas edge to edge - no transparent areas, no border frame, no text, no letters, no logo, ' +
  'no characters, no UI widgets. Deep royal violet and midnight purple base. Bold jagged GOLD ' +
  'and CRIMSON comic-style shards and speed-lines exploding inward from the TOP-LEFT and ' +
  'BOTTOM-RIGHT corners only, with thick black comic outlines and halftone dot texture inside ' +
  'the shards. Tucked into the corners among the shards: a blacksmith ANVIL with a raised ' +
  'hammer, circular RE-ROLL arrows, a pair of tumbling gold DICE, and small glowing rune ' +
  'sigils and sparks - the gamble of re-rolling stats. The CENTER of the canvas stays clean, ' +
  'dark and calm - a smooth dark-violet glassy area with a soft radial glow - because ' +
  'readable menu text will sit on top of it. Stylish, high-contrast corners, quiet center. ' +
  'Rich saturated purples, antique gold and crimson accents.';

const exists = async p => { try { await access(p); return true; } catch { return false; } };
const fetchBuf = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const atomicWrite = async (p, buf) => { await writeFile(p + '.tmp', buf); await rename(p + '.tmp', p); };

// Luminance stddev of a region of an RGB(A) buffer - "how busy is it".
// NOTE: sharp's stats() reads the INPUT image and ignores the pipeline, so an
// extract() before it is silently dropped (first run: every region scored
// identically). Render the crop to raw pixels and reduce it by hand.
const busy = async (buf, left, top, width, height) => {
  const { data } = await sharp(buf).extract({ left, top, width, height }).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  let s = 0, s2 = 0; const n = data.length;
  for (let i = 0; i < n; i++) { s += data[i]; s2 += data[i] * data[i]; }
  const mean = s / n; return Math.sqrt(Math.max(0, s2 / n - mean * mean));
};
const calm = async (buf) => {
  const cw = Math.round(W * 0.56), ch = Math.round(H * 0.50);
  const centre = await busy(buf, Math.round((W - cw) / 2), Math.round((H - ch) / 2), cw, ch);
  const k = Math.round(W * 0.28), kh = Math.round(H * 0.34);
  const corners = (await busy(buf, 0, 0, k, kh) + await busy(buf, W - k, H - kh, k, kh)) / 2;
  return { centre, corners, ratio: corners > 0 ? centre / corners : 9 };
};

if (!has('--generate')) {
  console.log('# panel_p5_reforge.webp -> Sprites/ui/\n');
  console.log(PROMPT);
  if (await exists(dest)) {
    const c = await calm(await sharp(await readFile(dest)).flatten({ background: { r: 11, g: 7, b: 18 } }).toBuffer());
    console.log('\n# existing plate calm-ratio ' + c.ratio.toFixed(2) + ' (centre ' + c.centre.toFixed(1) + ' vs corners ' + c.corners.toFixed(1) + ')');
  }
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --tries N');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey && !has('--rescore')) { console.error('LUDO_API_KEY required.'); process.exit(1); }
if (!has('--force') && !has('--rescore') && await exists(dest)) { console.log('skip (exists - use --force) ->', dest); process.exit(0); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
await mkdir(STAGE, { recursive: true });

let best = null;
// --rescore: re-run the gate over rolls already on disk (no API calls) — for
// when the gate itself was wrong, as it was on the first run.
const RESCORE = has('--rescore');
for (let attempt = 1; attempt <= (RESCORE ? 12 : TRIES); attempt++) {
  let raw;
  if (RESCORE) {
    const p = join(STAGE, 'roll_' + attempt + '.png');
    if (!(await exists(p))) continue;
    raw = await readFile(p);
  } else
  try {
    const res = await fetch(`${API}/assets/image`, {
      method: 'POST',
      headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT),
      body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt: PROMPT }),
    });
    if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
    const data = await res.json();
    const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
    if (!url) throw new Error('no url');
    raw = await fetchBuf(url);
  } catch (e) { console.log('  roll ' + attempt + ': ' + e.message); continue; }
  // Opaque landscape crop on the panel's own base violet (any transparent
  // areas the model leaves must not punch holes in the plate).
  const rgb = await sharp(raw).flatten({ background: { r: 18, g: 10, b: 30 } })
    .resize(W, H, { fit: 'cover', position: 'centre' }).removeAlpha().png().toBuffer();
  const c = await calm(rgb);
  const ok = c.ratio <= 0.55;
  console.log('  roll ' + attempt + ': ' + (ok ? 'OK ' : 'REJECT (centre too busy) ') +
    'calm-ratio ' + c.ratio.toFixed(2) + ' (centre ' + c.centre.toFixed(1) + ' vs corners ' + c.corners.toFixed(1) + ')');
  await atomicWrite(join(STAGE, 'roll_' + attempt + '.png'), rgb);
  if (ok && (!best || c.ratio < best.ratio)) best = { rgb, ratio: c.ratio, attempt };
  if (ok && c.ratio <= 0.40) break;   // clearly calm - stop spending
}
if (!best) { console.error('ABORT: no roll kept its centre calm enough for text'); process.exit(2); }

// Bake: full-colour art at a flat 20% alpha, the panel_p5_shop / _enhance recipe.
const out = await sharp(best.rgb).ensureAlpha(ALPHA).webp({ quality: 90 }).toBuffer();
const m = await sharp(out).metadata();
const st = await sharp(out).stats();
const a = st.channels[3];
if (m.width !== W || m.height !== H || !m.hasAlpha || Math.round(a.mean) !== Math.round(ALPHA * 255) || a.max !== a.min) {
  console.error('ABORT: bad bake ' + m.width + 'x' + m.height + ' alpha mean ' + a.mean + ' min ' + a.min + ' max ' + a.max); process.exit(1);
}
await atomicWrite(dest, out);
// Preview at the modal's dark base so it reads as it will in-game.
const prev = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 11, g: 7, b: 18, alpha: 255 } } })
  .composite([{ input: out }]).png().toBuffer();
await atomicWrite(join(STAGE, 'preview_over_base.png'), prev);
console.log('ok roll ' + best.attempt + ' (' + Math.round(out.length / 1024) + ' KB, alpha ' + Math.round(a.mean) + '/255, calm-ratio ' + best.ratio.toFixed(2) + ') ->', dest);
