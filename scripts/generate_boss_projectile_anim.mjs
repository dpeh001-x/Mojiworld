#!/usr/bin/env node
// Boss projectile VFX animation runner — v0.26.340
// =============================================================================
// 9-frame looping VFX animations for the 16 boss-signature projectiles. Same
// framework as monsters/zodiac (eagle, frame_size:-9 True-Size, sliced from the
// spritesheet, resized to the EXACT base dimensions — pixel-accurate framing so
// the renderer's spin/orient rotation + size blit apply identically). The
// motion prompts animate ONLY the intrinsic effect (flames pulse, energy
// crackles, water churns) and explicitly do NOT rotate/translate the sprite —
// the game's _PROJ_SPRITE_BLIT already spins/orients it, so baked-in rotation
// would double up. Output -> Sprites/projectiles/anim/<key>_0..8.webp
//
//   node scripts/generate_boss_projectile_anim.mjs                 # dry-run
//   node scripts/generate_boss_projectile_anim.mjs --only comet --generate
//   node scripts/generate_boss_projectile_anim.mjs --generate      # all 16
// Needs LUDO_API_KEY. Resumable: skips a projectile whose 9 frames exist.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJ_DIR = join(repoRoot, 'Sprites', 'projectiles');
const OUT_DIR = join(PROJ_DIR, 'anim');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const HOLD = ' The sprite stays centered at the EXACT same size, position and framing — do NOT rotate, spin, translate, zoom, or mirror it; animate ONLY the effect itself in place.';
// key -> { file, prompt }  (boss attribution in comments)
const PROJ = {
  goo:        { file: 'p_goo.png',        prompt: 'a glossy green slime-ball projectile (King Gloopaloo) — its gooey surface wobbles, jiggles and ripples with surface tension, viscous highlights sliding, a couple of drips beading off.' },
  bubble:     { file: 'p_bossbubble.png', prompt: 'a large translucent cosmic bubble (Octobaby / Pisces) — its iridescent soap-film surface shimmers with shifting rainbow sheen, tiny starlight motes drift inside, gentle surface ripples.' },
  pincer:     { file: 'p_pincer.png',     prompt: 'a purple octopus tentacle-pincer claw (Octobaby) pointing right — the pincer opens and snaps slightly, suckers pulse, a magenta energy glow flickers along its edge.' },
  splash:     { file: 'p_splash.png',     prompt: 'a radial water-splash burst (Octobaby) — a foamy water crown and droplets expand and ripple outward then settle, glassy blue highlights glinting.' },
  quake:      { file: 'p_quake.png',      prompt: 'a brown-and-gold earthquake shockwave ring (Taurus) — the cracked-earth ring pulses, dust and rubble shake loose, a fault-line glow flickers along the cracks.' },
  stalactite: { file: 'p_stalactite.png', prompt: 'a pale-blue ice stalactite shard (Capricorn) pointing down/forward — frost crystals glint and shimmer, cold vapour wisps curl off it, a sharp icy gleam pulses along the tip.' },
  venom:      { file: 'p_venom.png',      prompt: 'a glowing green venom stinger dart (Scorpio) pointing forward — toxic droplets bead and drip from the barbed tip, sickly green energy pulses along the stinger.' },
  tsunami:    { file: 'p_tsunami.png',    prompt: 'a wide curling water wave (Cancer) — the foaming crest churns and rolls, spray flicks off the top, teal-blue highlights ripple through the water.' },
  starbeam:   { file: 'p_starbeam.png',   prompt: 'a radiant golden cosmic beam-bolt (Leo) pointing forward — brilliant starlight pulses and crackles along its length, sparkle motes orbit and shed.' },
  starburst:  { file: 'p_starburst.png',  prompt: 'a bright golden cosmic star (Leo) — its radiant points flare brighter and dimmer in a twinkle, glittering sparkles shed and a warm halo pulses.' },
  voidring:   { file: 'p_voidring.png',   prompt: 'a dark cosmic void ring (Aetherion) — deep purple-black event-horizon energy swirls around the ring, a faint starfield shimmers inside, violet light crackles along the rim.' },
  roar:       { file: 'p_roar.png',       prompt: 'concentric translucent sonic shockwave rings (lion / bull roar) — the sound rings pulse and ripple outward and fade, a faint air-distortion shimmer rippling between them.' },
  whirl:      { file: 'p_whirl.png',      prompt: 'a swirling water vortex / whirlpool (Aquarius) — the churning water spirals inward, foam and droplets swirl, teal highlights pulse (subtle internal motion only).' },
  comet:      { file: 'p_comet.png',      prompt: 'a fiery comet (Gravitos) pointing forward — a rocky core wreathed in crackling orange-and-violet flame, the flame trail flickers and licks, glowing embers shed off the tail.' },
  wave:       { file: 'p_gravwave.png',   prompt: 'a purple gravity-distortion energy wave (Gravitos) — warped space ripples pulse across it, violet energy crackles, a faint bent starfield shimmers within.' },
  gravdrop:   { file: 'p_gravdrop.png',   prompt: 'an ominous purple gravity death-marker glyph (Gravitos) — concentric warning rings throb, violet targeting energy gathers inward and pulses, a dark core flickers.' },
  // --- Wayfarer + Expedition monster projectiles (v0.26.341) ---
  mforgespark:{ file: 'mforgespark.png',  prompt: 'a molten forge-ember spark (Forgewight / Smith Golem) — the white-hot core pulses, orange sparks crackle and shed off it, a glowing heat-haze shimmers around it.' },
  mfirespit:  { file: 'mfirespit.webp',   prompt: 'a fiery fire-spit jet (Bellowsbat) pointing forward — the flame licks and flickers, a hot yellow-orange core pulses, embers trail off the tail.' },
  mghostshot: { file: 'mghostshot.png',   prompt: 'a spectral ghost-shot bolt (Spectre Cannoneer) pointing forward — a translucent blue-green phantom wisp, ghostly ectoplasm trails and shimmers, eerie glow pulsing.' },
  mink:       { file: 'mink.png',         prompt: 'a wispy semi-transparent ink cloud (Brinekraken) — soft translucent violet-black ink billows, swirls and roils with see-through smoky edges, thin tendrils curling and dissolving outward, a few droplets dispersing. Keep it diffuse, gauzy and cloud-like rather than a solid opaque blob.' },
  mlantern:   { file: 'mlantern.png',     prompt: 'an eerie soul-flame lantern wisp (Mournshade / Tower Seer) — a ghostly blue-green flame flickers and dances, faint embers rising, a haunting glow pulsing.' },
  mtidemark:  { file: 'mtidemark.png',    prompt: 'an arcane glyph/rune projectile (Tower Hexer) — a glowing magic sigil pulses, runic symbols shimmer within, teal-violet energy crackling along the edges.' },
  micicle:    { file: 'micicle.png',      prompt: 'a sharp ice-shard icicle (Tower Shardling) pointing forward — frost crystals glint, cold vapour wisps off it, a pale-cyan icy gleam pulses along the shard.' },
  mbonechip:  { file: 'mbonechip.png',    prompt: 'a jagged bone-shard (Tower Ossifer) pointing forward — a necrotic green-grey glow pulses along the bone, faint dust shedding, an eerie shimmer.' },
  mvoltzap:   { file: 'mvoltzap.png',     prompt: 'a crackling lightning bolt (Tower Stormcaller) pointing forward — electric arcs zigzag and snap along it, white-blue sparks flicker, a bright energized core pulses.' },
  mdark:      { file: 'mdark.webp',       prompt: 'a dark void-energy orb (Bone Wraith) — swirling black-purple shadow energy churns, wispy dark tendrils curl out, a faint violet glow pulses at its core.' },
  msplinter:  { file: 'msplinter.webp',   prompt: 'a sharp crystalline splinter shard (Razorgale / Shardlich / Tomb Keeper) pointing forward — a glinting edge catches light, faint energy shimmers along it, tiny fragments shedding.' },
  // v0.26.501 — Bloodthirsty Vermillion blood-red arrow (replaces the old blood-drop).
  mbloodbolt: { file: 'mbloodbolt.png',    prompt: 'a blood-red crimson ARROW projectile pointing right — slick wet blood beads and drips off the shaft, a faint red energy trail flickers and pulses behind it, the glowing metal arrowhead glints sharply.' },
  // v0.26.510 — animate the freshly-authored zodiac / super-boss projectiles.
  gemini_shard:   { file: 'p_gemini_shard.png',   prompt: 'a twin crystalline spire shard (Gemini) pointing right — teal and violet aurora-crystal blades glint and pulse, faint airy shimmer and sparkling light motes drift and flicker around it.' },
  taurus_boulder: { file: 'p_taurus_boulder.png', prompt: 'a molten granite boulder (Taurus) — white-hot orange lava cracks pulse and glow brighter and dimmer across the grey stone, faint embers shed and heat-shimmer rises off it.' },
  deathorb:       { file: 'p_deathorb.png',        prompt: 'a void death-orb singularity (Aetherion) — the pitch-black core pulses, the violet-magenta event-horizon ring swirls, cosmic starlight motes spiral inward, an ominous dark aura breathes.' },
  // v0.26.513 — remaining zodiac bosses (keys match the engine skill ids).
  zodiac:       { file: 'p_zodiacbolt.png',   prompt: 'a fiery cosmic ram-bolt (Aries) pointing right — the white-hot flame core pulses and flickers, the curved ram horns glint, embers shed and a fiery trail licks behind it.' },
  scale:        { file: 'p_scale.png',        prompt: 'a golden balance-scale energy projectile (Libra) — the twin pans gently sway into balance, radiant gold equilibrium light pulses brighter and dimmer, airy sparkles drift around it.' },
  droplet:      { file: 'p_droplet.png',      prompt: 'a twin-fish water orb (Pisces) — the two koi-fish silhouettes circle each other inside, the glassy water surface ripples and highlights shift, a few droplets shed.' },
  cancerBubble: { file: 'p_cancerbubble.png', prompt: 'a clawed water-bubble (Cancer) — the translucent bubble surface wobbles and ripples, the crab-claw silhouette inside flickers, tiny bubbles rise and the iridescent sheen shifts.' },
  icePillar:    { file: 'p_icepillar.png',    prompt: 'a jagged ice-spire shard (Capricorn) pointing up/forward — frost facets glint and sparkle, cold vapour wisps curl off it, a pale-cyan icy gleam pulses along the spike.' },
  markedShot:   { file: 'p_markedshot.png',   prompt: 'a blazing marked arrow-star (Sagittarius) pointing right — the orange flame trail flickers and licks, the golden target-star reticle pulses and rotates, hot sparks shed.' },
  // v0.26.517 — Queen Shroomaloo boss spore-pod (her signature projectile).
  spore:        { file: 'p_spore.png',         prompt: 'a cute kawaii pink mushroom spore-pod (Queen Shroomaloo) — its chubby round body gently squishes and breathes, the domed cap bobs and wobbles softly, its rosy cheeks and happy face stay adorable, a soft pink glow pulses brighter and dimmer, and a few sparkly heart-shaped spore motes puff and drift off it cheerfully.' },
  // v0.26.518 — King Koopaloo firebomb. Base is m_firebomb.webp; output frames
  // land at anim/firebomb_*.webp (key-named) to match the engine skill 'firebomb'.
  firebomb:     { file: 'm_firebomb.webp',      prompt: 'an explosive fire-bomb (King Koopaloo) — the molten orange-red core pulses and flares brighter and dimmer, flame licks flicker around the casing, hot embers and sparks shed and a heat-haze shimmers off it.' },
  // v0.26.x — Octobaby homing missiles (keys are camelCase to match the engine
  // skill ids octoHead / octoLeg, so frames land at anim/octoHead_*.webp etc.).
  octoHead:     { file: 'p_octohead.png',       prompt: 'an angry octopus-head homing missile (Octobaby) pointing right with a pink jet-trail behind it — the big glaring eye narrows, glances and occasionally blinks, the short curling tentacle wisps wriggle and writhe, the magenta-pink energy jet-trail flickers and pulses, a faint violet glow breathes around the head.' },
  octoLeg:      { file: 'p_octoleg.png',        prompt: 'a barbed octopus-tentacle dart (Octobaby) pointing right with round suckers along its underside — ONLY a small, subtle, contained in-place motion: the rubbery purple tentacle gently undulates and writhes, the pale suckers softly pulse and flex, and a tiny sharp glint travels along the metal barb tip. Keep it calm and small — absolutely NO explosion, NO starburst, NO big spiky star, NO expanding burst or shockwave, NO large flash; the dart stays the same size every frame.' },
  // v0.26.x — Warlord B-ult banner (player ULT projectile, "War of Banners").
  // Per user: only the FLAG cloth waves as it's thrown; the pole stays rigid.
  // Frames land at anim/p_ult_warlord_0..8.webp, which the engine plays via the
  // _BULT_ANIM_KEY -> _projAnimFrame path (drawProjectiles bspr branch).
  p_ult_warlord: { file: 'p_ult_warlord.png',   prompt: 'a vermilion war-banner on a rigid wooden pole (Warlord, "War of Banners") hurled forward to the right — the cloth FLAG portion billows, ripples and snaps as if streaming in the wind from being thrown, its trailing edge flapping and waving; the wooden pole and gold finial stay rigid, straight and unmoving. Keep it bold and readable — ONLY the fabric undulates in place, no other motion.' },
  // v0.26.x — Mage Z (magicBolt) energy orb gets a CUTE electric-bolt crackle.
  // Base p_mage_orb.webp; frames land at anim/bolt_0..8.webp (engine skill key
  // 'bolt'). The orb itself also spins in-engine, so animate ONLY the crackle.
  bolt: { file: 'p_mage_orb.webp', prompt: 'a cute round blue-and-yellow magic energy orb crackling with ELECTRICITY — bright electric-blue and white lightning arcs zap, fork and dance AROUND the orb, small sparks shed off in little flickers, and the glowing core pulses brighter and dimmer with each crackle. Lively, zappy and cute. Keep the orb the same size and centered; animate ONLY the crackling electricity and the core pulse, looping smoothly.' },
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const smallBaseUri = async (buf) => 'data:image/png;base64,' + (await sharp(buf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
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

let keys = Object.keys(PROJ);
const only = arg('--only'); if (only) keys = only.split(',').filter((k) => PROJ[k]);
if (!keys.length) { console.error('No matching projectiles.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${keys.length} boss projectiles -> anim/<key>_0..8.webp (9-frame VFX):\n`);
  for (const k of keys) console.log(`  ${k}  (${PROJ[k].file})`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genOne(k) {
  const done = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(OUT_DIR, `${k}_${i}.webp`))))).every(Boolean);
  if (!force && done) return 'skip';
  const bp = join(PROJ_DIR, PROJ[k].file);
  if (!(await exists(bp))) return 'nobase';
  let buf = await readFile(bp);
  // v0.26.510 — optional transparent padding (env LUDO_ANIM_PAD, e.g. 0.12) so
  // the animate model has headroom and frames can't clip the subject at the
  // edges (anti-cutoff). Off by default to preserve existing entries' framing.
  const PAD = Number(process.env.LUDO_ANIM_PAD || 0);
  if (PAD > 0) {
    const mm = await sharp(buf).metadata();
    const px = Math.round(mm.width * PAD), py = Math.round(mm.height * PAD);
    buf = await sharp(buf).extend({ top: py, bottom: py, left: px, right: px, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }
  const { width: W, height: H } = await sharp(buf).metadata();
  const uri = await smallBaseUri(buf);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: PROJ[k].prompt + HOLD, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite-vfx' }),
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

console.log(`Generating ${keys.length} boss projectile animations (skip-existing: ${!force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip'); } else if (r === 'nobase') { console.log('NO BASE SPRITE'); } else { made++; console.log(`OK ${r}`); await sleep(800); } }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
