#!/usr/bin/env node
// Regenerate a boss ATTACK set (9 frames) from its base pose, with ludo.ai.
//
//   node scripts/regen_boss_attack_set.mjs --report
//   node scripts/regen_boss_attack_set.mjs --key gravitos3punch --rolls 3 --generate
//   node scripts/regen_boss_attack_set.mjs --key gravitos3soul --bake 2
//
// WHAT IS WRONG WITH THE SETS THIS WAS WRITTEN FOR, measured, not eyeballed:
//
//   * THEY ARE FOUR IMAGES PRETENDING TO BE NINE. Hashing the frames of both
//     gravitos3punch and gravitos3soul gives 0,1,2,3,3,3,2,1,0 - byte-identical
//     palindromes. The attack plays forward and then rewinds, so the punch
//     un-punches. --report prints the distinct count for any set.
//   * EVERY FRAME IS CLIPPED. Feet sit at y=1213 on a 1214-tall canvas, with
//     33-56 px of ink on the canvas edge in every frame. The titan's feet are
//     literally cut off by the canvas.
//
// The three mechanisms below are the ones this project has already paid for:
//
//   PAD ON THE WAY OUT - the base pose is composited smaller before it is sent,
//     and frame_size:-9 carries that margin into every returned frame, so wings
//     and fists have somewhere to go instead of the canvas edge.
//   ONE SCALE AND ONE OFFSET FOR THE SET - derived from frame 0 and applied
//     unchanged to all nine, so the titan cannot grow between frames while
//     everything the animation does survives.
//   THEN BODY-SCALE NORMALISATION - per frame, scale-only, feet held on their
//     line. A per-frame REFIT would cancel the animation; correcting scale
//     alone does not, and on the gravitos2star set it raised frame-to-frame
//     motion by 6.5% while cutting body drift from 5.6% to 0.1%.
//
// Body height is measured on the DARK ARMOUR (luminance <= 120) because the
// flame aura and the soul light are bright: measuring the whole silhouette
// would track the effects, which is exactly the mistake that produced a false
// "the boss is zooming" report on gravitos2star.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SET = join(repoRoot, 'Sprites', 'bosses', 'attack');
const POSES = join(repoRoot, 'Sprites', 'bosses');
const KEEP = join(repoRoot, 'scripts', '_tmp_bossatk_rolls');
const FRAMES = 9, ALPHA = 12, BODY_LUM = 120;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const KEYS = {
  gravitos3punch: {
    motion:
      'The winged crimson demon titan throws a single devastating FLAMING PUNCH, as one continuous '
      + 'motion: it drops its shoulder and hauls one huge fist back as fire spirals up that arm, then '
      + 'drives the fist FORWARD across its body in a heavy committed swing, the flame trailing off the '
      + 'knuckles in a whipping arc and bursting outward at full extension, before the arm settles and '
      + 'the fire dies back. Its great bat wings flare wide as it turns into the blow. '
      + 'Every frame must be clearly different from the last - this is one violent swing, not a pose.',
  },
  gravitos3soul: {
    motion:
      'The winged crimson demon titan tears SOULS out of the air in front of it: it spreads both arms '
      + 'wide and hauls upward, and pale ghostly soul-wisps and skull-like spirits are dragged writhing '
      + 'out of the ground and the air toward its chest, spiralling inward and igniting as they are '
      + 'devoured, its own crimson flame surging brighter with each one taken. Its great bat wings beat '
      + 'once and flare wide at the peak. '
      + 'Every frame must be clearly different from the last - the spirits move visibly between frames.',
  },
};
const FRAMING =
  ' CRITICAL FRAMING, these override the motion: the TITAN stays EXACTLY the same SIZE in every frame '
  + '- no zoom in, no zoom out, no camera push, it never grows or shrinks. It stays CENTRED and its '
  + 'FEET STAY ON THE SAME LINE, planted on the ground, in every single frame. Its horns, wings, fists '
  + 'and every spike must stay FULLY INSIDE the frame with clear empty margin on all four sides - '
  + 'nothing may touch or cross the frame edge, and the FEET must never be cut off. Keep the EXACT same '
  + 'character, the same left/right facing, the same armour, the same colours and the same art style '
  + 'throughout. Never mirror or flip.';

async function measure(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, border = 0, by0 = h, by1 = -1, bx0 = w, bx1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * c;
    if (data[i + 3] <= ALPHA) continue;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (data[i + 3] >= 160 && data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 <= BODY_LUM) {
      if (y < by0) by0 = y; if (y > by1) by1 = y; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
    }
  }
  if (x1 < 0) return null;
  return { w, h, x0, y0, x1, y1, bw: x1 - x0 + 1, bh: y1 - y0 + 1, border,
    body: by1 < 0 ? null : by1 - by0 + 1, bodyMidX: bx1 < 0 ? null : (bx0 + bx1) / 2, feet: y1 };
}

async function motionOf(bufs) {
  const r = [];
  for (const b of bufs) r.push(await sharp(b).ensureAlpha()
    .resize(400, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().toBuffer({ resolveWithObject: true }));
  let tot = 0;
  for (let i = 0; i + 1 < r.length; i++) {
    const a = r[i], b = r[i + 1];
    const { width: w, height: h, channels: c } = a.info;
    let s = 0, n = 0;
    for (let px = 0; px < w * h; px++) {
      const ia = px * c, ib = px * b.info.channels;
      if (a.data[ia + 3] <= 128 || b.data[ib + 3] <= 128) continue;
      s += Math.abs((a.data[ia] * 0.299 + a.data[ia + 1] * 0.587 + a.data[ia + 2] * 0.114)
                  - (b.data[ib] * 0.299 + b.data[ib + 1] * 0.587 + b.data[ib + 2] * 0.114));
      n++;
    }
    tot += s / Math.max(1, n);
  }
  return tot / (r.length - 1);
}

if (has('--report')) {
  for (const key of (arg('--key') ? [arg('--key')] : Object.keys(KEYS))) {
    const bufs = [];
    for (let i = 0; i < FRAMES; i++) bufs.push(await readFile(join(SET, `${key}_${i}.webp`)));
    const hashes = bufs.map((b) => createHash('sha1').update(b).digest('hex').slice(0, 8));
    const ms = [];
    for (const b of bufs) ms.push(await measure(b));
    const bodies = ms.map((m) => m.body);
    const sp = (Math.max(...bodies) - Math.min(...bodies)) / Math.max(...bodies) * 100;
    console.log(`=== ${key}`);
    console.log(`  frame hashes      ${hashes.join(' ')}`);
    console.log(`  distinct frames   ${new Set(hashes).size} of ${FRAMES}${new Set(hashes).size < FRAMES ? '   <-- padded, not animated' : ''}`);
    console.log(`  canvas            ${ms[0].w}x${ms[0].h}`);
    console.log(`  clipped ink       ${ms.reduce((a, m) => a + m.border, 0)} px across the set${ms.some((m) => m.border) ? '   <-- cut off' : ''}`);
    console.log(`  body heights      ${bodies.join(', ')}  (${sp.toFixed(1)}% spread)`);
    console.log(`  feet line         ${[...new Set(ms.map((m) => m.feet))].join(', ')}`);
    console.log(`  motion            ${(await motionOf(bufs)).toFixed(1)}`);
  }
  process.exit(0);
}

const KEY = arg('--key');
if (!KEY || !KEYS[KEY]) { console.error('--key must be one of: ' + Object.keys(KEYS).join(', ')); process.exit(1); }
const framePath = (i) => join(SET, `${KEY}_${i}.webp`);

// One scale + one offset for the set, then per-frame scale-only normalisation.
// Canvas grows to whatever the set needs; it never shrinks the titan to fit.
async function fitSet(bufs, target) {
  const ms = [];
  for (const b of bufs) ms.push(await measure(b));
  const sc = target.body / ms[0].body;               // preserve the DRAWN size of the titan
  const stage = [];
  for (let i = 0; i < bufs.length; i++) {
    const per = target.body / ms[i].body;            // per-frame: kill drift, keep the pose
    const k = (i === 0) ? sc : per;
    const sw = Math.max(1, Math.round(ms[i].w * k)), sh = Math.max(1, Math.round(ms[i].h * k));
    stage.push(await sharp(bufs[i]).ensureAlpha().resize(sw, sh, { fit: 'fill' }).png().toBuffer());
  }
  const sm = [];
  for (const b of stage) sm.push(await measure(b));
  // place every frame so its FEET land on the target line and its BODY centre
  // sits where the old set's did — body centre, not box centre, so a flung arm
  // or a wing does not drag the titan sideways.
  const place = sm.map((m) => ({ dx: Math.round(target.bodyMidX - m.bodyMidX), dy: Math.round(target.feet - m.feet) }));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < sm.length; i++) {
    minX = Math.min(minX, sm[i].x0 + place[i].dx); maxX = Math.max(maxX, sm[i].x1 + place[i].dx);
    minY = Math.min(minY, sm[i].y0 + place[i].dy); maxY = Math.max(maxY, sm[i].y1 + place[i].dy);
  }
  const M = 24;
  const growL = Math.max(0, Math.ceil(M - minX)), growR = Math.max(0, Math.ceil(maxX + M - (target.w - 1)));
  const growT = Math.max(0, Math.ceil(M - minY)), growB = Math.max(0, Math.ceil(maxY + M - (target.h - 1)));
  const gx = Math.max(growL, growR);
  const outW = target.w + 2 * gx, outH = target.h + growT + growB;
  const out = [];
  for (let i = 0; i < stage.length; i++) {
    const left = place[i].dx + gx, top = place[i].dy + growT;
    const cropL = Math.max(0, -left), cropT = Math.max(0, -top);
    const availW = Math.min(sm[i].w - cropL, outW - Math.max(0, left));
    const availH = Math.min(sm[i].h - cropT, outH - Math.max(0, top));
    const piece = await sharp(stage[i])
      .extract({ left: cropL, top: cropT, width: Math.max(1, availW), height: Math.max(1, availH) }).png().toBuffer();
    out.push(await sharp({ create: { width: outW, height: outH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }]).webp({ quality: 94 }).toBuffer());
  }
  return { out, canvas: `${outW}x${outH}`, grew: { x: gx, top: growT, bottom: growB } };
}

async function gradeSet(out) {
  const ms = [];
  for (const b of out) ms.push(await measure(b));
  const hashes = out.map((b) => createHash('sha1').update(b).digest('hex'));
  const bodies = ms.map((m) => m.body);
  const feet = ms.map((m) => m.feet);
  return {
    distinct: new Set(hashes).size,
    border: ms.reduce((a, m) => a + m.border, 0),
    bodySpread: (Math.max(...bodies) - Math.min(...bodies)) / Math.max(...bodies),
    footSpread: Math.max(...feet) - Math.min(...feet),
    motion: await motionOf(out),
    ms,
  };
}

// The target the new set has to land on: the OLD set's drawn body height, body
// centre and feet line, so data/anim_calib.js stays valid without a retune.
const oldMs = [];
for (let i = 0; i < FRAMES; i++) oldMs.push(await measure(await readFile(framePath(i))));
const target = { body: Math.max(...oldMs.map((m) => m.body)), bodyMidX: oldMs[0].bodyMidX,
                 feet: oldMs[0].feet, w: oldMs[0].w, h: oldMs[0].h };
console.log(`${KEY}: target body ${target.body}px, feet y=${target.feet}, canvas ${target.w}x${target.h}`);

if (has('--bake')) {
  const n = arg('--bake');
  const bufs = [];
  for (let i = 0; i < FRAMES; i++) bufs.push(await readFile(join(KEEP, `${KEY}_r${n}_${i}.png`)));
  const { out, canvas, grew } = await fitSet(bufs, target);
  const g = await gradeSet(out);
  console.log(`  canvas ${canvas} (grew x${grew.x} top${grew.top} bot${grew.bottom})  distinct ${g.distinct}/9  border ${g.border}  body ${(g.bodySpread * 100).toFixed(1)}%  feet ${g.footSpread}px  motion ${g.motion.toFixed(1)}`);
  if (g.border > 0 || g.distinct < FRAMES) { console.error('  rejected'); process.exit(2); }
  for (let i = 0; i < FRAMES; i++) await writeFile(framePath(i), out[i]);
  await writeFile(join(SET, `${KEY}.webp`), out[FRAMES - 1]);
  console.log('  baked');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey || !has('--generate')) { console.error('usage: --report | --key K --generate [--rolls N] | --key K --bake N'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const ROLLS = Number(arg('--rolls') || 3);
const PAD = Number(arg('--pad') || 0.18);
const hdr = { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' };
const fetchBuf = async (u) => Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(180000) })).arrayBuffer());

const posePath = existsSync(join(POSES, `${KEY}.webp`)) ? join(POSES, `${KEY}.webp`) : framePath(0);
const poseBuf = await readFile(posePath);
const pm = await measure(poseBuf);
const padded = await sharp({ create: { width: pm.w, height: pm.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(poseBuf).resize(Math.round(pm.w * (1 - 2 * PAD)), Math.round(pm.h * (1 - 2 * PAD)), { fit: 'inside' }).png().toBuffer(), gravity: 'centre' }])
  .png().toBuffer();
const uri = 'data:image/png;base64,'
  + (await sharp(padded).resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
console.log(`  seeding from ${posePath.split(/[\\/]/).pop()}`);

await mkdir(KEEP, { recursive: true });
let best = null;
for (let r = 1; r <= ROLLS; r++) {
  process.stdout.write(`  roll ${r}/${ROLLS} ... `);
  let bufs;
  try {
    const res = await fetch(`${API}/assets/sprite/animate`, {
      method: 'POST', headers: hdr, signal: AbortSignal.timeout(300000),
      body: JSON.stringify({ initial_image: uri, motion_prompt: KEYS[KEY].motion + FRAMING, frames: FRAMES,
        frame_size: -9, model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite' }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
    const d = await res.json();
    const urls = d.individual_frame_urls || [];
    if (urls.length < FRAMES) throw new Error(`got ${urls.length} frames`);
    bufs = await Promise.all(urls.slice(0, FRAMES).map(fetchBuf));
  } catch (e) { console.log('FAIL ' + e.message); continue; }
  for (let i = 0; i < bufs.length; i++) await writeFile(join(KEEP, `${KEY}_r${r}_${i}.png`), bufs[i]);

  const { out, canvas, grew } = await fitSet(bufs, target);
  const g = await gradeSet(out);
  const clean = g.border === 0 && g.distinct === FRAMES && g.bodySpread <= 0.03;
  console.log(`canvas ${canvas} (grew x${grew.x} t${grew.top} b${grew.bottom})  distinct ${g.distinct}/9  border ${g.border}  body ${(g.bodySpread * 100).toFixed(1)}%  feet ${g.footSpread}px  motion ${g.motion.toFixed(1)} ${clean ? '' : ' GATED'}`);
  if (!clean) continue;
  if (!best || g.motion > best.g.motion) best = { out, g, canvas, grew };
}
if (!best) { console.error('  no clean roll — re-run, or --bake a saved roll'); process.exit(2); }
for (let i = 0; i < FRAMES; i++) await writeFile(framePath(i), best.out[i]);
await writeFile(join(SET, `${KEY}.webp`), best.out[FRAMES - 1]);
console.log(`  wrote 9 frames + ${KEY}.webp  canvas ${best.canvas}  distinct 9/9  border 0  body ${(best.g.bodySpread * 100).toFixed(1)}%  motion ${best.g.motion.toFixed(1)}`);
