#!/usr/bin/env node
// Unique projectile sprites for each B-slot (Lv-50) master ultimate, replacing
// the borrowed shared keys (shard/shockwave/fire/gale/voidbeam/bolt/bloodwave).
// One dedicated sprite per ult → Sprites/projectiles/p_ult_<master>.png (true
// PNG, transparent sprite-vfx). Orient-mode sprites point RIGHT.
//   node tools/gen_bult_proj.mjs            # dry-run
//   node tools/gen_bult_proj.mjs --only ult_dragoon --generate
//   node tools/gen_bult_proj.mjs --generate # all 10 (skip-existing)
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

const OUTLINE = ' Epic painterly fantasy game projectile sprite, vibrant saturated colours, a bold uniform 2-3 pixel black outline (#0a0612) around the whole silhouette, crisp rim-light, fully transparent background, single object centred at ~75% of a 512x512 square, no text, no UI, no background, no ground shadow. Clearly readable at small size.';
// key (= in-engine skill id) -> prompt. Orient-mode → "pointing right".
const ITEMS = {
  ult_warlord:      'A heroic WAR-BANNER rally shockwave projectile pointing right — a billowing crimson-and-gold war banner trailing a radiant golden energy shockwave, sparks and motes streaming.',
  ult_doombringer:  'An apocalyptic BLADE-CLEAVE wave projectile pointing right — a huge crescent slash of crimson-and-black destructive energy with jagged dark edges and shedding embers.',
  ult_dragoon:      'A DRAGON-LANCE spear projectile pointing right — a glowing electric-blue energy spear crackling with lightning and a draconic blue aura, razor-sharp tip.',
  ult_nightreaper:  'A BLOOD-SCYTHE crescent blade projectile — a spinning crimson crescent scythe blade dripping blood-red energy with a dark bloodmoon glow, roughly round and radial.',
  ult_phantom:      'A VOID-SHURIKEN throwing star projectile — a spinning four-point violet-and-black void shuriken crackling with purple spectral energy, roughly round and radial.',
  ult_sage:         'A blazing METEOR projectile pointing right — a fiery rocky comet wreathed in orange-gold flame with a hot white core and a fiery trailing tail, embers shedding.',
  ult_elementalist: 'An ELEMENTAL CONVERGENCE bolt projectile pointing right — a swirling orb fusing fire, ice, lightning and wind energy into one prismatic core with a bright energy trail.',
  ult_marksman:     'A piercing DEADEYE sniper round projectile pointing right — a sleek glowing energy dart/bullet with a sharp white-hot piercing tip and a thin tracer trail, precise and fast.',
  ult_ballista:     'A heavy SIEGE BOLT projectile pointing right — a massive iron-tipped ballista bolt with glowing engraved runes and a faint fiery charge, weighty and menacing.',
  ult_skyhunter:    'A large GOLDEN ARROW projectile pointing right — a sleek polished solid-gold arrow with a sharp gleaming golden arrowhead, a long straight gold shaft, gold feathered fletching at the back, and a radiant warm golden glow with a faint sparkle trail. Bright precious-metal gold, regal, clean and clearly readable.',
  // Skyhunter G-skill (slot-X signature) "Gale Storm" — 15 homing wind arrows.
  gale_skyhunter:   'A GALE-STORM WIND ARROW projectile pointing right — a sleek razor-sharp arrow forged of swirling cyan-and-white wind, wreathed in spiralling gale streaks and a streaking air-current trail, a bright glowing cyan arrowhead and wind-feather fletching at the back. Fast, airy, luminous teal-cyan, clearly readable at small size.',
};

let keys = Object.keys(ITEMS);
const only = arg('--only'); if (only) keys = only.split(',').filter((k) => ITEMS[k]);
if (!has('--generate')) {
  console.log(`# ${keys.length} unique B-ult projectile sprites -> Sprites/projectiles/p_<key>.png\n`);
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
  const dest = join(DIR, 'p_' + k + '.png');
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
      await mkdir(DIR, { recursive: true }); await writeFile(dest, png);
      const m = await sharp(png).metadata();
      return `${m.format} ${m.width}x${m.height}`;
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(2500 * attempt); }
  }
  throw lastErr;
}
console.log(`Generating ${keys.length} B-ult projectile sprites...`);
let made = 0, skip = 0, fail = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skip++; console.log('skip'); } else { made++; console.log('OK ' + r); await sleep(700); } }
  catch (e) { fail++; console.log('FAIL: ' + e.message); }
}
console.log(`Done. ${made} made, ${skip} skipped, ${fail} failed.`);
process.exit(fail ? 2 : 0);
