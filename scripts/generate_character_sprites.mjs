#!/usr/bin/env node
// Character sprite generation runner — v0.25.326
// =============================================================================
// Drives the 36 hair / eyes / mouth Ludo prompts from one manifest. Modes:
//
//   node scripts/generate_character_sprites.mjs                 # dry-run print
//   node scripts/generate_character_sprites.mjs --json          # JSON manifest
//   node scripts/generate_character_sprites.mjs --layer hair    # filter
//   node scripts/generate_character_sprites.mjs --id flow,spiky # filter
//   node scripts/generate_character_sprites.mjs --generate      # call Ludo
//
// Generate mode requires LUDO_API_KEY in env. Each prompt is composed with the
// SIDE_PREFIX ("Side facing 40% to the right...") so every authored sprite
// matches the chibi's default right-facing idle pose. Output WebPs land at
// Sprites/character/<layer>/<filename>.
//
// The dry-run / JSON modes are safe and fast — use them to sanity-check the
// composed prompts before paying for 36 generations. Use --layer or --id to
// regenerate a single sprite without re-running the whole batch.
// =============================================================================
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTRIES, composePrompt, SIDE_PREFIX } from './character_sprites.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, '..');

const argv = process.argv.slice(2);
const has  = (flag) => argv.includes(flag);
const arg  = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };

const layerFilter = arg('--layer');
const idFilter    = arg('--id');
const mode = has('--generate') ? 'generate' : has('--json') ? 'json' : 'dry-run';

let work = ENTRIES.slice();
if (layerFilter) work = work.filter(e => e.layer === layerFilter);
if (idFilter) {
  const ids = idFilter.split(',').map(s => s.trim());
  work = work.filter(e => ids.includes(e.id));
}

if (!work.length) {
  console.error('No entries match the filters.');
  process.exit(1);
}

if (mode === 'dry-run') {
  console.log(`# Composed prompts (${work.length} entries) — side prefix: "${SIDE_PREFIX.trim()}"\n`);
  for (const e of work) {
    console.log(`## ${e.layer}/${e.filename}`);
    console.log(composePrompt(e));
    console.log('');
  }
  console.log(`# ${work.length} prompts shown. Re-run with --generate to call Ludo.`);
  process.exit(0);
}

if (mode === 'json') {
  const out = work.map(e => ({
    layer: e.layer,
    id: e.id,
    filename: e.filename,
    targetPath: `Sprites/character/${e.layer}/${e.filename}`,
    prompt: composePrompt(e),
  }));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

// ---- generate mode ----
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) {
  console.error('LUDO_API_KEY env var is required for --generate mode.');
  console.error('Get one at https://ludo.ai and run: LUDO_API_KEY=... node scripts/generate_character_sprites.mjs --generate');
  process.exit(1);
}

const LUDO_API_BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/v1';

async function generateOne(entry) {
  const prompt = composePrompt(entry);
  const res = await fetch(`${LUDO_API_BASE}/images`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_type: 'sprite',
      art_style: 'Anime/Manga',
      aspect_ratio: 'ar_1_1',
      n: 1,
    }),
  });
  if (!res.ok) throw new Error(`Ludo API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // Ludo's response shape: { images: [{ url: "..." }] } — adjust here if the
  // server returns a different shape (the MCP tool wraps the same endpoint).
  const url = data?.images?.[0]?.url || data?.url || data?.[0]?.url;
  if (!url) throw new Error(`No image URL in Ludo response: ${JSON.stringify(data).slice(0, 200)}`);
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Image fetch ${imgRes.status} for ${url}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const dest = join(repoRoot, 'Sprites', 'character', entry.layer, entry.filename);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return dest;
}

console.log(`Generating ${work.length} sprites...`);
let done = 0, failed = 0;
for (const e of work) {
  process.stdout.write(`[${++done}/${work.length}] ${e.layer}/${e.filename} ... `);
  try {
    const dest = await generateOne(e);
    console.log(`OK -> ${dest.replace(repoRoot, '.')}`);
  } catch (err) {
    failed++;
    console.log(`FAIL: ${err.message}`);
  }
}
console.log(`Done. ${done - failed} ok, ${failed} failed.`);
process.exit(failed ? 2 : 0);
