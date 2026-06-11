#!/usr/bin/env node
// Distinct mob projectile sprites (de-share pass, v0.26.x) →
// Sprites/projectiles/<key>.png. 11 monsters that previously fired a shared
// generic projectile each get bespoke art (3px black outline). Mirrors
// tools/gen_plant_mob_proj.mjs (sprite-vfx, Hand-Painted, blank-rejection).
//   node tools/gen_distinct_mob_proj.mjs                       # dry-run
//   node tools/gen_distinct_mob_proj.mjs --generate            # all 11
//   flags: --only a,b | --force
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'projectiles');
const has = (f) => process.argv.slice(2).includes(f);
const arg = (f) => { const a = process.argv.slice(2); const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };

const OUTLINE = ' Cute painterly fantasy game projectile sprite, vibrant saturated colours, a bold uniform 3 pixel black outline (#0a0612) around the whole silhouette, crisp rim-light, fully transparent background, single object centred at ~70% of a 512x512 square, no text, no UI, no background, no ground shadow. Clearly readable at very small size (renders ~30px in game).';
// key (= new in-engine m.shoot id) -> prompt. Orient-mode sprites point RIGHT.
const ITEMS = {
  mquery:       'A wobbling spectral QUESTION MARK bolt projectile — a curling indigo-violet glowing question-mark glyph made of uncertain flickering ghost-light, slightly tilted as if hesitating, tiny sweat-drop sparkle beside it. Comedic, mystical, chunky cartoon.',           // young_confused_barnaby
  mossbaton:    'A spinning BONE BATON projectile — a polished ivory officer’s baton carved from a femur with knobbed ends and a thin gold band at its grip, slight motion blur arcs around it as it twirls. Simple, chunky, cartoon.',                                          // towerOssifer
  mspine:       'A venomous NEEDLE DART projectile pointing right -- one long thin tapered spike like a sea-urchin needle, banded teal and cream along its length, razor point with a tiny green venom droplet, two small comic speed-streaks behind it. A single inanimate needle object only. Simple, chunky, cartoon.',
  mgaleblade:   'A WIND SICKLE crescent projectile pointing right — a curved blade of compressed cyan-white wind with swirling air-current lines inside it and small trailing speed wisps, semi-translucent edges glowing. Sharp, elegant, cartoon.',                                 // razorgale
  mcryshard:    'A NECRO-CRYSTAL SHARD projectile pointing right — a jagged violet-magenta crystal spike with a darker amethyst core, eerie inner glow, two tiny orbiting crystal flecks. Arcane, sharp, chunky cartoon.',                                                            // shardlich
  mbark:        'A jagged BARK CHUNK projectile — a torn slab of mossy brown tree bark with rough wood-grain texture, one small green sprout leaf still attached, splinter flecks trailing. Earthy, chunky, cartoon.',                                                                 // stump
  mrivet:       'A white-hot MOLTEN RIVET projectile — a short thick iron rivet glowing orange-white at its center with heat shimmer, tiny sparks spitting off it, dark forged-metal ends. Industrial, hot, chunky cartoon.',                                                          // forgewight
  mcoffinshard: 'A haunted COFFIN SPLINTER projectile pointing right — a sharp shard of aged dark coffin wood wreathed in ghostly green flame, a tiny bent grave-nail embedded in it, eerie ember flecks. Spooky, chunky, cartoon.',                                                  // tombWraith
  mstormorb:    'A crackling STORM ORB projectile — a sphere of dark thundercloud with miniature lightning bolts arcing around its equator like a ring, electric blue-white glow, tiny rain flecks. Stormy, energetic, chunky cartoon.',                                              // towerStormcaller
  mfeather:     'A radiant FEATHER BLADE projectile pointing right — a glowing golden-white angelic feather stiffened into a dart, luminous core, soft halo sparkles drifting off its trailing edge. Holy, elegant, cartoon.',                                                        // seraph
  mhexbolt:     'A cursed HEX BOLT projectile -- a violet evil-eye orb: one stylized glowing magenta eye centred in a plain dark thorned iron ring, wisps of curse-smoke curling off it. The ring is SMOOTH BARE METAL with thorn spikes only -- absolutely NO letters, NO runes, NO characters, NO symbols engraved anywhere. Witchy, ominous, chunky cartoon.',
};

let keys = Object.keys(ITEMS);
const only = arg('--only'); if (only) keys = only.split(',').filter((k) => ITEMS[k]);
if (!has('--generate')) {
  console.log(`# ${keys.length} distinct mob projectile sprites -> Sprites/projectiles/<key>.png\n`);
  for (const k of keys) console.log(`## ${k}`);
  console.log('# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 280000);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchTimed(url, opts = {}) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error('timeout'); throw e; } finally { clearTimeout(t); }
}
async function genOne(k) {
  const dest = join(DIR, k + '.png');
  if (!has('--force') && await exists(dest)) return 'skip';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetchTimed(`${BASE}/assets/image`, {
        method: 'POST', headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite-vfx', prompt: ITEMS[k] + OUTLINE, art_style: 'Hand-Painted', perspective: 'Side-Scroll', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false }),
      });
      if (!res.ok) throw new Error(`Ludo ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const imgRes = await fetchTimed(url); if (!imgRes.ok) throw new Error('img fetch ' + imgRes.status);
      const raw = Buffer.from(await imgRes.arrayBuffer()); if (!raw.length) throw new Error('empty');
      const png = await sharp(raw).ensureAlpha().resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const { data: rawPx, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
      let nz = 0; for (let i = 3; i < rawPx.length; i += 4) if (rawPx[i] > 16) nz++;
      if (nz / (info.width * info.height) < 0.01) throw new Error('blank generation');
      await mkdir(DIR, { recursive: true }); await writeFile(dest, png);
      return `png cov ${(100 * nz / (info.width * info.height)).toFixed(1)}%`;
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(2500 * attempt); }
  }
  throw lastErr;
}
console.log(`Generating ${keys.length} distinct mob projectile sprites...`);
let made = 0, skip = 0, fail = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skip++; console.log('skip'); } else { made++; console.log('OK ' + r); await sleep(700); } }
  catch (e) { fail++; console.log('FAIL: ' + e.message); }
}
console.log(`Done. ${made} made, ${skip} skipped, ${fail} failed.`);
process.exit(fail ? 2 : 0);
