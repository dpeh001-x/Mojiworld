#!/usr/bin/env node
// Recreate the OPEN treasure-chest sprites from the CLOSED ones (ludo.ai
// image-edit / image-to-image), per user: the open chests must be a FULL
// FRONTAL view (matching the closed sprite, not the old 3/4 diagonal) and
// EMPTY inside (no coins).
//
// The closed sprite is sent as the base image so each tier keeps its exact
// palette + trim + outline; the prompt only opens the lid, empties the
// interior, and locks the camera to a straight-on front view.
//
// Workflow (needs LUDO_API_KEY):
//   node scripts/gen_chest_open.mjs                       # dry run — prints the plan
//   node scripts/gen_chest_open.mjs --generate           # 4 candidates/tier -> scripts/_chest_review/
//   node scripts/gen_chest_open.mjs --generate --tier gold   # one tier only
//   node scripts/gen_chest_open.mjs --install wood=2 silver=1 gold=3
//        # post-process the chosen candidate -> Sprites/objects/chest_<tier>_open.png
//
// Install composes the chosen art bottom-anchored on a 768x768 transparent
// canvas with the body in the lower ~68% and the lid rising above, matching
// drawChests' open-state draw box (c.h + 10 + _lidExtra, _lidExtra ~= 0.45).
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OBJ = join(repoRoot, 'Sprites', 'objects');
const REVIEW = join(repoRoot, 'scripts', '_chest_review');
const SIZE = 768;
const BODY_FRACTION = 0.68;   // body occupies the bottom 68% of the open canvas (lid rises above)

// Closed base sprite per tier (the exact files the game loads as the closed state).
const TIERS = {
  wood:   { base: 'chest_wood.webp' },
  silver: { base: 'chest_silver.png' },
  gold:   { base: 'chest_gold.webp' },
};

// Per-tier material cue so the edit keeps the right palette even though the
// base image already carries it (belt-and-suspenders against drift).
const MATERIAL = {
  wood:   'brown wooden chest with dark-wood corner trim and a grey iron round clasp plate',
  silver: 'all-silver polished metal chest with riveted metal bands and an oval metal clasp',
  gold:   'wooden chest with bright gold metal trim, gold corner bands and a gold lock plate',
};

function promptFor(tier) {
  return (
    'Edit THIS treasure chest into its OPEN state. Keep the EXACT same art: same ' +
    MATERIAL[tier] + ', same flat cartoon chibi-game style, same thin even ~2px black outline, ' +
    'same colors and shading, same transparent PNG background (alpha only, nothing behind it). ' +
    'CRITICAL CAMERA: a perfectly STRAIGHT-ON FRONT view (front elevation), symmetric left-to-right, ' +
    'facing the viewer head-on exactly like the closed chest — NObody 3/4 view, NO diagonal, NO ' +
    'perspective, do NOT show the right side or the rounded back of the lid. ' +
    'The lid is HINGED AT THE BACK and swung UP and slightly back so it sits ABOVE the body; we see ' +
    'the flat inner face of the raised lid straight-on. ' +
    'CRITICAL: the chest is EMPTY inside — a plain dark hollow interior with a visible back inner wall ' +
    'and floor. NO coins, NO gold, NO treasure, NO gems, NO glow, NO sparkles, NO light rays, NO items ' +
    'of any kind inside. Just an empty open box. ' +
    'The body stays the same size and shape as the closed chest, occupying the lower portion; the open ' +
    'lid adds height above. Single object, centered, no ground, no shadow, no text.'
  );
}

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const N = Number(process.env.CHEST_N || 4);

async function fetchBuf(u) {
  const r = await fetch(u, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('img fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
const mime = (f) => f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'image/jpeg';

// ---- INSTALL: post-process a chosen candidate into the final open sprite ----
async function composeFinal(srcBuf) {
  // Trim transparent padding, then place bottom-anchored on a 768 canvas so the
  // trimmed art's height maps to the body-lower / lid-upper layout the renderer
  // expects. We scale the trimmed art to fill the full 768 height (lid at top,
  // body bottom) — drawChests then bottom-anchors + adds the lid-extra box.
  const trimmed = await sharp(srcBuf).trim({ threshold: 10 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const scale = Math.min(SIZE / meta.width, SIZE / meta.height);
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const resized = await sharp(trimmed).resize(w, h, { fit: 'fill' }).png().toBuffer();
  return sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, top: SIZE - h, left: Math.round((SIZE - w) / 2) }])
    .png().toBuffer();
}

async function doInstall() {
  const picks = argv.filter(a => /^(wood|silver|gold)=\d+$/.test(a)).map(a => a.split('='));
  if (!picks.length) { console.error('Install needs picks, e.g.  --install wood=2 silver=1 gold=3'); process.exit(1); }
  for (const [tier, idx] of picks) {
    const cand = join(REVIEW, `${tier}_cand${idx}.png`);
    if (!await exists(cand)) { console.error(`missing ${cand}`); process.exit(1); }
    const out = join(OBJ, `chest_${tier}_open.png`);
    await writeFile(out, await composeFinal(await readFile(cand)));
    console.log(`installed ${tier} cand${idx} -> Sprites/objects/chest_${tier}_open.png`);
  }
  console.log('Done. Syntax/visual-verify then commit.');
}

// ---- GENERATE: 4 candidates per tier via the ludo image-edit endpoint ----
async function doGenerate() {
  const apiKey = process.env.LUDO_API_KEY;
  if (!apiKey) { console.error('LUDO_API_KEY required for --generate.'); process.exit(1); }
  const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
  await mkdir(REVIEW, { recursive: true });
  const only = valOf('--tier');
  const tiers = only ? [only] : Object.keys(TIERS);
  for (const tier of tiers) {
    const baseFile = TIERS[tier].base;
    const buf = await readFile(join(OBJ, baseFile));
    const dataUri = `data:${mime(baseFile)};base64,${buf.toString('base64')}`;
    for (let i = 1; i <= N; i++) {
      const dest = join(REVIEW, `${tier}_cand${i}.png`);
      if (!has('--force') && await exists(dest)) { console.log(`skip ${tier} cand${i} (exists)`); continue; }
      let ok = false, last;
      for (let a = 1; a <= 3 && !ok; a++) {
        try {
          const res = await fetch(`${API}/assets/image/edit`, {
            method: 'POST',
            headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(180000),
            body: JSON.stringify({ image: dataUri, prompt: promptFor(tier), n: 1, augment_prompt: false }),
          });
          if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 160));
          const data = await res.json();
          const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
          if (!url) throw new Error('no url');
          await writeFile(dest, await fetchBuf(url));
          console.log(`OK ${tier} cand${i} -> ${dest.replace(repoRoot, '.')}`);
          ok = true;
        } catch (e) { last = e; if (a < 3) await new Promise(s => setTimeout(s, 3000 * a)); }
      }
      if (!ok) console.error(`FAIL ${tier} cand${i}: ${last && last.message}`);
    }
  }
  console.log(`\nReview scripts/_chest_review/, then:  node scripts/gen_chest_open.mjs --install wood=<i> silver=<i> gold=<i>`);
}

if (has('--install')) await doInstall();
else if (has('--generate')) await doGenerate();
else {
  console.log('# Recreate OPEN chest sprites (frontal + empty) from the closed bases.');
  console.log('# Tiers:', Object.entries(TIERS).map(([t, v]) => `${t}<-${v.base}`).join('  '));
  console.log('# 1) LUDO_API_KEY=... node scripts/gen_chest_open.mjs --generate');
  console.log('# 2) review scripts/_chest_review/*.png');
  console.log('# 3) node scripts/gen_chest_open.mjs --install wood=<i> silver=<i> gold=<i>');
}
