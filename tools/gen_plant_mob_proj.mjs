#!/usr/bin/env node
// Bloom Reaches plant-mob projectile sprites (m-prefix mob convention) →
// Sprites/projectiles/m<key>.png. Only meloncholy actually FIRES today
// (shoot:'mseed' replaces the shared generic msplinter); the other three are
// pre-staged art so giving thornmaw/elderbark/pinechad a ranged attack later
// is a one-line def change.
//   node tools/gen_plant_mob_proj.mjs            # dry-run
//   node tools/gen_plant_mob_proj.mjs --only mseed --generate
//   node tools/gen_plant_mob_proj.mjs --generate # all 4 (skip-existing)
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'projectiles');
const has = (f) => process.argv.slice(2).includes(f);
const arg = (f) => { const a = process.argv.slice(2); const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };

const OUTLINE = ' Cute painterly fantasy game projectile sprite, vibrant saturated colours, a bold uniform 2-3 pixel black outline (#0a0612) around the whole silhouette, crisp rim-light, fully transparent background, single object centred at ~70% of a 512x512 square, no text, no UI, no background, no ground shadow. Clearly readable at very small size (renders ~30px in game).';
// key (= in-engine m.shoot id) -> prompt. Orient-mode sprites point RIGHT.
const ITEMS = {
  mseed:      'A spat WATERMELON SEED projectile pointing right — a glossy jet-black teardrop watermelon seed with a wet pink sheen of melon flesh at its blunt end, a bright white specular highlight, and two tiny comic speed-streaks behind it. Simple, chunky, cartoon.',
  mthorn:     'A snapped-off BRAMBLE THORN projectile pointing right — a curved dark-green woody thorn spike with a wickedly sharp point, faint bark texture, one tiny leaf fleck at its base and a hint of sap glisten. Simple, chunky, cartoon.',
  macorn:     'A hurled ACORN projectile — a plump oak acorn with a textured brown cap and smooth tan nut body, a small white highlight, tiny motion flecks around it as it tumbles. Roughly round, simple, chunky, cartoon.',
  mpinespike: 'A flung PINEAPPLE SPIKE chunk projectile pointing right — a sharp golden-yellow pineapple skin fragment with diamond crosshatch texture and a short green leaf-blade fin, glinting with a confident sparkle. Simple, chunky, cartoon.',
};

let keys = Object.keys(ITEMS);
const only = arg('--only'); if (only) keys = only.split(',').filter((k) => ITEMS[k]);
if (!has('--generate')) {
  console.log(`# ${keys.length} plant-mob projectile sprites -> Sprites/projectiles/<key>.png\n`);
  for (const k of keys) console.log(`## ${k}\n${ITEMS[k] + OUTLINE}\n`);
  console.log('# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 280000);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchTimed(url, opts = {}) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error('timeout'); throw e; } finally { clearTimeout(t); }
}
async function genOne(k) {
  const dest = join(DIR, k + '.png');
  if (!has('--force') && await exists(dest)) return 'skip';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetchTimed(`${BASE}/assets/image`, {
        method: 'POST', headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite-vfx', prompt: ITEMS[k] + OUTLINE, art_style: 'Hand-Painted', perspective: 'Side-Scroll', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false }),
      });
      if (!res.ok) throw new Error(`Ludo ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const imgRes = await fetchTimed(url); if (!imgRes.ok) throw new Error('img fetch ' + imgRes.status);
      const raw = Buffer.from(await imgRes.arrayBuffer()); if (!raw.length) throw new Error('empty');
      const png = await sharp(raw).ensureAlpha().resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      // Reject blank generations (the endpoint occasionally returns a fully
      // transparent panel) — count non-trivial alpha before accepting.
      const { data: rawPx, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
      let nz = 0; for (let i = 3; i < rawPx.length; i += 4) if (rawPx[i] > 16) nz++;
      if (nz / (info.width * info.height) < 0.01) throw new Error('blank generation');
      await mkdir(DIR, { recursive: true }); await writeFile(dest, png);
      return `png ${info.width}x${info.height} cov ${(100 * nz / (info.width * info.height)).toFixed(1)}%`;
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(2500 * attempt); }
  }
  throw lastErr;
}
console.log(`Generating ${keys.length} plant-mob projectile sprites...`);
let made = 0, skip = 0, fail = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skip++; console.log('skip'); } else { made++; console.log('OK ' + r); await sleep(700); } }
  catch (e) { fail++; console.log('FAIL: ' + e.message); }
}
console.log(`Done. ${made} made, ${skip} skipped, ${fail} failed.`);
process.exit(fail ? 2 : 0);
