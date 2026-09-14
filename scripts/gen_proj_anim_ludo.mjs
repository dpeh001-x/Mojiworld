#!/usr/bin/env node
// Projectile animation frames from ludo.ai, seeded with the sprite that already ships.
//
// Supersedes gen_bloodlust_wave_anim_ludo.mjs, which did this for one sprite. Two targets now, and
// the thing that makes it worth a shared script: a GATE that encodes what went wrong the first
// time. v0.30.687's crescent was rolled from a brief asking for "embers shedding off the trailing
// edge", and that is exactly what it got - the middle frames shattered into a mean of 30
// disconnected blobs, peaking at 82, which the user called "rather weird". A roll is now measured
// before it is ever looked at, and one that fragments is discarded and re-rolled automatically.
//
// Always seeded with the SHIPPED sprite (image -> animate), never text -> image: the art exists and
// is the thing being animated, so a text prompt would invent a different projectile.
//
// Both targets are drawn by a branch that orients the sprite to its own velocity - the crescent is
// mirrored for leftward travel, the ring is rotated - so NEITHER may bake rotation or drift. What
// animates is what happens inside the shape.
//
//   node scripts/gen_proj_anim_ludo.mjs                             # print the briefs
//   node scripts/gen_proj_anim_ludo.mjs --target shockwave --generate --rolls 3
//   node scripts/gen_proj_anim_ludo.mjs --target shockwave --from 2 --install
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.PROJ_ANIM_OUT || ROOT;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEY = process.env.LUDO_API_KEY;
const N = 9, SIZE = 768;
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const NO_JUNK = 'ABSOLUTELY NO sparks, NO embers, NO glitter, NO speckles, NO dust, NO flying debris, '
  + 'NO grain, NO noise, NO smoke: the shape must stay whole and its edges clean in every single frame.';
const NO_MOVE = 'It stays PERFECTLY CENTRED, the SAME SIZE and the SAME ANGLE in every frame: do NOT rotate it, '
  + 'do NOT spin it, do NOT move it across the frame, no camera move, no zoom.';
const TAIL = 'Seamless loop - the last frame flows back into the first. Same colours, same art style, '
  + 'fully transparent background in every frame, no background, no scene, no text, no watermark.';

const TARGETS = {
  // the Bloodlust swing-rider's crescent. Engine mirrors it for leftward travel.
  bloodlust_wave: {
    src: 'Sprites/projectiles/p_bloodlust_shockwave.webp',
    motion: [
      'A crimson crescent blade SHOCKWAVE flying to the RIGHT - a sonic boom. Not fire, not sparkle, not magic dust.',
      NO_MOVE,
      'Its silhouette stays CRISP, SOLID and UNBROKEN - hard clean edges, sharp unbroken points, the same deep red body.',
      'What moves is the AIR around it: a thin translucent white pressure front peels off the outer curve and expands',
      'away, a second fainter one follows it, and a thin white-hot rim flashes along the leading edge and dims again.',
      NO_JUNK, TAIL,
    ].join(' '),
  },
  // the generic red shockwave ring. Engine rotates it to velocity.
  shockwave: {
    src: 'Sprites/projectiles/p_shockwave.webp',
    motion: [
      'A red energy SHOCKWAVE RING - a blast wave seen head on, like a sonic boom ring.',
      NO_MOVE,
      'The ring stays a clean unbroken ring with hard edges and its pale highlight, never breaking into pieces.',
      'The motion is the BLAST: the ring pushes outward and its wall thins and brightens as it goes, while a second,',
      'tighter ring is already forming inside it so the two overlap and the loop never snaps -',
      'and a white-hot flare races around the ring, once around per loop.',
      NO_JUNK, TAIL,
    ].join(' '),
  },
};

const target = arg('--target') || 'bloodlust_wave';
const T = TARGETS[target];
if (!T) { console.error('unknown --target; have: ' + Object.keys(TARGETS).join(', ')); process.exit(1); }
const KEEP = join(ROOT, 'scripts', '_tmp_projanim_' + target);

if (!has('--generate') && !has('--from')) {
  for (const [k, v] of Object.entries(TARGETS)) console.log(`=== ${k}\nseed: ${v.src}\n${v.motion}\n`);
  process.exit(0);
}

const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

async function poll(res) {
  if (res.status === 402) { console.error('OUT OF LUDO CREDITS'); process.exit(3); }
  if (!res.ok && res.status !== 202) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200));
  let data = await res.json();
  const id = data && (data.job_id || data.jobId || data.id);
  if (res.status !== 202 && !(data && data.status && id && !data.url && !data.spritesheet_url && !data.individual_frame_urls)) return data;
  if (!id) return data;
  for (let i = 0; i < 180; i++) {
    await new Promise((s) => setTimeout(s, 5000));
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) continue;
    data = await r.json();
    const st = String(data.status || data.state || '').toLowerCase();
    if (st === 'failed' || st === 'error') throw new Error('job failed: ' + JSON.stringify(data).slice(0, 200));
    if (st === 'completed' || st === 'succeeded' || st === 'done' || data.url || data.spritesheet_url || data.individual_frame_urls) {
      return (data.result && !Array.isArray(data.result)) ? Object.assign({}, data, data.result) : data;
    }
  }
  throw new Error('job did not finish');
}

// THE GATE. Connected components above 12px, per frame. A whole shape is 1 (plus a front or two);
// the rejected v0.30.687 roll averaged 30 and peaked at 82. Also reports centroid drift, because a
// frame set that wanders fights the engine's own orientation.
const BLOB_MAX = 6, DRIFT_MAX = 14;
async function score(bufs) {
  const rows = [];
  for (const buf of bufs) {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, seen = new Uint8Array(W * H);
    let any = 0, sx = 0, sy = 0, blobs = 0; const stack = [];
    for (let p = 0; p < W * H; p++) if (data[p * 4 + 3] > 10) { any++; sx += p % W; sy += (p / W) | 0; }
    for (let p0 = 0; p0 < W * H; p0++) {
      if (seen[p0] || data[p0 * 4 + 3] <= 10) continue;
      let n = 0; stack.length = 0; stack.push(p0); seen[p0] = 1;
      while (stack.length) {
        const p = stack.pop(); n++; const x = p % W, y = (p / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (seen[q] || data[q * 4 + 3] <= 10) continue;
          seen[q] = 1; stack.push(q);
        }
      }
      if (n >= 12) blobs++;
    }
    rows.push({ blobs, cx: sx / Math.max(1, any), cy: sy / Math.max(1, any) });
  }
  const meanBlobs = rows.reduce((s, r) => s + r.blobs, 0) / rows.length;
  const drift = Math.max(...rows.map((r) => Math.hypot(r.cx - rows[0].cx, r.cy - rows[0].cy)));
  return { meanBlobs: +meanBlobs.toFixed(2), maxBlobs: Math.max(...rows.map((r) => r.blobs)), drift: +drift.toFixed(1) };
}

if (has('--generate')) {
  if (!KEY) { console.error('LUDO_API_KEY required'); process.exit(1); }
  await mkdir(KEEP, { recursive: true });
  const rolls = Number(arg('--rolls') || 3);
  let roll = 1; while (existsSync(join(KEEP, `roll${roll}_0.png`))) roll++;
  const seed = await sharp(readFileSync(join(ROOT, T.src))).resize(512, 512, { fit: 'inside' }).webp({ quality: 95 }).toBuffer();
  for (let done = 0; done < rolls; done++, roll++) {
    process.stdout.write(`${target} roll ${roll}: animate ... `);
    let anim;
    try {
      anim = await poll(await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', signal: AbortSignal.timeout(900000),
        headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_image: 'data:image/webp;base64,' + seed.toString('base64'),
          motion_prompt: T.motion, frames: N, frame_size: -9, model: 'eagle', individual_frames: true }),
      }));
    } catch (e) { console.log('FAILED ' + e.message); continue; }
    const pngs = [];
    if (Array.isArray(anim.individual_frame_urls) && anim.individual_frame_urls.length >= N) {
      for (const u of anim.individual_frame_urls.slice(0, N)) pngs.push(await sharp(await fetchBuf(u)).png().toBuffer());
    } else if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
      const sh = await fetchBuf(anim.spritesheet_url), md = await sharp(sh).metadata();
      const cw = Math.floor(md.width / anim.num_cols), ch = Math.floor(md.height / anim.num_rows);
      for (let r = 0; r < anim.num_rows && pngs.length < N; r++) for (let c = 0; c < anim.num_cols && pngs.length < N; c++) {
        pngs.push(await sharp(sh).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
      }
    }
    if (pngs.length < N) { console.log('only ' + pngs.length + ' frames'); continue; }
    const sc = await score(pngs);
    const ok = sc.meanBlobs <= BLOB_MAX && sc.drift <= DRIFT_MAX;
    for (let i = 0; i < N; i++) await writeFile(join(KEEP, `roll${roll}_${i}.png`), pngs[i]);
    console.log(`${ok ? 'PASS' : 'REJECT'} blobs ${sc.meanBlobs} (max ${sc.maxBlobs}) drift ${sc.drift}`);
  }
  console.log('candidates in ' + KEEP);
}

if (has('--from')) {
  // Uncropped: the animate stage returns the framing it was seeded with, and a union crop would pad
  // the box out to whatever the frames throw and shrink the shape when the frames decode.
  const roll = arg('--from');
  if (has('--install')) await mkdir(join(OUT, 'Sprites', 'projectiles', 'anim'), { recursive: true });
  for (let i = 0; i < N; i++) {
    const out = await sharp(readFileSync(join(KEEP, `roll${roll}_${i}.png`)))
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    await writeFile(has('--install')
      ? join(OUT, 'Sprites', 'projectiles', 'anim', `${target}_${i}.webp`)
      : join(KEEP, `final_roll${roll}_${i}.webp`), out);
  }
  console.log((has('--install') ? 'installed ' : 'wrote ') + `${N} ${target} frames from roll ${roll}`);
}
