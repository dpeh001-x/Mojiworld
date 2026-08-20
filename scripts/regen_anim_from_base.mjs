#!/usr/bin/env node
// Regenerate animation sets from newly-dropped base sprites (ludo.ai
// /assets/sprite/animate). Per user: new art landed in Sprites/, and any of it
// that drives an animation sequence needs its frames rebuilt from the NEW base
// — otherwise the static sprite and its animation disagree.
//
// Candidates land in scripts/_style_pack/anim_regen/<key>/ ; install is a
// separate step, so a bad roll never overwrites shipped frames.
//   node scripts/regen_anim_from_base.mjs              # dry-run, lists targets
//   node scripts/regen_anim_from_base.mjs --generate   # needs LUDO_API_KEY
//   flags: --only=<key>
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_ROOT = join(repoRoot, 'scripts', '_style_pack', 'anim_regen');
const argv = process.argv.slice(2);
const val = (f, d) => { const a = argv.find((x) => x.startsWith(f + '=')); return a ? a.split('=')[1] : d; };

const FRAMES = 9, SIZE = 768;
const HOLD = ' The effect stays CENTRED in frame throughout — no drifting, no camera move, no new objects entering, ' +
  'and nothing is cropped at the edges. Fully transparent background, consistent art style across every frame.';

const TARGETS = {
  comet: { base: 'Sprites/projectiles/p_comet.webp', dir: 'Sprites/projectiles/anim',
    motion: 'The comet hurtles forward: its burning tail streams and flickers behind it, the icy core pulses brighter and dimmer, ' +
      'small sparks and debris peel off the trail, and the whole rock rotates very slightly as it flies.' },
  goo: { base: 'Sprites/projectiles/p_goo.webp', dir: 'Sprites/projectiles/anim',
    motion: 'The blob of goo wobbles and jiggles like thick slime in flight: it squashes and stretches, its surface ripples, ' +
      'a few droplets bulge out and are reabsorbed, and highlights slide across the wet surface.' },
  octoHead: { base: 'Sprites/projectiles/p_octohead.webp', dir: 'Sprites/projectiles/anim',
    motion: 'The octopus head pulses as it flies: the bulbous head squashes and swells with each beat, ' +
      'its tentacles undulate and curl in rippling waves, and the eyes glint. A living, breathing creature in motion.' },
  // v0.29.x — the p_pincer base was restyled into the house look, so its
  // 9-frame set has to be rebuilt from the NEW base or the static sprite and
  // its animation disagree (the exact failure this script exists for).
  pincer: { base: 'Sprites/projectiles/p_pincer.webp', dir: 'Sprites/projectiles/anim',
    motion: 'The tentacle pincer snaps: the two thick curved tentacle arms open wide apart, then clamp shut fast ' +
      'and spring slightly open again, the rubbery segments squashing and flexing with the bite while the rows of ' +
      'suckers ripple along the inner edges and highlights slide across the glossy skin.' },
  cloudburst: { base: 'Sprites/vfx/cloudburst.webp', dir: 'Sprites/vfx/anim',
    motion: 'The cloud burst blooms outward from nothing: it swells and billows rapidly, churning and rolling as it expands, ' +
      'then thins and dissipates into wisps that fade away at the edges.' },
  quake_ring: { base: 'Sprites/vfx/quake_ring.webp', dir: 'Sprites/vfx/anim',
    motion: 'The shockwave ring expands outward from the centre: the ring grows steadily wider and thinner as it travels, ' +
      'dust and debris kick up along its leading edge, and the whole ring fades as it spreads.' },
};

const only = val('--only', null);
const keys = only ? [only] : Object.keys(TARGETS);
for (const k of keys) if (!TARGETS[k]) { console.error('unknown target: ' + k); process.exit(1); }

if (!argv.includes('--generate')) {
  console.log(`regen ${keys.length} animation set(s), ${FRAMES} frames @ ${SIZE}\n`);
  for (const k of keys) {
    const t = TARGETS[k];
    console.log(`=== ${k}  base ${t.base}  ->  ${t.dir}/${k}_0..8`);
    console.log(t.motion + HOLD + '\n');
  }
  console.log('Re-run with --generate. Writes candidates only; install is separate.');
  process.exit(0);
}
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
// Spritesheet-first, exactly as gen_bolt_anim.mjs does it: the endpoint answers
// with {spritesheet_url, num_cols, num_rows} even when individual_frames is set.
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
  throw new Error('no usable frames: ' + JSON.stringify(data).slice(0, 200));
}
// One shared box, no per-frame trim — trimming each frame independently
// re-centres them and makes the effect jitter through the loop.
const normalise = (buf) => sharp(buf)
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 92 }).toBuffer();

for (const k of keys) {
  const t = TARGETS[k];
  const basePath = join(repoRoot, t.base);
  if (!existsSync(basePath)) { console.log('SKIP ' + k + ' — base missing: ' + t.base); continue; }
  const outDir = join(OUT_ROOT, k);
  await mkdir(outDir, { recursive: true });
  const uri = 'data:image/png;base64,' +
    (await sharp(await readFile(basePath)).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let done = false, last;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      process.stdout.write(`animate ${k} attempt ${attempt} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: t.motion + HOLD, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }),
      });
      if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 140));
      const bufs = await framesFrom(await res.json(), FRAMES);
      for (let i = 0; i < FRAMES; i++) await writeFile(join(outDir, `${k}_${i}.webp`), await normalise(bufs[i]));
      console.log(`OK — ${FRAMES} frames`);
      done = true;
    } catch (e) {
      last = e; console.log('fail: ' + String(e.message).slice(0, 120));
      if (attempt < 3) await new Promise((s) => setTimeout(s, 5000 * attempt));
    }
  }
  if (!done) console.log('FAILED ' + k + ': ' + (last && String(last.message).slice(0, 140)));
}
console.log('\ncandidates in scripts/_style_pack/anim_regen/ — shipped frames untouched');
