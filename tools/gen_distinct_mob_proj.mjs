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
// v0.29.391 — FLAT VARIANT. The OUTLINE above asks for "painterly" art with
// "crisp rim-light", and the request below pairs it with art_style
// 'Hand-Painted' — so a sprite meant to be SIMPLE was fighting its own style
// suffix. Three prompt rewrites for mbark ("no swirl", "no grain", "empty
// flat fill") all lost to it: ludo kept painting wood-grain rings because the
// suffix kept asking for painterly rendering. Keys listed in FLAT_KEYS get
// this suffix + art_style 'Illustration' instead, matching the flat cel path
// scripts/gen_remake_static.mjs uses. The other ten projectiles are correct
// as painterly and are untouched.
const FLAT_OUTLINE = ' Minimal FLAT VECTOR game icon, one solid uniform fill colour with NO gradient and NO texture, a single bold dark outline around the silhouette, hard flat cel style like a traffic-sign pictogram — absolutely no painterly rendering, no rim-light, no glossy sheen, no grain, no swirl, no rings, no interior detail of any kind. Fully transparent background, single object centred at ~70% of a 512x512 square, no text, no UI, no background, no ground shadow. Must read as one clean silhouette at ~30px in game.';
const FLAT_KEYS = new Set(['mbark']);
// key (= new in-engine m.shoot id) -> prompt. Orient-mode sprites point RIGHT.
const ITEMS = {
  // v0.30.x (per user "regenerate mhornshot to suit more like the monster that
  // uses it"). The shipped art was a smooth featureless pale crescent that read
  // as a banana or a moon sliver — it had nothing of Horncap in it. Horncap is
  // a cute mushroom with a RED cap covered in cream polka dots and two RIDGED
  // tan-gold horns curving out of it, so the shot it fires should obviously be
  // one of those horns: same ribbing, same gold, and a flick of the red-and-
  // cream cap at the broken base to tie it to the creature.
  // The horn is STRAIGHT, and that is deliberate rather than a miss. The first
  // wording asked for one "gently curved like a bull horn"; ludo drew a straight
  // tapered cone anyway on all three rolls, which is the better sprite -- a
  // CURVE is precisely what made the old art read as a banana at 38px, because
  // a crescent has no leading point to aim the eye. Asking for the straight
  // taper outright keeps a re-roll from wandering back to the crescent.
  mhornshot:    'A snapped-off HORN projectile pointing right -- a straight tapering tan-gold horn with clear raised ridges banded along its length like a ram horn, narrowing to a sharp pale ivory tip that leads the flight, the broken base at the back showing a small ring of cream and a fleck of red mushroom cap. Straight and dart-like, NOT curved, no crescent, no banana shape. A single inanimate horn object only. Simple, chunky, cartoon.',   // horny (Horncap)
  mquery:       'A wobbling spectral QUESTION MARK bolt projectile — a curling indigo-violet glowing question-mark glyph made of uncertain flickering ghost-light, slightly tilted as if hesitating, tiny sweat-drop sparkle beside it. Comedic, mystical, chunky cartoon.',           // young_confused_barnaby
  mossbaton:    'A spinning BONE BATON projectile — a polished ivory officer’s baton carved from a femur with knobbed ends and a thin gold band at its grip, slight motion blur arcs around it as it twirls. Simple, chunky, cartoon.',                                          // towerOssifer
  mspine:       'A venomous NEEDLE DART projectile pointing right -- one long thin tapered spike like a sea-urchin needle, banded teal and cream along its length, razor point with a tiny green venom droplet, two small comic speed-streaks behind it. A single inanimate needle object only. Simple, chunky, cartoon.',
  mgaleblade:   'A WIND SICKLE crescent projectile pointing right — a curved blade of compressed cyan-white wind with swirling air-current lines inside it and small trailing speed wisps, semi-translucent edges glowing. Sharp, elegant, cartoon.',                                 // razorgale
  mcryshard:    'A NECRO-CRYSTAL SHARD projectile pointing right — a jagged violet-magenta crystal spike with a darker amethyst core, eerie inner glow, two tiny orbiting crystal flecks. Arcane, sharp, chunky cartoon.',                                                            // shardlich
  // v0.29.383 — SIMPLIFIED per user "regenerate stumpy projectile sprites to
  // something simple". The old prompt (torn slab + wood-grain texture + sprout
  // leaf + trailing flecks) packed four ideas into a sprite that renders ~30px
  // and tumbles at spinRate 0.14 — it read as a brown smudge. One bold shape,
  // two colours, no accessories.
  // v2 — "BARK" alone made ludo draw a whole TREE STUMP (detailed, the exact
  // opposite of "simple"). v3 — "wood chip / splinter of a plank" then drew a
  // FAN OF FOUR PLANKS ("one solid object" ignored twice). v4 — the guitar-pick
  // anchor fixed the count but ludo still painted a decorative ring-swirl
  // inside ("no wood grain lines" ignored); per user the sprite must be
  // genuinely SIMPLE, so v5 demands an EMPTY flat fill in flat-vector terms.
  // Keep the pick anchor if this is ever re-rolled — it is what holds the
  // count at one.
  // v6 — even with every negation, the word "wooden" kept summoning a grain
  // swirl. Wood vocabulary removed entirely: it is just a brown shape now.
  mbark:        'A THICK DARK-BROWN OUTLINE surrounding EXACTLY ONE flat guitar-pick shape — the heavy dark border is the most important feature and must be clearly visible all the way around the silhouette. Inside that border: one single rounded triangle of flat uniform caramel-brown, with a completely EMPTY interior — no pattern, no swirl, no circles, no texture, no gradient, no highlight. Bold outlined sticker-style icon. Only this one shape in the whole image, nothing else.',   // stump
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
        // v0.29.391 — FLAT_KEYS route through the flat suffix + 'Illustration'
        // style; everything else keeps the original painterly pairing.
        body: JSON.stringify({ image_type: 'sprite-vfx', prompt: ITEMS[k] + (FLAT_KEYS.has(k) ? FLAT_OUTLINE : OUTLINE), art_style: FLAT_KEYS.has(k) ? 'Illustration' : 'Hand-Painted', perspective: 'Side-Scroll', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false }),
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
