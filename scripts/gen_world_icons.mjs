#!/usr/bin/env node
// World-map REGION ICONS (ludo.ai text->sprite). One cute, distinct emblem per
// world-map node, keyed by MAPS id, dropped at Sprites/world/regions/<id>.webp.
// The W-map renderer (WM_REGION_ICON registry) draws these as SVG <image>, and
// falls back to the existing _WM_BIOME_ICON emoji when a sprite isn't present —
// so a partial run degrades gracefully.
//
//   node scripts/gen_world_icons.mjs                      # dry-run (print prompts)
//   node scripts/gen_world_icons.mjs --only town,forest --generate
//   node scripts/gen_world_icons.mjs --generate           # all missing
//   node scripts/gen_world_icons.mjs --generate --force   # all, overwrite
// Needs LUDO_API_KEY. Existing files are backed up to regions/_backup/ first.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'world', 'regions');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Cute-emblem style lock — flat MapleStory-ish sticker look, bold ~2-3px dark
// outline, single focal motif, reads at ~36px. Pair with art_style Illustration.
const PREFIX =
  'A single cute standalone game sprite of: ';
const SUFFIX =
  '. Pure transparent background — ALPHA CHANNEL ONLY, absolutely NOTHING behind the ' +
  'subject: no background, no scene, no sky, no ground, no cast shadow, no circle, no ' +
  'disc, no halo, no badge, no coin, no tile, no frame, no border, no card, no panel. ' +
  'Just the object alone, floating on full transparency. Square canvas, subject ' +
  'centered and filling ~80% with a clean empty margin on every side, nothing touching ' +
  'the edges. ABSOLUTELY NO TEXT (no letters, numbers, runes, watermark). FLAT cute ' +
  'cel-shaded MapleStory style: only 2-3 HARD flat-color shade steps with crisp hard ' +
  'edges — NO soft gradients, NO airbrush, NO glossy 3D sheen, NO photoreal detail, ' +
  'NOT pixel-art, NOT blocky. BOLD clean dark outline about 2-3px thick with even ' +
  'consistent weight all the way around (a die-cut sticker look). Vibrant saturated ' +
  'colors, adorable, chunky rounded friendly shapes. Simple and low-detail so it reads ' +
  'clearly at tiny 36px in-game size.';

// id -> cute subject, one distinct emblem per world-map node. Missing ids keep
// their _WM_BIOME_ICON emoji fallback. Keep WM_REGION_ICON_IDS (in the game) in
// sync with these keys. Zodiac (zod_*) + Mirror Tower (tower_b*) intentionally
// keep their already-distinctive glyphs and are omitted.
const REGIONS = {
  // --- Batch 1: the named regions on the reference screenshot ---
  town:              'a cozy golden fantasy town archway with a little marble fountain, warm dawn glow',
  forest:            'a plump round emerald-green shade tree with a tiny sparkle leaf',
  mushroom:          'a chubby red toadstool mushroom with white polka dots and a happy tilt',
  ancient:           'a gnarled ancient elder tree with mossy roots and one glowing golden leaf',
  wildflowerPlains:  'a cheerful little bouquet cluster of a daisy and a pink tulip on a grassy tuft',
  glasswindSteppe:   'a single floating pale-blue glass crystal shard with a soft swirl of wind around it',
  glasswindSteppe2:  'two sharp crossed translucent pale-blue glass razor-shards, windswept',
  glasswindHamlet:   'a cute frosted little manor house with an icy-blue roof and a soft snow cap',
  gravitosArena:     'a swirling cosmic singularity, a small black hole with a glowing purple event-horizon ring',
  wayfarersLantern:  'a warm glowing red paper lantern hanging from a little hook, gentle flame',
  wayfarersLantern2: 'a glowing golden star-gate archway with a bright twinkling star in its center',
  boss:              'a shiny golden royal crown set with a single pink heart-gem',
  bubbleGrotto:      'a glossy cluster of translucent soap bubbles with one tiny flower blooming inside',
  witheringTide2:    'a cute rusted ship anchor tangled in strands of teal seaweed, dripping',
  abyssalTrench:     'an adorable deep-sea anglerfish with a glowing round lure lantern, dark blue water',
  // --- Batch 2: early / mid overworld ---
  slimeCave:         'an adorable translucent blue water-slime droplet with a shiny highlight and big eyes',
  sunsetBeach:       'a cute orange setting sun over a little curling ocean wave with a palm frond',
  duneSands:         'a cute golden sand dune with a tiny round cactus and a sun',
  cryptHollow:       'a cute mossy round gravestone with a friendly little white ghost wisp beside it',
  candyCanyon:       'a cute swirl lollipop and a wrapped candy, pink and red stripes',
  bubblegumSwamp:    'a cute glossy pink bubblegum bubble blob with a tiny sparkle',
  pearlBathhouse:    'a cute pink lotus flower floating on a little pool with a pearl',
  stardustAtrium:    'a cute cluster of golden sparkly stars and a shooting star trail',
  skyGarden:         'a cute fluffy white cloud with a little pink flower growing on top',
  frostbiteHollow:   'a cute little snow igloo with an icy-blue glow and a snowflake',
  frozenPeak:        'a cute snowy mountain peak with a single icicle and a snow cap',
  lavaCavern:        'a cute glowing molten lava blob with a small flame and orange cracks',
  octopusGrotto:     'an adorable round purple octopus with big friendly eyes and curly tentacles',
  sauroSlope:        'a cute chubby green baby dinosaur with tiny back plates',
  krookThrone:       'a cute round turtle with a shiny spiky green shell',
  tidalLagoon:       'a cute curling turquoise ocean wave with a little spiral seashell',
  graniteBluffs:     'a cute rounded grey boulder with a patch of green moss on top',
  thunderPlateau:    'a cute dark storm cloud with a bright yellow lightning bolt',
  honeycombHollow:   'a cute golden honeycomb hexagon with a tiny happy bee and a honey drip',
  coralReef:         'a cute branch of pink and orange coral with a tiny bubble',
  kelpForest:        'a cute swaying green kelp frond with a couple of round bubbles',
  everdawn_megamall: 'a cute pink shopping bag with a golden star and a little handle',
  // --- Batch 3: coast / celestial / faction / gauntlet ---
  sanctum:           'a cute floating celestial temple, a small marble shrine on a cloud with a glow',
  celestialSpire:    'a cute glowing golden halo with tiny white angel wings',
  tidepoolShoals:    'a cute round tropical fish, orange and white stripes, in a splash of water',
  stormCrest:        'a cute grey thundercloud crowning a small rocky peak with a spark',
  magmaFoundry:      'a cute little volcano with a puff of smoke and a trickle of orange lava',
  magmaFoundry2:     'a cute glowing blacksmith anvil with orange embers floating up',
  sundered_forge:    'a cute crossed blacksmith hammer and anvil with a spark',
  witheringTide:     'a cute rusted ship anchor with a small teal wave curling behind it',
  hollowSepulchre:   'a cute pale stone funerary urn with a soft blue wisp rising',
  hollowSepulchre2:  'a cute friendly round white skull with a tiny lit candle on top',
  wayfarersLantern1: 'a cute brass oil lamp with a warm glowing flame',
  boneGraveyard:     'a cute mossy wooden coffin with little flowers growing on it',
  boneGraveyard2:    'a cute round spiderweb with a tiny friendly spider',
  boneGraveyard3:    'a cute friendly white ghost wearing a tiny golden crown',
  verdantHollow:     'a cute bright green leaf sprout with a dewdrop',
  bloomhaven:        'a cute little cottage with a tulip-pink flower roof',
  thornspireThicket: 'a cute thorny green vine curling around a single red rose',
  shadowWovenHood:   'a cute little dark ninja mask with a red headband and big eyes',
  hiddenPagoda:      'a cute red-roofed three-tier pagoda tower',
  bastion:           'a cute rounded knight heater shield with a golden cross emblem',
  bastionThrone:     'a cute ornate golden royal throne chair with red cushion',
  bastionRampart:    'a cute pair of crossed silver swords with golden hilts',
  azureAcademia:     'a cute glowing blue crystal ball on a little stand with sparkles',
  azureAbode:        'a cute floating bubble with a tiny cloud house inside',
  jadeGrove:         'a cute pink cherry-blossom branch with a few petals falling',
  emeraldVillage:    'a cute cluster of little green-roofed cottages',
  reachOfVermillion: 'a cute wooden bow with a single red-feathered arrow',
  // --- Batch 4: clockwork / distorted / blockland / dimensions ---
  clockworkUnderpassLobby: 'a cute red carnival ticket stub with a star punch',
  clockworkSpire:    'a cute shiny brass clockwork gear cog',
  clockworkExpress:  'a cute little green steam locomotive train engine with a smoke puff',
  distortedThreshold:'a cute swirling purple portal vortex with sparkles',
  fracturedReflection:'a cute ornate hand mirror with a small crack and a glint',
  confusedVigil:     'a cute half-melted candle with a flickering warm flame',
  tower:             'a cute tall slender wizard tower with a pointed blue roof',
  innerDimension:    'a cute glowing cyan diamond gem floating with sparkles',
  interdimensionalAscension: 'a cute bright shooting star with a rainbow trail',
  zodiacHall:        'a cute glowing golden star medallion with a ring of tiny stars',
  blockland_meadow:  'a cute soft brown toy teddy bear sitting',
  blockland_grove:   'a cute little tree built from red toy building bricks',
  blockland_dunes:   'a cute stack of yellow toy building blocks',
  blockland_quarry:  'a cute toy pickaxe resting on a grey brick block',
  blockland_outpost: 'a cute little yellow toy construction crane',
  blockland_citadel: 'a cute chunky toy-brick tiger with a friendly face',
  blockland_apex:    'a cute green toy-brick T-rex dinosaur',
};

const apiKey = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(REGIONS);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').includes(k));
if (!keys.length) { console.error('No matching region. Valid: ' + Object.keys(REGIONS).join(', ')); process.exit(1); }

if (!has('--generate')) {
  console.log('# DRY RUN — gen_world_icons. ' + keys.length + ' icon(s). Add --generate to run:\n');
  for (const k of keys) console.log('## ' + k + '  ->  Sprites/world/regions/' + k + '.webp\n' + PREFIX + REGIONS[k] + SUFFIX + "\n");
  process.exit(0);
}
if (!apiKey) { console.error('LUDO_API_KEY env var is required for --generate.'); process.exit(1); }
const force = has('--force');
const CANVAS = 256, INNER = Math.round(CANVAS * 0.92);   // small: icons draw at ~36px

async function genOne(k) {
  const dest = join(OUT_DIR, k + '.webp');
  if (!force && await exists(dest)) return 'skip';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Illustration', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + REGIONS[k] + SUFFIX }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 140)}`);
      await mkdir(OUT_DIR, { recursive: true });
      if (await exists(dest)) { const bdir = join(OUT_DIR, '_backup'); await mkdir(bdir, { recursive: true }); await copyFile(dest, join(bdir, basename(dest))); }
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim({ threshold: 10 }).toBuffer(); } catch { content = raw; }
      const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
      const out = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }]).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
      await writeFile(dest, out);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${keys.length} world-map icon(s) (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip (use --force)'); } else { made++; console.log('OK'); await sleep(800); } }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
