#!/usr/bin/env node
// Replacement candidates for the mage's basic-attack projectile,
// Sprites/projectiles/p_mage_orb.png (skill 'bolt' -> LX_PLAYER_PROJ.mage_orb).
//
// Why: the shipped orb is a smiling CARTOON FACE. In flight it reads as a
// little creature being thrown rather than a spell, and it is the only
// player projectile with a face — p_deathorb, p_comet, p_gale et al are all
// abstract energy. It also spins at 0.35 rad/frame (~3.3 rev/sec, set in
// drawProjectiles), and a face tumbling end-over-end reads as a bug.
//
// Design constraints baked into every prompt:
//   • NO face, eyes or mouth — this is energy, not a creature
//   • ROTATIONALLY interesting but not top-heavy: it spins constantly, so the
//     silhouette must look deliberate at any angle (that is why p_deathorb's
//     swirl works and a face does not)
//   • arcane blue/cyan, matching the muzzle flash (magic_bolt.png) and the
//     '#88bbff' trail particles the bolt already emits
//   • bold flat cartoon + heavy dark outline = the house projectile style
//   • transparent background, centred, generous margin so the spin never clips
//
// Workflow (needs LUDO_API_KEY):
//   node scripts/gen_mage_orb.mjs                      # dry run — prints the plan
//   node scripts/gen_mage_orb.mjs --generate           # N per concept -> scripts/_mage_orb_review/
//   node scripts/gen_mage_orb.mjs --generate --concept rune
//   node scripts/gen_mage_orb.mjs --install rune=2     # chosen -> Sprites/projectiles/p_mage_orb.png
//
// --install writes the PNG the game loads AND the .webp beside it (both exist
// today), backing up the originals to scripts/_mage_orb_review/_backup/ first.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJ = join(repoRoot, 'Sprites', 'projectiles');
const REVIEW = join(repoRoot, 'scripts', '_mage_orb_review');
const CANVAS = 768;
const INNER = Math.round(CANVAS * 0.78);   // margin so a spinning orb never clips its own corners
const N = 3;                                // candidates per concept

const has = (f) => process.argv.includes(f);
const valOf = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

// Shared style contract — identical across concepts so the set is comparable
// and any winner already matches the other player projectiles.
const STYLE =
  'Sprite for a 2D SIDE-SCROLLING platformer, drawn as a flat side-on silhouette (no perspective, ' +
  'no 3/4 view, no depth tilt) to match the existing projectile set. ' +
  'Flat 2D cartoon game sprite, bold clean vector shapes, thick even dark navy outline, ' +
  'crisp cel shading with 2-3 tones, bright saturated arcane blue and cyan with white-hot core, ' +
  'subtle violet accent. Centred on a fully TRANSPARENT background (alpha only, nothing behind it), ' +
  'generous even margin on all four sides, the whole shape fits well inside the frame. ' +
  'CRITICAL: absolutely NO face, NO eyes, NO mouth, NO smile, NO creature, NO character — this is ' +
  'pure magical energy, an inanimate spell projectile. NO text, NO logo, NO drop shadow, NO ground, ' +
  'NO background scenery, NO frame or border, single object only.';

const CONCEPTS = {
  // Closest to a straight upgrade of what ships today: same read at a glance.
  core: 'A compact sphere of condensed arcane energy: a brilliant white-hot core wrapped in ' +
        'layered translucent blue plasma shells, with a few sharp cyan energy shards orbiting ' +
        'tight around the equator. Symmetrical and dense.',
  // Spins beautifully — the swirl reads as motion at every angle.
  swirl: 'A swirling vortex orb of blue arcane energy, spiral arms of cyan and white curling ' +
         'inward toward a bright singular core, like a small magical galaxy. Rotationally ' +
         'symmetric so it looks deliberate while spinning.',
  // Most "wizard": reads as cast magic rather than generic energy.
  rune: 'A glowing blue energy sphere encircled by a thin ring of angular arcane runes and a ' +
        'faint magic-circle glyph band, the runes carved in bright cyan light around a deep ' +
        'blue orb with a luminous centre.',
  // Aggressive silhouette — reads well small and fast.
  spark: 'A crackling ball of blue lightning: a dense luminous core with jagged electric arcs ' +
         'lashing outward in a rough star silhouette, sharp angular bolts in cyan and white ' +
         'over a deep blue plasma sphere.',
};

async function fetchBuf(u) {
  const r = await fetch(u, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// Trim to content, scale into INNER, centre on a transparent CANVAS square —
// the same normalisation the other projectile generators use, so the result
// drops into the existing draw box with no size jump.
async function normalise(raw) {
  let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
  const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  const meta = await sharp(inner).metadata();
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, left: Math.round((CANVAS - meta.width) / 2), top: Math.round((CANVAS - meta.height) / 2) }])
    .png().toBuffer();
}

async function doGenerate() {
  const apiKey = process.env.LUDO_API_KEY;
  if (!apiKey) { console.error('LUDO_API_KEY required for --generate.'); process.exit(1); }
  const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
  await mkdir(REVIEW, { recursive: true });
  const only = valOf('--concept');
  const names = only ? [only] : Object.keys(CONCEPTS);
  for (const name of names) {
    if (!CONCEPTS[name]) { console.error(`unknown concept "${name}"`); continue; }
    const prompt = `${CONCEPTS[name]} ${STYLE}`;
    for (let i = 1; i <= N; i++) {
      const dest = join(REVIEW, `${name}_cand${i}.png`);
      if (!has('--force') && await exists(dest)) { console.log(`skip ${name} cand${i} (exists)`); continue; }
      let ok = false, last;
      for (let a = 1; a <= 3 && !ok; a++) {
        try {
          const res = await fetch(`${API}/assets/image`, {
            method: 'POST',
            headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(180000),
            body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt }),
          });
          if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 160));
          const data = await res.json();
          const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
          if (!url) throw new Error('no url in response');
          await writeFile(dest, await normalise(await fetchBuf(url)));
          console.log(`OK   ${name} cand${i} -> ${dest.replace(repoRoot, '.')}`);
          ok = true;
        } catch (e) { last = e; if (a < 3) await new Promise(s => setTimeout(s, 3000 * a)); }
      }
      if (!ok) console.error(`FAIL ${name} cand${i}: ${last && last.message}`);
    }
  }
  console.log(`\nReview scripts/_mage_orb_review/, then:  node scripts/gen_mage_orb.mjs --install <concept>=<i>`);
}

async function doInstall() {
  const spec = process.argv[process.argv.indexOf('--install') + 1] || '';
  const m = /^([a-z]+)=(\d+)$/.exec(spec);
  if (!m) { console.error('usage: --install <concept>=<candidateIndex>   e.g. --install swirl=2'); process.exit(1); }
  const src = join(REVIEW, `${m[1]}_cand${m[2]}.png`);
  if (!await exists(src)) { console.error('no such candidate: ' + src); process.exit(1); }
  const backup = join(REVIEW, '_backup');
  await mkdir(backup, { recursive: true });
  for (const f of ['p_mage_orb.png', 'p_mage_orb.webp']) {
    if (await exists(join(PROJ, f)) && !await exists(join(backup, f))) await copyFile(join(PROJ, f), join(backup, f));
  }
  const buf = await readFile(src);
  await writeFile(join(PROJ, 'p_mage_orb.png'), buf);
  await writeFile(join(PROJ, 'p_mage_orb.webp'), await sharp(buf).webp({ quality: 92 }).toBuffer());
  console.log(`installed ${m[1]} cand${m[2]} -> Sprites/projectiles/p_mage_orb.{png,webp}  (originals in ${backup.replace(repoRoot, '.')})`);
}

if (has('--install')) await doInstall();
else if (has('--generate')) await doGenerate();
else {
  console.log('# Mage basic-attack orb (Sprites/projectiles/p_mage_orb.png) replacement candidates.');
  console.log('# Current art is a smiling FACE; it spins 0.35 rad/frame in flight.');
  console.log(`# Concepts (${N} candidates each):`);
  for (const [k, v] of Object.entries(CONCEPTS)) console.log(`#   ${k.padEnd(6)} ${v.slice(0, 92)}…`);
  console.log('# 1) node scripts/gen_mage_orb.mjs --generate');
  console.log('# 2) review scripts/_mage_orb_review/*.png');
  console.log('# 3) node scripts/gen_mage_orb.mjs --install <concept>=<i>');
}
