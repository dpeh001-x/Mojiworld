#!/usr/bin/env node
// CONDUCTOR MECH attack set, redrawn (ludo.ai animate from the idle frame).
// The shipped set was drawn at 59% of the idle's body (the sprite fit audit,
// v0.30.408) and was propped up by a calib scale. This asks ludo for the attack
// from the idle art itself, then normalises every frame to the idle's body
// scale on the idle's 768x768 canvas: same scale for all frames (one animate
// call keeps one scale), feet on the canvas floor, centred - so the game draws
// it at the idle's size with no calib.
//   node scripts/gen_conductor_mech_attack.mjs             # dry-run: prompt
//   node scripts/gen_conductor_mech_attack.mjs --generate  # needs LUDO_API_KEY; stages + contact sheet
//   node scripts/gen_conductor_mech_attack.mjs --install   # staged -> Sprites/monsters/attack/
import sharp from 'sharp';
import { writeFile, rename, mkdir, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REF = join(ROOT, 'Sprites', 'monsters', 'idle', 'conductorMech_0.webp');
const DEST = join(ROOT, 'Sprites', 'monsters', 'attack');
const STAGE = join(ROOT, 'scripts', '_style_pack', 'conductorMech_attack');
const BACKUP = join(ROOT, 'scripts', '_style_pack', 'conductorMech_attack_old');
const argv = process.argv.slice(2); const has = (f) => argv.includes(f);
const FRAMES = 9; const ROLLS = Number(argv[argv.indexOf('--rolls') + 1]) || 2;
const MOTION =
  'A boxy ticket-vending machine robot on four little wheels ATTACKS: it rocks back on its wheels, its two round eye-lenses flare, ' +
  'the slot panel on its front snaps open and it PUNCHES a glowing golden paper ticket straight forward with a sharp mechanical thrust, ' +
  'a puff of steam and a few sparks, then it settles back to its resting pose. The robot stays the SAME SIZE and in the SAME PLACE on its wheels ' +
  'for every frame - only its panels, arms and the ticket move. Side view, no background, clean sprite frames.';
const exists = (p) => existsSync(p);
const atomicWrite = async (p, buf) => { await writeFile(p + '.tmp', buf); await rename(p + '.tmp', p); };
const box = async (buf) => { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { W, H, x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2 }; };
if (has('--install')) {
  let n = 0; while (exists(join(STAGE, `conductorMech_${n}.webp`))) n++;
  if (n < FRAMES) { console.error(`ABORT: ${n} staged frames`); process.exit(1); }
  await mkdir(BACKUP, { recursive: true });
  for (let i = 0; i < FRAMES; i++) { const old = join(DEST, `conductorMech_${i}.webp`); if (exists(old)) await copyFile(old, join(BACKUP, `conductorMech_${i}.webp`)); await copyFile(join(STAGE, `conductorMech_${i}.webp`), old); }
  console.log(`installed ${FRAMES} frames -> Sprites/monsters/attack/ (old set kept in scripts/_style_pack/conductorMech_attack_old/)`);
  console.log('NOW: node scripts/gen_sprite_frame_index.mjs && node scripts/gen_anim_manifest.mjs && node scripts/animator_parity_check.mjs');
  process.exit(0);
}
if (!has('--generate')) { console.log('# conductorMech attack\n\n' + MOTION + '\n\n# --generate (needs LUDO_API_KEY), review contact_sheet.png, then --install.'); process.exit(0); }
const apiKey = process.env.LUDO_API_KEY; if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
async function post(p, body) { const res = await fetch(`${API}${p}`, { method: 'POST', signal: AbortSignal.timeout(600000), headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!res.ok) { const t = await res.text(); if (res.status === 402) throw new Error('402 OUT OF CREDITS'); throw new Error(`${p} ${res.status}: ${t.slice(0, 200)}`); } return res.json(); }
await mkdir(STAGE, { recursive: true });
const ref = await readFile(REF); const rb = await box(ref); const W = rb.W, H = rb.H;
console.log(`reference ${W}x${H}, body ${rb.w}x${rb.h}, feet at ${rb.y1}, centre ${rb.cx.toFixed(0)}`);
let best = null;
for (let roll = 1; roll <= ROLLS; roll++) {
  console.log(`animate roll ${roll}/${ROLLS} ...`);
  let anim; try { anim = await post('/assets/sprite/animate', { initial_image: `data:image/webp;base64,${ref.toString('base64')}`, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite' }); } catch (e) { console.log('  roll failed: ' + e.message); continue; }
  let bufs = [];
  if (anim.spritesheet_url && anim.num_cols && anim.num_rows) { const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata(); const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows); for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++) for (let c = 0; c < anim.num_cols && bufs.length < FRAMES; c++) bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).webp({ quality: 94 }).toBuffer()); }
  if (bufs.length < FRAMES && Array.isArray(anim.individual_frame_urls)) { bufs = []; for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u)); }
  if (bufs.length < FRAMES) { console.log(`  roll returned ${bufs.length}/${FRAMES}`); continue; }
  // one scale for the whole set: the rest frame (0) is brought to the idle body's height (and no wider than its width)
  const boxes = []; for (const b of bufs) boxes.push(await box(b));
  const b0 = boxes[0]; const k = Math.min(rb.h / b0.h, (rb.w * 1.15) / b0.w);
  const frames = [];
  for (let i = 0; i < FRAMES; i++) {
    const b = boxes[i]; const scaled = await sharp(bufs[i]).ensureAlpha().extract({ left: b.x0, top: b.y0, width: b.w, height: b.h }).resize(Math.max(1, Math.round(b.w * k)), Math.max(1, Math.round(b.h * k))).png().toBuffer();
    const sm = await sharp(scaled).metadata(); const left = Math.round(rb.cx - (b.cx - b.x0) * k), top = H - 1 - (sm.height - 1) - (H - 1 - rb.y1);   // feet on the reference's foot row
    const canvas = sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
    const cl = Math.max(0, Math.min(W - sm.width, left)), ct = Math.max(0, Math.min(H - sm.height, top));
    frames.push(await canvas.composite([{ input: scaled, left: cl, top: ct }]).webp({ quality: 92 }).toBuffer());
  }
  // score: body height parity with the idle across the set (median of the 4 smallest frames), and frame-to-frame motion
  const hs = []; for (const f of frames) hs.push((await box(f)).h); const s4 = hs.slice().sort((a, b) => a - b).slice(0, 4); const bodyRatio = s4[2] / rb.h;
  console.log(`  roll ${roll}: body/idle ${bodyRatio.toFixed(2)} (scale ${k.toFixed(3)}), heights ${hs.join(' ')}`);
  if (!best || Math.abs(bodyRatio - 1) < Math.abs(best.bodyRatio - 1)) best = { frames, bodyRatio, roll };
}
if (!best) { console.error('ABORT: no roll produced a full set'); process.exit(2); }
for (let i = 0; i < FRAMES; i++) await atomicWrite(join(STAGE, `conductorMech_${i}.webp`), best.frames[i]);
const TW = 160, TH = 160; const tiles = []; const idleThumb = await sharp(ref).resize(TW, TH).png().toBuffer(); tiles.push({ input: idleThumb, left: 0, top: 0 });
for (let i = 0; i < FRAMES; i++) tiles.push({ input: await sharp(best.frames[i]).resize(TW, TH).png().toBuffer(), left: (i + 1) * TW, top: 0 });
await sharp({ create: { width: TW * (FRAMES + 1), height: TH, channels: 4, background: { r: 24, g: 22, b: 40, alpha: 1 } } }).composite(tiles).png().toFile(join(STAGE, 'contact_sheet.png'));
console.log(`staged roll ${best.roll} (body/idle ${best.bodyRatio.toFixed(2)}) -> ${STAGE}; review contact_sheet.png (idle first), then --install`);
