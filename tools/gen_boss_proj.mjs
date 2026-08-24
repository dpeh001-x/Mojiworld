#!/usr/bin/env node
// BOSS PROJECTILE SPRITES — one table, ludo.ai, optional animation.
// =============================================================================
// Generalised out of tools/gen_cancer_pincer.mjs when a second boss needed the
// same treatment. Each entry names the file it writes, the prompt, an optional
// motion prompt (omit it for a static-only projectile), and a `reject` gate so
// a roll that misses the point of the change is re-rolled instead of shipped.
//
//   node tools/gen_boss_proj.mjs                      # dry-run, prints prompts
//   node tools/gen_boss_proj.mjs --generate           # all entries
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

const OUTLINE =
  ' Cute painterly fantasy game projectile sprite, vibrant saturated colours, a ' +
  'bold uniform 3 pixel black outline (#0a0612) around the whole silhouette, ' +
  'crisp rim-light, fully transparent background, single object centred at ~70% ' +
  'of a 768x768 square, no text, no UI, no background, no ground shadow. ' +
  'Clearly readable at very small size.';

const ITEMS = {
  // King Krook, the Ember Tyrant: a red crocodile king in a purple royal cape
  // with white fur trim and a gold crown. His projectile used to be a PURPLE
  // OCTOPUS TENTACLE, borrowed from art drawn for a different creature
  // entirely. Per user: "king krook should not be using pincer, he should be
  // using krook shell". His own signature is the SHELL CYCLONE charge, so a
  // thrown shell is the read.
  krookShell: {
    file: 'Sprites/projectiles/p_krookshell.webp',
    prompt:
      'A hurled SPIKED TURTLE SHELL projectile seen from the side, spinning. ' +
      'Deep crimson and maroon shell plates (#ae352a, #6e2624) with a dark ' +
      'royal-purple rim (#5b2a86), a bone-cream underside (#e4dbb1), short ' +
      'blunt gold-tipped spikes around the edge, a small gold crown emblem ' +
      'stamped on the shell back, faint ember sparks trailing. Regal and heavy. ' +
      'NOT a tentacle, NOT a claw, NO suckers.' + OUTLINE,
    // Reject a roll that comes back mostly violet: the whole point is that this
    // reads as Krook's red-and-gold shell, not the purple tentacle it replaces.
    reject: (share) => share.violet > 0.35,
  },
};

if (!has('--generate')) {
  console.log('# boss projectile sprites\n');
  for (const [k, it] of Object.entries(ITEMS)) {
    if (arg('--only') && arg('--only') !== k) continue;
    console.log(`## ${k} -> ${it.file}\n${it.prompt}\n`);
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
const shares = async (buf) => {
  const { data } = await sharp(buf).resize(96, 96, { fit: 'inside' }).ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  let n = 0, warm = 0, violet = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const R = data[i], G = data[i + 1], B = data[i + 2];
    if (R + G + B < 120) continue;
    n++;
    if (R > B + 25) warm++;
    if (B > R && B > G + 20) violet++;
  }
  return { warm: n ? warm / n : 0, violet: n ? violet / n : 0 };
};
const edgeTouching = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  const at = (x, y) => data[(y * info.width + x) * 4 + 3] > 40;
  for (let x = 0; x < info.width; x++) { if (at(x, 0)) n++; if (at(x, info.height - 1)) n++; }
  for (let y = 0; y < info.height; y++) { if (at(0, y)) n++; if (at(info.width - 1, y)) n++; }
  return n;
};
const atomicWrite = async (p, buf) => { await writeFile(p + '.tmp', buf); await rename(p + '.tmp', p); };

let fail = 0;
for (const [key, it] of Object.entries(ITEMS)) {
  if (arg('--only') && arg('--only') !== key) continue;
  process.stdout.write(`${key} ... `);
  try {
    let base = null;
    for (let attempt = 1; attempt <= TRIES; attempt++) {
      const data = await post('/assets/image', {
        image_type: 'sprite-vfx', prompt: it.prompt, art_style: 'Hand-Painted',
        perspective: 'Side-Scroll', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false,
      });
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const png = await sharp(await fetchBuf(url)).ensureAlpha()
        .resize(768, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 94 }).toBuffer();
      const sh = await shares(png);
      process.stdout.write(`[roll ${attempt}: warm ${(sh.warm * 100).toFixed(0)}% violet ${(sh.violet * 100).toFixed(0)}%] `);
      if (!it.reject || !it.reject(sh) || attempt === TRIES) { base = png; break; }
    }
    await mkdir(join(ROOT, 'Sprites', 'projectiles', 'anim'), { recursive: true });
    await atomicWrite(join(ROOT, it.file), base);
    process.stdout.write(`wrote ${it.file} `);

    if (it.motion && it.animPrefix) {
      let bufs = [], clipped = 0;
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
        if (bufs.length < FRAMES) throw new Error(`got ${bufs.length}/${FRAMES} frames`);
        clipped = 0;
        for (const b of bufs) if (await edgeTouching(b) > 24) clipped++;
        if (!clipped) break;
        process.stdout.write(`[clipped ${clipped}/${FRAMES}] `);
      }
      for (let i = 0; i < bufs.length; i++) {
        const out = await sharp(bufs[i]).ensureAlpha()
          .resize(768, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 94 }).toBuffer();
        await atomicWrite(join(ROOT, 'Sprites', 'projectiles', 'anim', `${it.animPrefix}_${i}.webp`), out);
      }
      process.stdout.write(`+ ${bufs.length} frames `);
    }
    console.log('OK');
  } catch (e) { fail++; console.log('FAIL: ' + e.message); }
}
process.exit(fail ? 2 : 0);
