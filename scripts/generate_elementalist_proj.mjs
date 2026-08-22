#!/usr/bin/env node
// Elementalist projectile sprites — Prismatic Cascade lances + Elemental
// Apotheosis catastrophes, base art + 9-frame animation (ludo.ai).
// =============================================================================
// Per user: "create specific unique sprites for the animation and projectiles
// of prismatic cascade and elemental apotheosis".
//   CASCADE — the v0.30.x remake fires no projectiles: four PHASES (pyre
//   column, frost nova, storm chain, void convergence) that borrowed other
//   skills' art — the Sage's meteor column, the shared ice_block, procedural
//   beams, and the cast burst reused for the finale. Each phase now has its
//   own burst (kind:'fx' → Sprites/fx/<key>.webp + anim, drawn by
//   spawnSpriteBurst / the fire-column hazard).
//   APOTHEOSIS v3 (v0.30.52) — one of four CATASTROPHES per charge; each is a
//   real projectile (kind:'proj' → Sprites/projectiles/p_<key>.webp + anim,
//   drawn oriented-to-velocity via bspr + _BULT_ANIM_KEY, like the warlord
//   banner).
//
// Same no-cutoff guarantee as generate_bult_proj_v2.mjs: the engine orients
// these to velocity, so content is trimmed and re-centred at <=300px on a
// 512^2 canvas (corner radius ~212 < 256 -> never clips at any angle). The
// anim pass animates THAT framed canvas, so every frame inherits the margin.
//
//   node scripts/generate_elementalist_proj.mjs                  # dry-run
//   node scripts/generate_elementalist_proj.mjs --generate --only cascade
//   node scripts/generate_elementalist_proj.mjs --generate --force
//   flags: --base-only | --anim-only | --force | --only <substr,substr>
// Needs LUDO_API_KEY. Resumable: skips a key whose base / 9 frames exist.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'projectiles');
const ANIM = join(DIR, 'anim');
const CANVAS = 512, TARGET = 300, FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const OUTLINE = ' Epic painterly fantasy game PROJECTILE sprite — a single object, vibrant saturated colours, a bold uniform 2px black outline around the whole silhouette, crisp rim-light. FULLY TRANSPARENT background, the object CENTERED and COMPACT with LOTS of empty transparent margin all around it (the object occupies only the middle ~55% of the frame, never touching any edge). ABSOLUTELY NO TEXT, no letters, no runes, no numbers. NO UI, NO background, NO ground shadow, NO scene, NO box or frame. Readable at small size.';
const HOLD = ' The sprite stays centered at the EXACT same size, position and framing — do NOT rotate, spin, translate, zoom, or mirror it; animate ONLY the effect itself in place. ONE motion only, at one steady rate, each frame differing from the last by the SAME small amount — no flare, no strobe, no brightening or dimming.';

// key -> { p: base prompt (subjects point RIGHT), m: motion prompt }
// Cascade phases are a FAMILY — every one carries the prism-refraction motif
// so the four reads as one spell amplifying, not four unrelated spells.
const FX_PREFIX = 'Chibi anime spell-effect VFX sprite for a 2D platformer in the Mojiworld aesthetic. Pure transparent background, alpha only — no scene, no character, no ground. 768x768 square canvas. ABSOLUTELY NO TEXT: no letters, words, numbers, runes, glyphs or symbols. Soft painterly cel-shaded anime style, bold black outlines, vibrant saturated colors, additive glow. Render ONLY the effect, strong centered composition occupying ~70% of the canvas with a clearly visible EMPTY TRANSPARENT MARGIN on all four sides — nothing may touch or bleed off any edge. Must read clearly when scaled to 1/4 size. ';
const ITEMS = {
  // Drawn by the fire-column hazard: a TALL vertical pyre, authored upright.
  cascade_fire:      { kind: 'fx', p: 'a tall vertical PYRE COLUMN of orange-white flame roaring straight upward from a ring of molten ground, prismatic rainbow glints refracting through the flames, embers streaming up — the column has a clearly visible TOP of curling fire fully inside the frame and a defined base.', m: 'a vertical pyre column — the flames lick and flicker in place at one steady rate; no growth, no flare.' },
  // Drawn as a nova around the caster: a flat radial burst, authored round.
  cascade_ice:       { kind: 'fx', p: 'a circular FROST NOVA — an expanding ring of jagged blue-white ice crystals and frost vapour bursting outward from a bright glacial core, prismatic rainbow refraction glinting on the crystal facets, snowflake motes scattered around the ring.', m: 'a frost nova ring — the frost vapour drifts and the crystal facets glint in place at one steady rate; no expansion, no flare.' },
  // Stamped at every chain hop: a compact impact flash, authored round.
  cascade_lightning: { kind: 'fx', p: 'a compact STORM IMPACT burst — a bright electric-yellow lightning strike point with jagged white arcs branching outward in all directions, a crackling plasma core, prismatic rainbow sparks scattered around it.', m: 'a lightning impact burst — the arcs flicker in place at one steady rate; no flare, core brightness constant.' },
  // The finale: the prism itself collapsing into a void blast, authored round.
  cascade_void:      { kind: 'fx', p: 'a VOID CONVERGENCE blast — a violet-black singularity at the centre with four prismatic spectrum rays (orange, ice-blue, electric-yellow, violet) being drawn INWARD into it, a ring of dark purple shockwave energy around it, rainbow glints at the ray tips.', m: 'a void convergence — the spectrum rays shimmer in place at one steady rate; no rotation, no flare, brightness constant.' },
  // Catastrophes are COLOSSAL and each is a different object, because each
  // charge of Apotheosis must read as its own world-ending event.
  apo_fire:          { p: 'A colossal ROLLING FIRESTORM projectile pointing right — a towering curling wave of orange-white flame surging forward like a tsunami of fire, black smoke and embers shedding off its crest, molten cracks glowing at its base.', m: 'a rolling firestorm wave — the flames lick and flicker in place.' },
  apo_ice:           { p: 'A colossal GLACIAL COMET projectile pointing right — a jagged boulder of blue-white ice wreathed in frost vapour, ice shards splintering off it, a streaming tail of frost crystals behind it.', m: 'a glacial comet — the frost vapour drifts and the ice glints in place.' },
  // Re-rolled once: the first roll came back as a thin yellow dart with a
  // little crackle — readable as lightning, not as a catastrophe.
  apo_lightning:     { p: 'A colossal THUNDER SPEAR projectile pointing right — a THICK, MASSIVE jagged bolt of concentrated yellow-white lightning, as tall as it is long, a blinding white plasma core inside a wide zigzagging golden-yellow body, MANY violent forked electric arcs branching off it in every direction, sparks and plasma wisps shedding. Heavy and dense, not thin or dart-like.', m: 'a massive thunder spear — the forked arcs branching off it flicker in place.' },
  apo_void:          { p: 'A colossal VOID SINGULARITY projectile — a black-hole sphere with a glowing violet event-horizon ring, purple-black space warping around it, spectral motes being dragged inward, crackling void lightning on the rim.', m: 'a void singularity — the event-horizon ring shimmers and the motes drift inward in place.' },
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

// Trim to alpha bbox, scale content to fit TARGET, centre on CANVAS^2 transparent.
async function frameNoCutoff(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let minX = W, minY = H, maxX = 0, maxY = 0, any = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 12) { any = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (!any) { minX = 0; minY = 0; maxX = W - 1; maxY = H - 1; }
  const content = await sharp(buf).ensureAlpha().extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize(TARGET, TARGET, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  const m = await sharp(content).metadata();
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: content, left: Math.round((CANVAS - m.width) / 2), top: Math.round((CANVAS - m.height) / 2) }]).png().toBuffer();
}
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / data.num_cols), ch = Math.floor(meta.height / data.num_rows), o = [];
    for (let r = 0; r < data.num_rows && o.length < n; r++) for (let c = 0; c < data.num_cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}

let keys = Object.keys(ITEMS);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k.includes(o)));
if (!keys.length) { console.error('No matching keys.'); process.exit(1); }
if (!has('--generate')) {
  console.log(`# ${keys.length} elementalist sprites. proj -> Sprites/projectiles/p_<key>.webp (+anim/) · fx -> Sprites/fx/<key>.webp (+anim/)\n`);
  for (const k of keys) console.log(`  ${k}  [${ITEMS[k].kind || 'proj'}]`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --base-only --anim-only --force --only a,b');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force'), baseOnly = has('--base-only'), animOnly = has('--anim-only');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hdr = { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' };

const isFx = (k) => ITEMS[k].kind === 'fx';
// LUDO_ANIM_PAD — same knob as generate_ult_skill_sprites.mjs. 0.12 is enough
// for effects that hold their silhouette; cascade_lightning's arcs zoomed past
// it and cut flat at the frame edge, so that one is re-animated at 0.25.
const FX_DIR = join(repoRoot, 'Sprites', 'fx'), FX_ANIM = join(FX_DIR, 'anim'), FX_PAD = Number(process.env.LUDO_ANIM_PAD || 0.12);
const basePath = (k) => isFx(k) ? join(FX_DIR, `${k}.webp`) : join(DIR, `p_${k}.webp`);
const framePath = (k, i) => isFx(k) ? join(FX_ANIM, `${k}_${i}.webp`) : join(ANIM, `p_${k}_${i}.webp`);
async function genBase(k) {
  const out = basePath(k);
  if (!force && await exists(out)) return 'skip';
  const body = isFx(k)
    ? { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: FX_PREFIX + ITEMS[k].p }
    : { image_type: 'sprite-vfx', art_style: 'Hand-Painted', perspective: 'Side-Scroll', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: ITEMS[k].p + OUTLINE };
  const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: hdr, signal: AbortSignal.timeout(150000), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const data = await res.json();
  const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
  if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 140)}`);
  await mkdir(isFx(k) ? FX_DIR : DIR, { recursive: true });
  const raw = await fetchBuf(url);
  await writeFile(out, await sharp(isFx(k) ? raw : await frameNoCutoff(raw)).webp({ quality: 92 }).toBuffer());
  return 'base';
}
async function genAnim(k) {
  const done = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(framePath(k, i))))).every(Boolean);
  if (!force && done) return 'skip';
  const bp = basePath(k);
  if (!(await exists(bp))) return 'nobase';
  // proj: already framed at <=300/512 -> margin baked in. fx: pad 12% a side
  // (same anti-cutoff headroom generate_ult_skill_sprites.mjs uses), frames
  // come back at the padded size and the burst blit shows the whole sprite.
  let base = await sharp(await readFile(bp)).png().toBuffer();
  if (isFx(k)) {
    const bm = await sharp(base).metadata(), px = Math.round(bm.width * FX_PAD), py = Math.round(bm.height * FX_PAD);
    base = await sharp(base).extend({ top: py, bottom: py, left: px, right: px, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }
  const { width: OW, height: OH } = await sharp(base).metadata();
  const uri = 'data:image/png;base64,' + (await sharp(base).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, { method: 'POST', headers: hdr, signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: ITEMS[k].m + HOLD, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite-vfx' }) });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      await mkdir(isFx(k) ? FX_ANIM : ANIM, { recursive: true });
      for (let i = 0; i < bufs.length; i++) await writeFile(framePath(k, i), await sharp(bufs[i]).resize(OW, OH, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
      return `${OW}x${OH}`;
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(3000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${keys.length} projectiles (base:${!animOnly} anim:${!baseOnly} force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  try {
    if (!animOnly) { process.stdout.write(`  ${k} base ... `); const r = await genBase(k); console.log(r === 'skip' ? 'skip' : 'OK'); if (r !== 'skip') { made++; await sleep(800); } }
    if (!baseOnly) { process.stdout.write(`  ${k} anim ... `); const r = await genAnim(k); if (r === 'skip') { skipped++; console.log('skip'); } else if (r === 'nobase') console.log('NO BASE'); else { made++; console.log(`OK ${r}`); await sleep(800); } }
  } catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
