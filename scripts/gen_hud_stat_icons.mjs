#!/usr/bin/env node
// HUD stat icons — the three lanes the generated set was missing.
// =============================================================================
// Sprites/ui/hud/ already carries 16 custom icons (atk, def, acc, crit, jump,
// dodge, …) but never had HP, MP or SPEED — so the Level-Up cards and the stat
// summary still fell back to emoji, and ACC/Jump rendered as bullet dots.
// These three complete the set so every stat lane can use one visual language.
//
// Same recipe as scripts/generate_ui_icons.mjs (short subject-first prompt +
// shared style tail — long "cute RPG" prefixes make the sprite model return
// chibi characters), same 128x128 webp output the other 16 use.
//
//   node scripts/gen_hud_stat_icons.mjs                 # dry-run
//   node scripts/gen_hud_stat_icons.mjs --generate      # writes (skips existing)
//   flags: --force --only hp,mp --outdir <dir>
// Needs LUDO_API_KEY (read from the environment — never committed).
// =============================================================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OUT_DIR = arg('--outdir') || join(repoRoot, 'Sprites', 'ui', 'hud');
const SIZE = 128;

// VERBATIM from generate_ui_icons.mjs — this tail is what keeps the 16
// existing icons a matched set; do not reword it for these three.
const SUFFIX = ' game UI icon for a 2D side-scroller, cel-shaded anime style with bold dark outlines, glossy highlights, vibrant saturated colors, single object icon only, centered, no character, no person, no creature, no hands, no text, fully inside the frame with empty margin on all sides, transparent background';

const ICON = {
  // subject-first and terse, per the recorded ludo.ai lesson
  hp:    'A glossy bright red heart',
  mp:    'A glossy deep blue teardrop of mana',
  speed: 'A bright yellow lightning bolt',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

let keys = Object.keys(ICON);
const only = arg('--only');
if (only) { const w = only.split(',').map(x => x.trim()); keys = keys.filter(k => w.includes(k)); }
if (!keys.length) { console.error('No matching icons.'); process.exit(1); }
if (!has('--generate')) {
  console.log(`# ${keys.length} icon(s) -> ${OUT_DIR} (${SIZE}x${SIZE} webp)\n`);
  for (const k of keys) console.log(`  ${k}\n     ${ICON[k]}`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function gen(k) {
  const out = join(OUT_DIR, `${k}.webp`);
  if (!force && await exists(out)) return 'skip';
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({
          image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1',
          n: 1, augment_prompt: false, prompt: ICON[k] + SUFFIX,
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
      await writeFile(out, await sharp(await fetchBuf(url))
        .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 92 }).toBuffer());
      return out;
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await sleep(3000 * a); }
  }
  throw last;
}

console.log(`Generating ${keys.length} HUD stat icon(s) into ${OUT_DIR} ...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try {
    const r = await gen(k);
    if (r === 'skip') { skipped++; console.log('skip (exists)'); }
    else { made++; console.log('OK -> ' + r); await sleep(500); }
  } catch (e) {
    failed++; console.log('FAIL: ' + e.message);
    if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); }
  }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
