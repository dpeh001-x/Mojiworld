#!/usr/bin/env node
// New ATTACK animations for Plumpdrake (fatDragon) and Tubsalamander (fatLizard)
// ============================================================================
// Per user: "regenerate new attacking sprite animations for plumpdrake and
// tubesalamander". Both are Sauro Slope fire lizards; the keys on disk are
// fatDragon and fatLizard, and the display names are the user's spelling.
//
// WHAT EACH ONE ACTUALLY DOES, from monsterTypes - the animation has to match
// the kit or it reads as the wrong monster:
//   fatDragon  bigMelee kind 'swing', 450 ms telegraph  -> a heavy TAIL SWIPE
//   fatLizard  volleyShot:2 + shoot:'mfirespit'         -> a two-beat SPIT
//
// NEITHER ANIMATION DRAWS FIRE. The game spawns mfirespit as its own projectile
// sprite, so a flame baked into the frames would double it up. It also happens
// to be the only way these sets can be measured at all: both mobs are orange
// (#dd5533 / #ff8844), so unlike the smith golem's grey stone there is no colour
// that separates body from flame. Ask for no fire and total ink IS the body.
//
// TWO DIFFERENT GEOMETRIES, on purpose - see drawMonster's _atkScale branch:
//
//   fatDragon is PADDED and registered. With a constant in _ATK_FRAME_SCALE the
//     engine plants each attack frame by ITS OWN content bottom, so a swinging
//     tail may sit anywhere in its canvas. That buys the room the swipe needs.
//     The cost is that the constant is only valid while every frame holds the
//     same body share - the old set ran 48.8% to 53.0% and the drake grew 1.24x
//     through its own swing, with a constant (1.951) that was 5% off besides.
//   fatLizard is FLUSH and unregistered. Without a constant the frame inherits
//     the static sprite's transform, so its body share and content bottom must
//     match the base. A spit is compact enough to fit at the base's own 90.1%,
//     and adding a constant where none is needed would change behaviour.
//
// Usage:
//   node scripts/regen_lizard_attacks.mjs --key fatDragon --rolls 3
//   node scripts/regen_lizard_attacks.mjs --bake --key fatDragon --roll 2
//   node scripts/regen_lizard_attacks.mjs --check
// ============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOB = join(root, 'Sprites', 'monsters');
const KEEP = join(root, 'scripts', '_tmp_lizard_rolls');
const FRAMES = 9;
const ALPHA = 8;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i < 0 ? null : argv[i + 1]; };

const STYLE = ' Hand-painted 2D game sprite, side-scroller side view facing right, '
  + 'clean readable silhouette, fully transparent background, no ground shadow, '
  + 'no floor, no scenery, no text.';

// FRAMING is appended to every motion prompt. Every clause here is a failure
// this pipeline has already shipped once: the model drifting the camera, the
// model resizing the subject between frames, and the model adding effects that
// then get measured as if they were the monster.
const FRAMING = ' The camera is LOCKED: identical framing, identical zoom and '
  + 'identical subject size in every frame. Do not zoom, pan, crop or scale the '
  + 'character. Feet stay on the same baseline. No flames, no fire, no fireballs, '
  + 'no smoke, no sparks, no embers, no glow, no light flashes, no motion-blur '
  + 'streaks, no impact effects and no added props.';

const CFG = {
  fatDragon: {
    name: 'Plumpdrake',
    canvasW: 1077, canvasH: 1077,
    // PADDED: body held well inside the canvas so the tail has somewhere to go.
    // The exact constant is measured after baking, not assumed - see report().
    targetShare: 0.78, padded: true, floorMargin: 40,
    // Per user, mid-run: "instead of a Plumpdrake tailswipe do a claw scratch".
    // Still a bigMelee kind 'swing', so the 450 ms telegraph reads correctly.
    motion: 'A squat heavy orange-red dragon performs a powerful CLAW SCRATCH. '
      + 'Frames 1-3 it rocks its weight back and rears one clawed forelimb high '
      + 'and back, claws spread wide, jaws opening. Frames 4-6 it rakes that claw '
      + 'down and forward across the front of its body in a strong diagonal slash '
      + '- this is the heaviest part of the swing and the claw reaches furthest '
      + 'forward. Frames 7-9 the limb follows through low and the dragon settles '
      + 'back to the standing pose. The HEAD, TORSO, TAIL and HIND FEET stay put '
      + 'and the same size throughout - only the clawing forelimb travels.',
  },
  fatLizard: {
    name: 'Tubsalamander',
    canvasW: 709, canvasH: 714,
    // FLUSH: must match the base's own share and sit on the canvas floor.
    targetShare: 0.901, padded: false, floorMargin: 1,
    motion: 'A chubby orange salamander performs a TWO-BEAT SPIT attack. Frames '
      + '1-2 it rears its head and neck back, chest swelling. Frame 3 it snaps '
      + 'the head forward and its jaws open wide for the first spit. Frames 4-5 '
      + 'it draws back a second time. Frame 6 it snaps forward again, jaws wide, '
      + 'for the second spit. Frames 7-9 it settles back to the standing pose. '
      + 'Nothing leaves the mouth - the projectile is drawn by the game. The BODY '
      + 'and FEET stay put and the same size throughout.',
  },
};

// ---- measurement -----------------------------------------------------------
// Total ink, which IS the body here because the brief forbids effects.
async function measure(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x0 = w, x1 = -1, y0 = h, y1 = -1, area = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + 3] <= ALPHA) continue;
    area++;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  return { w, h, x0, x1, y0, y1, iw: x1 - x0 + 1, ih: y1 - y0 + 1, area };
}

// Opaque pixels touching the canvas edge — a clipped limb.
async function border(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let n = 0;
  const at = (x, y) => data[(y * w + x) * c + 3] > ALPHA;
  for (let x = 0; x < w; x++) { if (at(x, 0)) n++; if (at(x, h - 1)) n++; }
  for (let y = 0; y < h; y++) { if (at(0, y)) n++; if (at(w - 1, y)) n++; }
  return n;
}

// ---- placement --------------------------------------------------------------
// Each frame's body is normalised to the SAME height, then ONE global shrink is
// applied across the set so the widest frame still clears the canvas.
//
// Both halves are load-bearing and each alone is wrong, which the smith golem
// rebuild established the hard way. Fitting every frame independently to the
// canvas equalises nothing and actively shrinks whichever frame swings widest -
// the mob comes out smallest exactly when it swings hardest. One global scale
// alone leaves the model's own 1.2x frame-to-frame size variation in place. The
// pair holds the body constant AND keeps the tail inside the frame.
async function placeSet(raws, cfg) {
  const ms = [];
  for (const r of raws) { const m = await measure(r); if (!m) return null; ms.push(m); }
  const targetH = Math.round(cfg.canvasH * cfg.targetShare);

  // UNIFORM (--uniform): one factor for the whole set, from the median frame.
  //
  // Per-frame normalisation assumes ink height IS body height. That held for the
  // smith golem, whose grey stone could be isolated from its lava, and whose raw
  // frames varied 1.24x so the correction was worth making. It does NOT hold
  // here. These mobs are orange end to end, so ink includes whatever the model
  // adds; the drake's chosen roll measures a 1.108x raw spread that is ONE frame
  // carrying a small slash mark, and normalising against it would shrink the
  // DRAGON by 10% on the frame where it strikes. Excluding that frame the raw
  // spread is 1.057x - the model already holds size, so the honest move is to
  // scale the set uniformly and leave the animation exactly as generated.
  const uniform = has('--uniform');
  const med = ms.map((m) => m.ih).slice().sort((a, b) => a - b)[ms.length >> 1];
  const perFrame = uniform ? ms.map(() => targetH / med) : ms.map((m) => targetH / m.ih);
  let g = 1;
  for (let i = 0; i < ms.length; i++) {
    const s = perFrame[i];
    const wNeed = ms[i].iw * s, hNeed = ms[i].ih * s;
    g = Math.min(g, (cfg.canvasW - 8) / wNeed, (cfg.canvasH - cfg.floorMargin - 8) / hNeed);
  }
  const out = [];
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i], s = perFrame[i] * g;
    const nw = Math.max(1, Math.round(m.iw * s)), nh = Math.max(1, Math.round(m.ih * s));
    const cropped = await sharp(raws[i]).extract({ left: m.x0, top: m.y0, width: m.iw, height: m.ih })
      .resize(nw, nh, { fit: 'fill' }).png().toBuffer();
    const left = Math.round((cfg.canvasW - nw) / 2);
    const top = Math.round((cfg.canvasH - 1 - cfg.floorMargin) - nh);
    out.push(await sharp({ create: { width: cfg.canvasW, height: cfg.canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cropped, left: Math.max(0, left), top: Math.max(0, top) }])
      .webp({ quality: 94 }).toBuffer());
  }
  return out;
}

// ---- the gate ---------------------------------------------------------------
// SWING is the number that matters: biggest body over smallest across the set.
// A constant multiplier cannot correct a set that is not constant, and a mob
// that grows through its own swing is what the user reports as "2x larger".
//
// WIDTH is a separate gate because height cannot see a flare-up: the smith
// golem's idle erupted in flame and held its body height flat at 1.019x while
// its silhouette width went to 1.234x. An attack legitimately changes width
// (that is the swing), so width is only reported here, not failed on.
async function report(label, bufs, cfg) {
  const ms = [];
  for (const b of bufs) ms.push(await measure(b));
  const hs = ms.map((m) => m.ih), ws = ms.map((m) => m.iw);
  const bots = ms.map((m) => m.y1);
  const swing = Math.max(...hs) / Math.min(...hs);
  const wSwing = Math.max(...ws) / Math.min(...ws);
  const footSpread = Math.max(...bots) - Math.min(...bots);
  let bord = 0;
  for (const b of bufs) bord += await border(b);
  // MEDIAN, not max. Max ink share is inflated by whichever frame reaches
  // furthest - for the drake that is the raised claw - so sizing the constant
  // off it would shrink the mob for the whole swing. The median frame is the
  // one that represents the body, and it is what mob_attack_padding_audit.mjs
  // compares against idle. Using max here printed 1.138 against the audit's
  // 1.199, and the in-game blit measurement backs the audit: at 1.199 the drawn
  // body is 0.993-1.007x of idle.
  const share = hs.slice().sort((a, b) => a - b)[hs.length >> 1] / cfg.canvasH;
  // In --uniform mode `swing` is the RAW ink spread, which legitimately
  // includes a raised claw and any mark the model added, so it is held to 1.15
  // rather than 1.05. Normalised mode forces ink height equal, so 1.05 there is
  // a check that the forcing worked, not a check on the model.
  const cap = has('--uniform') ? 1.15 : 1.05;
  const ok = swing <= cap && bord === 0 && footSpread <= 8;
  console.log(`    ${label}: body swing ${swing.toFixed(3)}x  width swing ${wSwing.toFixed(3)}x  `
    + `foot spread ${footSpread}px  clipped ${bord}px  share ${(share * 100).toFixed(1)}%`);
  return { ok, swing, wSwing, footSpread, bord, share };
}

// ---- --check: measure what is on disk ---------------------------------------
if (has('--check')) {
  let bad = 0;
  for (const key of Object.keys(CFG)) {
    const cfg = CFG[key];
    const bufs = [];
    for (let i = 0; i < FRAMES; i++) {
      const p = join(MOB, 'attack', `${key}_${i}.webp`);
      if (existsSync(p)) bufs.push(await readFile(p));
    }
    if (bufs.length < FRAMES) { console.log(`  ${key}: only ${bufs.length} frames`); bad++; continue; }
    console.log(`  ${key} (${cfg.name})`);
    const g = await report('attack', bufs, cfg);
    const base = await measure(await readFile(join(MOB, `${key}.webp`)));
    const baseShare = base.ih / base.h;
    const needed = baseShare / g.share;
    console.log(`    base share ${(baseShare * 100).toFixed(1)}%  =>  `
      + (cfg.padded ? `_ATK_FRAME_SCALE.${key} should be ${needed.toFixed(3)}`
                    : `no constant needed (ratio ${needed.toFixed(3)})`));
    if (!g.ok) bad++;
  }
  process.exit(bad ? 1 : 0);
}


// ---- generation --------------------------------------------------------------
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const hdr = { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' };
const fetchBuf = async (u) => Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(180000) })).arrayBuffer());
await mkdir(KEEP, { recursive: true });

const KEY = arg('--key');
if (!KEY || !CFG[KEY]) { console.error('--key fatDragon|fatLizard'); process.exit(1); }
const cfg = CFG[KEY];

// ---- re-place a saved roll, no credits spent --------------------------------
if (has('--bake')) {
  const n = arg('--roll') || '1';
  const raws = [];
  for (let i = 0; i < FRAMES; i++) raws.push(await readFile(join(KEEP, `${KEY}_r${n}_${i}.png`)));
  const placed = await placeSet(raws, cfg);
  const g = await report(`roll ${n}`, placed, cfg);
  if (!g.ok && !has('--force')) { console.error('  gated — not written (--force to override)'); process.exit(2); }
  await mkdir(join(MOB, 'attack'), { recursive: true });
  for (let i = 0; i < FRAMES; i++) await writeFile(join(MOB, 'attack', `${KEY}_${i}.webp`), placed[i]);
  console.log('  written');
  process.exit(0);
}

// Seed from the mob's OWN base sprite so the result is the same character.
// Padded on the way out: frame_size:-9 is True Size and carries the margin into
// every returned frame, so the tail has canvas to travel across instead of the
// edge. Composite the seed SMALLER onto a transparent canvas to create it.
const baseBuf = await readFile(join(MOB, `${KEY}.webp`));
const PAD = Number(arg('--pad') || (cfg.padded ? 0.20 : 0.08));
const inner = Math.round(Math.max(cfg.canvasW, cfg.canvasH) * (1 - 2 * PAD));
const seed = await sharp({ create: { width: cfg.canvasW, height: cfg.canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(baseBuf).resize(inner, inner, { fit: 'inside' }).png().toBuffer(), gravity: 'centre' }])
  .png().toBuffer();
const uri = 'data:image/png;base64,'
  + (await sharp(seed).resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');

const ROLLS = Number(arg('--rolls') || 3);
let best = null;
for (let r = 1; r <= ROLLS; r++) {
  process.stdout.write(`${KEY} attack roll ${r}/${ROLLS} ... `);
  let bufs;
  try {
    const res = await fetch(`${API}/assets/sprite/animate`, {
      method: 'POST', headers: hdr, signal: AbortSignal.timeout(300000),
      body: JSON.stringify({ initial_image: uri, motion_prompt: cfg.motion + FRAMING + STYLE,
        frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true,
        loop: false, image_type: 'sprite' }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
    const d = await res.json();
    const urls = d.individual_frame_urls || [];
    if (urls.length < FRAMES) throw new Error(`got ${urls.length} frames`);
    bufs = await Promise.all(urls.slice(0, FRAMES).map(fetchBuf));
  } catch (e) { console.log('FAIL ' + e.message); continue; }
  console.log('ok');
  for (let i = 0; i < bufs.length; i++) await writeFile(join(KEEP, `${KEY}_r${r}_${i}.png`), bufs[i]);
  const placed = await placeSet(bufs, cfg);
  if (!placed) { console.log('    empty frame'); continue; }
  const g = await report(`roll ${r}`, placed, cfg);
  if (!g.ok) { console.log('    gated'); continue; }
  if (!best || g.swing < best.g.swing) best = { placed, g, r };
}
if (!best) { console.error(`${KEY}: no clean roll — re-run, or --bake --roll N --force`); process.exit(2); }
await mkdir(join(MOB, 'attack'), { recursive: true });
for (let i = 0; i < FRAMES; i++) await writeFile(join(MOB, 'attack', `${KEY}_${i}.webp`), best.placed[i]);
console.log(`  wrote attack from roll ${best.r}`);
