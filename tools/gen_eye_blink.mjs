#!/usr/bin/env node
// Closed-eye "blink" variants for every equippable player eye style.
// =============================================================================
// For each id in the game's LX_EYES registry, edit the open-eye layer
// (Sprites/character/eyes/<file>) into a CLOSED-eye version via Ludo
// /assets/image/edit, saved to Sprites/character/eyes/blink/<file>. The game
// swaps to this layer during a brief, occasional blink window so the hero
// blinks naturally.
//
//   node tools/gen_eye_blink.mjs                       # dry-run (list ids)
//   node tools/gen_eye_blink.mjs --only default,cute --generate   # test a few
//   node tools/gen_eye_blink.mjs --generate            # all (skips existing)
// Needs LUDO_API_KEY. Resumable: skips a style whose blink file exists (--force).
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const EYES_DIR = join(repoRoot, 'Sprites', 'character', 'eyes');
const OUT_DIR  = join(EYES_DIR, 'blink');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Parse the LX_EYES { id: 'file.webp', ... } map straight out of the game so
// this stays in sync with whatever styles are registered.
const html = await readFile(join(repoRoot, 'mojiworld_game.html'), 'utf8');
const block = html.match(/const LX_EYES = \(\(\) => \{[\s\S]*?const files = \{([\s\S]*?)\};/);
if (!block) { console.error('Could not locate LX_EYES files map.'); process.exit(1); }
const FILES = {};
for (const m of block[1].matchAll(/([a-zA-Z_]+):\s*'([^']+)'/g)) FILES[m[1]] = m[2];

const PROMPT = 'Take this transparent chibi-character EYES sprite layer and redraw it with the eyes CLOSED: replace the open eyes with gentle closed eyelids shown as soft downward-curving closed-eye arcs / lash-lines in the same colour, line weight and style, keeping any eyelashes, makeup or eye accents. Keep the EXACT same position, scale, framing and art style — do not move, resize or recolour. Output ONLY the eyes layer on a fully transparent background: no face, no skin, no head, no extra background.';

let ids = Object.keys(FILES);
const only = arg('--only'); if (only) ids = only.split(',').filter((k) => FILES[k]);
const limit = arg('--limit'); if (limit) ids = ids.slice(0, Number(limit));
if (!ids.length) { console.error('No matching eye styles.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${ids.length} eye-blink variants -> Sprites/character/eyes/blink/<file>:\n`);
  for (const id of ids) console.log(`  ${id}  (${FILES[id]})`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only a,b --limit N');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

async function gen(id) {
  const file = decodeURIComponent(FILES[id]);   // registry may URL-encode spaces (e.g. neo%20galaxy.webp)
  const dest = join(OUT_DIR, file);
  if (!force && await exists(dest)) return 'skip';
  const srcPath = join(EYES_DIR, file);
  if (!(await exists(srcPath))) return 'nosrc';
  const srcBuf = await readFile(srcPath);
  const meta = await sharp(srcBuf).metadata();
  // Downscale the reference to keep the upload under the model's input cap.
  const small = await sharp(srcBuf).resize(900, 900, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const dataUri = 'data:image/png;base64,' + small.toString('base64');
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image/edit`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image: dataUri, prompt: PROMPT, n: 1, augment_prompt: false }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 150)); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url: ' + JSON.stringify(data).slice(0, 120));
      await mkdir(OUT_DIR, { recursive: true });
      const W = meta.width || 800, H = meta.height || 800;
      await writeFile(dest, await sharp(await fetchBuf(url)).ensureAlpha().resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toBuffer());
      return `${W}x${H}`;
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await sleep(3000 * a); }
  }
  throw last;
}

console.log(`Generating ${ids.length} eye-blink variants (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const id of ids) {
  process.stdout.write(`  ${id} ... `);
  try { const r = await gen(id); if (r === 'skip') { skipped++; console.log('skip'); } else if (r === 'nosrc') { console.log('NO SOURCE'); } else { made++; console.log('OK ' + r); await sleep(400); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
