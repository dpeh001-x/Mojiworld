#!/usr/bin/env node
// ARCHBISHOP skill-bar icons — regenerated for readability (ludo.ai)
// =============================================================================
// Per user: "update these 2 icons for arch bishop" (the G and B slots —
// Judgment of the Holy Grail and Apotheosis).
//
// Why they needed replacing rather than re-touching:
//   • Both were near-monochrome GOLD, and the skill-bar frame they sit in is
//     itself gold/amber — so the emblem had almost no figure/ground contrast
//     and read as a muddy blob at 40px. Every other icon in Sprites/skills
//     carries a vivid, high-contrast subject (violet starburst, emerald fang,
//     crimson bolt) against a thick dark outline.
//   • archbishop_grail was never a purpose-made icon at all: it was derived
//     from the FX sheet by generate_skill_icons_fromfx.mjs, so it inherited a
//     soft, low-contrast full-scene look instead of an emblem silhouette.
//
// The PREFIX below is copied VERBATIM from generate_ult_icons.mjs so these two
// stay in the same house style as the other 72 icons; only the per-icon clause
// is new, and it adds the cool-accent requirement that buys back the contrast.
//
//   node scripts/regen_archbishop_icons.mjs                 # dry-run
//   node scripts/regen_archbishop_icons.mjs --generate      # writes both
//   flags: --only grail|ult   --outdir <dir>   (default Sprites/skills)
// Needs LUDO_API_KEY (never commit it — read from the environment).
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
const OUT_DIR = arg('--outdir') || join(repoRoot, 'Sprites', 'skills');
const SIZE = 256;

// VERBATIM from generate_ult_icons.mjs — do not reword; it is what keeps the
// whole icon set consistent (frame-less emblem, transparent edges, no text).
const PREFIX = 'Mobile game SKILL ICON — a single bold emblem that clearly depicts the skill, floating FREE on a FULLY TRANSPARENT background (alpha only). ' +
  'ABSOLUTELY NO frame, NO border, NO box, NO rounded-square, NO circle badge, NO panel, NO background fill or gradient, NO ground, NO scene — ONLY the emblem itself with clean transparent edges all around it. ' +
  'Chibi anime style: thick dark outline around the emblem, vibrant saturated colors, soft cel shading, bright additive glow. ' +
  'Strong centered composition filling about 85% of the square canvas with a small transparent margin. ' +
  'ABSOLUTELY NO TEXT: no letters, numbers, words, runes-as-writing or watermark. Bold, clean, instantly readable at small size. ';

// The contrast fix: a COOL accent (sapphire/cyan) beside the gold, so the
// emblem separates from the amber skill-bar frame instead of blending into it.
const CONTRAST = 'HIGH CONTRAST: pair the warm gold with deep sapphire-blue and bright cyan-white accents, ' +
  'strong dark navy shading in the recesses, so the emblem stays crisp and readable against a GOLD user-interface frame. ' +
  'Simple bold silhouette — readable at 40 pixels. ';

// The first pass produced two near-identical pointed blue/gold CRESTS: neither
// depicted its skill, and at 46px the player could not tell the G slot from the
// B slot. "emblem" alone pulls this generator straight to heraldry, so each
// prompt now names the literal OBJECT, bans the badge shapes explicitly, and
// the two subjects are deliberately orthogonal in silhouette — an upright CUP
// versus a wide WING SPAN — so they stay distinguishable at icon size.
const NEGATIVE = 'NOT a shield, NOT a heraldic crest, NOT a coat of arms, NOT a rank badge, ' +
  'NOT a pointed chevron insignia, NOT a diamond plaque. ';

const ICON = {
  archbishop_grail: NEGATIVE +
    'The subject is literally A DRINKING CHALICE seen from the side: a tall ornate golden goblet with a round bowl, ' +
    'a slender stem and a wide circular foot, unmistakably a CUP. Brilliant cyan-white holy light overflows from the ' +
    'bowl and spills down the sides, sapphire gemstones set around the rim, a thin halo ring glowing behind the cup. ' +
    'Tall upright silhouette',
  archbishop_ult: NEGATIVE +
    'The subject is literally A PAIR OF ANGEL WINGS spread WIDE and horizontal, made of layered white and gold ' +
    'feathers, with a single bright golden halo ring floating above and between them and a shaft of cyan-white light ' +
    'rising through the gap. No body, no figure, no armour — only the two feathered wings and the halo. ' +
    'Wide horizontal silhouette',
};

const KEY_ALIAS = { grail: 'archbishop_grail', ult: 'archbishop_ult' };
let keys = Object.keys(ICON);
const only = arg('--only');
if (only) {
  const want = only.split(',').map((s) => KEY_ALIAS[s.trim()] || s.trim());
  keys = keys.filter((k) => want.includes(k));
}
if (!keys.length) { console.error('No matching icons.'); process.exit(1); }
if (!has('--generate')) {
  console.log(`# ${keys.length} archbishop icon(s) -> ${OUT_DIR} (${SIZE}x${SIZE}, frame-less)\n`);
  for (const k of keys) console.log(`  ${k}\n     ${ICON[k]}`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function gen(k) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({
          image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1',
          n: 1, augment_prompt: false, prompt: PREFIX + CONTRAST + ICON[k] + '.',
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS');
        throw new Error(res.status + ': ' + t.slice(0, 140));
      }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(OUT_DIR, { recursive: true });
      const out = join(OUT_DIR, `${k}.png`);
      await writeFile(out, await sharp(await fetchBuf(url))
        .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer());
      return out;
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await sleep(3000 * a); }
  }
  throw last;
}

console.log(`Generating ${keys.length} archbishop icon(s) into ${OUT_DIR} ...`);
let made = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const p = await gen(k); made++; console.log('OK -> ' + p); await sleep(500); }
  catch (e) {
    failed++; console.log('FAIL: ' + e.message);
    if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); }
  }
}
console.log(`Done. ${made} made, ${failed} failed.`);
process.exit(failed ? 2 : 0);
