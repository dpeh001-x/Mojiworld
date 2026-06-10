#!/usr/bin/env node
// Re-generate ALL skill-bar icons FRAME-LESS — clean emblem, no box (ludo.ai)
// =============================================================================
// The v0.26.535 icon set has a rounded-square BOX + background fill; per user
// every icon must become a single bold emblem on a fully transparent
// background with clean edges (matching the v0.26.539 ultimate icons).
// Prompts are built from each skill's name + description parsed out of the
// SKILLS table in mojiworld_game.html, so each emblem actually depicts the
// skill. Output overwrites Sprites/skills/<id>.png (256x256). Originals should
// be backed up first (see scripts comment / the cp step).
//
//   node scripts/generate_skill_icons.mjs                 # dry-run list
//   node scripts/generate_skill_icons.mjs --only fireball,blink --generate
//   node scripts/generate_skill_icons.mjs --generate      # all non-ult icons
//   flags: --only a,b  --include-ult  --skip-existing
// Needs LUDO_API_KEY.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(repoRoot, 'mojiworld_game.html');
const OUT_DIR = join(repoRoot, 'Sprites', 'skills');
const SIZE = 256;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// This is the PROVEN v0.26.543 prompt (accurate subjects + boxless) with the
// ONLY changes the user asked for: outline -> thin even ~2px, and a mild
// "a little simpler / less busy". DO NOT add "flat / minimal / iconic / emblem"
// or shorten the subject phrasing — both make the model abstract skills into
// generic stars. The long anti-box clause is required (else it adds card boxes).
// ROOT CAUSE of the rounded-square "card" backgrounds: the word ICON +
// "mobile game" cues an APP ICON (a rounded-square tile). Reframing as a
// die-cut STICKER / sprite cutout, and explicitly "not an app icon / not on a
// tile", is what actually stops the card.
const PREFIX = 'A die-cut STICKER of the SUBJECT described below — the effect, projectile, or object ITSELF exactly as described, NOT a person, character or creature performing it, and NO hands or bodies. Like a transparent-PNG game sprite cutout with a clean cutout edge and nothing behind it. ' +
  'This is NOT an app icon and NOT on a square tile or card: ABSOLUTELY NO rounded-square, NO tile, NO card, NO frame, NO border, NO badge, NO panel, NO background fill or gradient, NO ground, NO scene. FULLY TRANSPARENT background (alpha only), clean transparent edges all around the subject. ' +
  'Clean simple chibi-anime style: bold simple shapes with a thin EVEN ~2px solid BLACK outline (uniform weight, NOT thick or chunky), vibrant flat colors and light cel shading, a little simpler and less busy than a painting. ' +
  'Centered, about 82% of the square image. ABSOLUTELY NO TEXT: no letters, numbers, words or watermark. ';

// Parse SKILLS { id: { name:'..', ... desc:'..' } } out of the game file.
function parseSkillMeta(src) {
  const start = src.indexOf('const SKILLS = {');
  const end = src.indexOf('\n};', start);
  const block = src.slice(start, end);
  const meta = {};
  const Q = "(?:[^'\\\\]|\\\\.)*";
  const re = new RegExp("^\\s*([A-Za-z0-9_]+):\\s*\\{.*?\\bname:\\s*'(" + Q + ")'.*?\\bdesc:\\s*'(" + Q + ")'", 'gm');
  let m;
  while ((m = re.exec(block))) {
    const unesc = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    meta[m[1]] = { name: unesc(m[2]), desc: unesc(m[3]) };
  }
  return meta;
}
const prettify = (id) => id.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
// v2 — purely-visual overrides for ABSTRACT skill names (Backstab, Rush, …).
// Quoting the skill name in the prompt made the model render the NAME as text;
// these describe ONLY the visual so there is no word for it to letter out.
const VISUAL_OVERRIDE = {
  backstab:      'a sharp dagger plunging into a glowing red weak-point, a stealthy critical-strike burst',
  darkPulse:     'a pulsing dark-purple shockwave orb of necrotic energy radiating rings',
  dragoon_skylance: 'a glowing azure lance/spear plunging downward, crackling with blue draconic lightning',
  evadeRoll:     'a swift acrobatic dash with motion-blur afterimages and a small dust burst',
  meteor:        'a single blazing meteor plummeting with a long fiery tail and ember sparks',
  multiShot:     'a fan of three glowing arrows fired outward from one point',
  phantom_cut:   'a violet void-rift slash with two crossed spectral daggers',
  rush:          'a forward charging dash with sharp speed-streaks and an impact burst',
  slash:         'a single bright crescent sword-slash arc',
  snipe_railgun: 'a focused glowing energy rail-beam shot through a crosshair reticle',
  stab:          'a sword thrusting straight forward with a piercing gleam at the tip',
  warCry:        'a roaring shout shockwave of golden rally energy radiating outward',
  wildBond:      'a feral beast paw-print glowing with wild green nature energy',
  // v3 — action skills that abstracted into stars / grabbed a card; pin them to a concrete picture.
  smokeDash:     'a ninja dashing forward leaving a swift trail of grey smoke and motion streaks',
  smokeBomb:     'a sharp four-point metal ninja shuriken throwing-star with a slight motion blur',
  groundSlam:    'a heavy armoured fist smashing the ground with a cracked-earth shockwave and dust',
  flurry:        'a rapid flurry of several overlapping steel sword-slash arcs',
  rampage:       'a raging red berserker aura around a clenched muscular fist',
  powerStrike:   'a heavy overhead sword chop with a bright impact flash',
  shadowStrike:  'a dark shadowy dagger lunging with a purple motion trail',
  soulSiphon:    'a stream of ghostly green soul-wisps being drawn into a hand',
  arcaneBurst:   'a burst of swirling blue-purple arcane magic energy orbs',
  sage_meteorshower: 'several flaming meteors falling from above with fiery trails',
  guardian:      'a glowing protective knight shield with a holy gleam',
  // v4 — ABSTRACT buff/utility/movement skills get a concrete subject so the
  // model has something real to draw instead of wrapping a vague concept in a
  // card-box. (Boxes correlate strongly with abstract subjects.)
  bloodlust:     'a fierce blood-red fanged aura with dripping red energy and a feral crimson glow',
  blink:         'a swirling blue arcane teleport portal with a bright flash',
  eagleEye:      'a sharp fierce hawk eye with a golden targeting glint',
  celestialAurora: 'flowing ribbons of green and blue aurora light with sparkling stars',
  holyLight:     'a radiant orb of golden holy light casting gentle rays',
  holyShield:    'a glowing golden holy shield with a soft cross gleam',
  elemental:     'a swirling orb fusing fire, water and lightning energy together',
};
const subject = (id, meta) => {
  // Rich subject phrasing (proven to draw the ACTUAL subject, not a star).
  // Overrides handle abstract action names (which would otherwise letter-out
  // the name as text, or become a generic star).
  if (VISUAL_OVERRIDE[id]) return ' ' + VISUAL_OVERRIDE[id] + '. Depict this as ONE clear picture, the actual subject, NO writing.';
  const m = meta[id];
  const name = m ? m.name : prettify(id);
  const desc = m ? m.desc.slice(0, 160) : '';
  return ` Depict the skill ${name}.` + (desc ? ` What it does: ${desc}.` : '') +
    ` Draw it as ONE clear picture — the ACTUAL weapon, elemental effect, or magic that represents this skill — NOT a generic star, gem or badge.`;
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

const src = await readFile(GAME, 'utf8');
const meta = parseSkillMeta(src);

let ids = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.png')).map((f) => basename(f, '.png'));
if (!has('--include-ult')) ids = ids.filter((id) => !id.endsWith('_ult'));
const only = arg('--only'); if (only) { const set = new Set(only.split(',')); ids = ids.filter((id) => set.has(id)); }
ids.sort();
if (!ids.length) { console.error('No matching icons.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${ids.length} skill icons -> Sprites/skills/<id>.png (${SIZE}x${SIZE}, frame-less). meta hits: ${ids.filter((i)=>meta[i]).length}/${ids.length}\n`);
  for (const id of ids) console.log(`  ${id.padEnd(22)} ${meta[id] ? '«' + meta[id].name + '»' : '(no meta — prettified)'}`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --only a,b --skip-existing --include-ult');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const skipExisting = has('--skip-existing');
const MAXTRIES = Number(arg('--tries') || 6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Box detector: createImage often adds a rounded-square "card" background no
// matter what the prompt says. A card nearly FILLS its alpha bounding box and
// the bbox is large + squarish. An emblem/burst leaves big transparent gaps
// inside its bbox (fill well under 0.85). Returns true if the image looks boxed.
async function isBoxed(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const A = (x, y) => data[(y * W + x) * 4 + 3] > 40;
  let minX = W, minY = H, maxX = 0, maxY = 0, opaque = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (A(x, y)) { opaque++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (opaque === 0) return false;
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const large = bw > W * 0.5 && bh > H * 0.5;
  const square = bw / bh > 0.78 && bw / bh < 1.28;
  if (!large || !square) return false;
  // STRAIGHT-EDGE test: a rounded-square card keeps the columns/rows just
  // inside each bbox edge almost fully opaque (flat sides). A burst/emblem
  // only touches an edge at a point, so these bands are mostly transparent.
  const ix = minX + 3, ax = maxX - 3, iy = minY + 3, ay = maxY - 3;
  let l = 0, r = 0, t = 0, b = 0;
  for (let y = minY; y <= maxY; y++) { if (A(ix, y)) l++; if (A(ax, y)) r++; }
  for (let x = minX; x <= maxX; x++) { if (A(x, iy)) t++; if (A(x, ay)) b++; }
  const edges = [l / bh, r / bh, t / bw, b / bw];
  // all four sides ≥0.7 opaque => flat rectangular silhouette => a card box.
  return Math.min(...edges) > 0.7;
}

async function gen(id) {
  const bp = join(OUT_DIR, `${id}.png`);
  if (skipExisting && await exists(bp)) return 'skip';
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + subject(id, meta) }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 140)); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(bp, await sharp(await fetchBuf(url)).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
      return 'OK';
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await sleep(3000 * a); }
  }
  throw last;
}

console.log(`Generating ${ids.length} frame-less skill icons...`);
let made = 0, skipped = 0, failed = 0;
for (const id of ids) {
  process.stdout.write(`  ${id} ... `);
  try { const r = await gen(id); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(400); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
