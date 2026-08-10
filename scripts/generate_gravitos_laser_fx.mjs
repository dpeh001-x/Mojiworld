#!/usr/bin/env node
// Laser Sweep FX overlay (ludo.ai) — Sprites/fx/gravitos_laserring.webp.
//   node scripts/generate_gravitos_laser_fx.mjs --generate [--force]
//
// The caster animation is geometrically constrained (it must match the boss's
// canvas, scale and framing), which is exactly why it cannot carry big
// effects — every roll that tried either blew out the frame or zoomed the
// camera. An FX SPRITE has no such constraint: it is a standalone radial
// element the game scales and spins itself, so the spectacle lives here.
// Same pattern Soul Drain already uses with gravitos_soulring.
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(repoRoot, 'Sprites', 'fx', 'gravitos_laserring.webp');
const SIZE = 512;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

const PROMPT =
  'A radial ENERGY CHARGE EFFECT for a game, seen head-on, on a FULLY ' +
  'TRANSPARENT background. A brilliant magenta-pink and violet targeting ring: ' +
  'a bright thin outer circle with sharp converging arrow-shaped tick marks ' +
  'pointing inward, a second inner ring of glowing runic segments, jagged ' +
  'electric arcs leaping between the two rings, and a hot white-pink core ' +
  'flare at the centre with radiating spark filaments and drifting embers. ' +
  'Concentric, perfectly centered, filling about 92% of the square frame. ' +
  'Glowing additive light on empty transparency — NO character, NO creature, ' +
  'NO background, NO ground, NO panel, NO frame, NO border. ' +
  'ABSOLUTELY NO TEXT: no letters, numbers or words.';

if (!has('--generate')) {
  console.log('# 1 FX sprite -> Sprites/fx/gravitos_laserring.webp (512, transparent radial)');
  console.log('# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
if (!has('--force') && await exists(OUT)) { console.log('exists; use --force'); process.exit(0); }
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

const res = await fetch(`${API}/assets/image`, {
  method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
  signal: AbortSignal.timeout(300000),
  body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1',
    n: 1, augment_prompt: false, prompt: PROMPT }),
});
if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 180)}`);
const data = await res.json();
const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
if (!url) throw new Error('no url');
const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
const buf = Buffer.from(await r.arrayBuffer());

// Trim to the real alpha bounds and re-pad, so the ring is exactly centred and
// fills a predictable fraction — the game scales it by `size`, and an
// off-centre or under-filled source would sit wrong on the boss.
const inner = Math.round(SIZE * 0.94), pad = Math.round((SIZE - inner) / 2);
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const fitted = await sharp(await sharp(buf).trim({ threshold: 4 }).toBuffer())
  .resize(inner, inner, { fit: 'contain', background: CLEAR }).toBuffer();
const out = await sharp(fitted).extend({ top: pad, bottom: pad, left: pad, right: pad, background: CLEAR })
  .webp({ quality: 92, alphaQuality: 100 }).toBuffer();
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, out);

const { data: px, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let opaque = 0, corners = 0;
for (let i = 0; i < info.width * info.height; i++) if (px[i * 4 + 3] > 16) opaque++;
for (const [x, y] of [[2, 2], [info.width - 3, 2], [2, info.height - 3], [info.width - 3, info.height - 3]])
  if (px[(y * info.width + x) * 4 + 3] > 16) corners++;
console.log(`OK -> ${OUT}  ${info.width}x${info.height}  ${Math.round(opaque / (info.width * info.height) * 100)}% opaque, corners painted ${corners}/4`);
