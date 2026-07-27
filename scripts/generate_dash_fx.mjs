#!/usr/bin/env node
// Class quick-dash VFX sprites — ludo.ai text→sprite (static, side-view)
// =============================================================================
// Art for the v0.29.240 per-class dash sprite slots (LX_FX dash_warrior /
// dash_mage / dash_archer / dash_rogue). Output -> Sprites/fx/dash_<cls>.png,
// spawned by quickDash() via spawnSpriteBurst; the procedural particle FX
// remains the fallback until each file exists. Static single images — the
// in-game render scales / fades / mirrors them for motion (base art reads
// LEFT-TO-RIGHT; the game flips for leftward dashes).
//
//   node scripts/generate_dash_fx.mjs                    # dry-run list
//   node scripts/generate_dash_fx.mjs --only dash_mage --generate
//   node scripts/generate_dash_fx.mjs --generate         # all 4
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

// PROMPT SHAPE (v2, hard-learned): this account's sprite model reads long
// "cute RPG …aesthetic" prefixes as a CHARACTER request and returns chibi
// characters no matter what follows. Short, effect-FIRST prompts with
// explicit no-character negations produce clean cel-shaded VFX. Style tail
// stays compact: 2D side-scroller + cel-shaded anime + bold dark outlines.
// v3 per user "make it simple and not look like an edge is cut-off": simpler
// shapes, and EVERY stroke must taper/fade to nothing well before the frame
// border — art that touches the border reads as sliced once trimmed in-game.
const SUFFIX = ' special-effect for a 2D side-scroller game, simple flat cel-shaded anime style with bold dark outlines, minimal detail, clean bold simple shapes, vibrant saturated colors, game VFX element only, no character, no person, no creature, no text, every stroke tapers and fades to nothing well before the image border, nothing touching or clipped by the frame edge, generous empty margin on all sides, transparent background';

// file (Sprites/fx/<key>.png) -> prompt. Keys mirror the LX_FX entries.
const FX = {
  // v4 per user: v3 came out as a closed round crescent (read as a moon, not
  // motion) — force a WIDE SHALLOW arc, much wider than tall, laid flat.
  dash_warrior: 'A single simple amber-orange horizontal speed swoosh laid flat, a wide shallow sweeping arc at least four times wider than tall, thick glowing center thinning to fine sharp points at the left and right ends, two small ember dots trailing behind, strong sense of fast sideways motion,',
  dash_mage:    'A single simple violet-blue arcane streak, one smooth horizontal energy trail with a soft bright core that fades out at both ends, three or four small four-pointed star sparkles around it,',
  dash_archer:  'A single simple emerald-green wind streak, two smooth curved horizontal wind lines that taper to fine points at both ends, one small leaf fleck trailing behind,',
  // "ninja smoke" made ludo draw a literal ninja head in the smoke — keep it
  // to abstract smoke/shadow vocabulary only, and forbid faces explicitly.
  dash_rogue:   'A single simple violet-grey smoke streak, one smooth stretched horizontal smoke wisp that tapers to fine points at both ends with two tiny puffs trailing behind, abstract smoke only, no face, no eyes,',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(FX);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching FX.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${keys.length} class dash VFX -> Sprites/fx/<key>.png:\n`);
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
      // ANTI-CUTOFF: trim to drawn content, then CONTAIN onto a transparent
      // 768² canvas at ~82%, centered — clean margin, never edge-clipped.
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

console.log(`Generating ${keys.length} class dash VFX (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(800); } }
  catch (e) { failed++; const c = e && e.cause; console.log(`FAIL: ${e.message}${c ? ' | cause: ' + (c.code || c.errno || c.message || c) : ''}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
