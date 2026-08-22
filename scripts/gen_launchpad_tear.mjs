#!/usr/bin/env node
// Launch pad -> DIMENSIONAL TEAR (per user: "instead of such a large bumper,
// regenerate the image in a style of dimensional tears instead").
//
// The shipped Sprites/objects/launchpad_pad.webp is a heavy top-down stone
// disc: a runic bumper with a rivetted metal rim and a cyan flame in the
// middle. Big, solid and mechanical — the opposite of what a hyper-launch
// should read as. This regenerates it as a RIFT: a jagged rip in space that
// the world falls into, no hardware at all.
//
// CANVAS IS LOAD-BEARING, and the naive swap is wrong. drawLaunchPads sizes
// the sprite as
//   drawW = pad.w * 1.42;  drawH = drawW * (naturalHeight / naturalWidth)
// and plants the BOX bottom just under the pad line (dy = cy - drawH + 6).
// Measured on the art this replaces: the disc's content was 484x378 inside a
// 512x512 canvas with 67 px of transparent padding BELOW it — so the disc drew
// ~161 px wide and floated its own base on the pad line. A raw tear render is
// 177x512 content with ZERO bottom padding: dropped into the same square it
// would draw ~59 px wide (a sliver on a 120 px pad) and sit 6 px INTO the
// floor. So the render is composed onto a TALL canvas whose aspect gives the
// rift a sane drawn footprint, with a bottom margin that puts its base on the
// pad line. Non-square is already the convention here — launchpad_pad_side is
// 355x512. Numbers below are derived, not guessed: see COMPOSE.
//
//   node scripts/gen_launchpad_tear.mjs                # dry-run (print prompt)
//   node scripts/gen_launchpad_tear.mjs --generate     # needs LUDO_API_KEY
//   flags: --force (overwrite)  --out=<path>  --keep-backup
import { readFile, writeFile, access, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (n) => (argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1];
const OUT = arg('out') || join(ROOT, 'Sprites', 'objects', 'launchpad_pad.webp');
// COMPOSE — target: the rift draws ~95 px wide x ~275 px tall on the arena's
// 120 px pads (the disc drew 161x126; this is narrower and taller, which is
// the point of "not such a large bumper"). With drawW = 120*1.42 = 170:
//   canvas 300x540  -> drawH = 170 * 540/300 = 306 px
//   content height 90% of canvas (486 px) -> drawn 275 px
//   the render's own 1:2.89 aspect then fixes content width at 168 px (56%)
//                                    -> drawn 95 px
//   bottom margin 12 px canvas       -> ~7 px drawn: base lands on the pad line
const CANVAS_W = 300, CANVAS_H = 540;
const CONTENT_H = 486, BOTTOM_MARGIN = 12;
const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The tear reads bottom-heavy on purpose: its widest point sits low, where the
// player stands, and it tapers upward into the direction of launch. Same cyan
// the draw code tints its glow with (pad.color defaults to #66ddff), so the
// procedural halo and the art agree.
const PROMPT =
  'A single flat 2D cartoon game sprite: a DIMENSIONAL TEAR — a jagged vertical ' +
  'rip torn straight through reality, hovering just above the ground. The tear is ' +
  'a narrow slash-shaped opening with ragged, uneven torn edges like slashed ' +
  'fabric or cracked glass, widest near the bottom and tapering to a thin point ' +
  'at the top. Through the opening you see a glowing void: electric cyan and ' +
  'pale blue-white energy with a deep dark blue core, faint swirling currents ' +
  'pulling inward. The torn edges glow hot white-cyan and shed a few small ' +
  'floating shards and sparks that drift outward around the rip. Bold clean ' +
  'vector shapes, crisp cel shading, thick dark outline, luminous cyan palette ' +
  '(#66ddff electric cyan, pale white core, deep navy interior). Vertical ' +
  'composition, centred, filling about 80% of the frame height. Fully ' +
  'TRANSPARENT background (alpha only). Viewed flat face-on from the side, like ' +
  'a 2D platformer prop. ' +
  'CRITICAL: NO stone disc, NO circular platform, NO metal ring, NO rivets, NO ' +
  'runic circle, NO pedestal, NO base, NO machinery, NO hardware of any kind — ' +
  'it is a rip in the air, nothing solid. NO character, NO creature, NO face, ' +
  'NO text, NO ground, NO shadow, NO background.';

if (!has('--generate')) {
  console.log('# -> ' + OUT.replace(ROOT, '').replace(/^[\\/]/, ''));
  console.log('# canvas: ' + CANVAS_W + 'x' + CANVAS_H + ' (drawLaunchPads derives height from the aspect)\n');
  console.log(PROMPT);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

if (!has('--force') && await exists(OUT)) {
  // The replacement is the whole point, so this only guards an accidental run.
  console.error('refusing to overwrite ' + OUT + ' without --force');
  process.exit(1);
}

// Keep the disc around for a side-by-side before/after, off the ship list.
if (has('--keep-backup') && await exists(OUT)) {
  const bak = OUT.replace(/\.webp$/, '_disc_backup.webp');
  await copyFile(OUT, bak);
  console.log('backed up -> ' + bak.split(/[\\/]/).pop());
}

const fetchBuf = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(150000) });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};

// Scale the trimmed render to CONTENT_H and seat it on the composed canvas
// with BOTTOM_MARGIN of clearance, so its base lands on the pad line.
async function normalise(buf) {
  const content = await sharp(buf)
    .resize({ height: CONTENT_H, fit: 'inside', withoutEnlargement: false })
    .toBuffer();
  const m = await sharp(content).metadata();
  return sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: content,
      left: Math.round((CANVAS_W - m.width) / 2),
      top: CANVAS_H - BOTTOM_MARGIN - m.height }])
    .webp({ quality: 92 }).toBuffer();
}

let last, ok = false;
for (let a = 1; a <= 4 && !ok; a++) {
  try {
    process.stdout.write(`attempt ${a} ... `);
    const res = await fetch(`${API}/assets/image`, {
      method: 'POST',
      headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(150000),
      body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }),
    });
    if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
    const data = await res.json();
    const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
    if (!url) throw new Error('no url in response');
    const raw = await fetchBuf(url);
    let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
    const out = await normalise(content);
    if (out.length < 2000) throw new Error('suspiciously small (' + out.length + 'B)');
    await writeFile(OUT + '.tmp', out);
    const { rename } = await import('node:fs/promises');
    await rename(OUT + '.tmp', OUT);   // atomic, per project convention
    const meta = await sharp(OUT).metadata();
    console.log(`ok -> ${OUT.split(/[\\/]/).pop()} (${meta.width}x${meta.height}, ${(out.length / 1024).toFixed(0)} KB)`);
    ok = true;
  } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
}
if (!ok) { console.error('FAILED: ' + (last && last.message)); process.exit(1); }
