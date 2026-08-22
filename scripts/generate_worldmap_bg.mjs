#!/usr/bin/env node
// World map backdrop — a deep-space nebula plate for the W-key map (ludo.ai).
// =============================================================================
// Per user (with a screenshot of the map): "Generate a much better background
// for the world map rectangular portion".
//
// The shipped backgrounds/worldmap_bg.webp is a busy painted terrain map —
// forests, lava fields, rivers, towns. Two problems: a ~100-node travel graph
// sits on top of it, so every house and tree competes with a node; and the CSS
// (#worldmap-modal .modal::before) layers three nebula radial-gradients over
// it at 0.85 opacity, so in practice none of it reaches the screen anyway — the
// user sees purple murk. The map is already styled as a star chart (galaxy
// chrome, twinkle dots, "The Singularity" at the top), so the plate should BE
// space: atmospheric, deep, quiet where nodes sit.
//
// Follows the hard-won recipe in generate_talent_backgrounds.mjs: the API only
// accepts image_type 'sprite' and biases toward a cut-out on white, so ask for
// a full-bleed ENVIRONMENT PLATE and let CSS handle the dimming.
//
//   node scripts/generate_worldmap_bg.mjs                 # dry-run
//   node scripts/generate_worldmap_bg.mjs --generate      # writes _wm_v1..N.png
//   flags: --variants N
// Needs LUDO_API_KEY. Never commit the key.
// =============================================================================
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const PROMPT =
  'A detailed painterly deep-space ENVIRONMENT ILLUSTRATION — a vast cosmic nebula seen from a distance, like a game concept-art background plate. '
  + 'The scene fills the whole rectangular image and continues past all four edges. '
  + 'Sweeping clouds of violet, deep indigo, magenta and teal nebula gas with soft luminous cores, drifting dust lanes, '
  + 'a faint spiral galaxy far in the distance, scattered small stars of varied brightness, a few bright star glints with soft bloom. '
  + 'Deep rich values with strong atmospheric depth; the centre of the image is calmer and darker than the edges so content can sit over it. '
  + 'Cinematic, visible brushwork, vivid but not neon. '
  + 'NO planets in the foreground, NO people, NO characters, NO creatures, NO spaceships, NO close-up objects, NO frames, NO borders, NO UI, NO logo. '
  + 'NO TEXT of any kind: no letters, numbers, words or watermark.';

if (!has('--generate')) {
  console.log('# world map backdrop (ludo.ai)\n');
  console.log('  target : backgrounds/worldmap_bg.webp  (the modal paints it via CSS)');
  console.log('  prompt :', PROMPT.slice(0, 140) + '...');
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --variants N');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const variants = Math.max(1, Number(arg('--variants') || 3));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); };

async function genOne(dest) {
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', signal: AbortSignal.timeout(180000),
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt: PROMPT }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const d = await res.json();
      const url = Array.isArray(d) ? d[0]?.url : (d?.url || d?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      // Trim any uniform border the sprite bias leaves, then save as PNG for review.
      let buf = await fetchBuf(url);
      try { buf = await sharp(buf).trim({ threshold: 12 }).toBuffer(); } catch {}
      await writeFile(dest, await sharp(buf).png().toBuffer());
      const m = await sharp(dest).metadata();
      return `${m.width}x${m.height}`;
    } catch (e) { last = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw last;
}
let failed = 0;
for (let v = 1; v <= variants; v++) {
  const dest = join(repoRoot, `_wm_v${v}.png`);
  process.stdout.write(`  variant ${v} ... `);
  try { console.log('OK ' + await genOne(dest)); await sleep(800); }
  catch (e) { failed++; console.log('FAIL: ' + e.message); }
}
console.log(`Done. ${variants - failed} made. Review _wm_v*.png, then bake the pick with --bake <n> in scripts/bake_worldmap_bg.mjs`);
process.exit(failed === variants ? 2 : 0);
