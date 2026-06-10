#!/usr/bin/env node
// Equipment sprite import helper — v0.25.304
// =============================================================================
// Scans Sprites/character/<slot>/ for new equipment sprites and prints
// ready-to-paste JS into stdout. You hand-edit *content*, never wiring.
//
// Usage:    node scripts/import_equipment_sprites.mjs
//           node scripts/import_equipment_sprites.mjs cape           # one slot
//           node scripts/import_equipment_sprites.mjs cape body_top  # several
//
// What it does:
//   1. Walks each LX_EQ slot folder under Sprites/character/.
//   2. Lists *.webp / *.png that are NOT placeholders (README.md, .gitkeep).
//   3. For each slot with sprites, prints the inner `files` object that
//      should be pasted INSIDE the call to _lxEqRegistry(slotFolder) in
//      mojiworld_game.html — i.e. the keys of the registry.
//   4. Also prints a sample item-definition block per slot so you can
//      copy-paste a quick test item.
//
// The script does not modify mojiworld_game.html — it's a pure printer.
// =============================================================================
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, '..');

// Slot list mirrors LX_EQ_REGISTRIES in mojiworld_game.html. Keep in sync if
// new slots are added.
const SLOTS = ['body_top', 'body_bottom', 'cape', 'gloves', 'boots', 'weapon', 'helmet'];

// CLI args: optional list of slots to scan. Defaults to all.
const argv = process.argv.slice(2).map(s => s.toLowerCase());
const target = argv.length ? SLOTS.filter(s => argv.includes(s)) : SLOTS;

if (!target.length) {
  console.error(`Unknown slot(s): ${argv.join(', ')}.`);
  console.error(`Valid slots: ${SLOTS.join(', ')}.`);
  process.exit(1);
}

// Filename → spriteId. lowercase, drop ext, snake_case.
function spriteIdOf(filename) {
  const base = filename.replace(/\.(webp|png|jpg|jpeg|gif)$/i, '');
  return base
    .replace(/[A-Z]+/g, m => '_' + m.toLowerCase())   // CamelCase → _camel_case
    .replace(/[^a-z0-9_]+/g, '_')                     // sanitise
    .replace(/^_+|_+$/g, '')                          // trim leading / trailing _
    .replace(/_+/g, '_');                             // collapse runs
}

// Pretty title from a sprite id.
function titleOf(id) {
  return id.split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

let printedAny = false;

for (const slot of target) {
  const dir = join(repoRoot, 'Sprites', 'character', slot);
  let files = [];
  try { files = readdirSync(dir); }
  catch (e) {
    console.error(`# slot ${slot}: folder missing (${dir})`);
    continue;
  }
  // Filter to art only — webp / png. Skip README, .gitkeep, dotfiles.
  const sprites = files.filter(f => {
    if (f.startsWith('.') || f.toLowerCase() === 'readme.md') return false;
    return /\.(webp|png|jpg|jpeg|gif)$/i.test(f);
  }).sort();
  if (!sprites.length) continue;

  printedAny = true;
  // Header
  console.log(`// ── ${slot} (${sprites.length} sprite${sprites.length === 1 ? '' : 's'}) ────────────────────────`);
  // v0.25.307 — Print the full _lxEqRegistry call ready to paste,
  // replacing the existing LX_<SLOT> declaration in mojiworld_game.html.
  console.log(`const LX_${slot.toUpperCase()} = _lxEqRegistry(${JSON.stringify(slot)}, {`);
  for (const f of sprites) {
    const id = spriteIdOf(f);
    const cleanIdent = /^[a-z][a-z0-9_]*$/.test(id);
    const comment = cleanIdent ? '' : `  // ⚠ check id`;
    console.log(`  ${id}: ${JSON.stringify(f)},${comment}`);
  }
  console.log(`});\n`);

  // Sample item-definition block — picker-friendly + ready to drop into
  // the equipment table.
  console.log(`// Sample item definitions for the ${slot} sprites above.`);
  console.log(`// Edit names / stats / tints to taste.`);
  console.log(`const _SAMPLE_${slot.toUpperCase()}_ITEMS = [`);
  for (const f of sprites) {
    const id = spriteIdOf(f);
    const itemId = `${slot}_${id}`;
    console.log(`  { id: ${JSON.stringify(itemId)}, name: ${JSON.stringify(titleOf(id))}, slot: ${JSON.stringify(slot)}, spriteId: ${JSON.stringify(id)}, tint: null },`);
  }
  console.log(`];\n`);
}

if (!printedAny) {
  console.log(`# No sprites found in any of: ${target.join(', ')}.`);
  console.log(`# Drop authored sprites into Sprites/character/<slot>/ and re-run.`);
  console.log(`# See EQUIPMENT_TEMPLATE.md at repo root for the canvas spec.`);
}
