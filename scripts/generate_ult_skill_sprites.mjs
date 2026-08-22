#!/usr/bin/env node
// Lv-50 B-slot ULTIMATE skill VFX — base art + 9-frame animation (ludo.ai)
// =============================================================================
// One capstone "ultimate ultimate" FX per final class (17 masters). Two phases:
//   1) BASE  — text->sprite via Ludo POST /assets/image  -> Sprites/fx/<key>.png
//   2) ANIM  — animate the base via /assets/sprite/animate -> Sprites/fx/anim/<key>_0..8.webp
// Mirrors scripts/generate_g_skill_anim.mjs (anti-cutoff pad + True-Size HOLD).
//
//   node scripts/generate_ult_skill_sprites.mjs                       # dry-run list
//   node scripts/generate_ult_skill_sprites.mjs --only necromancer --generate
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
const FRAMES = 9;
// v0.29.392 — PAD is env-overridable (matching generate_g_skill_anim.mjs).
// The 0.12 default is enough for effects that hold their silhouette, but a
// dynamic one can still grow past the frame: elementalist_ult's lightning
// bled to alpha 255 on the canvas edge at 0.12 and would have visibly clipped
// in game. Re-run a bleeding effect with LUDO_ANIM_PAD=0.22 rather than
// re-rolling and hoping. (Check with the edge-alpha scan in the changelog.)
const PAD = Number(process.env.LUDO_ANIM_PAD || 0.12);
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
  // v0.30.43 — per user, sprite + animation reworked. The old roll had drifted
  // off its own skill in three ways. (1) SUBJECT: "Hundred-Hand Shadow Dance"
  // promises hands and shadow, and the art had neither — a radial sunburst of
  // pennant shapes that read as a firework, not a shinobi. (2) TEXT: those
  // pennants carried garbled glyph marks, which the shared PREFIX bans
  // outright; the banner/flag silhouette is what invited them, so the shapes
  // themselves are now banned rather than just re-forbidding the letters.
  // (3) PALETTE: bright red-gold-cyan on a starburst reads festive, and this
  // is the ROGUE capstone. Rebuilt around the name: a thousand-armed asura of
  // shadow, every hand holding a blade. Radial on purpose — the cast spins the
  // sprite a full 360 deg twice (see the shinobi_ult skill fn), so a spoked
  // composition is what that motion was written for.
  shinobi_ult:      { p: 'MANY overlapping ghostly arms sweeping outward from a dark hooded silhouette at the centre, like a thousand-armed asura of shadow mid-strike — each hand gripping a short moonlit kunai or tanto blade, the arms layered in receding indigo and black after-image echoes so it reads as ONE figure moving everywhere at once. The arms SWEEP AND SPIRAL like a body caught mid-turn: varied arm lengths, blades at scattered angles, the whole flurry swirling off-axis with a clear sense of rotation. It must feel like a DANCE captured mid-motion, NOT a symmetrical emblem — no evenly-spaced spokes, no rigid mandala, no heraldic seal, no sea-urchin ring of identical spikes. Cold steel-white edge-light traces every blade, torn crimson talisman ribbons whip between the arms, and a dark violet shadow-vortex churns at the core. PALETTE IS STRICTLY DEEP INDIGO, BLACK AND COLD STEEL-WHITE with a clearly visible but restrained CRIMSON accent on the ribbons — absolutely NO gold, NO warm orange, NO festive red-and-cyan fireworks look. SHAPE BANS: no banners, no pennants, no flags, no arrow or chevron or dart shapes, no scrolls, no placards — nothing that could carry a marking. Wordless imagery only. FRAMING IS CRITICAL: zoom the whole effect OUT so it occupies about 70% of the canvas, centred, with a clearly visible EMPTY TRANSPARENT MARGIN of at least 12% on ALL FOUR sides. No blade, arm, ribbon or spark may touch, bleed into or be cropped by any edge.', m: 'a ring of ghostly shadow arms holding blades. The ONE and ONLY motion is the after-image arms flickering softly in place, every arm at the same steady rate, each frame differing from the one before it by the SAME small amount. Core brightness stays CONSTANT across all frames — no flare, no strobe, no bloom, no brightening or dimming, no rotation, no zoom, no travel.' },
  nightreaper_ult:  { p: 'a blood-red eclipse domain, a black sun corona ringed with crimson light, spectral soul-scythes orbiting, dripping blood-energy and violet death motes gathering, an eerie reaper-moon glow.', m: 'a blood-eclipse domain — the crimson corona flickers, soul-scythes drift, violet death motes pulse inward.' },
  phantom_ult:      { p: 'a swirling violet void-singularity tearing reality with crossed spectral daggers, warping purple event-horizon rings pulling inward, ghostly phantom hands reaching from the rift, crackling void energy.', m: 'a violet void-singularity — the rift swirls and warps, spectral hands flicker, void energy crackles around the rim.' },
  sage_ult:         { p: 'a colossal blazing comet plunging with a fiery tail, a glowing arcane targeting sigil scorched beneath linking radiant impact-runes with fire-web threads, molten embers and a hot shockwave glow.', m: 'a blazing comet and arcane sigil — the comet glow flickers, the sigil runes pulse, embers shed, a hot glow breathes.' },
  elementalist_ult: { p: 'a swirling convergence of all four elements spiraling into a brilliant prismatic vortex — fire licking, ice shards glinting, lightning arcs crackling, violet arcane runes orbiting, radiant ascended energy.', m: 'a four-element prismatic vortex — fire flickers, frost shimmers, lightning crackles, arcane runes orbit in place.' },
  // v0.30.43 — NOT an ultimate: the Archmage G-skill burst, hosted here because
  // this is the only fx base+anim pipeline (generate_g_skill_anim.mjs animates
  // existing art only). The previous art was an ice totem in a runic ring —
  // neither prismatic nor four-element, and the ring carried glyph marks. The
  // engine fans this sprite from tall-and-narrow to wide-and-flat while
  // quarter-turning it (v0.25.996/997), so it is authored as a VERTICAL prism
  // whose refracted bands already spread sideways.
  elementalist_cascade: { p: 'a tall vertical crystalline PRISM standing upright, splitting a beam of pure white light into FOUR distinct elemental bands that fan outward horizontally to both sides like refracted spectrum rays — an orange fire band, an ice-blue frost band, an electric-yellow lightning band and a violet void band — rainbow glints along the prism facets, sparks of each element at the band tips. No runes, no ring, no circle, no glyphs, no writing of any kind.', m: 'a prism refracting four elemental bands — the bands shimmer softly in place at one steady rate; no rotation, no flare, brightness constant.' },
  necromancer_ult:         { p: 'a necromantic surge of ghostly green souls spiraling upward into a risen necromancer-crown, skeletal thralls forming from emerald soul-fire, a swirling necrotic vortex core, eerie phosphor glow and drifting wisps.', m: 'ghostly green souls spiraling — the soul-wisps drift and flicker, the necrotic vortex churns, phosphor glow pulses.' },
  hexmaster_ult:    { p: 'a spreading plague of purple hex-runes and cursed evil-eye sigils branching like contagion tendrils, dark-frost and sickly violet miasma creeping outward, a throbbing cursed glow, malignant runic circles.', m: 'spreading purple hex-runes — cursed sigils orbit and flicker, sickly miasma creeps, a cursed glow throbs.' },
  // v0.29.403 — per user "animation not smooth". Same root cause as
  // skyhunter_ult (v0.29.402): the old motion prompt stacked FOUR competing
  // motions — pours, pulses, sparkles rise, halo breathes — so consecutive
  // frames disagreed about what was moving and the loop lurched. Measured
  // evenness 2.03 with steps of 6.7 and 7.7 sitting beside 28.6 and 31.8.
  // Rewritten to ONE motion (light descending at a constant rate) with the
  // even-increment instruction that fixed skyhunter. Base art unchanged.
  // v0.29.437 — per user, base art remade. The previous roll put a pale BLUE
  // watercolour splash at the foot of the pillar and a stray brown feather off
  // to the side, both fighting the gold, and rendered soft/airbrushed rather
  // than cel. Palette is now locked and the cel treatment stated here (the
  // shared PREFIX asks for "soft painterly" and governs all 17, so it is
  // overridden per-entry as skyhunter_ult already does). Motion prompt is
  // deliberately unchanged — v0.29.403 tuned it to fix a lurching loop.
  // Framing note: "a column descending from heaven" has no top by definition,
  // and three re-rolls all bled 233-286 px of solid alpha off the top edge.
  // The fix is compositional, not more capitals — the effect is described as
  // CAPPED by a winged halo crest that is itself the highest object, which is
  // exactly why the pre-v0.29.437 art sat fully inside the canvas.
  archbishop_ult:   { p: 'a radiant golden pillar of divine light CAPPED AT THE TOP by an ascended angelic halo ring with spread golden wings and a fleur-de-lis grail crest. That winged crest is the HIGHEST point of the artwork and sits completely inside the frame with clear empty space above it; the broad column of holy light flares DOWNWARD and outward from beneath the crest and ends in a bright pool of radiance at the bottom. Choral sparkles and white feathers drift around it. PALETTE IS STRICTLY GOLD, WARM AMBER AND WHITE — absolutely NO blue, NO teal, NO watercolour splashes or washes, NO brown feathers, no stray off-palette accents anywhere. Crisp 2D side-scroller RPG cel-shading: flat hard-edged colour bands with clean shade steps and bold dark outlines, NOT soft, NOT airbrushed, NOT painterly, no blurry gradients. FRAMING IS CRITICAL: the ENTIRE effect including the very top of the light column must sit COMPLETELY INSIDE the canvas, with a clearly visible EMPTY TRANSPARENT MARGIN of at least 10% on ALL FOUR sides. The pillar must have a defined TOP that is fully visible — it must NOT run off, touch, bleed into or be cropped by the top edge, and nothing may touch the left, right or bottom edges either. Zoom the whole effect out to guarantee this.', m: 'a radiant pillar of holy light, animated with EXTREMELY SUBTLE low-amplitude motion. The artwork stays essentially identical in every frame — same shape, same size, same position, same brightness. The ONLY change is a very faint slow shimmer drifting through the light and a barely-perceptible twinkle on the sparkles. Amplitude is tiny: each frame differs only slightly from the previous one, like a gentle looping idle. Absolutely no travel, no streaming, no descending, no pulsing, no flashing, no flicker, no bursts, no growth or shrink, no rotation.' },
  marksman_ult:     { p: 'a precision focus-reticle of glowing crosshairs locking onto multiple target-marks, a charged piercing energy-round glinting at center, a sharp lens-flare glint, taut aiming-light threads, cold blue precision glow.', m: 'a precision focus-reticle — the crosshairs tighten and pulse, the charged round glints, aiming-threads flicker.' },
  ballista_ult:     { p: 'a massive mounted siege-ballista war engine drawn taut, a heavy explosive bolt charged with fiery energy on the rail, gears and bracing, impact sparks and a charging anchor-shot glow, imposing fortress-weapon presence.', m: 'a charged siege-ballista bolt — the bolt vibrates with energy, motion streaks pulse, impact sparks flicker.' },
  beastmaster_ult:  { p: 'a colossal spirit apex dire-wolf of amber spirit-energy rearing with bared fangs, a feral rally-roar shockwave and claw-mark energy, wild amber sparks and primal runes, a bonded-rider aura.', m: 'a colossal spirit dire-wolf — the amber spirit-energy flickers and pulses, claw-mark energy crackles in place.' },
  // v0.29.398 — per user: crisper 2D-sidescroller cel style, greener palette,
  // smoother loop. The shared PREFIX asks for "soft painterly cel-shaded" and
  // governs all 17 ults, so the harder cel treatment is stated HERE rather
  // than changing every other ultimate. Motion prompt asks for one slow
  // continuous rotation (the previous "swirls / glints / crackles" gave three
  // competing motions, which is what made the 9-frame loop read as jumpy).
  skyhunter_ult:    { p: 'a swirling EMERALD-GREEN wind-tempest cyclone with a calm glowing eye, a storm of wind-charged arrows orbiting and streaking outward, gusty spiral streaks, leaves and feathers caught in the vortex, gale energy. Palette is jade / emerald / verdant green with pale mint highlights — green dominant, only a faint teal accent, NOT blue and NOT cyan. Crisp 2D SIDE-SCROLLER RPG cel-shading: flat hard-edged colour bands with clean shade steps and bold dark outlines, NOT soft, NOT airbrushed, NOT painterly, no blurry gradients.', m: 'an emerald wind cyclone rotating slowly and smoothly — ONE single continuous steady swirl in the same direction at an even unchanging speed, the arrows and leaves drifting gently around with it. Keep every frame close to the one before it: small even increments, no sudden jumps, no flicker, no direction changes, no bursts.' },
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
