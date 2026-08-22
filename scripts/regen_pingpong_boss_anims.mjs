#!/usr/bin/env node
// Regenerate the boss attack sets that are PING-PONGED rather than animated.
//
// THE DEFECT, measured not guessed. A hash of every frame in all 57 nine-frame
// boss sets found exactly four built as a mirror:
//     f0 f1 f2 f3 f3 f3 f2 f1 f0      <- 4 unique images, not 9
// gravitos3laser, gravitos3punch, gravitos3soul, gravitos2soul. The middle
// three frames are identical (a freeze) and the back half is the front half
// reversed, so the attack visibly rewinds into its own wind-up. The renderer is
// innocent: _bossLoopFrame is a plain forward `% n`.
//
// It came from the generator, not the model. generate_gravitos_attack_anim.mjs
// pads a short roll with
//     [...run, ...Array(holds).fill(peak), ...run.slice(0, -1).reverse()]
// which is a ping-pong by construction — a salvage path for when too few frames
// survive the quality gate. Better than crashing, but it must not ship silently.
//
// So this script re-rolls those sets AND REFUSES TO WRITE A MIRROR: the palindrome
// check that found the bug runs on the output too. A roll that comes back
// mirrored, frozen, or barely moving fails instead of shipping.
//
//   node scripts/regen_pingpong_boss_anims.mjs                 # dry run
//   node scripts/regen_pingpong_boss_anims.mjs --generate      # needs LUDO_API_KEY
//   flags: --only=<key>  --force
import sharp from 'sharp';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ATK = join(ROOT, 'Sprites', 'bosses', 'attack');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const only = (argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];

// Shared wording. The old prompts never forbade returning to the opening pose,
// which is exactly the shape the salvage path then baked in.
// Containment is a HARD requirement, learned the expensive way: the first
// re-roll fixed the ping-pong and immediately reintroduced the failure the
// original soul generator documented — a full-frame opaque fire blast, 4,587
// edge pixels, the body bbox filling the entire canvas. Motion and containment
// have to be demanded together or the model trades one for the other.
const CONTAIN =
  ' CRITICAL - KEEP THE EFFECT TIGHT TO HIS BODY: all fire, smoke and energy must ' +
  'hug his silhouette or the limb performing the action. The outer third of the ' +
  'frame stays EMPTY and fully transparent on the left, right and top - no ' +
  'full-frame blast, no screen-filling flames, no glow reaching the frame edges, ' +
  'no background wash. If the effect would touch the edge of the image, make it ' +
  'smaller instead.';
const RULES =
  ' CRITICAL - ONE-SHOT, NOT A LOOP: every frame must be a NEW moment of the ' +
  'same action, moving forward the whole way. The LAST frame must NOT return to ' +
  'the first frame\'s pose, and NO two frames may be the same. Do NOT play the ' +
  'motion forwards and then backwards. ' +
  'CRITICAL - LOCKED FRAMING: the character stays the EXACT same size, scale and ' +
  'screen position in every frame; do NOT zoom, crop closer, drift or resize. ' +
  'The whole body including wings and feet stays inside the frame with clear ' +
  'margin. Keep the EXACT same left/right facing as the source - never mirror or ' +
  'flip. Keep the same art style, palette and fully transparent background.';

const SETS = {
  gravitos3soul: {
    base: 'gravitos3.webp',
    motion:
      'the colossal fire-and-shadow titan performs a SOUL DRAIN in place. Animate his ' +
      'BODY ONLY: over the nine frames he steadily raises both arms from his sides up ' +
      'to chest height and hunches a little further forward each frame, head bowing, ' +
      'wings drawing inward. He ENDS hunched with arms raised, NOT back in the ' +
      'opening stance. ' +
      'DO NOT ADD any new fire, flames, explosion, blast, aura, shockwave, glow or ' +
      'energy of any kind, and no orb. The character already has flames on his body in ' +
      'the source image - keep exactly those and no more. This is a POSE change only.' + CONTAIN + RULES,
  },
  gravitos3laser: {
    base: 'gravitos3.webp',
    motion:
      'the colossal fire-and-shadow titan fires a LASER in place: frames 1-3 he draws ' +
      'his right arm back and a searing white-hot point charges in his palm while his ' +
      'wings sweep back; frames 4-6 he thrusts the arm forward and a narrow blazing ' +
      'beam erupts from his palm toward the right, brightest at the palm; frames 7-9 ' +
      'the beam thins and the recoil settles with his arm still extended and smoke ' +
      'curling off it. He ENDS with the arm out, NOT back in the opening stance.' + RULES,
  },
  gravitos3punch: {
    base: 'gravitos3.webp',
    motion:
      'the colossal fire-and-shadow titan throws a PUNCH in place. Animate his BODY ' +
      'ONLY: frames 1-3 he coils, pulling his right fist back beside his hip and ' +
      'dropping his shoulder; frames 4-6 the fist drives forward in a heavy hook as ' +
      'his torso twists and his wings sweep back; frames 7-9 the arm is fully ' +
      'extended across his body and he leans into the follow-through. He ENDS ' +
      'mid-follow-through, NOT back in the opening stance. ' +
      'DO NOT ADD any new fire, flames, explosion, blast, shockwave, glow, smoke or ' +
      'energy of any kind. The character already has flames on his body in the source ' +
      'image - keep exactly those and no more. This is a POSE change, nothing else.' + CONTAIN + RULES,
  },
  gravitos2soul: {
    base: 'gravitos2.webp',
    motion:
      'the colossal cosmic star-titan performs a SOUL DRAIN in place. Animate his BODY ' +
      'ONLY: over the nine frames he steadily raises both arms from his sides up to ' +
      'chest height and hunches a little further forward each frame, head bowing. He ' +
      'ENDS hunched with arms raised, NOT back in the opening stance. ' +
      'DO NOT ADD any new energy, aura, blast, explosion or glow. The character ' +
      'already has his own cosmic glow in the source image - keep exactly that and no ' +
      'more. This is a POSE change only.' + CONTAIN + RULES,
  },
};

// ---- the palindrome detector, reused as the OUTPUT gate --------------------
const hashOf = (buf) => createHash('md5').update(buf).digest('hex');
function mirrorReport(hashes) {
  const uniq = new Set(hashes).size;
  const mirrored = [[8, 0], [7, 1], [6, 2], [5, 3]].every(([a, b]) => hashes[a] === hashes[b]);
  const endsWhereItStarted = hashes[8] === hashes[0];
  return { uniq, mirrored, endsWhereItStarted };
}
async function motionCurve(bufs) {
  const small = [];
  for (const b of bufs) small.push(await sharp(b).resize(96, 96, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  const d = [];
  for (let i = 1; i < small.length; i++) {
    let s = 0;
    for (let p = 0; p < small[0].length; p += 4) s += Math.abs(small[i][p] - small[0][p]) + Math.abs(small[i][p + 3] - small[0][p + 3]);
    d.push(Math.round(s / 1000));
  }
  return d;
}
// A palindromic difference curve is the same defect even when the bytes differ
// slightly (re-encode, feather). Compare the curve against its own reverse.
function curveIsPalindromic(d) {
  const n = d.length;
  let err = 0, mag = 0;
  for (let i = 0; i < n; i++) { err += Math.abs(d[i] - d[n - 1 - i]); mag += d[i]; }
  return mag > 0 && (err / mag) < 0.12;
}

// Opaque-core bleed: how many pixels of solid body/effect sit ON the frame
// border. BOTTOM contact is allowed and correct — every shipped gravitos frame
// stands with its feet on the canvas floor. Top/left/right are the tell.
async function edgeBleed(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const A = (x, y) => data[(y * W + x) * C + 3];
  let n = 0;
  for (let x = 0; x < W; x++) if (A(x, 0) > 200) n++;
  for (let y = 0; y < H; y++) { if (A(0, y) > 200) n++; if (A(W - 1, y) > 200) n++; }
  return n;
}
async function audit(key) {
  const bufs = [];
  for (let i = 0; i < FRAMES; i++) bufs.push(readFileSync(join(ATK, `${key}_${i}.webp`)));
  const rep = mirrorReport(bufs.map(hashOf));
  const curve = await motionCurve(bufs);
  return { ...rep, curve, curvePalindromic: curveIsPalindromic(curve) };
}

if (!has('--generate')) {
  console.log('AUDIT of the four sets flagged by the whole-roster hash scan:\n');
  for (const key of Object.keys(SETS)) {
    if (only && !key.includes(only)) continue;
    const a = await audit(key);
    console.log(`  ${key.padEnd(16)} unique=${a.uniq}/9  mirrored=${a.mirrored}  endsAtStart=${a.endsWhereItStarted}`);
    console.log(`  ${''.padEnd(16)} motion curve: ${a.curve.join(' ')}`);
  }
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). ~1 animate call per set.');
  process.exit(0);
}

const KEY = process.env.LUDO_API_KEY;
if (!KEY) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const post = async (path, body) => {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(600000),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`);
  return r.json();
};
const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};

let failures = 0;
for (const [key, cfg] of Object.entries(SETS)) {
  if (only && !key.includes(only)) continue;
  console.log(`\n=== ${key} ===`);
  const before = await audit(key);
  console.log(`  before: unique=${before.uniq}/9 mirrored=${before.mirrored}`);
  const basePath = join(ROOT, 'Sprites', 'bosses', cfg.base);
  const baseBuf = readFileSync(basePath);
  const baseMeta = await sharp(baseBuf).metadata();
  // Pad so effects have headroom, exactly as the shipped gravitos pipeline does;
  // the pad is cropped back off afterwards so the canvas is byte-identical in size.
  const padX = Math.round(baseMeta.width * 0.12), padY = Math.round(baseMeta.height * 0.12);
  const padded = await sharp({ create: { width: baseMeta.width + padX * 2, height: baseMeta.height + padY * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: baseBuf, left: padX, top: padY }]).png().toBuffer();
  const padMeta = await sharp(padded).metadata();
  const small = await sharp(padded).resize(920, 920, { fit: 'inside' }).png().toBuffer();

  let ok = false, lastErr = null;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    try {
      process.stdout.write(`  attempt ${attempt}: animating ... `);
      const data = await post('/assets/sprite/animate', {
        initial_image: 'data:image/png;base64,' + small.toString('base64'),
        motion_prompt: cfg.motion,
        frames: FRAMES, frame_size: -9, model: 'eagle',
        individual_frames: true, loop: false, image_type: 'sprite',
      });
      // Slice the SPRITESHEET: individual_frame_urls square non-square frames
      // (the bug that once gave gravitos detached limbs).
      let raw = [];
      if (data.spritesheet_url && data.num_cols && data.num_rows) {
        const sheet = await fetchBuf(data.spritesheet_url);
        const m = await sharp(sheet).metadata();
        const cw = Math.floor(m.width / data.num_cols), ch = Math.floor(m.height / data.num_rows);
        for (let r = 0; r < data.num_rows && raw.length < FRAMES; r++)
          for (let c = 0; c < data.num_cols && raw.length < FRAMES; c++)
            raw.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
      } else {
        const urls = data.individual_frame_urls || [];
        if (urls.length < FRAMES) throw new Error('no spritesheet and too few frames');
        for (let i = 0; i < FRAMES; i++) raw.push(await fetchBuf(urls[i]));
      }
      if (raw.length < FRAMES) throw new Error(`got ${raw.length} frames`);
      // Back onto the base canvas exactly.
      const finals = [];
      for (const b of raw) {
        finals.push(await sharp(await sharp(b).resize(padMeta.width, padMeta.height, { fit: 'fill' }).png().toBuffer())
          .extract({ left: padX, top: padY, width: baseMeta.width, height: baseMeta.height })
          .webp({ quality: 92 }).toBuffer());
      }
      // ---- THE GATE the old pipeline lacked ----
      const rep = mirrorReport(finals.map(hashOf));
      const curve = await motionCurve(finals);
      const palin = curveIsPalindromic(curve);
      const moves = Math.max(...curve) > 60;
      console.log(`unique=${rep.uniq}/9 mirrored=${rep.mirrored} curvePalindromic=${palin} peak=${Math.max(...curve)}`);
      if (rep.mirrored) throw new Error('roll came back MIRRORED');
      if (rep.endsWhereItStarted) throw new Error('last frame returns to the first');
      if (palin) throw new Error('motion curve is a palindrome (ping-pong)');
      if (rep.uniq < 8) throw new Error(`only ${rep.uniq} unique frames`);
      if (!moves) throw new Error('barely animates (peak diff ' + Math.max(...curve) + ')');
      // Containment, per frame. 1656px wide, so ~120px of border contact is a
      // generous allowance for a wing tip; a full-frame blast scores thousands.
      let worstBleed = 0;
      for (const f of finals) worstBleed = Math.max(worstBleed, await edgeBleed(f));
      if (worstBleed > 220) throw new Error('effect fills the frame (edge bleed ' + worstBleed + 'px)');
      console.log('    containment ok (worst edge bleed ' + worstBleed + 'px)');
      for (let i = 0; i < FRAMES; i++) {
        const p = join(ATK, `${key}_${i}.webp`);
        await writeFile(p + '.tmp', finals[i]);
        await rename(p + '.tmp', p);
      }
      // the still frame the game uses when the set has not decoded
      const still = join(ROOT, 'Sprites', 'bosses', `${key}.webp`);
      if (existsSync(still)) { await writeFile(still + '.tmp', finals[4]); await rename(still + '.tmp', still); }
      console.log(`  WROTE ${FRAMES} frames + still, curve: ${curve.join(' ')}`);
      ok = true;
    } catch (e) {
      lastErr = e; console.log('rejected: ' + e.message);
      if (/\b402\b|credit/i.test(e.message)) { console.error('OUT OF CREDITS'); process.exit(3); }
    }
  }
  if (!ok) { failures++; console.error(`  FAILED ${key}: ${lastErr && lastErr.message} (art left untouched)`); }
}
console.log(failures ? `\nDONE with ${failures} failure(s)` : '\nALL SETS REGENERATED');
process.exit(failures ? 1 : 0);
