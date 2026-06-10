#!/usr/bin/env node
// Generate the Sundered Smith forgeHammer projectile sprite via Ludo
// /assets/image (transparent sprite-vfx), re-encoded to a TRUE .png (this
// loader, LX_MOB_PROJ.forgeHammer, has no webp↔png fallback).
// Prompt sourced verbatim from SPRITE_DROPIN_PROMPTS.md.
//   node tools/gen_forgehammer.mjs            # dry-run (prompt)
//   node tools/gen_forgehammer.mjs --generate # call Ludo (needs LUDO_API_KEY)
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(repoRoot, 'Sprites', 'projectiles', 'p_forgehammer.png');
const has = (f) => process.argv.slice(2).includes(f);

const PROMPT = "Top-down game projectile sprite of a heavy molten forge war-hammer, single object centred on a fully transparent background, 512x512 square canvas. A short-handled blacksmith's sledgehammer with a chunky rectangular dark-iron head, the striking faces glowing white-hot orange with cracks of molten lava-light, a stubby charred wooden haft wrapped in scorched leather, faint ember sparks and a thin heat-shimmer trailing off the head. Clean cel-shaded illustrative style with a bold uniform 3-pixel black outline (#0a0612) around the entire silhouette, crisp rim-light on the hot edges, saturated forge palette (deep iron grey, molten orange-gold #ffaa44, white-hot core). Composed at a slight 3/4 spin angle so it reads as a thrown, tumbling hammer; effect occupies ~75% of the canvas; clearly readable at 64x64. No text, no watermark, no UI, no background, no ground shadow.";

if (!has('--generate')) {
  console.log('# forgeHammer -> Sprites/projectiles/p_forgehammer.png (true PNG)');
  console.log('# image_type=sprite-vfx, art_style=Cel-Shaded, perspective=Top-Down, ar_1_1\n');
  console.log(PROMPT);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). ~2 credits.');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchTimed(url, opts = {}, ms = 240000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error('timeout'); throw e; }
  finally { clearTimeout(t); }
}

console.log('Generating forgeHammer sprite...');
const res = await fetchTimed(`${BASE}/assets/image`, {
  method: 'POST',
  headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image_type: 'sprite-vfx', prompt: PROMPT, art_style: 'Cel-Shaded',
    perspective: 'Top-Down', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false,
  }),
});
if (!res.ok) { console.error(`Ludo ${res.status}: ${(await res.text()).slice(0, 200)}`); process.exit(1); }
const data = await res.json();
const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
if (!url) { console.error('No image URL: ' + JSON.stringify(data).slice(0, 200)); process.exit(1); }
const imgRes = await fetchTimed(url);
if (!imgRes.ok) { console.error('Image fetch ' + imgRes.status); process.exit(1); }
const raw = Buffer.from(await imgRes.arrayBuffer());
if (!raw.length) { console.error('Empty image'); process.exit(1); }

// Re-encode to a TRUE PNG (preserve alpha). Square 512 to match the prompt spec.
const png = await sharp(raw).ensureAlpha().resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const meta = await sharp(png).metadata();
await mkdir(dirname(DEST), { recursive: true });
if (await exists(DEST)) await copyFile(DEST, DEST.replace(/\.png$/, '.prev.png')).catch(() => {});
await writeFile(DEST, png);
// quick transparency sanity check
const { data: rgba, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
let opaque = 0; for (let i = 3; i < rgba.length; i += info.channels) if (rgba[i] > 40) opaque++;
const pct = Math.round(opaque / (info.width * info.height) * 100);
console.log(`OK -> ${DEST} (real PNG, ${meta.width}x${meta.height}, hasAlpha=${meta.hasAlpha}, ~${pct}% opaque)`);
process.exit(0);
