#!/usr/bin/env node
// Generate the Bloodthirsty Vermillion blood-red ARROW projectile base sprite
// via Ludo /assets/image (transparent sprite-vfx). Replaces the old blood-drop
// Sprites/projectiles/mbloodbolt.png (backed up first). Then run
// scripts/generate_boss_projectile_anim.mjs --only mbloodbolt --generate to
// produce the 9-frame anim/ loop.
// =============================================================================
//   node tools/gen_bloodbolt_arrow.mjs            # dry-run (prompt only)
//   node tools/gen_bloodbolt_arrow.mjs --generate # call Ludo (needs LUDO_API_KEY)
// =============================================================================
import { writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(repoRoot, 'Sprites', 'projectiles', 'mbloodbolt.png');
const BACKUP = join(repoRoot, 'Sprites', 'projectiles', '_orig_backup', 'mbloodbolt.png');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

// Orient-mode blit rotates the sprite to its velocity vector, so the arrow MUST
// point to the RIGHT (arrowhead on the right) in the source frame.
const PROMPT = 'A single sharp ARROW projectile flying horizontally pointing to the RIGHT, '
  + 'glistening blood-red crimson, a pointed glowing metal arrowhead at the right tip and '
  + 'dark crimson feather fletching at the left end, slick wet blood dripping off it with a '
  + 'faint red energy trail streaming behind to the left. Hand-painted fantasy game projectile '
  + 'sprite, clean side view, the arrow centered and roughly horizontal, crisp silhouette, '
  + 'fully transparent background, no scenery, no frame, no text.';

if (!has('--generate')) {
  console.log('# Bloodthirsty Vermillion blood-red arrow -> Sprites/projectiles/mbloodbolt.png');
  console.log('# image_type=sprite-vfx, art_style=Hand-Painted, ar_1_1, removeBackground=true\n');
  console.log(PROMPT);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). ~2 credits.');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

async function fetchTimed(url, opts = {}, ms = 120000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error('timeout'); throw e; }
  finally { clearTimeout(t); }
}

console.log('Generating blood-red arrow base sprite...');
const res = await fetchTimed(`${BASE}/assets/image`, {
  method: 'POST',
  headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image_type: 'sprite-vfx',
    prompt: PROMPT,
    art_style: 'Hand-Painted',
    perspective: 'Side-Scroll',
    aspect_ratio: 'ar_1_1',
    n: 1,
    augment_prompt: false,
  }),
});
if (!res.ok) { console.error(`Ludo ${res.status}: ${(await res.text()).slice(0, 200)}`); process.exit(1); }
const data = await res.json();
const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
if (!url) { console.error('No image URL: ' + JSON.stringify(data).slice(0, 200)); process.exit(1); }
const imgRes = await fetchTimed(url);
if (!imgRes.ok) { console.error('Image fetch ' + imgRes.status); process.exit(1); }
const buf = Buffer.from(await imgRes.arrayBuffer());
if (!buf.length) { console.error('Empty image'); process.exit(1); }

// Back up the original blood-drop once, then overwrite.
await mkdir(dirname(BACKUP), { recursive: true });
if (await exists(DEST) && !(await exists(BACKUP))) { await copyFile(DEST, BACKUP); console.log(`Backed up original -> ${BACKUP}`); }
await writeFile(DEST, buf);
console.log(`OK -> ${DEST} (${buf.length} bytes)`);
process.exit(0);
