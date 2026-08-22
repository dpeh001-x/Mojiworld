#!/usr/bin/env node
// Sage "Meteor Sigil" ultimate — regenerate the meteor projectile and rebuild
// the cast sigil as a grander fiery incantation (ludo.ai).
//
// Per user: "p_ult_sage regenerate it similar style, and regenerate sage_ult_0
// sprite and animation into a grander fiery incantation".
//
//   node scripts/gen_sage_ult.mjs                 # dry run, prints prompts
//   node scripts/gen_sage_ult.mjs --generate      # statics -> _style_pack/sage/
//   node scripts/gen_sage_ult.mjs --install       # copy chosen candidates over shipped art
//   node scripts/gen_sage_ult.mjs --animate       # 9 frames from the SHIPPED sage_ult.webp
//   flags: --only=<key>  --n=<candidates, default 3>  --pick=<key>:<n> (with --install)
//
// RENDER CONSTRAINTS, read off the engine before writing a word of prompt:
//   * p_ult_sage is drawn with `spin: 0.55` (SKILL_FNS.sage_ult) — it tumbles
//     fast, so the art must be RADIAL. A directional comet tail would smear
//     into a pinwheel. The shipped art is already a spiral fireball; that part
//     is right and is kept.
//   * sage_ult is a spawnSpriteBurst at size 240, life 80, with NO spin option,
//     so the burst never rotates. Its 9 frames may therefore carry real motion.
//   * Both letterbox back into the exact shipped geometry: p_ult_sage 512x512,
//     fx/sage_ult 768x768, anim frames 952x952.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_ROOT = join(repoRoot, 'scripts', '_style_pack', 'sage');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const a = argv.find((x) => x.startsWith(f + '=')); return a ? a.split('=')[1] : d; };

// House look, same tail the rest of the FX pack uses (gen_projectile_restyle).
const STYLE = ' Cute chunky cartoon game sprite in the style of a chibi mobile RPG: ONE effect centred in frame, '
  + 'a thick uniform near-black outline running the whole way round the silhouette, soft cel shading, glossy '
  + 'white highlight blobs, bright saturated colours, a bold silhouette that still reads at thumbnail size. '
  + 'Fully transparent background, no ground shadow, no background scenery, no character, no text, no border, '
  + 'no frame, not pixel art, not photorealistic.';

const TARGETS = {
  // The tumbling meteor. "Similar style" per user - so it stays a spiral
  // fireball. What is fixed is the shipped art's big soft grey-white haze,
  // which fills the square and reads as a smudge rather than a fireball; the
  // prompt asks for clean transparency outside the flame instead.
  p_ult_sage: {
    out: 'Sprites/projectiles/p_ult_sage.webp',
    size: [512, 512],
    prompt: 'A blazing meteor fireball hurtling through the air, seen head-on: a chunky cracked obsidian rock core '
      + 'glowing with white-hot lava veins at the centre, completely wrapped in a swirling spiral vortex of orange, '
      + 'crimson and gold flame that curls all the way around the sphere like a pinwheel of fire, a brilliant '
      + 'white-hot glowing heart at the very middle, small ember flecks and sparks flicking off the outer edge. '
      + 'Radially symmetric and perfectly round overall, the flames spiralling evenly around the core in every '
      + 'direction with NO tail and NO trailing comet streak on any one side.',
    style: ' Cute chunky cartoon game sprite in the style of a chibi mobile RPG: ONE round fireball centred in frame '
      + 'and filling it, a thick uniform near-black outline round the whole silhouette and round the flame tongues, '
      + 'soft cel shading, glossy highlights, bright saturated orange gold and crimson. CRISP EDGES: the flame '
      + 'silhouette must be cleanly outlined against FULLY TRANSPARENT background - no soft grey or white haze, no '
      + 'blurry glow cloud, no smoke smudge, no fog filling the corners. No ground shadow, no scenery, no character, '
      + 'no text, no border, no frame, not pixel art, not photorealistic.',
  },
  // The cast sigil. "Grander fiery incantation" per user. The shipped art is a
  // smallish flat disc with one flame plume leaning off to the upper right;
  // this asks for a towering, ornate, symmetrical summoning circle - a bigger
  // read at the 240px burst size, and it stands upright so it does not look
  // like it is falling over when it pops behind the caster.
  sage_ult: {
    out: 'Sprites/fx/sage_ult.webp',
    size: [768, 768],
    prompt: 'A colossal fire summoning incantation erupting from the ground: a huge ornate magic circle of glowing '
      + 'molten gold and crimson runes lying flat on the ground in perspective at the bottom, made of THREE '
      + 'concentric rune rings set with angular arcane glyphs and a blazing eight-pointed star burning at its '
      + 'centre, and rising straight up out of that circle a TOWERING column of roaring orange and gold fire that '
      + 'billows outward into a great mushrooming crown of flame at the top, white-hot at its core. Two smaller '
      + 'rune rings hover in the air around the column, tilted and glowing. Embers, sparks and floating cinders '
      + 'stream upward all around it. Epic, imposing, ceremonial - a grand ritual of fire.',
    style: ' Cute chunky cartoon game sprite in the style of a chibi mobile RPG: ONE effect centred in frame, tall '
      + 'and UPRIGHT with the flame column rising vertically and the rune circle flat at the bottom, filling the '
      + 'frame top to bottom, a thick uniform near-black outline round the flame silhouette and the rune bands, '
      + 'soft cel shading, glossy highlights, bright saturated orange gold and crimson with white-hot cores. Fully '
      + 'transparent background, no ground, no floor, no scenery, no character, no text, no border, no frame, not '
      + 'pixel art, not photorealistic.',
  },
};

// The 9-frame loop, animated off whatever sage_ult.webp is SHIPPED at the time.
const MOTION =
  'The grand fire incantation BURNS and CHURNS in place: the towering flame column roils upward, its billowing '
  + 'crown of fire boiling and licking outward then settling, the white-hot core pulsing brighter and dimmer, '
  + 'embers and cinders streaming steadily up past the column, and the concentric rune rings glowing in a slow '
  + 'pulse while the hovering rings drift a little. '
  + 'CRITICAL - LOCKED FRAMING: the effect stays perfectly centred at the exact same size, position and scale in '
  + 'every frame; no zoom, pan, crop, rescale, drift, wobble, mirror or flip, and the rune circle at the bottom '
  + 'stays put. '
  + 'CRITICAL - DO NOT ROTATE the effect as a whole; only the fire and the glow move. '
  + 'CRITICAL - SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. '
  + 'Keep the exact same art style, thick dark outline, hot orange-gold-crimson palette and fully transparent '
  + 'background in every frame. No character, no ground, no scenery, no text.';

const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEY = process.env.LUDO_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

const only = val('--only', null);
const keys = Object.keys(TARGETS).filter((k) => !only || k === only);
const N = Number(val('--n', '3'));

// ---------------------------------------------------------------- dry run --
if (!has('--generate') && !has('--install') && !has('--animate')) {
  for (const k of keys) {
    const t = TARGETS[k];
    console.log('=== ' + k + '  -> ' + t.out + '  ' + t.size.join('x'));
    console.log(t.prompt + (t.style || STYLE));
    console.log();
  }
  console.log('=== animate motion -> Sprites/fx/anim/sage_ult_0..8.webp (952x952)');
  console.log(MOTION);
  console.log('\nRe-run with --generate (statics), then --install, then --animate.');
  process.exit(0);
}

// --------------------------------------------------------------- generate --
if (has('--generate')) {
  if (!KEY) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  await mkdir(OUT_ROOT, { recursive: true });
  for (const k of keys) {
    const t = TARGETS[k];
    const dir = join(OUT_ROOT, k);
    await mkdir(dir, { recursive: true });
    console.log('\n' + k + ' -> ' + dir);
    for (let i = 1; i <= N; i++) {
      let done = false;
      for (let attempt = 1; attempt <= 3 && !done; attempt++) {
        try {
          const res = await fetch(`${API}/assets/image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `ApiKey ${KEY}` },
            body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1',
                                   n: 1, augment_prompt: false, prompt: t.prompt + (t.style || STYLE) }),
            signal: AbortSignal.timeout(285000),   // the service currently holds a POST ~300s before dropping it; 180s was aborting before it could answer
          });
          if (!res.ok) throw new Error('api ' + res.status + ' ' + (await res.text()).slice(0, 120));
          const data = await res.json();
          // /assets/image answers with a BARE ARRAY: [{url}] — not {images:[...]}.
          const arr = Array.isArray(data) ? data : (data.images || data.image_urls || []);
          const first = arr[0];
          const url = (typeof first === 'string') ? first : (first && first.url) || data.url;
          if (!url) throw new Error('no url: ' + JSON.stringify(data).slice(0, 160));
          const raw = await fetchBuf(url);
          const trimmed = await sharp(raw).ensureAlpha().trim({ threshold: 8 }).toBuffer();
          const buf = await sharp(trimmed)
            .resize(t.size[0], t.size[1], { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 92 }).toBuffer();
          const st = await sharp(buf).stats();
          const a = st.channels[3];
          const clear = a ? Math.round((1 - a.mean / 255) * 100) : 0;
          const f = join(dir, `${k}_c${i}.webp`);
          await writeFile(f, buf);
          console.log(`  c${i}: ${(buf.length / 1024).toFixed(1)}KB, ${clear}% transparent`);
          done = true;
        } catch (e) {
          console.log(`  c${i} attempt ${attempt} failed: ${String(e).slice(0, 140)}`);
          if (attempt < 3) await sleep(4000);
        }
      }
    }
  }
  console.log('\nReview the candidates, then: --install --pick=<key>:<n>');
}

// ---------------------------------------------------------------- install --
if (has('--install')) {
  const picks = argv.filter((x) => x.startsWith('--pick=')).map((x) => x.split('=')[1]);
  if (!picks.length) { console.error('need --pick=<key>:<n> (repeatable)'); process.exit(1); }
  for (const p of picks) {
    const [k, n] = p.split(':');
    const t = TARGETS[k];
    if (!t) { console.error('unknown key ' + k); process.exit(1); }
    const src = join(OUT_ROOT, k, `${k}_c${n}.webp`);
    const dst = join(repoRoot, t.out);
    const m = await sharp(src).metadata();
    if (m.width !== t.size[0] || m.height !== t.size[1]) {
      console.error(`ABORT ${k}: candidate is ${m.width}x${m.height}, want ${t.size.join('x')}`); process.exit(1);
    }
    await copyFile(src, dst);
    console.log('installed ' + src.split(/[\\/]/).pop() + ' -> ' + t.out);
  }
}

// ---------------------------------------------------------------- animate --
if (has('--animate')) {
  if (!KEY) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  const BASE = join(repoRoot, 'Sprites', 'fx', 'sage_ult.webp');
  const OUT_DIR = join(repoRoot, 'Sprites', 'fx', 'anim');
  const FRAMES = 9, SIZE = 952;   // matches the shipped frame geometry
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
  // Shared canvas, no per-frame trim — per-frame trims re-centre and jitter.
  const normalise = (buf) => sharp(buf)
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 92 }).toBuffer();

  const baseBuf = await readFile(BASE);
  const uri = 'data:image/png;base64,' +
    (await sharp(baseBuf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      process.stdout.write(`animate attempt ${a} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      await mkdir(OUT_DIR, { recursive: true });
      for (let i = 0; i < FRAMES; i++) await writeFile(join(OUT_DIR, `sage_ult_${i}.webp`), await normalise(bufs[i]));
      console.log('ok -> Sprites/fx/anim/sage_ult_0..8.webp');
      ok = true;
    } catch (e) {
      console.log('failed: ' + String(e).slice(0, 160));
      if (a < 4) await sleep(6000);
    }
  }
  if (!ok) process.exit(1);
}
