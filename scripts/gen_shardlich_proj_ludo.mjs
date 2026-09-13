#!/usr/bin/env node
// Shardlich's own projectile, via ludo.ai.
//
// Per user: "using ludo.ai make a specific projectile for shardlich, that suits its theme".
// It already had a bespoke file - mcryshard.webp, from the v0.26.x de-share pass - but that art is a
// VIOLET necro-crystal, and Shardlich is not violet: the monster is a pale ice-blue crystalline lich
// in faceted glass armour (color #a0c0ff over shell #3a5a8a), the Glasswind Steppe's "ice-shard
// caster", crowned with shard-prisms, and its hits roll a 30% electrocute. So the shard it throws
// should be a prism of its own crown - cold blue glass with a lightning-lit core - not a purple one.
//
// Two ludo.ai stages, the same shape gen_block_fx_ludo.mjs uses:
//   1. text -> image for the key frame (/assets/image)
//   2. that image -> nine frames (/assets/sprite/animate), frame_size -9 so the framing is kept
// The motion prompt only lights the shard: refraction glints travelling the facets and a pale
// electric arc crackling over it. It must NOT spin or drift, because the engine already rotates this
// projectile itself (LX_MOB_PROJ mcryshard = mode 'orient', the point leading the velocity) - a spin
// baked into the frames would fight that rotation.
//
// Both endpoints may answer 202 + a job id instead of the asset; poll() handles either.
//
//   node scripts/gen_shardlich_proj_ludo.mjs                    # print the prompts, generate nothing
//   node scripts/gen_shardlich_proj_ludo.mjs --generate         # needs LUDO_API_KEY; writes candidates
//   node scripts/gen_shardlich_proj_ludo.mjs --from N --install # install roll N over the live art
import sharp from 'sharp';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = join(ROOT, 'scripts', '_tmp_shardlich_proj');
// SHARD_OUT installs into a scratch dir instead of the shared checkout: parallel sessions edit this
// repo and mcryshard.webp is tracked, so writing over it here is opt-in rather than automatic.
const PROJ = process.env.SHARD_OUT || join(ROOT, 'Sprites', 'projectiles');
const N = 9, SIZE = 512, PAD = 0.06;
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const arg = (f) => { const a = argv.find((x) => x.startsWith(f + '=')) || argv[argv.indexOf(f) + 1]; return a && a.startsWith(f + '=') ? a.slice(f.length + 1) : a; };

const BASE_PROMPT = [
  'Game projectile sprite, side view, ONE object centred, fully transparent background - no scene, no floor,',
  'no character, no hand, no text, no watermark, no border.',
  'A SHARP ICE-CRYSTAL PRISM SHARD flying point-first to the RIGHT: a long faceted glass dart, its tip a clean',
  'sharp point on the right, the tail breaking into two or three smaller splinters on the left.',
  'Colours: pale ice blue (#a0c0ff) glass facets over deep steel blue (#3a5a8a) shadow planes, a bright',
  'white-cyan core glowing inside the crystal, cold white rim-light along the top edges.',
  'A thin pale-blue electric arc crackles along the shard and a few small lightning sparks trail behind it.',
  'Bold thin dark-navy outline around every edge, flat cel shading with a glossy highlight, crisp vector',
  'facets - like a cut gemstone, not a smooth icicle. Clean readable silhouette at small size.',
].join(' ');

const MOTION = [
  'The crystal shard stays perfectly centred, the same size and the same angle in every frame - do NOT rotate it,',
  'do NOT spin it, do NOT move it across the frame, no camera move, no zoom.',
  'Only the light moves: the white-cyan core pulses brighter and dimmer, refraction glints travel along the facets',
  'from tail to tip, and the pale-blue electric arc crackles over the surface and re-forms, with small sparks',
  'flickering around the shard. Seamless loop, consistent art style, transparent background in every frame.',
].join(' ');

if (!has('--generate') && !has('--from')) {
  console.log('BASE:\n' + BASE_PROMPT + '\n\nMOTION:\n' + MOTION + '\n\n--generate (LUDO_API_KEY) | --from N [--install]');
  process.exit(0);
}
await mkdir(KEEP, { recursive: true });
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEY = process.env.LUDO_API_KEY;
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

// The API answers either with the asset itself or 202 + { job_id }. Poll until it resolves.
async function poll(res) {
  if (res.status === 402) { console.error('OUT OF LUDO CREDITS'); process.exit(3); }
  if (!res.ok && res.status !== 202) throw new Error(res.status + ' ' + (await res.text()).slice(0, 160));
  let data = await res.json();
  const id = data && (data.job_id || data.jobId || data.id);
  if (res.status !== 202 && !(data && data.status && id && !data.url && !data.images && !data.spritesheet_url)) return data;
  if (!id) return data;
  for (let i = 0; i < 120; i++) {
    await new Promise((s) => setTimeout(s, 5000));
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) continue;
    data = await r.json();
    const st = String(data.status || data.state || '').toLowerCase();
    if (st === 'failed' || st === 'error') throw new Error('job failed: ' + JSON.stringify(data).slice(0, 160));
    if (st === 'completed' || st === 'succeeded' || st === 'done' || data.url || data.images || data.spritesheet_url || data.individual_frame_urls) return data.result || data;
  }
  throw new Error('job did not finish');
}
const urlOf = (d) => (Array.isArray(d) ? d[0]?.url : (d?.url || d?.images?.[0]?.url || d?.image_url || d?.result?.url));

// Framing is SHARED across the set. Trimming each frame on its own would re-centre and re-scale the
// crystal whenever a spark flares past its edge - which is exactly what the first run did, and what
// made the gates report a shard that changes size. So: measure every raw frame, take the UNION box,
// square it with a margin, and cut all nine frames (and the base) with that ONE box.
async function rawBox(buf) {
  const m = await sharp(buf).metadata();
  const w = m.width, h = m.height;
  const raw = await sharp(buf).ensureAlpha().raw().toBuffer();
  let minX = w, minY = h, maxX = -1, maxY = -1, lit = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (raw[i + 3] < 40) continue; lit++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { w, h, lit, minX, minY, maxX, maxY };
}
// Metrics on a finished 512 frame: colour shares, and the box of the CRYSTAL itself - solid,
// blue-dominant pixels - so white sparks around it do not read as the shard growing.
async function metrics(buf) {
  const raw = await sharp(buf).ensureAlpha().raw().toBuffer();
  let lit = 0, blue = 0, violet = 0, cminX = SIZE, cminY = SIZE, cmaxX = -1, cmaxY = -1, core = 0;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4, a = raw[i + 3]; if (a < 40) continue;
    const r = raw[i], g = raw[i + 1], b = raw[i + 2];
    lit++;
    if (b > r + 18 && b >= g - 10) blue++;
    if (r > g + 30 && b > g + 30) violet++;
    if (a > 200 && b > r + 12) { core++; if (x < cminX) cminX = x; if (x > cmaxX) cmaxX = x; if (y < cminY) cminY = y; if (y > cmaxY) cmaxY = y; }
  }
  return { buf, lit, blue, violet, core, box: { minX: cminX, minY: cminY, maxX: cmaxX, maxY: cmaxY }, raw };
}
async function frameSet(pngs) {
  const boxes = []; for (const p of pngs) boxes.push(await rawBox(p));
  const u = boxes.reduce((a, b) => ({ minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) }), { minX: 1e9, minY: 1e9, maxX: -1, maxY: -1 });
  const w = u.maxX - u.minX + 1, h = u.maxY - u.minY + 1;
  const side = Math.round(Math.max(w, h) * (1 + PAD * 2));
  const left = Math.round(u.minX - (side - w) / 2), top = Math.round(u.minY - (side - h) / 2);
  const out = [];
  for (const p of pngs) {
    const m = await sharp(p).metadata();
    const ex = Math.max(0, -left), ey = Math.max(0, -top);
    const padded = await sharp(p).ensureAlpha().extend({ left: ex, top: ey, right: Math.max(0, left + side - m.width), bottom: Math.max(0, top + side - m.height), background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const cut = await sharp(padded).extract({ left: left + ex, top: top + ey, width: side, height: side }).resize(SIZE, SIZE).png().toBuffer();
    out.push(await metrics(cut));
  }
  return out;
}
function gates(frames) {
  const bad = [];
  const litAll = frames.reduce((a, f) => a + f.lit, 0);
  const blueShare = frames.reduce((a, f) => a + f.blue, 0) / Math.max(1, litAll);
  const violetShare = frames.reduce((a, f) => a + f.violet, 0) / Math.max(1, litAll);
  if (frames.some((f) => f.lit / (SIZE * SIZE) < 0.02)) bad.push("a frame is nearly empty");
  if (blueShare < 0.35) bad.push("not blue enough for Shardlich (" + (blueShare * 100).toFixed(0) + "%)");
  if (violetShare > 0.20) bad.push("still reads violet (" + (violetShare * 100).toFixed(0) + "%)");
  const w = frames.map((f) => f.box.maxX - f.box.minX), h = frames.map((f) => f.box.maxY - f.box.minY);
  const span = (a) => (Math.max(...a) - Math.min(...a)) / Math.max(1, Math.max(...a));
  if (span(w) > 0.12 || span(h) > 0.12) bad.push("the crystal changes size (w " + (span(w) * 100).toFixed(0) + "%, h " + (span(h) * 100).toFixed(0) + "%)");
  const cx = frames.map((f) => (f.box.minX + f.box.maxX) / 2), cy = frames.map((f) => (f.box.minY + f.box.maxY) / 2);
  if (Math.max(...cx) - Math.min(...cx) > SIZE * 0.05 || Math.max(...cy) - Math.min(...cy) > SIZE * 0.05) bad.push("the crystal drifts");
  // Motion, measured as the share of the sprite that MATERIALLY changes frame to frame. A mean alpha
  // delta over the whole canvas hides this effect: the arcs and sparks are small and bright, so they
  // move a lot of pixels a little way down the average and read as a still image.
  let diff = 0;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1].raw, b = frames[i].raw; let changed = 0, lit = 0;
    for (let p = 0; p < a.length; p += 4) {
      if (a[p + 3] > 40 || b[p + 3] > 40) lit++;
      if (Math.max(Math.abs(a[p] - b[p]), Math.abs(a[p + 1] - b[p + 1]), Math.abs(a[p + 2] - b[p + 2]), Math.abs(a[p + 3] - b[p + 3])) > 24) changed++;
    }
    diff += changed / Math.max(1, lit);
  }
  diff /= Math.max(1, frames.length - 1);
  if (diff < 0.015) bad.push("nothing moves between frames (" + (diff * 100).toFixed(1) + "% of the sprite)");
  if (diff > 0.60) bad.push("the whole sprite is redrawn each frame (" + (diff * 100).toFixed(1) + "%)");
  return { bad, blueShare, violetShare, diff };
}
async function sheet(frames, p) {
  const T = 150, comps = [];
  for (let i = 0; i < frames.length; i++) comps.push({ input: await sharp(frames[i].buf).resize(T, T).png().toBuffer(), left: 4 + i * (T + 4), top: 4 });
  await sharp({ create: { width: frames.length * (T + 4) + 4, height: T + 8, channels: 4, background: { r: 22, g: 26, b: 36, alpha: 1 } } }).composite(comps).png().toFile(p);
}

let chosen = null;
if (has('--from')) {
  const n = arg('--from');
  const pngs = []; for (let i = 0; i < N; i++) pngs.push(readFileSync(join(KEEP, `roll${n}_${i}.png`)));
  const frames = await frameSet(pngs);
  const g = gates(frames);
  console.log(`roll ${n}: blue ${(g.blueShare * 100).toFixed(0)}%  violet ${(g.violetShare * 100).toFixed(0)}%  ${g.bad.length ? 'FAIL: ' + g.bad.join(' | ') : 'passes every gate'}`);
  await sheet(frames, join(KEEP, `roll${n}_sheet.png`));
  chosen = frames;
} else {
  if (!KEY) { console.error('LUDO_API_KEY required'); process.exit(1); }
  const ROLLS = Number(arg('--rolls') || 2);
  let start = 1; while (existsSync(join(KEEP, `roll${start}_0.png`))) start++;
  for (let roll = start; roll < start + ROLLS; roll++) {
    process.stdout.write(`roll ${roll}: key frame ... `);
    const img = await poll(await fetch(`${API}/assets/image`, { method: 'POST', signal: AbortSignal.timeout(600000),
      headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: BASE_PROMPT }) }));
    const keyUrl = urlOf(img); if (!keyUrl) { console.log('no key-frame url'); continue; }
    const keyBuf = await fetchBuf(keyUrl);
    await writeFile(join(KEEP, `roll${roll}_base.png`), await sharp(keyBuf).png().toBuffer());
    process.stdout.write('animate ... ');
    const seed = await sharp(keyBuf).resize(SIZE, SIZE, { fit: 'inside' }).webp({ quality: 94 }).toBuffer();
    const anim = await poll(await fetch(`${API}/assets/sprite/animate`, { method: 'POST', signal: AbortSignal.timeout(900000),
      headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ initial_image: 'data:image/webp;base64,' + seed.toString('base64'), motion_prompt: MOTION, frames: N, frame_size: -9, model: 'eagle', individual_frames: true, loop: true }) }));
    let pngs = [];
    if (Array.isArray(anim.individual_frame_urls) && anim.individual_frame_urls.length >= N) {
      for (const u of anim.individual_frame_urls.slice(0, N)) pngs.push(await sharp(await fetchBuf(u)).png().toBuffer());
    } else if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
      const sh = await fetchBuf(anim.spritesheet_url), md = await sharp(sh).metadata();
      const cw = Math.floor(md.width / anim.num_cols), ch = Math.floor(md.height / anim.num_rows);
      for (let r = 0; r < anim.num_rows && pngs.length < N; r++) for (let c = 0; c < anim.num_cols && pngs.length < N; c++)
        pngs.push(await sharp(sh).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    }
    if (pngs.length < N) { console.log('only ' + pngs.length + ' frames'); continue; }
    for (let i = 0; i < N; i++) await writeFile(join(KEEP, `roll${roll}_${i}.png`), pngs[i]);
    const frames = await frameSet(pngs);
    const g = gates(frames);
    await sheet(frames, join(KEEP, `roll${roll}_sheet.png`));
    console.log(`blue ${(g.blueShare * 100).toFixed(0)}%  violet ${(g.violetShare * 100).toFixed(0)}%  ${g.bad.length ? 'FAIL: ' + g.bad.join(' | ') : 'passes every gate'}`);
    if (!g.bad.length) { chosen = frames; break; }
  }
}
if (!chosen) { console.error('no roll passed the gates - look at scripts/_tmp_shardlich_proj/*_sheet.png'); process.exit(2); }
if (has('--install')) {
  await mkdir(join(PROJ, 'anim'), { recursive: true });
  for (let i = 0; i < N; i++) await writeFile(join(PROJ, 'anim', `mcryshard_${i}.webp`), await sharp(chosen[i].buf).webp({ quality: 92 }).toBuffer());
  await writeFile(join(PROJ, 'mcryshard.webp'), await sharp(chosen[0].buf).webp({ quality: 92 }).toBuffer());
  console.log('installed Sprites/projectiles/mcryshard.webp + anim/mcryshard_0..8.webp');
} else {
  console.log('candidates in ' + KEEP + ' (add --install to write them into Sprites/projectiles)');
}
