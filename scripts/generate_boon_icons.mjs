#!/usr/bin/env node
// Boon (POWERUPS) icons — clean frame-less sticker emblems (ludo.ai).
// Output -> Sprites/boons/<id>.png (256). Wired via _boonIconUrl()/boonIconHtml().
//   node scripts/generate_boon_icons.mjs            # dry-run
//   node scripts/generate_boon_icons.mjs --only crit --generate
//   node scripts/generate_boon_icons.mjs --generate # all (skip-existing)  flags: --force --only a,b
// Needs LUDO_API_KEY.
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'boons');
const SIZE = 256;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const PREFIX = 'A die-cut STICKER of the SUBJECT described below — the object/symbol ITSELF as a transparent-PNG game-icon sprite with a clean cutout edge and nothing behind it. ' +
  'This is NOT an app icon and NOT on a square tile or card: ABSOLUTELY NO rounded-square, NO tile, NO card, NO frame, NO border, NO panel, NO background fill or gradient, NO ground, NO scene, NO person or character. FULLY TRANSPARENT background (alpha only). ' +
  'Clean simple chibi-anime game-icon style: bold simple shapes with a thin EVEN ~2px solid BLACK outline (uniform weight, NOT thick or chunky), vibrant flat colors, light cel shading, a soft glow. ' +
  'Centered, about 82% of the square image. ABSOLUTELY NO TEXT: no letters, numbers, words or watermark. Subject: ';

// id (POWERUPS id) -> concrete subject
const BOON = {
  atk_p:  'a strong flexed muscular arm showing a big bicep, with a small power-spark',
  atk:    'a single sharp steel sword blade pointing up, with a bright edge glint',
  def:    'a sturdy knight shield with a metal trim and a small shine',
  maxhp:  'a glossy glowing red heart',
  maxmp:  'a glowing blue mana orb / crystal with an inner sparkle',
  crit:   'a single sharp eye with a bright targeting glint, aimed and focused',
  critd:  'a heavy impact burst with a cracked star-shaped flash, sharp and violent',
  spd:    'a fast winged running boot with little speed streaks',
  jmp:    'a coiled spring with an upward arrow above it',
  ls:     'a deep-red blood droplet with a small vampire fang, life-drain theme',
  burn:   'a bright orange flame',
  multi:  'three arrows fanned outward from one point',
  mpreg:  'a swirling blue mana vortex with a circular regen arrow around it',
  thorns: 'a coiled green thorny vine with sharp spikes',
  eco:    'a small pile of shiny gold coins with a sparkle',
  xp:     'an open book with a glowing star rising from its pages',
  tjump:  'three upward arrows stacked over a small feather, triple-jump theme',
  acc:    'a fierce eagle head in profile with a sharp focused eye',
  cdSkip: 'a bright yellow lightning bolt overlapping a small clock, fast-cooldown theme',
  lowg:   'a single soft white feather floating gently with a faint upward glow',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(BOON);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching boons.'); process.exit(1); }
if (!has('--generate')) {
  console.log(`# ${keys.length} boon icons -> Sprites/boons/<id>.png (${SIZE}x${SIZE})\n`);
  for (const k of keys) console.log('  ' + k);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only a,b');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gen(k) {
  const bp = join(OUT_DIR, `${k}.png`);
  if (!force && await exists(bp)) return 'skip';
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + BOON[k] + '.' }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 140)); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(bp, await sharp(await fetchBuf(url)).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
      return 'OK';
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await sleep(3000 * a); }
  }
  throw last;
}

console.log(`Generating ${keys.length} boon icons (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await gen(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(350); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
