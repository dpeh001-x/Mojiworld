#!/usr/bin/env node
// p_tsunami — regenerate the tsunami/tidal-sweep projectile sprite (ludo.ai)
// =============================================================================
// Per user: "regenerate p_tsunami sprite into something there is much nicer".
//
// The shipped art was a flat teal SLAB — a near-full-frame rectangle of water
// with squared-off sides and a scalloped top. It read as a wall or a curtain,
// not a wave, and because the content ran to the frame edge it looked sliced
// once the game trimmed it.
//
// This sprite serves TWO skills, and both are drawn with
// _PROJ_SPRITE_BLIT mode:'orient' — rotated to atan2(vy, vx) every frame:
//   • tsunami    — Cancer's horizontal water wave
//   • tidalSweep — Octobaby's grotto tidal sweep (wired v0.29.931)
// So the art must read as a wave travelling LEFT-TO-RIGHT along its own long
// axis, and must taper at both ends so any rotation looks deliberate.
//
// Prompt shape follows the hard-learned house recipe (see
// scripts/generate_dash_fx.mjs): SHORT and effect-first with explicit
// no-character negations — long "cute RPG …aesthetic" prefixes make this
// account's sprite model return chibi characters regardless of the effect
// described.
//
//   node scripts/generate_tsunami_proj.mjs                 # dry-run
//   node scripts/generate_tsunami_proj.mjs --generate      # write the file
//   flags: --force  --variants N  (writes p_tsunami_v1..vN.png to pick from)
// Needs LUDO_API_KEY. Never commit the key.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'projectiles');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Same compact style tail every other VFX generator uses, plus the
// taper/margin clauses that stop the art reading as edge-clipped.
const SUFFIX = ' special-effect for a 2D side-scroller game, simple flat cel-shaded anime style with bold dark outlines, minimal detail, clean bold simple shapes, vibrant saturated colors, game VFX element only, no character, no person, no creature, no text, every stroke tapers and fades to nothing well before the image border, nothing touching or clipped by the frame edge, generous empty margin on all sides, transparent background';

// Effect-first, and explicitly a SIDE-ON travelling wave rather than a body of
// water: the old art failed by being a filled rectangle, so the shape language
// here is all crest / curl / spray with a thin tapering tail.
const PROMPT =
  'A single cresting ocean wave seen from the side travelling to the right, '
  + 'one tall curling turquoise crest at the right end with a white foam lip curling over, '
  + 'the body sweeping back to the left and thinning to a fine tapered tail, '
  + 'a few small white foam droplets flicking off the crest, '
  + 'much wider than tall, strong sense of fast sideways motion, deep teal to bright cyan gradient,';

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Trim to drawn content, then CONTAIN at 82% on a transparent 768² canvas —
// matches the existing p_tsunami dimensions and the fx post-process recipe, so
// nothing downstream (blit size, aspect handling) has to change.
async function postProcess(raw) {
  let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
  const CANVAS = 768, INNER = Math.round(CANVAS * 0.82);
  const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, gravity: 'center' }])
    .png().toBuffer();
}

if (!has('--generate')) {
  console.log('# p_tsunami regeneration (ludo.ai)\n');
  console.log('  target : Sprites/projectiles/p_tsunami.webp  (768x768, transparent)');
  console.log('  used by: tsunami (Cancer wave) + tidalSweep (Octobaby) — both mode:orient\n');
  console.log('  prompt :', PROMPT.slice(0, 120) + '...');
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --variants N');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const variants = Math.max(1, Number(arg('--variants') || 1));

async function genOne(destPng) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT + SUFFIX }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 140)}`);
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(destPng, await postProcess(await fetchBuf(url)));
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}

let failed = 0;
for (let v = 1; v <= variants; v++) {
  const dest = join(OUT_DIR, variants === 1 ? '_p_tsunami_new.png' : `_p_tsunami_v${v}.png`);
  process.stdout.write(`  variant ${v} ... `);
  try { await genOne(dest); console.log('OK -> ' + dest); await sleep(800); }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${variants - failed} made, ${failed} failed.`);
console.log('Review the PNG(s), then convert the chosen one to Sprites/projectiles/p_tsunami.webp');
process.exit(failed ? 2 : 0);
