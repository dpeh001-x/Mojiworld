#!/usr/bin/env node
// Warlord planted standard — ludo.ai text->sprite, N candidate variants.
// =============================================================================
// Per user, with a screenshot of the planted banner: "regenerate the sprite
// for this banner it should be much nicer and aesthetic and fit the game
// better, remove the weird glow around it" + "it should not looked squished".
//
// The live asset (Sprites/fx/warlord_banner_planted.webp) is a 182x697 cutout
// - aspect 0.26 - force-drawn into a 92x150 box (aspect 0.61): squished to 43%
// of its proportional height, and the 4.6x single-step downscale smears its
// hard alpha edge into the red fringe the user reads as a glow. A regenerated
// standard therefore has to be COMPOSED for the box it lives in: a broad
// hanging pennant on a crossbar, roughly 0.5-0.7 wide-to-tall, and it must
// carry no baked glow or aura.
//
// This script generates candidates ONLY. Nothing live is overwritten: each
// variant lands in scripts/_banner_v<i>.png (raw) and _banner_v<i>_trim.png
// (trimmed to silhouette, bottom flush = pole base, for the honest floor
// anchor the renderer relies on). Pick by aspect + eye, then promote.
//
//   LUDO_API_KEY=... node scripts/gen_warlord_banner_planted.mjs --n 3
// =============================================================================
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('--n', 3));
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// PROMPT SHAPE (from the repo's hard-learned recipe): short, OBJECT-first, no
// scene-setting prefix (those make this model return chibi characters), with
// explicit negations. Composition is dictated here because the renderer draws
// the art at its own aspect: a wide pennant on a crossbar, pole base at the
// very bottom, and NO glow/aura anywhere (that is the exact defect being
// removed).
const PROMPT = 'A single tall war standard: a straight dark wooden pole with a small brass finial on top, a wide crimson red pennant banner hanging from a horizontal crossbar near the top, the banner cloth about half as wide as the pole is tall, gold embroidered trim along the cloth edges, one small gold emblem in the centre of the cloth, cloth ends in two soft points at the bottom, slightly weathered fabric, the pole base ends in a plain spike at the very bottom of the image,'
  + ' fantasy RPG game item sprite for a 2D side-scroller, clean painted anime style with bold dark outlines, vibrant saturated colours, front view, upright, fully visible with generous empty margin on all sides, nothing touching or clipped by the frame edge, game object only, no glow, no aura, no light rays, no sparkles, no shadow on the ground, no character, no person, no creature, no text, transparent background';

async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }

async function gen(i, aspect) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: aspect, n: 1, augment_prompt: false, prompt: PROMPT }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 160)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 160)}`);
      const raw = await fetchBuf(url);
      await writeFile(join(repoRoot, 'scripts', `_banner_v${i}.png`), raw);
      // Trim to the drawn silhouette. Bottom flush = pole base (the renderer
      // anchors the image's bottom edge to the floor line).
      const trimmed = await sharp(raw).ensureAlpha().trim({ threshold: 12 }).png().toBuffer();
      const m = await sharp(trimmed).metadata();
      await writeFile(join(repoRoot, 'scripts', `_banner_v${i}_trim.png`), trimmed);
      // halo audit: how much of the silhouette is semi-transparent?
      const { data: px, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let soft = 0, opq = 0;
      for (let k = 3; k < px.length; k += 4) { if (px[k] > 8 && px[k] < 200) soft++; else if (px[k] >= 200) opq++; }
      return { i, aspectReq: aspect, w: m.width, h: m.height, ar: +(m.width / m.height).toFixed(3), softPct: +(soft / (soft + opq) * 100).toFixed(1) };
    } catch (e) { lastErr = e; if (attempt < 3) await sleep(4000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${N} candidate standards...`);
const out = [];
for (let i = 1; i <= N; i++) {
  // Ask for a portrait frame first; if this account's model rejects the ratio,
  // fall back to square (a banner trimmed out of a square is tall anyway).
  process.stdout.write(`  v${i} ... `);
  let r = null;
  try { r = await gen(i, 'ar_9_16'); }
  catch (e) { process.stdout.write(`(portrait refused: ${String(e.message).slice(0, 60)}) square ... `); try { r = await gen(i, 'ar_1_1'); } catch (e2) { console.log('FAIL ' + e2.message); continue; } }
  console.log(`OK  trimmed ${r.w}x${r.h}  aspect ${r.ar}  soft-alpha ${r.softPct}%  (want ~0.5-0.7, soft near 0)`);
  out.push(r);
  await sleep(800);
}
console.log(JSON.stringify(out));
