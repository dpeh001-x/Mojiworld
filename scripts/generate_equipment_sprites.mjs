#!/usr/bin/env node
// Equipment sprite generation runner — v0.25.812
// =============================================================================
// Drives all 121 equipment prompts from Equipment_Sprite_Prompts.docx (sourced
// from tools/_equip_rows.json + the exact buildPrompt() that authored the docx)
// through the Ludo image API. Modes:
//
//   node scripts/generate_equipment_sprites.mjs                 # dry-run print
//   node scripts/generate_equipment_sprites.mjs --json          # JSON manifest
//   node scripts/generate_equipment_sprites.mjs --cat W         # filter W/A/C
//   node scripts/generate_equipment_sprites.mjs --limit 3       # first N only
//   node scripts/generate_equipment_sprites.mjs --generate      # call Ludo
//
// Generate mode requires LUDO_API_KEY in env. Output PNG/WebPs land at
// Sprites/equipment/<weapons|armors|accessories>/<slug>.<ext>. Re-running skips
// files that already exist unless --force is passed (cheap resume after a
// partial batch — you never pay twice for the same icon).
//
// The dry-run / JSON modes are safe and free — use them to sanity-check the
// composed prompts and target paths before paying for 121 generations.
// =============================================================================
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DATA, buildPrompt } = require('../tools/gen_equip_prompts.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, '..');

const argv = process.argv.slice(2);
const has  = (flag) => argv.includes(flag);
const arg  = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };

const CAT_DIR = { W: 'weapons', A: 'armors', C: 'accessories' };

// name → filesystem slug. MUST match the game's _itemKey() in
// mojiworld_game.html so itemIconHtml() resolves these sprites: strip
// apostrophes FIRST (Assassin's Edge → assassins_edge), then non-alnum →
// underscore, collapse + trim.
const slugify = (name) => name.toLowerCase()
  .replace(/['’‘]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');

// Build the work manifest from the same data that authored the docx.
let work = DATA.map((row) => {
  const [cat, tier, rarity, cls, name] = row;
  const slot = CAT_DIR[cat];
  const slug = slugify(name);
  return {
    cat, tier, rarity, cls, name, slot, slug,
    prompt: buildPrompt(row),
    targetPath: `Sprites/equipment/${slot}/${slug}.webp`,
  };
});

const catFilter = arg('--cat');
if (catFilter) work = work.filter((e) => e.cat === catFilter.toUpperCase());
const limit = arg('--limit');
if (limit) work = work.slice(0, Number(limit));

if (!work.length) { console.error('No entries match the filters.'); process.exit(1); }

// Collision guard — two different items must never map to the same file.
const seen = new Map();
for (const e of work) {
  if (seen.has(e.targetPath)) {
    console.error(`Slug collision: "${e.name}" and "${seen.get(e.targetPath)}" both -> ${e.targetPath}`);
    process.exit(1);
  }
  seen.set(e.targetPath, e.name);
}

const mode = has('--generate') ? 'generate' : has('--json') ? 'json' : 'dry-run';

if (mode === 'dry-run') {
  console.log(`# Composed equipment prompts (${work.length} entries)\n`);
  for (const e of work) {
    console.log(`## [${e.cat}] T${e.tier} ${e.name} -> ${e.targetPath}`);
    console.log(e.prompt);
    console.log('');
  }
  console.log(`# ${work.length} prompts shown. Re-run with --generate to call Ludo.`);
  process.exit(0);
}

if (mode === 'json') {
  console.log(JSON.stringify(work, null, 2));
  process.exit(0);
}

// ---- generate mode ----
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) {
  console.error('LUDO_API_KEY env var is required for --generate mode.');
  console.error('Get one at https://ludo.ai, then run (PowerShell):');
  console.error('  $env:LUDO_API_KEY="sk-..."; node scripts/generate_equipment_sprites.mjs --generate');
  process.exit(1);
}
const LUDO_API_BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
// Ludo image-gen knobs (from the official OpenAPI spec). item-icon + Cel-Shaded
// matches the docx global style ("clean cel-shaded fantasy game art", inventory
// icon). Override via env without touching the script.
const IMAGE_TYPE = process.env.LUDO_IMAGE_TYPE || 'item-icon';
const ART_STYLE  = process.env.LUDO_ART_STYLE  || 'Cel-Shaded';
const PERSPECTIVE = process.env.LUDO_PERSPECTIVE || 'Any perspective';

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

async function generateOne(entry) {
  const dest = join(repoRoot, entry.targetPath);
  if (!force && await exists(dest)) return { dest, skipped: true };
  const res = await fetch(`${LUDO_API_BASE}/assets/image`, {
    method: 'POST',
    headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_type: IMAGE_TYPE,
      prompt: entry.prompt,
      art_style: ART_STYLE,
      perspective: PERSPECTIVE,
      aspect_ratio: 'ar_1_1',
      n: 1,
      augment_prompt: false,
    }),
  });
  if (!res.ok) throw new Error(`Ludo API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  // POST /assets/image returns an array of ImageResult: [{ url, request_id, ... }]
  const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
  if (!url) throw new Error(`No image URL in response: ${JSON.stringify(data).slice(0, 200)}`);
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Image fetch ${imgRes.status} for ${url}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return { dest, skipped: false };
}

// Beta rate limit: 1 simultaneous request per endpoint. Sequential already
// honours that; a small inter-call delay further reduces 429 risk on the full
// 121 run. Tune via LUDO_DELAY_MS (only applied after a real API hit).
const DELAY_MS = Number(process.env.LUDO_DELAY_MS || 800);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Generating ${work.length} equipment sprites (skip-existing: ${!force})...`);
let done = 0, made = 0, skipped = 0, failed = 0;
for (const e of work) {
  process.stdout.write(`[${++done}/${work.length}] ${e.slot}/${e.slug} ... `);
  try {
    const { dest, skipped: sk } = await generateOne(e);
    if (sk) { skipped++; console.log('skip (exists)'); }
    else { made++; console.log(`OK -> ${dest.replace(repoRoot, '.')}`); if (DELAY_MS) await sleep(DELAY_MS); }
  } catch (err) { failed++; console.log(`FAIL: ${err.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
