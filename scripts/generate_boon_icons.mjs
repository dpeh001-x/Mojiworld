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

// Some subjects (a sword, an eye) are so strongly associated with classic
// game-icon tiles that the model paints a rounded-square badge behind them
// even though PREFIX forbids it — crit and atk both came back framed twice.
// STUBBORN reframes the request as a physical vinyl sticker photographed on
// nothing, which breaks that association, and names the failure explicitly.
const STUBBORN = 'A single physical die-cut VINYL STICKER, floating alone on a FULLY TRANSPARENT alpha background — ' +
  'like a sticker peeled off its sheet with nothing behind it. The ONLY thing in the image is the subject shape itself. ' +
  'CRITICAL: do NOT paint any square, rounded-square, circle, badge, tile, card, plaque, panel, medallion, button or coloured backdrop behind the subject. ' +
  'The area around the subject must be EMPTY / transparent — not dark blue, not navy, not teal, not white, not any colour. ' +
  'Style: clean chibi-anime game art, bold simple shapes, thin even ~2px solid black outline, vibrant flat colours, light cel shading, thin white sticker rim around the silhouette. ' +
  'Centered, about 82% of the frame. NO TEXT of any kind. The sticker subject is: ';
// Per-id prompt override for the two that keep coming back framed.
const PREFIX_FOR = { crit: STUBBORN, atk: STUBBORN, diagslash: STUBBORN };   // v0.29.351 — diagslash came back with a frame-corner artifact on the plain PREFIX

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
  // v0.29.298 boons — added with the roster so the art pipeline stays complete.
  chain:  'a jagged yellow-white lightning bolt forking into two branches that arc apart, electric storm theme',
  freeze: 'a pale blue crystalline snowflake with sharp icy facets and a cold glow',
  // v0.29.344 action boons. v0.29.347 shipped stopgap icons via the
  // Higgsfield fallback (no key that session); v0.29.351 regenerated all six
  // through THIS canonical pipeline per user "redo using ludo.ai, high
  // quality cel-shaded". Subjects were enriched for dynamic angles + layered
  // cel shading — the flat first-pass reads were the complaint.
  flamedash: 'a sleek winged leather boot mid-sprint at a dynamic three-quarter angle, powerful orange and gold flames streaming off its heel in layered tongues, ember sparks in its wake, strong two-tone cel shading with a warm rim light',
  blink:     'a luminous teleport portal ring of swirling cyan and violet energy seen at a slight tilt, spiral arms wrapping into a bright white core, small arcane runes and sparks orbiting it, deep indigo shadow bands and electric highlights',
  novastep:  'an explosive orange shockwave starburst with a white-hot core, layered jagged rays of fire bursting outward over a thin expanding ring, tiny debris shards flying, bold impact-frame energy with crisp cel shade steps',
  diagslash: 'a gleaming longsword captured mid-swing on a steep diagonal, a curved arc of white-blue slash energy trailing the blade edge, motion speed-lines, polished steel with hard cel-shaded reflections and a cold rim light',
  echo:      'three overlapping ghostly crescent slash arcs in fading shades of violet, the front arc sharp and bright with spectral white edge-light, the two behind progressively dimmer and more transparent, small spirit wisps drifting off them',
  bloom:     'a stylised sakura blossom bursting open, curved pink petals flying outward from a glowing magenta heart with a four-point gold sparkle, each petal with a darker underside and bright cel-shaded top, petals caught mid-spin',
  // v0.29.355 — Tier-1 boon roster (docs/design/boon_ideas_v2.md). Art is
  // generated AHEAD of the mechanics per user "lets work on tier 1, create
  // the VFX sprites and icons" — these ids are therefore the BINDING ids the
  // POWERUPS entries must use when each boon is implemented. Riposte reuses
  // the nova_ring FX for its blast; the icon here is its shield identity.
  waltz:     'an elegant golden pocket watch mid-dissolve, its face breaking into swirling ribbons of cyan time-energy with tiny clock ticks and two small music notes caught in the swirl, cool blue glow with crisp cel shade bands',
  mirror:    'an ornate standing mirror with a crack down the glass, a bright cyan ghost-flame stepping out of the reflection leaving a fading translucent copy inside, indigo shadows and cold rim light',
  crescendo: 'three ascending golden music notes, the third and largest note exploding into a bright four-point crit star with sharp impact sparks and speed lines, warm gold cel shading over deep amber shadows',
  execute:   'a heavy dark executioner axe blade falling edge-down, wicked crimson energy searing along the cutting edge and a small white skull-shaped spark at the tip, black steel with hard red rim light',
  riposte:   'a round knight shield angled mid-deflect, a bright orange shockwave ring bursting off its face with sharp recoil sparks flying back, polished steel boss and layered cel-shaded highlights',
  skin:      'a translucent teal hexagonal energy barrier shell, one hex panel flashing brilliant white as it absorbs a strike, small deflection sparks and a faint inner glow, glassy cel-shaded facets',
  rampage:   'a fierce rising aura of layered red-orange fury flames with three stacked white chevron arrows climbing inside it, each flame band a crisp cel shade step, embers streaming upward',
  goldblood: 'a large faceted golden droplet splashing down into a burst of small gold coins, a deep red gleam at the droplet core, rich metallic cel shading with bright coin glints',
  overflow:  'an industrial brass pressure-valve wheel bursting open, a crackling crimson energy arc jetting out sideways under pressure, steam wisps and rivets, warm metal tones with hard shadows',
  doppel:    'two overlapping violet arcane spell circles casting the same bright spark, the front circle sharp and luminous, the back circle a fading ghost copy slightly offset, mystic runes around both rims',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(BOON);
// --only is EXACT by default. It used to prefix-match, so `--only crit,atk`
// silently also regenerated critd and atk_p (two already-correct icons).
// Opt into prefix matching explicitly with a trailing '*', e.g. `--only atk*`.
const only = arg('--only');
if (only) keys = keys.filter((k) => only.split(',').some((o) => (o.endsWith('*') ? k.startsWith(o.slice(0, -1)) : k === o)));
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
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: (PREFIX_FOR[k] || PREFIX) + BOON[k] + '.' }),
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
