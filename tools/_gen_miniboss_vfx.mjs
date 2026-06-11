#!/usr/bin/env node
// Mini-boss VFX (ludo.ai): 2 unique projectiles (Sprites/projectiles/, 768²)
// + 2 columnStrike pillars (Sprites/fx/, 256x1024). Resumable; --force overwrites.
//   node tools/_gen_miniboss_vfx.mjs --generate
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

const SPRITE_PRE = 'Sprite for a cute 2D side-scroller RPG in the Mojiworld aesthetic. Pure transparent background, alpha only — no scene, no ground, no frame. ABSOLUTELY NO TEXT (no letters, numbers, runes, watermark). Soft painterly cel-shaded anime style, bold clean dark outline, glossy highlights, vibrant saturated colors. Centered, subject fills ~80% of the canvas. ';
const COL_PRE = 'VFX sprite, pure transparent background (alpha only), no scene, no ground, no character, ABSOLUTELY NO TEXT. A single VERTICAL column of energy, centered horizontally, filling the canvas top to bottom; repeating flowing vertical motif (survives strong vertical stretching); bright hot core down the centerline (~30% width); soft translucent falloff on the left and right edges so it reads as light, not a slab; fade the very top and bottom ~5% to transparent. Painterly vibrant VFX. ';

const ITEMS = [
  { kind:'proj', file:'Sprites/projectiles/mblightseed.png', w:768, h:768, ar:'ar_1_1',
    prompt: SPRITE_PRE + 'A rotten grave-seed projectile pointing to the RIGHT — a gnarled dark seed pod wrapped in sickly moss-green blight tendrils (#88cc66), weeping pale drifting spores, a faint toxic green glow, a few wilted grey-pink petals trailing behind it.' },
  { kind:'proj', file:'Sprites/projectiles/mgravebone.png', w:768, h:768, ar:'ar_1_1',
    prompt: SPRITE_PRE + 'A heavy carved bone-shard projectile pointing to the RIGHT — a jagged ivory femur spear-shard (#d8d0b8) wrapped in wisps of pale teal soul-fire, faint glowing notches along the bone, bone-dust motes trailing behind it.' },
  { kind:'col', file:'Sprites/fx/fx_col_blightelder.webp', w:256, h:1024, ar:'ar_9_16',
    prompt: COL_PRE + 'Theme: a pillar of erupting BLIGHTED NATURE — rising sickly moss-green energy (#88cc66) full of drifting pale spores, wilted petals and thin mossy tendrils licking upward, a hot pale-green core, murky dark-green outer wisps.' },
  { kind:'col', file:'Sprites/fx/fx_col_ossuarytyrant.webp', w:256, h:1024, ar:'ar_9_16',
    prompt: COL_PRE + 'Theme: a pillar of ERUPTING BONES — stacked ivory bone shards, ribs and small skull fragments (#d8d0b8) rising in a tight column wrapped in pale-teal soul-fire wisps, a hot bone-white core, faint grey bone-dust at the edges.' },
];

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!has('--generate')) { for (const it of ITEMS) console.log('## ' + it.file + '\n' + it.prompt + '\n'); process.exit(0); }
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

let fail = 0;
for (const it of ITEMS) {
  const dest = join(root, it.file);
  process.stdout.write('  ' + it.file + ' ... ');
  if (!has('--force') && await exists(dest)) { console.log('skip'); continue; }
  let done = false, last;
  for (let a = 1; a <= 4 && !done; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(180000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: it.ar, n: 1, augment_prompt: false, prompt: it.prompt }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 120)); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(dirname(dest), { recursive: true });
      const img = sharp(await fetchBuf(url)).resize(it.w, it.h, { fit: it.kind === 'col' ? 'fill' : 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
      await writeFile(dest, it.file.endsWith('.webp') ? await img.webp({ quality: 92 }).toBuffer() : await img.png().toBuffer());
      console.log('OK'); done = true; await sleep(500);
    } catch (e) { last = e; if (/402/.test(e.message)) { console.log('FAIL: ' + e.message); process.exit(3); } if (a < 4) await sleep(3000 * a); }
  }
  if (!done) { fail++; console.log('FAIL: ' + (last && last.message)); }
}
process.exit(fail ? 2 : 0);
