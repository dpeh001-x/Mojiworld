#!/usr/bin/env node
// Zodiac projectile sprites via Ludo /assets/image (transparent sprite-vfx),
// re-encoded to TRUE .png (LX_MOB_PROJ has no webp↔png fallback per-entry).
//   gemini_shard   (new)  — Gemini twin crystalline spire shard (beam + nova)
//   taurus_boulder (new)  — Taurus molten lava-cracked granite boulder (falling)
//   p_quake        (replace) — Taurus molten granite shockwave (regenerated)
//
//   node tools/gen_zodiac_proj.mjs                       # dry-run
//   node tools/gen_zodiac_proj.mjs --only gemini_shard --generate
//   node tools/gen_zodiac_proj.mjs --generate            # all 3
// Needs LUDO_API_KEY. Resumable: skips an existing file unless --force.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'projectiles');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const OUTLINE = ' Clean cel-shaded illustrative game art with a bold uniform 2-3 pixel black outline (#0a0612) around the entire silhouette, crisp rim-light, fully transparent background, single object centred, ~70% of a 512x512 square canvas, clearly readable at 64x64, no text, no watermark, no UI, no background, no ground shadow.';
const ITEMS = {
  gemini_shard: { file: 'p_gemini_shard.png', persp: 'Side-Scroll',
    prompt: 'A glowing TWIN crystalline spire shard projectile pointing to the RIGHT — two fused teal and violet aurora-crystal blades joined into one pointed shard, a faint airy shimmer aura and a few sparkling light motes trailing.' },
  taurus_boulder: { file: 'p_taurus_boulder.png', persp: 'Any perspective',
    prompt: 'A chunky molten granite boulder projectile — rough deep-grey stone cracked with white-hot molten lava fissures glowing orange-gold (#ffaa44), a white-hot core showing through the cracks, faint embers and heat-shimmer rising off it, roughly round and tumbling.' },
  p_quake: { file: 'p_quake.png', persp: 'Side-Scroll',
    prompt: 'A molten earthquake shockwave burst — jagged grey granite chunks and a cracked-earth fault-line erupting outward, the cracks glowing white-hot orange-gold (#ffaa44) with molten lava light, dust and embers flying, symmetric radial burst that reads as a ground shockwave.' },
  // Aetherion super-boss death orb (instakill). key in-engine is camelCase 'deathOrb'.
  deathorb: { file: 'p_deathorb.png', persp: 'Any perspective',
    prompt: 'A menacing void death-orb projectile — a pulsing pitch-black singularity core ringed by swirling violet-and-magenta event-horizon energy (#c8a8ff), faint cosmic starlight motes spiralling inward, a thin bright accretion ring and an ominous dark aura, roughly round and radial.' },
  // v0.26.513 — remaining zodiac boss projectiles (one dedicated design per sign).
  zodiac:      { file: 'p_zodiacbolt.png',   persp: 'Side-Scroll',
    prompt: 'A fiery cosmic RAM-bolt projectile (Aries) pointing right — a comet-like bolt fronted by curved glowing ram horns, a white-hot orange-red flame core, golden zodiac sparks and a fiery trail streaming behind.' },
  scale:       { file: 'p_scale.png',        persp: 'Any perspective',
    prompt: 'A golden balance-scale energy projectile (Libra) — twin luminous scale-pans hanging from a glowing horizontal beam, radiant gold-and-white equilibrium light, airy sparkles, a serene cosmic glow.' },
  droplet:     { file: 'p_droplet.png',       persp: 'Any perspective',
    prompt: 'A swirling twin-fish water orb projectile (Pisces) — a glassy teal-blue water sphere with two faint koi-fish silhouettes circling each other inside, bright water highlights and a few flung droplets.' },
  cancerBubble:{ file: 'p_cancerbubble.png', persp: 'Any perspective',
    prompt: 'A clawed water-bubble projectile (Cancer) — a translucent blue soap bubble with a faint crab-claw silhouette inside, a foamy rim, glassy iridescent sheen and tiny rising bubbles.' },
  icePillar:   { file: 'p_icepillar.png',    persp: 'Side-Scroll',
    prompt: 'A jagged ice-spire shard projectile (Capricorn) pointing up and forward — a sharp pale-cyan crystalline ice spike, glinting frost facets, cold vapour wisping off it, a bright icy gleam.' },
  markedShot:  { file: 'p_markedshot.png',   persp: 'Side-Scroll',
    prompt: 'A blazing marked arrow-star projectile (Sagittarius) pointing right — a fiery orange arrow-bolt overlaid with a glowing golden target-star reticle, a hot flame trail and sparks.' },
  // v0.26.517 — Queen Shroomaloo's boss spore-pod (her one projectile; was the
  // procedural fallback). DISTINCT from the common Shroom mob's `mspore` — this
  // is a queenly cradle-veil toxic pod, magenta/pink not the mob's orange.
  spore:       { file: 'p_spore.png',        persp: 'Any perspective',
    prompt: 'A CUTE chibi spore-pod projectile (Queen Shroomaloo) — a plump round kawaii mushroom spore with a soft pastel-pink and magenta domed cap dotted with little pale cream spots, a chubby rounded glossy body, big soft highlights, rosy cheeks, a gentle dreamy pink glow, and a few sparkly heart-shaped spore motes puffing off it cheerfully. Adorable, friendly, bouncy and round.' },
};

let keys = Object.keys(ITEMS);
const only = arg('--only'); if (only) keys = only.split(',').filter((k) => ITEMS[k]);
if (!keys.length) { console.error('No matching items.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${keys.length} zodiac projectile sprites (true PNG, sprite-vfx, Cel-Shaded):\n`);
  for (const k of keys) { console.log(`## ${k} -> Sprites/projectiles/${ITEMS[k].file}`); console.log(ITEMS[k].prompt + OUTLINE + '\n'); }
  console.log('# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 260000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchTimed(url, opts = {}) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error('timeout'); throw e; } finally { clearTimeout(t); }
}

async function genOne(k) {
  const dest = join(DIR, ITEMS[k].file);
  if (!force && await exists(dest) && k !== 'p_quake') return 'skip';
  const res = await fetchTimed(`${BASE}/assets/image`, {
    method: 'POST', headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_type: 'sprite-vfx', prompt: ITEMS[k].prompt + OUTLINE, art_style: 'Cel-Shaded', perspective: ITEMS[k].persp, aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false }),
  });
  if (!res.ok) throw new Error(`Ludo ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
  if (!url) throw new Error('no url: ' + JSON.stringify(data).slice(0, 160));
  const imgRes = await fetchTimed(url); if (!imgRes.ok) throw new Error('img fetch ' + imgRes.status);
  const raw = Buffer.from(await imgRes.arrayBuffer()); if (!raw.length) throw new Error('empty');
  const png = await sharp(raw).ensureAlpha().resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await mkdir(DIR, { recursive: true });
  if (await exists(dest)) await copyFile(dest, join(DIR, '_orig_backup_' + ITEMS[k].file)).catch(() => {});
  await writeFile(dest, png);
  const m = await sharp(png).metadata();
  return `${m.format} ${m.width}x${m.height} alpha=${m.hasAlpha}`;
}

console.log(`Generating ${keys.length} zodiac projectile sprites...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK ' + r); await sleep(800); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
