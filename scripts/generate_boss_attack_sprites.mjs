#!/usr/bin/env node
// Boss attack-pose generation runner — v0.26.310
// =============================================================================
// For every base boss sprite in Sprites/bosses/<type>.{png,webp}, generates a
// matching attack-pose sprite via Ludo's editImage endpoint — UPLOADING the
// base sprite as a base64 data-URI so the result stays on-model (same
// character, colours, outline) and "doesn't look far off" the idle art.
// Output lands at Sprites/bosses/attack/<type>.webp, which the game's
// _loadBossAttackSprites() loader already expects (currently 404ing).
//
//   node scripts/generate_boss_attack_sprites.mjs                 # dry-run list
//   node scripts/generate_boss_attack_sprites.mjs --only octobaby # one boss
//   node scripts/generate_boss_attack_sprites.mjs --limit 2 --generate
//   node scripts/generate_boss_attack_sprites.mjs --generate      # all (skips existing)
//
// Generate mode requires LUDO_API_KEY. Resumable: skips bosses whose attack
// sprite already exists unless --force.
// =============================================================================
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, '..');
const BOSS_DIR  = join(repoRoot, 'Sprites', 'bosses');
const OUT_DIR   = join(repoRoot, 'Sprites', 'bosses', 'attack');

const argv = process.argv.slice(2);
const has  = (f) => argv.includes(f);
const arg  = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Shared instruction — keep identity, just change to an attacking pose.
const BASE_PROMPT =
  'The EXACT SAME character as the source image, same design, same colours, ' +
  'same thick black outline and cel-shaded painterly style — redrawn in a ' +
  'dynamic mid-attack pose: lunging toward the viewer, mouth open mid-roar, ' +
  'limbs and any weapons flexed outward in an aggressive attacking stance, ' +
  'charging elemental energy and a dramatic presence aura behind it, sense of ' +
  'motion and menace. Full body, single centered character, transparent ' +
  'background, no text, no watermark, no UI.';

// Per-boss overrides (authored in SPRITES_TODO.md) for the two with bespoke prompts.
const OVERRIDES = {
  octobaby:
    'Same character mid-roar — chunky black wraparound shades knocked slightly ' +
    'askew so one glowing magenta eye burns through the side gap, mouth open ' +
    'showing a small fanged maw, eight tentacles flexed outward in a star ' +
    'pattern, four-coloured status orbs (toxic purple, ice cyan, silence amber, ' +
    'shock yellow) charging at each tentacle tip, full storm-cloud aura behind. ' +
    'Keep the identical character design, colours, outline and style as the source.',
  koopaKing:
    'Same character mid-roar — mouth wide open belching a wide diagonal fireball ' +
    'geyser, eyes glowing pure red, both clawed fists raised, crimson mohawk ' +
    'flames stretched tall, full-body ember shockwave halo. Keep the identical ' +
    'character design, spiked orange shell, colours, outline and style as the source.',
};

const mime = (ext) => ext === '.webp' ? 'image/webp' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

// Discover base boss sprites (skip the attack/ subdir + non-art files).
let files = (await readdir(BOSS_DIR, { withFileTypes: true }))
  .filter((d) => d.isFile() && /\.(png|webp)$/i.test(d.name))
  .map((d) => d.name);

const only = arg('--only');
let work = files.map((f) => ({ type: basename(f, extname(f)), file: f, ext: extname(f).toLowerCase() }));
if (only) { const set = new Set(only.split(',')); work = work.filter((w) => set.has(w.type)); }
const limit = arg('--limit');
if (limit) work = work.slice(0, Number(limit));

if (!work.length) { console.error('No matching boss sprites found.'); process.exit(1); }

const promptFor = (type) => OVERRIDES[type] || BASE_PROMPT;

if (!has('--generate')) {
  console.log(`# ${work.length} boss attack poses to generate (source -> output):\n`);
  for (const w of work) {
    console.log(`## ${w.type}  [${OVERRIDES[w.type] ? 'authored' : 'generic'} prompt]`);
    console.log(`   src: Sprites/bosses/${w.file}  ->  Sprites/bosses/attack/${w.type}.webp`);
  }
  console.log(`\n# Re-run with --generate (needs LUDO_API_KEY) to upload each base sprite and generate.`);
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY env var required for --generate.'); process.exit(1); }
const LUDO_API_BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const DELAY_MS = Number(process.env.LUDO_DELAY_MS || 800);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateOne(w) {
  const dest = join(OUT_DIR, `${w.type}.webp`);
  if (!force && await exists(dest)) return { dest, skipped: true };
  const buf = await readFile(join(BOSS_DIR, w.file));
  const dataUri = `data:${mime(w.ext)};base64,${buf.toString('base64')}`;
  const res = await fetch(`${LUDO_API_BASE}/assets/image/edit`, {
    method: 'POST',
    headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUri, prompt: promptFor(w.type), n: 1, augment_prompt: false }),
  });
  if (!res.ok) throw new Error(`Ludo API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
  if (!url) throw new Error(`No image URL: ${JSON.stringify(data).slice(0, 200)}`);
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Image fetch ${imgRes.status}`);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(dest, Buffer.from(await imgRes.arrayBuffer()));
  return { dest, skipped: false };
}

console.log(`Generating ${work.length} boss attack poses (skip-existing: ${!force})...`);
let made = 0, skipped = 0, failed = 0, done = 0;
for (const w of work) {
  process.stdout.write(`[${++done}/${work.length}] ${w.type} ... `);
  try {
    const { dest, skipped: sk } = await generateOne(w);
    if (sk) { skipped++; console.log('skip (exists)'); }
    else { made++; console.log(`OK -> ${dest.replace(repoRoot, '.')}`); if (DELAY_MS) await sleep(DELAY_MS); }
  } catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
