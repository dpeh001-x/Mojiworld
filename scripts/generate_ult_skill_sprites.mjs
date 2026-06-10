#!/usr/bin/env node
// Lv-50 B-slot ULTIMATE skill VFX — base art + 9-frame animation (ludo.ai)
// =============================================================================
// One capstone "ultimate ultimate" FX per final class (17 masters). Two phases:
//   1) BASE  — text->sprite via Ludo POST /assets/image  -> Sprites/fx/<key>.png
//   2) ANIM  — animate the base via /assets/sprite/animate -> Sprites/fx/anim/<key>_0..8.webp
// Mirrors scripts/generate_g_skill_anim.mjs (anti-cutoff pad + True-Size HOLD).
//
//   node scripts/generate_ult_skill_sprites.mjs                       # dry-run list
//   node scripts/generate_ult_skill_sprites.mjs --only lich --generate
//   node scripts/generate_ult_skill_sprites.mjs --generate            # all 17, base+anim
//   flags: --base-only | --anim-only | --force | --only a,b,c
// Needs LUDO_API_KEY. Resumable: skips a key whose base / 9 frames already exist.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX_DIR = join(repoRoot, 'Sprites', 'fx');
const OUT_DIR = join(FX_DIR, 'anim');
const FRAMES = 9, PAD = 0.12;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Locked style prefix — keeps all 17 on the Mojiworld transparent-sprite spec.
const PREFIX = 'Chibi anime spell-effect VFX sprite for a 2D platformer in the Mojiworld aesthetic. ' +
  'Pure transparent background, alpha only — no scene, no character, no ground. 768x768 square canvas. ' +
  'ABSOLUTELY NO TEXT of any kind: no letters, no words, no numbers, no digits, no percentages, no captions, ' +
  'no labels, no runic writing, no watermark, no logo, no UI — the artwork must be 100% wordless imagery only. ' +
  'Soft painterly cel-shaded anime style, bold black outlines, vibrant saturated colors, additive glow. ' +
  'Render ONLY the effect, strong centered composition occupying ~70% of the canvas with breathing room at the edges, ' +
  'epic legendary ultimate-tier intensity. Must read clearly when scaled to 1/4 size. ';
const HOLD = ' The effect stays centered at the EXACT same size, position and framing, fully inside the frame with empty ' +
  'margins — do NOT rotate, spin, translate, zoom, crop, mirror or resize it; animate ONLY the effect shimmering/pulsing in place.';

// key (= LX_FX spriteKey, matches SKILLS id <master>_ult) -> { p: base prompt, m: motion prompt }
const ULT = {
  warlord_ult:      { p: 'a colossal golden war-banner planted in the earth, the cloth completely BLANK with no writing, numbers or emblem, standard unfurling in a heroic gale, spectral vanguard soldiers rising from radiant gold-crimson rally-light, sparks and motes streaming upward, a commanding aura ring at the base.', m: 'a heroic golden war-banner — the standard ripples, rally-light pulses and radiates, spectral motes rising.' },
  doombringer_ult:  { p: 'a titanic black-iron greatsword wreathed in crimson-and-violet ruin energy, the blade cracked with molten apocalyptic fissures, dark shockwave rings churning off the edge, embers and ash shedding, an aura of catastrophe.', m: 'a titanic ruin greatsword — crimson-violet energy churns along the blade, shockwave cracks pulse, embers shedding.' },
  crusader_ult:     { p: 'a radiant domed holy bastion of golden dawn-light, concentric blessed runic rings glowing, absorbed light coiling inward into a brilliant core about to burst, warm halo and divine sparkles orbiting.', m: 'a radiant holy dawn-bastion dome — divine light pulses across the barrier, the core glows brighter, sparkles orbit.' },
  dragoon_ult:      { p: 'a storm of descending azure dragon-lances raining from a thundercloud, each spear crackling with blue draconic lightning, a great winged dragon-silhouette of energy behind them, motion streaks and impact sparks.', m: 'descending azure dragon-lances — blue draconic lightning crackles along the spears, motion streaks pulse, sparks flicker.' },
  shadowlord_ult:   { p: 'a regal shadow-avatar wreathed in a swarm of violet phantom after-images and clone silhouettes fanning outward, a dark crown of umbral energy, swirling shadow wisps and echo-trails, an ominous sovereign aura.', m: 'a shadow-sovereign avatar — violet phantom after-images flicker and shimmer, umbral wisps coil in place.' },
  shinobi_ult:      { p: 'a radial flurry of crossed glowing katana slash-arcs and crimson paper talisman seals frozen mid-dance, countless after-image blades fanning out, ribbons of cyan-and-red motion, petals and sparks scattering.', m: 'a flurry of crossed slash-arcs and seals — blade after-images shimmer and the talisman glow pulses in place.' },
  nightreaper_ult:  { p: 'a blood-red eclipse domain, a black sun corona ringed with crimson light, spectral soul-scythes orbiting, dripping blood-energy and violet death motes gathering, an eerie reaper-moon glow.', m: 'a blood-eclipse domain — the crimson corona flickers, soul-scythes drift, violet death motes pulse inward.' },
  phantom_ult:      { p: 'a swirling violet void-singularity tearing reality with crossed spectral daggers, warping purple event-horizon rings pulling inward, ghostly phantom hands reaching from the rift, crackling void energy.', m: 'a violet void-singularity — the rift swirls and warps, spectral hands flicker, void energy crackles around the rim.' },
  sage_ult:         { p: 'a colossal blazing comet plunging with a fiery tail, a glowing arcane targeting sigil scorched beneath linking radiant impact-runes with fire-web threads, molten embers and a hot shockwave glow.', m: 'a blazing comet and arcane sigil — the comet glow flickers, the sigil runes pulse, embers shed, a hot glow breathes.' },
  elementalist_ult: { p: 'a swirling convergence of all four elements spiraling into a brilliant prismatic vortex — fire licking, ice shards glinting, lightning arcs crackling, violet arcane runes orbiting, radiant ascended energy.', m: 'a four-element prismatic vortex — fire flickers, frost shimmers, lightning crackles, arcane runes orbit in place.' },
  lich_ult:         { p: 'a necromantic surge of ghostly green souls spiraling upward into a risen lich-crown, skeletal thralls forming from emerald soul-fire, a swirling necrotic vortex core, eerie phosphor glow and drifting wisps.', m: 'ghostly green souls spiraling — the soul-wisps drift and flicker, the necrotic vortex churns, phosphor glow pulses.' },
  hexmaster_ult:    { p: 'a spreading plague of purple hex-runes and cursed evil-eye sigils branching like contagion tendrils, dark-frost and sickly violet miasma creeping outward, a throbbing cursed glow, malignant runic circles.', m: 'spreading purple hex-runes — cursed sigils orbit and flicker, sickly miasma creeps, a cursed glow throbs.' },
  archbishop_ult:   { p: 'a towering radiant column of golden divine light descending from heaven, an ascended angelic halo and fleur-de-lis grail crest within, choral sparkles and feathers drifting, a sweeping beam of judgment.', m: 'a radiant pillar of holy light — divine light pours and pulses, choral sparkles rise, a warm halo breathes.' },
  marksman_ult:     { p: 'a precision focus-reticle of glowing crosshairs locking onto multiple target-marks, a charged piercing energy-round glinting at center, a sharp lens-flare glint, taut aiming-light threads, cold blue precision glow.', m: 'a precision focus-reticle — the crosshairs tighten and pulse, the charged round glints, aiming-threads flicker.' },
  ballista_ult:     { p: 'a massive mounted siege-ballista war engine drawn taut, a heavy explosive bolt charged with fiery energy on the rail, gears and bracing, impact sparks and a charging anchor-shot glow, imposing fortress-weapon presence.', m: 'a charged siege-ballista bolt — the bolt vibrates with energy, motion streaks pulse, impact sparks flicker.' },
  beastmaster_ult:  { p: 'a colossal spirit apex dire-wolf of amber spirit-energy rearing with bared fangs, a feral rally-roar shockwave and claw-mark energy, wild amber sparks and primal runes, a bonded-rider aura.', m: 'a colossal spirit dire-wolf — the amber spirit-energy flickers and pulses, claw-mark energy crackles in place.' },
  skyhunter_ult:    { p: 'a swirling cyan wind-tempest cyclone with a calm glowing eye, a storm of wind-charged arrows orbiting and streaking outward, gusty spiral streaks, feathers and motes caught in the vortex, gale energy.', m: 'a cyan wind-tempest cyclone — the storm swirls, wind-charged arrows glint and streak, gusty energy crackles.' },
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

let keys = Object.keys(ULT);
const only = arg('--only'); if (only) keys = Object.keys(ULT).filter((k) => only.split(',').some((o) => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching ultimate FX.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${keys.length} ultimate FX. BASE -> Sprites/fx/<key>.png · ANIM -> Sprites/fx/anim/<key>_0..8.webp\n`);
  for (const k of keys) console.log(`  ${k}`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --base-only --anim-only --force --only a,b');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force'), baseOnly = has('--base-only'), animOnly = has('--anim-only');
const ANIM_TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genBase(k) {
  const bp = join(FX_DIR, `${k}.png`);
  if (!force && await exists(bp)) return 'skip';
  const res = await fetch(`${API}/assets/image`, {
    method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(ANIM_TIMEOUT),
    body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + ULT[k].p }),
  });
  if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const data = await res.json();
  const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
  if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 140)}`);
  await mkdir(FX_DIR, { recursive: true });
  await writeFile(bp, await sharp(await fetchBuf(url)).png().toBuffer());
  return 'base';
}

async function genAnim(k) {
  const done = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(OUT_DIR, `${k}_${i}.webp`))))).every(Boolean);
  if (!force && done) return 'skip';
  let bp = join(FX_DIR, `${k}.png`);
  if (!(await exists(bp))) { const alt = bp.replace(/\.png$/, '.webp'); if (await exists(alt)) bp = alt; else return 'nobase'; }
  const padded = await padBuf(await readFile(bp));
  const { width: W, height: H } = await sharp(padded).metadata();
  const uri = await smallUri(padded);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(ANIM_TIMEOUT),
        body: JSON.stringify({ initial_image: uri, motion_prompt: ULT[k].m + HOLD, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite-vfx' }),
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

console.log(`Generating ${keys.length} ultimate FX (base:${!animOnly} anim:${!baseOnly} force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  try {
    if (!animOnly) { process.stdout.write(`  ${k} base ... `); const r = await genBase(k); console.log(r === 'skip' ? 'skip' : 'OK'); if (r !== 'skip') { made++; await sleep(800); } }
    if (!baseOnly) { process.stdout.write(`  ${k} anim ... `); const r = await genAnim(k); if (r === 'skip') { skipped++; console.log('skip'); } else if (r === 'nobase') { console.log('NO BASE — run base phase first'); } else { made++; console.log(`OK ${r}`); await sleep(800); } }
  } catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
