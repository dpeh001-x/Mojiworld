#!/usr/bin/env node
// Forge enhancement FX base sprites (Brok's anvil) via Ludo /assets/image →
// Sprites/fx/forge_success.png + forge_fail.png (true PNG, transparent). These
// are then animated by scripts/generate_g_skill_anim.mjs (reads Sprites/fx/) and
// played as a frame-cycling overlay by _playForgeAnim on enhance success/fail.
//   node tools/gen_forge_fx.mjs            # dry-run
//   node tools/gen_forge_fx.mjs --generate # call Ludo (needs LUDO_API_KEY)
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'fx');
const has = (f) => process.argv.slice(2).includes(f);
const arg = (f) => { const a = process.argv.slice(2); const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };

const STYLE = ' Clean cel-shaded fantasy game FX art, bold uniform 2-3px black outline (#0a0612), vibrant saturated colours, single central motif filling ~75% of a 512x512 square, fully transparent background, no text, no UI frame, no ground shadow. Reads clearly at small size.';
const ITEMS = {
  forge_success: 'A blacksmith ANVIL being struck in a SUCCESSFUL forge — a sturdy dark-iron anvil with a brilliant white-gold spark-burst and a hot flash exploding at the strike point on top, radiant golden sparks and embers flying upward, a triumphant warm glow.',
  forge_fail:    'A FAILED forge on a blacksmith anvil — a dull cracked dark-iron anvil with a sad grey-and-red smoke puff rising, a few dim fizzling red embers, a faint crack and a broken metal shard, gloomy and cold.',
};

let keys = Object.keys(ITEMS);
const only = arg('--only'); if (only) keys = only.split(',').filter((k) => ITEMS[k]);

if (!has('--generate')) {
  console.log('# forge FX -> Sprites/fx/<key>.png (sprite-vfx, Cel-Shaded)\n');
  for (const k of keys) console.log(`## ${k}\n${ITEMS[k] + STYLE}\n`);
  console.log('# Re-run with --generate (needs LUDO_API_KEY). ~2 credits each.');
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
        body: JSON.stringify({ image_type: 'sprite-vfx', prompt: ITEMS[k] + STYLE, art_style: 'Cel-Shaded', perspective: 'Side-Scroll', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false }),
      });
      if (!res.ok) throw new Error(`Ludo ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const imgRes = await fetchTimed(url); if (!imgRes.ok) throw new Error('img fetch ' + imgRes.status);
      const raw = Buffer.from(await imgRes.arrayBuffer()); if (!raw.length) throw new Error('empty');
      const png = await sharp(raw).ensureAlpha().resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      await mkdir(DIR, { recursive: true });
      await writeFile(dest, png);
      const m = await sharp(png).metadata();
      return `${m.format} ${m.width}x${m.height} alpha=${m.hasAlpha}`;
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(2500 * attempt); }
  }
  throw lastErr;
}
console.log(`Generating ${keys.length} forge FX bases...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK ' + r); await sleep(800); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
