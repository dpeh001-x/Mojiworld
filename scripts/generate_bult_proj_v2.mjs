#!/usr/bin/env node
// B-ult projectile sprites v2 — dedicated art per Lv-50 ultimate, on a LARGE
// canvas that never gets cut off when the projectile rotates to its velocity.
// =============================================================================
// The engine draws these oriented-to-velocity, so the subject must sit inside
// the canvas's inscribed circle. We GUARANTEE that in post: generate, trim to
// the content's alpha bbox, then re-center it at ~58% of a 512² canvas (max
// content dim ≤ ~300px → corner radius ~210 < 256, so no clip at any rotation).
// Output overwrites Sprites/projectiles/p_ult_<master>.png (matches LX_BULT_PROJ).
// Previous set backed up at Sprites/projectiles/_bult_backup/.
//   node scripts/generate_bult_proj_v2.mjs                 # dry-run
//   node scripts/generate_bult_proj_v2.mjs --only nightreaper --generate
//   node scripts/generate_bult_proj_v2.mjs --generate      # all 9 (--force to overwrite)
// Needs LUDO_API_KEY.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'projectiles');
const CANVAS = 512, TARGET = 300;   // content fits within TARGET on a CANVAS² frame
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const OUTLINE = ' Epic painterly fantasy game PROJECTILE sprite — a single small object, vibrant saturated colours, a bold uniform 2px black outline around the whole silhouette, crisp rim-light. FULLY TRANSPARENT background, the object CENTERED and COMPACT with LOTS of empty transparent margin all around it (the object occupies only the middle ~55% of the frame, never touching any edge). NO text, NO UI, NO background, NO ground shadow, NO scene, NO box or frame. Readable at small size.';
// master -> prompt (orient-mode subjects point RIGHT). Fixed nightreaper (was a
// moon) and marksman (was a rifle) to read as actual projectiles.
const ITEMS = {
  warlord:      'A WAR-BANNER shockwave projectile pointing right — JUST a billowing crimson-and-gold banner cloth on a short pole trailing a radiant golden energy shockwave and sparks. NO person, NO soldier, NO character holding it — only the banner cloth and the energy wave.',
  doombringer:  'An apocalyptic BLADE-WAVE projectile pointing right — a single crescent slash of crimson-and-black destructive energy with jagged edges and shedding embers.',
  dragoon:      'A DRAGON-LANCE spear projectile pointing right — a glowing electric-blue energy spear crackling with lightning and a draconic aura, razor-sharp tip.',
  nightreaper:  'A spinning SCYTHE-BLADES projectile — two or three sharp curved crimson scythe blades joined at the centre like a bladed pinwheel / spinning shuriken of scythes, dripping blood-red energy with a faint dark glow. Clearly multiple curved SCYTHE BLADES, NOT a moon, NOT a circle, NOT a planet, NOT a single handle.',
  phantom:      'A VOID SHURIKEN projectile — a single four-point violet-and-black throwing star crackling with purple spectral void energy.',
  sage:         'A blazing METEOR projectile pointing right — a fiery rocky comet with a hot white-orange core and a short flaming tail, embers shedding.',
  elementalist: 'An ELEMENTAL CONVERGENCE orb projectile pointing right — a swirling sphere fusing fire, ice and lightning into one bright prismatic core with a short energy trail.',
  marksman:     'A piercing ENERGY ROUND projectile pointing right — a sleek glowing CYAN-BLUE energy bullet/dart with a bright core, a sharp pointed tip and a short tracer streak behind it. Use vivid saturated blue with a dark outline so it is clearly visible. It is JUST the glowing bolt object, NOT a gun, NOT a rifle, NOT a person, NOT white-on-white.',
  ballista:     'A heavy SIEGE BOLT projectile pointing right — a single massive iron-tipped ballista bolt with glowing engraved runes and a faint fiery charge.',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

// Trim to alpha bbox, scale content to fit TARGET, center on CANVAS² transparent.
async function frameNoCutoff(buf) {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let minX = W, minY = H, maxX = 0, maxY = 0, any = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 12) { any = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (!any) { minX = 0; minY = 0; maxX = W - 1; maxY = H - 1; }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const content = await sharp(buf).ensureAlpha().extract({ left: minX, top: minY, width: cw, height: ch })
    .resize(TARGET, TARGET, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  const m = await sharp(content).metadata();
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: content, left: Math.round((CANVAS - m.width) / 2), top: Math.round((CANVAS - m.height) / 2) }])
    .png().toBuffer();
}

let keys = Object.keys(ITEMS);
const only = arg('--only'); if (only) keys = only.split(',').filter((k) => ITEMS[k]);
if (!keys.length) { console.error('No matching ults.'); process.exit(1); }
if (!has('--generate')) {
  console.log(`# ${keys.length} B-ult projectile sprites (large canvas, no cutoff) -> Sprites/projectiles/p_ult_<master>.png\n`);
  for (const k of keys) console.log('  ' + k);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --only a,b --force');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gen(k) {
  const dest = join(DIR, `p_ult_${k}.png`);
  if (!force && await exists(dest)) return 'skip';
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite-vfx', art_style: 'Hand-Painted', perspective: 'Side-Scroll', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: ITEMS[k] + OUTLINE }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 140)); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(DIR, { recursive: true });
      await writeFile(dest, await frameNoCutoff(await fetchBuf(url)));
      return 'OK';
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await sleep(3000 * a); }
  }
  throw last;
}

console.log(`Generating ${keys.length} B-ult projectile sprites (no-cutoff frame)...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await gen(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(350); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
