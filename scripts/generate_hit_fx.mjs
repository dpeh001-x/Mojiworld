#!/usr/bin/env node
// Class skill-impact spark VARIANTS — ludo.ai text→sprite (static).
// =============================================================================
// v0.29.x — extends the v0.29.250 per-class hit sparks (Sprites/fx/hit_<cls>.png)
// with 2 extra variants per class (hit_<cls>_2 / hit_<cls>_3), so different
// skills read with different impact designs (hitMonster maps each skill id to
// a variant deterministically). Aesthetic follows the user's reference: a
// white-hot impact flash core over an ink-black splatter mass, tinted per
// class. Same hard-learned prompt recipe as generate_dash_fx.mjs.
//
//   node scripts/generate_hit_fx.mjs                      # dry-run list
//   node scripts/generate_hit_fx.mjs --generate           # all
//   node scripts/generate_hit_fx.mjs --only hit_mage_2 --generate
//   flags: --force --only a,b
// Needs LUDO_API_KEY. Resumable: skips a file that already exists.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX_DIR = join(repoRoot, 'Sprites', 'fx');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const SUFFIX = ' impact special-effect for a 2D side-scroller game, white-hot bright flash core over an ink-black paint splatter mass, simple flat cel-shaded anime style with bold shapes, vibrant saturated colors, game VFX element only, no character, no person, no creature, no face, no text, every shape tapers and fades to nothing well before the image border, nothing touching or clipped by the frame edge, generous empty margin on all sides, transparent background';

// file (Sprites/fx/<key>.png) -> prompt. _2/_3 join the existing base art as
// skill-keyed variants.
const FX = {
  // v2 per user: cleave slash replaced — heavy blunt concussion read instead.
  hit_warrior_2: 'A single heavy blunt concussion impact, thick ember-orange cracked shockwave fractures radiating from a dense white-hot core, a few chunky debris fragments flying out, black ink splatter mass behind,',
  hit_warrior_3: 'A single brutal ground-shock impact burst, ember-orange and gold jagged shockwave ring around a white-hot core, chunky black ink splatter flecks thrown upward,',
  hit_rogue_2:   'A single X-shaped cross slash impact, two thin crossing violet-magenta blade arcs over a white-hot flash core, fine black ink splatter spray,',
  // v2: "fan of slice arcs" drew a literal folding fan (prompt-trap list).
  // v3 per user: slash trio replaced — single crescent shadow-cut read.
  hit_rogue_3:   'A single large curved crescent cut arc sweeping through a white-hot flash core, deep violet-magenta with a dark shadowy trailing edge, black ink splatter spraying off the outer curve, abstract cut mark only, no object, no weapon,',
  hit_mage_2:    'A single arcane ring-shock impact, a cyan-blue circular rune ring pulsing around a white-hot core flash, black ink splatter breaking outward through the ring,',
  hit_mage_3:    'A single crystalline shatter impact, sharp cyan-and-ice-blue glass shards exploding from a white-hot flash core, black ink splatter behind the shards,',
  hit_archer_2:  'A single piercing arrow-strike impact, thin leaf-green and gold needle spikes radiating from a small intense white-hot puncture flash, black ink splatter streaking in one direction,',
  // v2 per user: leaf burst replaced — multi-hit volley cluster read instead.
  hit_archer_3:  'A single tight cluster of three small white-hot puncture bursts overlapping, each rimmed with leaf-green spikes and tiny gold sparks between them, black ink splatter spraying outward from the cluster,',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(FX);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching FX.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${keys.length} hit-spark variants -> Sprites/fx/<key>.png:\n`);
  for (const k of keys) console.log(`  ${k}.png`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only a,b');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genOne(k) {
  const dest = join(FX_DIR, `${k}.png`);
  if (!force && await exists(dest)) return 'skip';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: FX[k] + SUFFIX }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 140)}`);
      await mkdir(FX_DIR, { recursive: true });
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const CANVAS = 768, INNER = Math.round(CANVAS * 0.82);
      const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
      const out = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }])
        .png().toBuffer();
      await writeFile(dest, out);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${keys.length} hit-spark variants (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(800); } }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
