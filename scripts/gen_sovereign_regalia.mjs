#!/usr/bin/env node
// Unique art for the Sovereign's two borrowed assets (ludo.ai).
// ============================================================================
// Per user, with a screenshot of a pink BEE orbiting the Sovereign: "the crown
// produced by the sovereign and the projectiles it used should have a unique
// sprite set".
//
// Both were borrowing someone else's art:
//   CROWN SHARD  — the Regalia shards spawn via `spawnMonster('sparkling')`,
//                  a Lv-14 flower-bee, and override everything about it
//                  EXCEPT the sprite. So the apex boss's crown was a bee.
//   HOMING VOLLEY— fired with `skill:'mdark'`, the shared dark orb that
//                  Aetherion's Shard Lance and Pisces' Dream bolt also use.
//                  (Those two keep mdark; only the Sovereign moves.)
//
// Two assets, each a static + a 9-frame loop:
//   Sprites/monsters/sovCrownShard.webp        + monsters/idle/sovCrownShard_0..8
//   Sprites/projectiles/msovereign.webp        + projectiles/anim/msovereign_0..8
//
//   node scripts/gen_sovereign_regalia.mjs             # dry run
//   node scripts/gen_sovereign_regalia.mjs --generate  # base + frames for both
//   node scripts/gen_sovereign_regalia.mjs --only shard|homer
//   node scripts/gen_sovereign_regalia.mjs --contact   # review strips
// Needs LUDO_API_KEY. Never commit the key.
// ============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAMES = 9, SIZE = 768;
const has = (f) => process.argv.includes(f);
const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

// The Sovereign's own palette: cream-gold #fff5d0 over near-black brown
// #3a1a0a, with the amber #ffcc44 its homers already tint to.
const STYLE =
  'Cute stylised 2D game asset, thick clean dark outline, soft cel shading, vivid saturated colours, '
  + 'single object centred and fully inside the frame, front-facing, fully TRANSPARENT background, '
  + 'no ground shadow, no panel, no frame, no border, no text, no letters, no watermark, no character, '
  + 'no face, no eyes, no hands, no creature, no insect, no bee.';

const JOBS = {
  shard: {
    label: 'crown shard',
    base: join(repoRoot, 'Sprites', 'monsters', 'sovCrownShard.webp'),
    animDir: join(repoRoot, 'Sprites', 'monsters', 'idle'),
    animKey: 'sovCrownShard',
    prompt: STYLE + ' A single broken FRAGMENT OF A GOLDEN ROYAL CROWN floating in the air: one ornate '
      + 'cream-gold spire or crown point (#fff5d0 highlights, deep amber #d89a2a mid-tones, near-black '
      + 'brown #3a1a0a outline) with fine engraved filigree along its edge, the metal cleanly snapped at '
      + 'the bottom into a jagged break. A glowing amber gem (#ffcc44) is set into its face, casting a '
      + 'warm halo, and a few small golden light motes drift around it. It reads as a sacred, heavy piece '
      + 'of regalia, not as a weapon and not as a creature. Diamond-ish silhouette that stays readable '
      + 'when shrunk to 34 pixels.',
    motion:
      'Animate this floating golden crown fragment as a seamless, perfectly looping cycle. The set amber '
      + 'gem pulses gently brighter then dimmer, a soft warm glow breathes outward from it, and the small '
      + 'golden light motes drift slowly around the fragment and fade in and out. Faint engraved filigree '
      + 'catches a travelling glint that sweeps along the metal once per loop. '
      + 'CRITICAL - DO NOT ROTATE: the fragment must NOT spin, turn, tumble or revolve. Its orientation is '
      + 'FIXED and identical in every frame; only the light and the motes move. The game already orbits it. '
      + 'CRITICAL - LOCKED FRAMING: identical size, position and scale in every frame. Do not zoom, pan, '
      + 'crop, rescale, drift, wobble, mirror or flip. The outer silhouette stays constant. '
      + 'CRITICAL - SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. '
      + 'Keep the exact same art style, palette, thick dark outline and fully transparent background in '
      + 'every frame. No face, no eyes, no character, no background, no shadow.',
  },
  homer: {
    label: 'sovereign homer',
    base: join(repoRoot, 'Sprites', 'projectiles', 'msovereign.webp'),
    animDir: join(repoRoot, 'Sprites', 'projectiles', 'anim'),
    animKey: 'msovereign',
    prompt: STYLE + ' A royal GOLDEN ENERGY BOLT: a bright molten-amber core (#ffcc44 into white-hot '
      + '#fff5d0 at the centre) wrapped in a spiralling shell of cream-gold light, with a tiny engraved '
      + 'crown sigil floating inside the core like a seal pressed into the light. Sharp radiating gold '
      + 'spokes flare outward around it and a few embers hang in its aura. Deep amber #d89a2a shadows and '
      + 'a near-black brown #3a1a0a outline keep it legible against a bright arena. Round, compact, '
      + 'symmetrical silhouette that still reads at 30 pixels. No trail, no motion streak, no direction.',
    motion:
      'Animate this royal golden energy bolt as a seamless, perfectly looping cycle of INTERNAL energy '
      + 'motion. The spiralling gold shell churns steadily inward toward the core, the white-hot centre '
      + 'pulses brighter and dimmer, the engraved crown sigil inside glows and fades, and the radiating '
      + 'spokes flare and retract slightly while small embers drift in the aura. '
      + 'CRITICAL - DO NOT ROTATE: the bolt must NOT spin, turn, revolve or orbit as a whole. Its overall '
      + 'orientation stays FIXED and identical in every single frame; only the energy INSIDE it flows. The '
      + 'game spins the projectile procedurally, so baked rotation would double-spin and step it. '
      + 'CRITICAL - LOCKED FRAMING: perfectly centred at identical size, position and scale in every frame. '
      + 'Do not zoom, pan, crop, rescale, drift, wobble, mirror or flip. The diameter stays constant. '
      + 'CRITICAL - SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. '
      + 'Keep the exact same art style, palette, thick dark outline and fully transparent background in '
      + 'every frame. No face, no eyes, no character, no background, no shadow.',
  },
};

const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEY = process.env.LUDO_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

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
  throw new Error('no usable frames in response');
}
// One shared canvas for every frame, no per-frame trim: trimming each frame
// independently re-centres them and makes the loop jitter.
const normalise = (buf) => sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toBuffer();

async function genBase(job) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', signal: AbortSignal.timeout(180000),
        headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: job.prompt }),
      });
      if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 140));
      const d = await res.json();
      const url = Array.isArray(d) ? d[0]?.url : (d?.url || d?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(dirname(job.base), { recursive: true });
      await writeFile(job.base, await normalise(await fetchBuf(url)));
      return (await sharp(job.base).metadata()).width + 'px';
    } catch (e) { last = e; if (a < 4) await sleep(4000 * a); }
  }
  throw last;
}

async function genAnim(job) {
  const uri = 'data:image/png;base64,' + (await sharp(await readFile(job.base)).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', signal: AbortSignal.timeout(600000),
        headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_image: uri, motion_prompt: job.motion, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }),
      });
      if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 160));
      const bufs = await framesFrom(await res.json(), FRAMES);
      await mkdir(job.animDir, { recursive: true });
      for (let i = 0; i < FRAMES; i++) await writeFile(join(job.animDir, `${job.animKey}_${i}.webp`), await normalise(bufs[i]));
      return FRAMES + ' frames';
    } catch (e) { last = e; if (a < 4) await sleep(4000 * a); }
  }
  throw last;
}

async function contact(job) {
  const OUT = join(repoRoot, 'scripts', '_sov_regalia_review');
  await mkdir(OUT, { recursive: true });
  const BIG = 118, SMALL = 44, PAD = 8, HDR = 42, LBL = 18;
  const W = FRAMES * (BIG + PAD) + PAD, H = HDR + BIG + LBL + PAD * 2 + SMALL + LBL + PAD;
  const svg = (t, s, c, w, h) => Buffer.from(`<svg width="${w}" height="${h}"><text x="0" y="${s}" font-family="Segoe UI,Arial" font-size="${s}" font-weight="700" fill="${c}">${t}</text></svg>`);
  const layers = [{ input: svg(`${job.animKey} - 9 frames in order (top: large, bottom: true in-game size)`, 17, '#fff', W, HDR), left: PAD, top: 11 }];
  for (let i = 0; i < FRAMES; i++) {
    const f = join(job.animDir, `${job.animKey}_${i}.webp`);
    if (!await exists(f)) continue;
    const b = await readFile(f), x = PAD + i * (BIG + PAD);
    layers.push({ input: await sharp(b).resize(BIG, BIG, { fit: 'inside' }).png().toBuffer(), left: x, top: HDR });
    layers.push({ input: svg(String(i), 13, '#ffd870', BIG, LBL), left: x, top: HDR + BIG + 2 });
    layers.push({ input: await sharp(b).resize(SMALL, SMALL, { fit: 'inside' }).png().toBuffer(), left: x + Math.round((BIG - SMALL) / 2), top: HDR + BIG + LBL + PAD * 2 });
  }
  const out = join(OUT, `${job.animKey}_strip.png`);
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 22, g: 26, b: 42, alpha: 1 } } }).composite(layers).png().toFile(out);
  console.log('wrote ' + out);
}

const only = arg('--only');
const jobs = Object.entries(JOBS).filter(([k]) => !only || k === only);
if (!has('--generate') && !has('--contact')) {
  console.log('# Sovereign regalia art (ludo.ai)\n');
  for (const [k, j] of jobs) console.log(`  ${k.padEnd(6)} -> ${j.base.replace(repoRoot, '.')}  + ${j.animKey}_0..8 in ${j.animDir.replace(repoRoot, '.')}`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY), then --contact for review strips.');
  process.exit(0);
}
if (has('--generate') && !KEY) { console.error('LUDO_API_KEY required.'); process.exit(1); }
for (const [k, job] of jobs) {
  if (has('--generate')) {
    process.stdout.write(`${job.label}: base ... `);
    console.log(await genBase(job));
    process.stdout.write(`${job.label}: animate ... `);
    console.log(await genAnim(job));
  }
  if (has('--contact')) await contact(job);
}
