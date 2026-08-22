#!/usr/bin/env node
// elemental_link — the Elemental Convergence chain-node burst (ludo.ai).
// =============================================================================
// Per user: "The lightning chain of the elemental convergence skill can be
// regenerated with more spark and intensity".
//
// The shipped Sprites/fx/elemental_link.webp is a clean eight-point star inside
// a rune circle — a magic SIGIL. It is stamped at every enemy the chain hops to
// (SKILL_FNS.elemental), so what the player reads at each arc terminus is a
// tidy heraldic sunburst rather than electricity discharging into a body. The
// game already proves the target look elsewhere: Sprites/fx/cascade_lightning
// is a forked white-hot crackle with spark confetti, and that is the register
// this one should be in.
//
// Prompt follows the house recipe (see generate_tsunami_proj.mjs): SHORT,
// effect-first, explicit no-character negations — long "cute RPG aesthetic"
// prefixes make this account's sprite model return chibi characters regardless
// of the effect described.
//
//   node scripts/generate_chain_link_fx.mjs                 # dry-run
//   node scripts/generate_chain_link_fx.mjs --generate      # writes _link_v1..N.png
//   flags: --variants N
// Needs LUDO_API_KEY. Never commit the key.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const SUFFIX = ' special-effect for a 2D side-scroller game, simple flat cel-shaded anime style with bold dark outlines, minimal detail, clean bold simple shapes, vibrant saturated colors, game VFX element only, no character, no person, no creature, no text, every stroke tapers and fades to nothing well before the image border, nothing touching or clipped by the frame edge, generous empty margin on all sides, transparent background';

// Effect-first, and explicitly a DISCHARGE rather than a symbol: the failure
// mode being replaced is a tidy radial star, so the shape language here is all
// fork, branch and scatter, with nothing circular or heraldic in it.
const PROMPT =
  'A violent electric discharge burst, a white-hot core with jagged forked lightning bolts branching outward in irregular directions, '
  + 'branching arcs that split into smaller crooked forks, bright spark specks scattering away from the centre, '
  + 'hot white core fading to golden yellow then pale electric blue at the tips, '
  + 'crackling and asymmetric, no circle, no ring, no star shape, no symbol, no rune,';

async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
// Trim to drawn content then CONTAIN at 82% on a transparent 768 square —
// matches the existing elemental_link dimensions exactly, so nothing
// downstream (burst size, grow curve) has to change.
async function postProcess(raw) {
  let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
  const CANVAS = 768, INNER = Math.round(CANVAS * 0.82);
  const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, gravity: 'center' }]).png().toBuffer();
}

if (!has('--generate')) {
  console.log('# elemental_link regeneration (ludo.ai)\n');
  console.log('  target : Sprites/fx/elemental_link.webp  (768x768, transparent)');
  console.log('  used by: SKILLS.elemental (Elemental Convergence) at every chain hop\n');
  console.log('  prompt :', PROMPT.slice(0, 120) + '...');
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --variants N');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const variants = Math.max(1, Number(arg('--variants') || 3));

async function genOne(dest) {
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', signal: AbortSignal.timeout(150000),
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT + SUFFIX }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const d = await res.json();
      const url = Array.isArray(d) ? d[0]?.url : (d?.url || d?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, await postProcess(await fetchBuf(url)));
      return 'ok';
    } catch (e) { last = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw last;
}
let failed = 0;
for (let v = 1; v <= variants; v++) {
  const dest = join(repoRoot, `_link_v${v}.png`);
  process.stdout.write(`  variant ${v} ... `);
  try { await genOne(dest); console.log('OK -> ' + dest); await sleep(800); }
  catch (e) { failed++; console.log('FAIL: ' + e.message); }
}
console.log(`Done. ${variants - failed} made, ${failed} failed. Review, then bake the pick to Sprites/fx/elemental_link.webp`);
process.exit(failed === variants ? 2 : 0);
