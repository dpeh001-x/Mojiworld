#!/usr/bin/env node
// SCORPIO'S VENOM DELUGE — FX sprites for the Venomlord's signature move.
// =============================================================================
// Scorpio's signature was the GENERIC 'column' every non-bespoke sign shares
// (_sigMove), so the Venomlord's one big move looked like Sagittarius's and
// Aquarius's. The Deluge gives her an arena-denial signature of her own, and
// these are the two pieces of art it needs.
//
// Palette is read off her zodiac entry rather than eyeballed:
//   base #882266  shade #330022  hi #cc44aa  aura #ff66cc   (element: poison)
// The pools have to read as HERS at a glance next to King Gloopaloo's blue
// gloop_puddle, which is the other lingering floor hazard in the game.
//
//   node tools/gen_scorpio_fx.mjs                 # dry-run, prints prompts
//   node tools/gen_scorpio_fx.mjs --generate      # needs LUDO_API_KEY
//   flags: --only <key> --tries N (default 3) --frames N (default 9)
// =============================================================================
import sharp from 'sharp';
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const TRIES = Math.max(1, Number(arg('--tries') || 3));
const FRAMES = Number(arg('--frames') || 9);

const COMMON =
  ' Cute painterly fantasy game VFX sprite, vibrant saturated colours, crisp ' +
  'rim-light, fully transparent background, no text, no UI, no background, ' +
  'no character, no ground tiles. Clearly readable at small size.';

const ITEMS = {
  // The lingering pool. Drawn flat on the floor, so it is authored as a wide
  // shallow ellipse seen at a low angle — a circular top-down blob would read
  // as a ball hovering in a side-scroller.
  // NOTE the directory. Hazard art lives in Sprites/vfx/ and is registered in
  // LX_VFX by camelCase key, with an optional 9-frame loop at
  // Sprites/vfx/anim/<basename>_0..8.webp picked up by _VFX_ANIM_BASE.
  // Sprites/fx/ is the SKILL effect folder and nothing would have loaded these
  // from there — the first version of this file wrote to the wrong one.
  venompool: {
    file: 'Sprites/vfx/scorpio_venompool.webp',
    size: [512, 256],
    prompt:
      'A wide shallow ELLIPTICAL POOL of glowing venom seen at a low ' +
      'side-scroller angle, lying flat on the ground. Toxic magenta-violet ' +
      'liquid (#882266, #cc44aa) with a hot pink luminous rim (#ff66cc) and ' +
      'a dark plum core (#330022), bubbling blisters across the surface, thin ' +
      'wisps of vapour rising from the edges, a few droplets flicked out ' +
      'around it. Wet, viscous, clearly poisonous. Flat on the floor, NOT a ' +
      'sphere, NOT a ball, no vertical column.' + COMMON,
    motion:
      'the venom pool bubbles and churns in place, blisters swelling and ' +
      'popping, the glowing rim pulsing. The pool stays the same size and ' +
      'stays centred in frame, no zoom, no drift, no camera move.',
    animPrefix: 'scorpio_venompool',
    reject: (sh) => sh.magenta < 0.35,
  },
  // The impact burst at the moment the stinger lands.
  delugeburst: {
    file: 'Sprites/vfx/scorpio_deluge.webp',
    size: [768, 768],
    prompt:
      'A violent SPLASH BURST of toxic venom erupting upward and outward from ' +
      'a single point of impact, like a stinger has just punched into the ' +
      'ground. Magenta-violet spray (#882266, #cc44aa) with a hot pink ' +
      'luminous core (#ff66cc), long arcing droplet streaks flung outward, ' +
      'a dark plum shockwave ring (#330022) at the base. Radial, explosive, ' +
      'dripping. NOT a fireball, NOT a beam, no column of light.' + COMMON,
    reject: (sh) => sh.magenta < 0.30,
  },
};

if (!has('--generate')) {
  console.log('# Scorpio Venom Deluge FX\n');
  for (const [k, it] of Object.entries(ITEMS)) {
    if (arg('--only') && arg('--only') !== k) continue;
    console.log(`## ${k} -> ${it.file}  (${it.size.join('x')})\n${it.prompt}\n`);
    if (it.motion) console.log(`### motion\n${it.motion}\n`);
  }
  console.log('# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', signal: AbortSignal.timeout(600000),
    headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 402 || /\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS');
    throw new Error(`${path} ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}
// Magenta share: the whole point is that these read as Scorpio's venom rather
// than a generic green poison or Gloopaloo's blue, so a roll that comes back
// off-palette is re-rolled instead of shipped.
const shares = async (buf) => {
  const { data } = await sharp(buf).resize(96, 96, { fit: 'inside' }).ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  let n = 0, magenta = 0, green = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const R = data[i], G = data[i + 1], B = data[i + 2];
    if (R + G + B < 90) continue;
    n++;
    if (R > G + 25 && B > G + 15) magenta++;      // pink/violet, not green
    if (G > R + 25 && G > B + 25) green++;
  }
  return { n, magenta: n ? magenta / n : 0, green: n ? green / n : 0 };
};
const atomicWrite = async (p, buf) => { await writeFile(p + '.tmp', buf); await rename(p + '.tmp', p); };

await mkdir(join(ROOT, 'Sprites', 'vfx', 'anim'), { recursive: true });
let fail = 0;
for (const [key, it] of Object.entries(ITEMS)) {
  if (arg('--only') && arg('--only') !== key) continue;
  process.stdout.write(`${key} ... `);
  try {
    const [W, H] = it.size;
    let base = null;
    for (let attempt = 1; attempt <= TRIES; attempt++) {
      const data = await post('/assets/image', {
        image_type: 'sprite-vfx', prompt: it.prompt, art_style: 'Hand-Painted',
        perspective: 'Side-Scroll', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false,
      });
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const png = await sharp(await fetchBuf(url)).ensureAlpha()
        .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 94 }).toBuffer();
      const sh = await shares(png);
      process.stdout.write(`[roll ${attempt}: magenta ${(sh.magenta * 100).toFixed(0)}% green ${(sh.green * 100).toFixed(0)}%] `);
      if (!it.reject || !it.reject(sh) || attempt === TRIES) { base = png; break; }
    }
    await atomicWrite(join(ROOT, it.file), base);
    process.stdout.write(`wrote ${it.file} `);

    if (it.motion && it.animPrefix) {
      let bufs = [];
      for (let attempt = 1; attempt <= TRIES; attempt++) {
        const anim = await post('/assets/sprite/animate', {
          initial_image: `data:image/webp;base64,${base.toString('base64')}`,
          motion_prompt: it.motion, frames: FRAMES, frame_size: -9,
          model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite',
        });
        bufs = [];
        if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
          const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata();
          const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
          for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++)
            for (let c = 0; c < anim.num_cols && bufs.length < FRAMES; c++)
              bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).webp({ quality: 94 }).toBuffer());
        }
        if (bufs.length < FRAMES && Array.isArray(anim.individual_frame_urls)) {
          bufs = []; for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
        }
        if (bufs.length >= FRAMES) break;
        process.stdout.write(`[got ${bufs.length}/${FRAMES}] `);
      }
      if (bufs.length < FRAMES) throw new Error(`only ${bufs.length}/${FRAMES} frames`);
      for (let i = 0; i < bufs.length; i++) {
        const out = await sharp(bufs[i]).ensureAlpha()
          .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 94 }).toBuffer();
        await atomicWrite(join(ROOT, 'Sprites', 'fx', 'anim', `${it.animPrefix}_${i}.webp`), out);
      }
      process.stdout.write(`+ ${bufs.length} frames `);
    }
    console.log('OK');
  } catch (e) { fail++; console.log('FAIL: ' + e.message); }
}
process.exit(fail ? 2 : 0);
