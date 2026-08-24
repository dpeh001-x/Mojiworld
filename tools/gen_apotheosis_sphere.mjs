#!/usr/bin/env node
// Elemental Apotheosis — release-sphere projectile art (ludo.ai).
//
// Per user: "rework the projectile sprite that fires on release with ludo.ai".
//
// The released sphere is the payoff of a 4-second hold, and the art it was
// wearing (p_ult_elementalist) was authored as a "four-element convergence
// BEAM" — a horizontal streak. The skill no longer fires a beam: it launches a
// piercing SPHERE that crosses the map, drawn with bsprKeepAspect and a slow
// 0.12 spin, so a beam-shaped asset reads as a smear rather than an orb and
// its aspect fights the keep-aspect draw.
//
// This regenerates it as an actual sphere: a four-element convergence orb whose
// quadrants are fire / ice / storm / arcane, spinning around a white-hot core.
// Same pipeline as the other projectile generators (tools/gen_zodiac_proj.mjs):
// sprite-vfx, cel-shaded, 512x512 transparent, heavy outline so it reads at
// speed. Writes a _orig_backup_ copy before overwriting.
//
//   node tools/gen_apotheosis_sphere.mjs            # show the prompt, cost nothing
//   node tools/gen_apotheosis_sphere.mjs --generate # call Ludo (needs LUDO_API_KEY)
//   node tools/gen_apotheosis_sphere.mjs --generate --force
import { writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'projectiles');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

const OUTLINE = ' Clean cel-shaded illustrative game art with a bold uniform 2-3 pixel black outline (#0a0612) around the entire silhouette, crisp rim-light, fully transparent background, single object centred, ~70% of a 512x512 square canvas, clearly readable at 64x64, no text, no watermark, no UI, no background, no ground shadow.';

// The projectile directory is 105 .webp and no .png — write the format the
// engine's registry actually asks for (bult_elementalist -> p_ult_elementalist.webp).
const FILE = 'p_ult_elementalist.webp';
const PROMPT =
  'A massive four-element convergence SPHERE projectile — one perfectly round orb, ' +
  'not a beam, its surface divided into four swirling quadrants that spiral into each ' +
  'other: molten fire orange-red (#ff5522), glacial ice cyan (#66ddff), crackling ' +
  'storm-yellow lightning (#ffee44) and violet arcane energy (#aa66ff). A blinding ' +
  'white-hot core burns at the centre where all four meet, thin arcs of each element ' +
  'orbiting the equator like rings, sparks and elemental motes flung outward, a faint ' +
  'concentric shockwave ring around the whole orb. Symmetric and radial so it reads ' +
  'the same while spinning.';

if (!has('--generate')) {
  console.log('# Elemental Apotheosis release sphere ->', join('Sprites', 'projectiles', FILE));
  console.log(PROMPT + OUTLINE);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 260000);
async function fetchTimed(url, opts = {}) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error('timeout'); throw e; } finally { clearTimeout(t); }
}

const dest = join(DIR, FILE);
if (!force && await exists(dest)) { console.log('exists — pass --force to regenerate'); process.exit(0); }

const res = await fetchTimed(`${BASE}/assets/image`, {
  method: 'POST',
  headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ image_type: 'sprite-vfx', prompt: PROMPT + OUTLINE, art_style: 'Cel-Shaded',
    perspective: 'Any perspective', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false }),
});
if (!res.ok) { console.error(`Ludo ${res.status}: ${(await res.text()).slice(0, 200)}`); process.exit(2); }
const data = await res.json();
const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
if (!url) { console.error('no url: ' + JSON.stringify(data).slice(0, 200)); process.exit(2); }
const imgRes = await fetchTimed(url);
if (!imgRes.ok) { console.error('img fetch ' + imgRes.status); process.exit(2); }
const raw = Buffer.from(await imgRes.arrayBuffer());
if (!raw.length) { console.error('empty image'); process.exit(2); }
const out = await sharp(raw).ensureAlpha()
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 92 }).toBuffer();
await mkdir(DIR, { recursive: true });
if (await exists(dest)) await copyFile(dest, join(DIR, '_orig_backup_' + FILE)).catch(() => {});
await writeFile(dest, out);
const m = await sharp(out).metadata();
console.log(`OK ${FILE} — ${m.format} ${m.width}x${m.height} alpha=${m.hasAlpha}`);
