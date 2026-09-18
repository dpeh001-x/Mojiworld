#!/usr/bin/env node
// THE TOWER BOSSES MOVE (final polish audit R10; per user "Work on all the above"). Three attack sets were near-static:
// mean frame-to-frame change 0.83 (the Arbiter's VERDICT: the pose holds nine frames, only the flame moves), 1.46 (his
// column) and 1.96 (the Sovereign's volley), against 13.9 for a typical boss attack. Each is regenerated with
// ludo.ai's /assets/sprite/animate, seeded with the set's own frame 0 so every frame is the same character, and put
// back on the set's own canvas at the same scale and foot position - so the calibration (anim_calib, the manifest's
// content boxes after a regen) keeps describing the art.
//
//   node scripts/gen_tower_anim_ludo.mjs                                  # print the plan
//   node scripts/gen_tower_anim_ludo.mjs --generate [--only <set>] [--rolls N]   # rolls kept in scripts/_tmp_tower_anim/
//   node scripts/gen_tower_anim_ludo.mjs --apply <set> <roll>             # write that roll into Sprites/bosses/attack/
// After --apply: node scripts/gen_anim_manifest.mjs && node scripts/animator_parity_check.mjs
import sharp from 'sharp';
import { writeFile, mkdir, readFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = join(ROOT, 'scripts', '_tmp_tower_anim');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEY = process.env.LUDO_API_KEY;
const N = 9;
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const FRAME = 'Clean flat cartoon game-sprite art with a dark outline, exactly like the source image. Fully TRANSPARENT background in '
  + 'every frame - no background, no scene, no floor, no ground shadow, no text, no border. The character stays the SAME SIZE and in the '
  + 'SAME PLACE in every frame: no zoom, no camera move, no travelling across the frame, feet on the SAME line, the whole body and '
  + 'the whole weapon inside the frame with clear margin - nothing cut off. The same camera angle throughout; he never turns to face the viewer.';
const ARBITER = 'The SAME golden armoured knight in every frame: identical gold plate armour, closed gold helm with a purple plume, purple cape, '
  + 'identical long silver greatsword, identical colours. ';
const SOVEREIGN = 'The SAME hooded dark sorcerer-king in every frame: identical black hood with the face in shadow, gold-and-white trimmed dark '
  + 'armour and robes, dark flowing cape, identical twisted staff topped with a burning orange crystal, identical colours. ';
const SETS = {
  towerArbiterverdict: { pad: { top: 0.75, side: 0.55, bottom: 0.06 },
    motion: ARBITER + 'He delivers his VERDICT: frames 1-3 he lifts the greatsword high above his helm with both hands, the blade bursting into '
      + 'flame; frames 4-6 he brings it down in one great vertical cleaving strike in front of him, flames trailing the blade; frames 7-9 '
      + 'he raises it back to the upright guard. A heavy, clear, full-body swing - arms, shoulders and cape all move. ' + FRAME },
  towerArbitercolumn: { pad: { top: 0.5, side: 0.55, bottom: 0.06 },
    motion: ARBITER + 'He calls down a PILLAR: frames 1-3 he raises the greatsword point-down above the ground in front of him with both hands; '
      + 'frames 4-6 he drives it down into the ground and leans his weight on the hilt as golden light flares up around the blade; frames '
      + '7-9 he pulls it back up to the upright guard. The arms, shoulders, head and cape clearly move. ' + FRAME },
  towerSovereignvolley: { pad: { top: 0.45, side: 0.6, bottom: 0.06 },
    motion: SOVEREIGN + 'He casts a VOLLEY: frames 1-3 he raises the staff high and the crystal flares brighter; frames 4-6 he sweeps the '
      + 'staff forward and thrusts his free hand out, and a burst of burning sparks flies from the crystal; frames 7-9 he draws the staff '
      + 'back to his side. The arms, staff, hood and robes clearly move. ' + FRAME },
};
const src = (set, i) => join(ROOT, 'Sprites', 'bosses', 'attack', `${set}_${i}.webp`);

// The seed region: frame 0's content box, padded (more above, where a raised weapon goes), squared, clamped to nothing -
// it may run past the canvas edge, which is padded transparent. Returned in canvas pixels.
async function region(set) {
  const md = await sharp(src(set, 0)).metadata();
  const t = await sharp(src(set, 0)).trim({ threshold: 8 }).toBuffer({ resolveWithObject: true });
  const bw = t.info.width, bh = t.info.height, bx = -t.info.trimOffsetLeft, by = -t.info.trimOffsetTop;
  const p = SETS[set].pad;
  let x0 = bx - bw * p.side, x1 = bx + bw * (1 + p.side), y0 = by - bh * p.top, y1 = by + bh * (1 + p.bottom);
  const side = Math.ceil(Math.max(x1 - x0, y1 - y0));
  const cx = (x0 + x1) / 2;
  x0 = Math.round(cx - side / 2); y1 = Math.round(y1); y0 = y1 - side;   // square, bottom (the feet) kept where it was
  return { x: x0, y: y0, s: side, W: md.width, H: md.height };
}
// Cut a square region out of an image, padding with transparency wherever it leaves the canvas.
async function cut(buf, r) {
  const big = await sharp(buf).extend({ top: r.s, bottom: r.s, left: r.s, right: r.s, background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp(big).extract({ left: r.x + r.s, top: r.y + r.s, width: r.s, height: r.s }).png().toBuffer();
}
// Effects (light rays, flame arcs) can run to the edge of the generated square; pasted back, that edge would be a hard
// straight cut in the arena. Fade the outer 6% of the top, left and right to transparent. Not the bottom: the feet sit
// just above it, on the same foot line as the shipped frames.
async function feather(buf, size) {
  const b = Math.max(8, Math.round(size * 0.06)), raw = Buffer.alloc(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.min(x, y, size - 1 - x);
    raw[y * size + x] = d >= b ? 255 : Math.round(255 * d / b);
  }
  const mask = await sharp(raw, { raw: { width: size, height: size, channels: 1 } }).png().toBuffer();
  return sharp(buf).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}
// Put a square frame back onto a transparent canvas of the set's size, at the region it came from.
async function place(frame, r) {
  const sq = await feather(await sharp(frame).resize(r.s, r.s, { fit: 'fill' }).png().toBuffer(), r.s);
  const big = await sharp({ create: { width: r.W + 2 * r.s, height: r.H + 2 * r.s, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: sq, left: r.x + r.s, top: r.y + r.s }]).png().toBuffer();
  return sharp(big).extract({ left: r.s, top: r.s, width: r.W, height: r.H }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
}
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
async function poll(res) {
  if (res.status === 402) { console.error('OUT OF LUDO CREDITS'); process.exit(3); }
  if (!res.ok && res.status !== 202) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200));
  let data = await res.json();
  const id = data && (data.job_id || data.jobId || data.id);
  if (res.status !== 202 && !(data && data.status && id && !data.url && !data.spritesheet_url && !data.individual_frame_urls)) return data;
  for (let i = 0; i < 180; i++) {
    await new Promise((s) => setTimeout(s, 5000));
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) continue;
    data = await r.json();
    const st = String(data.status || '').toLowerCase();
    if (st === 'failed' || st === 'cancelled') throw new Error('job failed: ' + JSON.stringify(data).slice(0, 200));
    if (st === 'succeeded' || data.individual_frame_urls || data.spritesheet_url) return (data.result && !Array.isArray(data.result)) ? Object.assign({}, data, data.result) : data;
  }
  throw new Error('job did not finish');
}

// The SHIPPED frame 0 is the reference every roll is fitted back to, so it is measured once, before anything is written,
// and kept beside the rolls: after an --apply, frame 0 on disk is the new art and can no longer serve.
const refFile = (set) => join(KEEP, `${set}_ref.json`);
async function saveRef(set) {
  const r = await region(set);
  const t = await sharp(src(set, 0)).trim({ threshold: 8 }).toBuffer({ resolveWithObject: true });
  const ref = { r, h: t.info.height, cx: -t.info.trimOffsetLeft + t.info.width / 2, bottom: -t.info.trimOffsetTop + t.info.height };
  await writeFile(refFile(set), JSON.stringify(ref));
  return ref;
}
// The animator redraws the character a little larger or lower than the seed (measured: the volley's new frame 0 was 6%
// taller with the feet 10 px lower). One transform for the whole set - scale about the new frame 0's foot point, then move
// that point onto the shipped frame 0's - so the set keeps its internal motion and lands on the old size and foot line.
async function fit(frames, ref) {
  const t = await sharp(frames[0]).trim({ threshold: 8 }).toBuffer({ resolveWithObject: true });
  const s = ref.h / t.info.height, ncx = -t.info.trimOffsetLeft + t.info.width / 2, nb = -t.info.trimOffsetTop + t.info.height;
  const W = ref.r.W, H = ref.r.H, sw = Math.round(W * s), sh = Math.round(H * s);
  const left = Math.round(ref.cx - ncx * s), top = Math.round(ref.bottom - nb * s), P = Math.max(W, H);
  const out = [];
  for (const f of frames) {
    const scaled = await sharp(f).resize(sw, sh).png().toBuffer();
    const big = await sharp({ create: { width: W + 2 * P, height: H + 2 * P, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: scaled, left: left + P, top: top + P }]).png().toBuffer();
    out.push(await sharp(big).extract({ left: P, top: P, width: W, height: H }).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
  }
  return { out, s, dx: left, dy: top };
}
if (has('--ref')) { const set = arg('--ref'); console.log(JSON.stringify(await saveRef(set))); process.exit(0); }
if (has('--apply')) {
  const set = arg('--apply'), roll = argv[argv.indexOf('--apply') + 2];
  if (!SETS[set] || !roll) { console.error('usage: --apply <set> <roll>'); process.exit(1); }
  if (!existsSync(refFile(set))) { console.error('no ' + refFile(set) + ' - run --ref <set> on the SHIPPED frames first'); process.exit(1); }
  const ref = JSON.parse(await readFile(refFile(set), 'utf8')), r = ref.r;
  for (let i = 0; i < N; i++) {
    const f = join(KEEP, `${set}_roll${roll}_${i}.png`);
    if (!existsSync(f)) { console.error('missing ' + f); process.exit(1); }
  }
  const placed = [];
  for (let i = 0; i < N; i++) placed.push(await place(await readFile(join(KEEP, `${set}_roll${roll}_${i}.png`)), r));
  const fitted = await fit(placed, ref);
  for (let i = 0; i < N; i++) { const out = src(set, i); await writeFile(out + '.tmp', fitted.out[i]); await rename(out + '.tmp', out); }
  console.log(`applied ${set} roll ${roll} -> ${N} frames on the ${r.W}x${r.H} canvas (scale ${fitted.s.toFixed(3)}, foot point to ${ref.cx.toFixed(0)},${ref.bottom})`);
  process.exit(0);
}
if (!has('--generate')) { for (const [k, v] of Object.entries(SETS)) console.log('=== ' + k + ' ===\n' + v.motion + '\n'); process.exit(0); }
if (!KEY) { console.error('LUDO_API_KEY required'); process.exit(1); }
await mkdir(KEEP, { recursive: true });
const only = arg('--only'), rolls = Number(arg('--rolls') || 1);
for (const [set, spec] of Object.entries(SETS)) {
  if (only && only !== set) continue;
  const r = await region(set);
  if (!existsSync(refFile(set))) await saveRef(set);   // measured off the shipped frames, before any --apply replaces them
  // 896 px square keeps the seed under the 1 MP limit for True Size framing (frame_size -9)
  const seed = await sharp(await cut(await readFile(src(set, 0)), r)).resize(896, 896).webp({ quality: 95, alphaQuality: 100 }).toBuffer();
  await writeFile(join(KEEP, `${set}_seed.webp`), seed);
  let start = 1; while (existsSync(join(KEEP, `${set}_roll${start}_0.png`))) start++;
  for (let roll = start; roll < start + rolls; roll++) {
    process.stdout.write(`${set} roll ${roll}: animate ... `);
    try {
      const anim = await poll(await fetch(`${API}/assets/sprite/animate`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(300000), body: JSON.stringify({ initial_image: 'data:image/webp;base64,' + seed.toString('base64'),
          motion_prompt: spec.motion, frames: N, frame_size: -9, model: 'eagle', individual_frames: true }) }));
      const urls = Array.isArray(anim.individual_frame_urls) ? anim.individual_frame_urls.slice(0, N) : [];
      if (urls.length < N) { console.log('only ' + urls.length + ' frames: ' + JSON.stringify(anim).slice(0, 160)); continue; }
      for (let i = 0; i < N; i++) await writeFile(join(KEEP, `${set}_roll${roll}_${i}.png`), await sharp(await fetchBuf(urls[i])).png().toBuffer());
      console.log('kept ' + N + ' frames');
    } catch (e) { console.log('fail: ' + e.message); }
  }
}
