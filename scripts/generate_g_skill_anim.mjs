#!/usr/bin/env node
// Final-class (master) G-SKILL VFX animations — v0.26.504
// =============================================================================
// 9-frame looping VFX animations for the 17 master G-skill FX sprites, animated
// from the EXISTING Sprites/fx/<key> art via Ludo /assets/sprite/animate.
//
// NO-CUTOFF strategy (per user "ENSURE the sprite images do not get cut off"):
//   1. Pad the base with a transparent border (PAD frac) → headroom so any
//      slight model zoom can't clip the subject.
//   2. frame_size:-9 (True-Size) + motion-only HOLD prompt (no rotate/zoom/pan).
//   3. Resize every output frame to the EXACT padded dims → pixel-accurate
//      framing, identical aspect to the base, so the in-game spriteBurst blit
//      (fixed wpx×hpx box) shows the full sprite.
// Output -> Sprites/fx/anim/<key>_0..8.webp
//
//   node scripts/generate_g_skill_anim.mjs                 # dry-run
//   node scripts/generate_g_skill_anim.mjs --only lich --generate
//   node scripts/generate_g_skill_anim.mjs --generate      # all 17
// Needs LUDO_API_KEY. Resumable: skips a skill whose 9 frames already exist.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX_DIR = join(repoRoot, 'Sprites', 'fx');
const OUT_DIR = join(FX_DIR, 'anim');
const FRAMES = 9;
const PAD = Number(process.env.LUDO_ANIM_PAD || 0.12);   // transparent border each side (anti-cutoff headroom; env-overridable for re-pads)
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const HOLD = ' The effect stays centered at the EXACT same size, position and framing, fully inside the frame with empty margins around it — do NOT rotate, spin, translate, zoom, crop, mirror or resize it; animate ONLY the effect itself shimmering/pulsing in place.';
// master -> { file, prompt }. key = the LX_FX spriteKey the G skill spawns.
const FX = {
  warlord_banner:       { file: 'warlord_banner.png',       prompt: 'a heroic war banner / battle horn flourish (Warlord) — the banner ripples in the wind, golden rally-light pulses and radiates, sparks rising.' },
  doombringer_apoc:     { file: 'doombringer_apoc.png',     prompt: 'an apocalyptic dark explosion burst (Doombringer) — crimson-black destructive energy churns and flares, shockwave cracks pulse outward, embers shedding.' },
  crusader_aegis:       { file: 'crusader_aegis.png',       prompt: 'a holy golden shield aegis (Crusader) — radiant divine light pulses across the barrier, blessed sparkles orbit, a warm halo breathes.' },
  dragoon_skylance:     { file: 'dragoon_skylance.png',     prompt: 'a piercing sky-lance spear strike (Dragoon) — brilliant blue energy crackles along the spear, motion streaks pulse, sparks flicker at the tip.' },
  shadowlord_clones:    { file: 'shadowlord_clones.png',    prompt: 'three violet shadow-clone silhouettes (Shadowlord) — dark phantom energy wisps and flickers around them, spectral after-images shimmer in place.' },
  shinobi_seal:         { file: 'shinobi_seal.png',         prompt: 'a glowing paper talisman elemental seal (Shinobi) — runic symbols pulse and flicker through colours, the seal ring rotates its glow, energy crackling.' },
  nightreaper_eclipse:  { file: 'nightreaper_eclipse.png',  prompt: 'a dark eclipse death-mark sigil (Nightreaper) — a black sun corona flickers, violet death energy gathers and pulses inward, eerie glow breathing.' },
  phantom_voidrift:     { file: 'phantom_voidrift.png',     prompt: 'a violet void-rift portal with crossed daggers (Phantom) — the rift swirls and warps, spectral hands flicker, purple void energy crackles around the rim.' },
  sage_meteorshower:    { file: 'sage_meteorshower.png',    prompt: 'a fiery meteor-shower impact (Sage) — molten fireballs glow and flicker, flame licks and embers shed, a hot impact glow pulses.' },
  elementalist_cascade: { file: 'elementalist_cascade.png', prompt: 'a fire-ice-lightning elemental cascade (Elementalist) — the three elements swirl and pulse together, sparks crackle, frost shimmers, flames flicker in place.' },
  soul_vortex:          { file: 'soul_vortex.webp',         prompt: 'a swirling green soul-vortex pool (Lich) — ghostly souls spiral and drift inward, the vortex churns, an eerie necrotic glow pulses.' },
  hexmaster_grandhex:   { file: 'hexmaster_grandhex.png',   prompt: 'a grand dark-magic hex curse circle (Hexmaster) — purple hex runes orbit and flicker, dark-frost crackles, a cursed glow throbs.' },
  archbishop_grail:     { file: 'archbishop_grail.png',     prompt: 'a radiant holy grail blessing (Archbishop) — golden divine light pours and pulses from the grail, choral sparkles rise, a warm halo breathes.' },
  marksman_oneshot:     { file: 'marksman_oneshot.png',     prompt: 'a focused one-shot reticle / charged shot burst (Marksman) — the aiming glow tightens and pulses, energy charges with a sharp glint, sparks flicker.' },
  ballista_volley:      { file: 'ballista_volley.png',      prompt: 'a siege ballista bolt volley (Ballista) — the heavy bolts glint and vibrate with energy, motion streaks pulse, impact sparks flicker.' },
  beastmaster_pack:     { file: 'beastmaster_pack.png',     prompt: 'a summoned beast-pack call sigil (Beastmaster) — a feral rally glow pulses, claw-mark energy flickers, wild amber sparks rising.' },
  skyhunter_gale:       { file: 'skyhunter_gale.png',       prompt: 'a gale of wind-charged arrows (Skyhunter) — swirling cyan wind streaks pulse, the arrows glint, gusty energy crackles in place.' },
  // v0.26.x — Brok's forge enhancement result FX (anvil success / fail).
  forge_success:        { file: 'forge_success.png',        prompt: 'an anvil being STRUCK in a successful forge — a brilliant white-gold spark-burst flares and explodes at the strike point on top, golden sparks and embers shoot upward and shed, the triumphant warm glow pulses bright then settles. The anvil itself stays put.' },
  forge_fail:           { file: 'forge_fail.png',           prompt: 'a FAILED forge on an anvil — a sad grey-and-red smoke puff billows up and disperses, dim red embers fizzle and die out, a faint crack flickers and a broken shard wobbles, gloomy and cold. The anvil itself stays put.' },
  // v0.26.x — B-skill (Lv-50 ultimate) projectiles. Made EPIC: energy crackles
  // and pulses brilliantly while the shard/beam stays centered in frame.
  fx_shard:             { file: 'fx_shard.png',             prompt: 'an EPIC crystalline energy shard projectile — brilliant arcane energy crackles and pulses along its length, the sharp glinting edges flare bright then dim in a powerful rhythm, sparkling motes and a faint energy aura shimmer around it. It stays centered, same size and orientation.' },
  fx_voidbeam:          { file: 'fx_voidbeam.png',          prompt: 'an EPIC void energy lance/beam projectile — searing violet-white energy surges and crackles along its length, the core pulses brilliantly, electric arcs and void sparks flicker off it. It stays centered, same size and orientation, pointing the same way.' },
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
async function padBuf(buf) {
  const m = await sharp(buf).metadata();
  const px = Math.round(m.width * PAD), py = Math.round(m.height * PAD);
  return sharp(buf).extend({ top: py, bottom: py, left: px, right: px, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}
const smallUri = async (buf) => 'data:image/png;base64,' + (await sharp(buf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows;
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}

let keys = Object.keys(FX);
const only = arg('--only'); if (only) keys = only.split(',').filter((k) => FX[k] || Object.keys(FX).find(x => x.startsWith(k)));
if (only) keys = Object.keys(FX).filter(k => only.split(',').some(o => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching G-skill FX.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${keys.length} master G-skill FX -> Sprites/fx/anim/<key>_0..8.webp (9-frame, padded ${PAD * 100}%):\n`);
  for (const k of keys) console.log(`  ${k}  (${FX[k].file})`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// v0.26.x — env-configurable animate timeout. The default 150s was too short on
// slow-endpoint days (doombringer/dragoon timed out); the mop-up pass can set
// LUDO_REQ_TIMEOUT_MS=280000 to ride out the slow requests.
const ANIM_TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);

async function genOne(k) {
  const done = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(OUT_DIR, `${k}_${i}.webp`))))).every(Boolean);
  if (!force && done) return 'skip';
  let bp = join(FX_DIR, FX[k].file);
  if (!(await exists(bp))) { const alt = bp.replace(/\.(png|webp)$/, bp.endsWith('.png') ? '.webp' : '.png'); if (await exists(alt)) bp = alt; else return 'nobase'; }
  const padded = await padBuf(await readFile(bp));
  const { width: W, height: H } = await sharp(padded).metadata();
  const uri = await smallUri(padded);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(ANIM_TIMEOUT),
        body: JSON.stringify({ initial_image: uri, motion_prompt: FX[k].prompt + HOLD, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite-vfx' }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      await mkdir(OUT_DIR, { recursive: true });
      for (let i = 0; i < bufs.length; i++) await writeFile(join(OUT_DIR, `${k}_${i}.webp`), await sharp(bufs[i]).resize(W, H, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
      return `${W}x${H}`;
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(3000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${keys.length} G-skill FX animations (skip-existing: ${!force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip'); } else if (r === 'nobase') { console.log('NO BASE SPRITE'); } else { made++; console.log(`OK ${r}`); await sleep(800); } }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
