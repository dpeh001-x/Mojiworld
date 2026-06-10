#!/usr/bin/env node
// Static-sprite REMAKES (ludo.ai text->sprite, /assets/image · image_type:sprite).
// =============================================================================
// One clean cel-shaded remake per asset, dropped straight onto its existing
// on-disk path (the in-game loaders key off these exact filenames):
//   • p_pincer          -> Sprites/projectiles/p_pincer.png   (Octobaby pincer proj)
//   • gravitos_soulring -> Sprites/fx/gravitos_soulring.png    (Soul-Drain telegraph)
//   • wolf_alpha        -> Sprites/summons/wolf_alpha.webp     (Beastmaster summon base)
// After wolf_alpha lands, regen its walk/attack frames with:
//   node scripts/generate_summon_anim.mjs --only wolf_alpha --generate --force
//
//   node scripts/gen_remake_static.mjs                       # dry-run (print prompts)
//   node scripts/gen_remake_static.mjs --only p_pincer --generate
//   node scripts/gen_remake_static.mjs --generate --force    # all three, overwrite
// Needs LUDO_API_KEY. Existing files are backed up to <dir>/_backup_remake/ first.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Shared style lock — paste-equivalent of the project's other ludo prefixes:
// transparent, wordless, soft painterly cel-shaded anime, bold clean outline.
const PREFIX =
  'Sprite for a cute 2D side-scroller RPG in the Mojiworld aesthetic. ' +
  'Pure transparent background, alpha only — no scene, no ground tile, no frame. ' +
  '768x768 square canvas. ABSOLUTELY NO TEXT of any kind (no letters, numbers, ' +
  'runes, watermark). Soft painterly cel-shaded anime style, bold clean dark ' +
  'outline, glossy highlights, vibrant saturated colors, smooth soft gradients ' +
  '(NOT pixel-art, NOT blocky). Centered, subject fills ~80% of the canvas, with ' +
  'a clean transparent margin on all sides. Reads clearly at small in-game size. ';

// v0.26.650 — FLAT MapleStory prefix for assets that want the simple 2D
// illustrative look instead of the painterly default: hard flat cel-shade
// steps (no gradients), minimal detail, balanced (non-chibi) proportions.
// Pair with art_style:'Illustration' on the item.
const FLAT_PREFIX =
  'Clean simple 2D MapleStory-style game sprite. Pure transparent background, ' +
  'alpha only — no scene, no ground tile, no frame, no panel. 768x768 square ' +
  'canvas. ABSOLUTELY NO TEXT of any kind (no letters, numbers, runes, ' +
  'watermark). FLAT CEL-SHADED illustration: only 2-3 HARD flat-color shade ' +
  'steps per area with crisp hard shadow edges — absolutely NO soft gradients, ' +
  'NO airbrushed shading, NO painterly rendering, NO glossy 3D sheen, NO ' +
  'photoreal detail, NOT pixel-art, NOT blocky. Simple clean anime shapes, ' +
  'MINIMAL detail, bold clean dark outline. Balanced near-natural proportions ' +
  '(NOT chibi, NOT super-deformed, NOT a tiny round mascot, NOT a big-head ' +
  'baby). Centered, subject fills ~80% of the canvas with a clean transparent ' +
  'margin on all sides. Reads clearly at small in-game size. ';

// v0.26.651 — CUTE flat prefix. Keeps FLAT_PREFIX's simple 2D illustrative
// shading (hard cel-shade steps, low detail, no painterly gloss) but pushes
// APPEAL: big round friendly eyes, soft rounded shapes, gentle happy face,
// rosy cheeks, a slightly-larger-than-natural cute head (the v2 flat pass read
// as "ugly / not cute"; v1 painterly was cute but over-detailed — this is the
// middle ground). Pair with art_style:'Illustration'.
const CUTE_FLAT_PREFIX =
  'Clean simple 2D cute game sprite, MapleStory / cute mascot style. Pure ' +
  'transparent background, alpha only — no scene, no ground tile, no frame, no ' +
  'panel. 768x768 square canvas. ABSOLUTELY NO TEXT of any kind. FLAT ' +
  'CEL-SHADED: only 2-3 HARD flat-color shade steps per area with crisp hard ' +
  'edges — absolutely NO soft gradients, NO airbrushed shading, NO painterly ' +
  'rendering, NO glossy 3D sheen, NO photoreal detail, NOT pixel-art, NOT ' +
  'blocky. Simple clean shapes, LOW detail, bold clean dark outline. VERY CUTE ' +
  'and appealing: BIG round friendly expressive eyes with bright white ' +
  'catch-light sparkles, soft rounded body shapes, a gentle happy smiling ' +
  'expression, soft rosy cheeks. A cute slightly-large head (adorable, but ' +
  'still a real little animal — NOT a creepy flat face, NOT an over-detailed ' +
  'render, NOT super-deformed). Centered, subject fills ~80% of the canvas with ' +
  'a clean transparent margin on all sides. Reads clearly at small in-game size. ';

const ITEMS = {
  p_pincer: {
    dest: join(repoRoot, 'Sprites', 'projectiles', 'p_pincer.png'),
    fmt: 'png',
    prompt:
      'A single glossy PURPLE crab/octopus PINCER CLAW projectile, a curved ' +
      'two-part snapping claw with a smooth violet body, lighter lavender ' +
      'highlights and a deep purple core, the open claw POINTING and snapping ' +
      'toward the RIGHT (it flies rightward). Bold dark-purple outline. Cute but ' +
      'menacing. Just the claw — no arm, no tentacle, no creature. The claw is ' +
      'fully ISOLATED on a 100% EMPTY TRANSPARENT background — absolutely NO ' +
      'colored backdrop, NO purple fill, NO square panel, NO box or border ' +
      'behind it; only the claw on alpha.',
  },
  gravitos_soulring: {
    dest: join(repoRoot, 'Sprites', 'fx', 'gravitos_soulring.png'),
    fmt: 'png',
    prompt:
      'A glowing SOUL-DRAIN telegraph RING seen head-on: a bright violet/amethyst ' +
      'energy ring with a luminous cyan-white inner rim, wispy lavender soul ' +
      'streamers and tiny drifting spirit motes spiralling INWARD toward the ' +
      'hollow centre, faint additive glow. Ominous, magical, ghostly. A clean ' +
      'circular RING (mostly empty in the middle, not a solid orb).',
  },
  // v0.26.650 — wolf-trio restyle. v2 per user: SIMPLER flat 2D MapleStory look
  // (art_style 'Illustration' + FLAT_PREFIX) — the painterly v1 was too detailed
  // and too chibi. Now: hard flat cel-shade steps (no gradients/gloss), minimal
  // detail, balanced near-natural proportions (not chibi). Each keeps its colour
  // identity; three-quarter side view, whole body in frame.
  wolf: {
    dest: join(repoRoot, 'Sprites', 'summons', 'wolf.webp'),
    fmt: 'webp', art_style: 'Illustration', prefix: CUTE_FLAT_PREFIX,
    prompt:
      'A cute GREY WOLF PUP companion, full body, friendly summoned ally, ' +
      'three-quarter side view. Plain soft grey fur with a lighter pale-grey ' +
      'chest and muzzle, BIG round friendly dark eyes with white sparkle ' +
      'highlights, perky rounded ears, a happy little smile with one tiny fang, ' +
      'soft rosy cheeks, a big fluffy tail. Adorable and friendly. Clean simple ' +
      'flat shapes, low detail. The WHOLE wolf inside the frame, nothing cropped.',
  },
  wolf_alpha: {
    dest: join(repoRoot, 'Sprites', 'summons', 'wolf_alpha.webp'),
    fmt: 'webp', art_style: 'Illustration', prefix: CUTE_FLAT_PREFIX,
    prompt:
      'A cute ALPHA WOLF companion, full body, friendly summoned ally, ' +
      'three-quarter side view. Dark charcoal-slate grey fur, a fluffy white ' +
      'chest ruff, BIG round friendly YELLOW eyes with white sparkle highlights, ' +
      'a small RED flower behind one ear, a happy little smile, soft rosy cheeks, ' +
      'a big bushy tail. Confident but adorable. Clean simple flat shapes, low ' +
      'detail. The WHOLE wolf inside the frame, nothing cropped.',
  },
  wolf_sky: {
    dest: join(repoRoot, 'Sprites', 'summons', 'wolf_sky.webp'),
    fmt: 'webp', art_style: 'Illustration', prefix: CUTE_FLAT_PREFIX,
    prompt:
      'A cute SKY-FOX WOLF companion, full body, friendly summoned ally, ' +
      'three-quarter side view. Soft cream and pale-gold fur with a few cyan-teal ' +
      'sky markings, a fluffy cream chest, one small pair of feathery wing-tufts, ' +
      'BIG round friendly TEAL-cyan eyes with white sparkle highlights, a happy ' +
      'little smile, soft rosy cheeks, a big fluffy cream tail with a teal tip. ' +
      'Light, airy and adorable. Clean simple flat shapes, low detail. The WHOLE ' +
      'creature inside the frame, nothing cropped.',
  },
  eagle: {
    dest: join(repoRoot, 'Sprites', 'summons', 'eagle.webp'),
    fmt: 'webp', art_style: 'Illustration', prefix: FLAT_PREFIX,
    prompt:
      'A GOLDEN EAGLE companion flying with wings spread, three-quarter view facing ' +
      'slightly RIGHT, wings held roughly level. Simple flat shapes: golden-yellow ' +
      'and warm brown wings, a clean cream-white head, a bright yellow beak, one ' +
      'bold alert eye, feathers drawn as a few clean simple shapes (NOT many small ' +
      'detailed feathers). Normal eagle proportions. The WHOLE eagle with full ' +
      'wingspan is inside the frame with a generous transparent margin — nothing ' +
      'cropped.',
  },
  // Octobaby (Eight-Mood Tyrant) homing-missile projectiles. Drawn in 'orient'
  // mode (rotated to velocity), so author them pointing toward the RIGHT.
  p_octohead: {
    dest: join(repoRoot, 'Sprites', 'projectiles', 'p_octohead.png'),
    fmt: 'png',
    prompt:
      'A small menacing OCTOPUS-HEAD homing missile projectile flying toward the ' +
      'RIGHT. A round bulbous magenta-and-violet octopus head (deep purple shell ' +
      'crown on top) with one big angry glaring eye, a few short curling tentacle ' +
      'wisps trailing BEHIND it to the left like a comet tail, a faint pink energy ' +
      'glow. Bold dark outline, glossy cel-shading. Cute but threatening. The head ' +
      'is fully ISOLATED on a 100% EMPTY TRANSPARENT background — absolutely NO ' +
      'colored backdrop, NO panel or box behind it; only the projectile on alpha.',
  },
  p_octoleg: {
    dest: join(repoRoot, 'Sprites', 'projectiles', 'p_octoleg.png'),
    fmt: 'png',
    prompt:
      'A single severed OCTOPUS TENTACLE dart homing missile flying toward the ' +
      'RIGHT, pointed barbed tip leading on the right, the thick end with round ' +
      'suckers trailing behind on the left. Purple-and-magenta rubbery tentacle ' +
      'with a row of pale suckers underneath, a sharp curved hooked tip, a faint ' +
      'pink motion shimmer behind it. Bold dark outline, glossy cel-shading. ' +
      'Cute but menacing. The tentacle is fully ISOLATED on a 100% EMPTY ' +
      'TRANSPARENT background — absolutely NO colored backdrop, NO panel or box ' +
      'behind it; only the projectile on alpha.',
  },
  // Bonebos'n — Withering Tide twin-cutlass pirate skeleton (Lv 44). Monster
  // base sprite: full body, chibi, facing slightly LEFT (matches the roster).
  bonebosn: {
    dest: join(repoRoot, 'Sprites', 'monsters', 'bonebosn.png'),
    fmt: 'png',
    prompt:
      'A cute but menacing chibi PIRATE SKELETON enemy, full body, standing in a ' +
      'ready dual-wield combat stance facing slightly toward the LEFT. A bare bony ' +
      'grinning skull with glowing CYAN eye-sockets, wearing a big black pirate ' +
      'TRICORN hat with a small skull-and-crossbones emblem, a tattered dark-RED ' +
      'pirate captain coat with gold trim over rib bones, a brown belt and boots. ' +
      'It DUAL-WIELDS TWO curved silver CUTLASS swords — one in EACH bony hand, ' +
      'held out to the sides ready to slash (clearly two separate swords). Big head, ' +
      'small body (chibi proportions). Bold thick dark outline, glossy cel-shading, ' +
      'vibrant colors. The WHOLE character INCLUDING both full cutlass blades and ' +
      'the hat is fully inside the frame with a clean transparent margin on every ' +
      'side — nothing cropped or touching the edges. Pure transparent background, ' +
      'alpha only — NO ground, NO colored backdrop, NO panel behind it.',
  },
  // Echo Keeper — spectral memory-keeper NPC who re-summons fallen-boss shades.
  // Hovering ghost, lavender/purple, drifting memory sparks. Gets a deterministic
  // thick black outline pass after generation.
  echo_keeper: {
    dest: join(repoRoot, 'Sprites', 'npc', 'echo_keeper.png'),
    fmt: 'png',
    prompt:
      'A cute chibi GHOSTLY MEMORY-KEEPER spirit, full body, gently HOVERING in the ' +
      'air (no legs — its lower body fades into a soft wispy spectral tail instead ' +
      'of feet). A small hooded figure in a flowing translucent LAVENDER-and-violet ' +
      'robe with a calm, serene faceless hood lit by a soft inner glow (two gentle ' +
      'glowing dot-eyes). It cradles a glowing purple orb of swirling memories in ' +
      'its little hands. Faint glowing memory sparks, motes and wisps drift around ' +
      'it. Mysterious, calm, friendly. Big head, small body (chibi). VERY BOLD, ' +
      'clean, UNIFORM thick JET-BLACK cartoon outline (a heavy ~3px-style outline) ' +
      'around the whole silhouette. Soft cel-shading, ethereal glow. Facing forward, ' +
      'slightly toward the right. The WHOLE figure is inside the frame with a clean ' +
      'transparent margin on every side — nothing cropped. Pure transparent ' +
      'background, alpha only — NO ground, NO colored backdrop, NO panel behind it.',
  },
};

const apiKey = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(ITEMS);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').includes(k));
if (!keys.length) { console.error('No matching item. Valid: ' + Object.keys(ITEMS).join(', ')); process.exit(1); }

if (!has('--generate')) {
  console.log('# DRY RUN — gen_remake_static. Prompts (add --generate to run):\n');
  for (const k of keys) console.log('## ' + k + '  ->  ' + ITEMS[k].dest + '\n' + PREFIX + ITEMS[k].prompt + '\n');
  process.exit(0);
}
if (!apiKey) { console.error('LUDO_API_KEY env var is required for --generate.'); process.exit(1); }
const force = has('--force');

async function genOne(k) {
  const { dest, prompt, fmt } = ITEMS[k];
  // v0.26.650 — per-item style overrides (default to the painterly Anime/Manga
  // look so existing assets are unchanged).
  const pfx = ITEMS[k].prefix || PREFIX;
  const artStyle = ITEMS[k].art_style || 'Anime/Manga';
  if (!force && await exists(dest)) return 'skip';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: artStyle, aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: pfx + prompt }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 140)}`);
      // Backup existing, then trim + contain onto a clean transparent 768² canvas.
      const dir = dirname(dest);
      if (await exists(dest)) { const bdir = join(dir, '_backup_remake'); await mkdir(bdir, { recursive: true }); await copyFile(dest, join(bdir, basename(dest))); }
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const CANVAS = 768, INNER = Math.round(CANVAS * 0.82);
      const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
      let pipe = sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }]);
      const out = await (fmt === 'webp' ? pipe.webp({ quality: 92, alphaQuality: 100 }) : pipe.png()).toBuffer();
      await mkdir(dir, { recursive: true });
      await writeFile(dest, out);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${keys.length} static remake(s) (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip (use --force)'); } else { made++; console.log('OK'); await sleep(800); } }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
