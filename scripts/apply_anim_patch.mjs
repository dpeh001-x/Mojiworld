#!/usr/bin/env node
// Hardbake a single-monster calibration patch into anim_calib.js.
// The patch comes from the animator's "Copy patch" button (a small JSON blob
// tagged LX_ANIM_PATCH:1 with the selected entity's calib + attack hitboxes).
//   node scripts/apply_anim_patch.mjs '<patch json>'
//   node scripts/apply_anim_patch.mjs patch.json
// Semantics: the patch is DECLARATIVE for its entity — the entity's calib
// block is replaced (pure-default states are dropped to keep the bake
// minimal), and its hitbox block is replaced, or removed when the patch has
// no hitbox key (the animator always emits hitboxes that exist). All other
// entities are untouched. Atomic write + node --check before replacing.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CALIB = join(root, 'anim_calib.js');

const arg = process.argv[2];
if (!arg) { console.error('usage: apply_anim_patch.mjs <patch-json-or-file>'); process.exit(2); }
const raw = existsSync(arg) ? readFileSync(arg, 'utf8') : arg;
let patch;
try { patch = JSON.parse(raw); } catch (e) { console.error('patch is not valid JSON:', e.message); process.exit(2); }
if (patch.LX_ANIM_PATCH !== 1 || !patch.type || !patch.calib) {
  console.error('not an LX_ANIM_PATCH v1 blob (need LX_ANIM_PATCH:1, type, calib)'); process.exit(2);
}
const t = patch.type;

const src = readFileSync(CALIB, 'utf8');
const m = src.match(/^([\s\S]*?)window\.LX_ANIM_CALIB = (\{[\s\S]*?\});\nwindow\.LX_ATK_HITBOX = (\{[\s\S]*?\});\n?$/);
if (!m) { console.error('anim_calib.js did not match the expected shape'); process.exit(1); }
const header = m[1];
const calib = JSON.parse(m[2]);
const hitbox = JSON.parse(m[3]);

const isDefault = v => +v.s === 1 && +v.dx === 0 && +v.dy === 0;
const entity = {};
for (const [st, v] of Object.entries(patch.calib)) {
  const e = { s: +v.s, dx: +v.dx, dy: +v.dy };
  if (!isDefault(e)) entity[st] = e;
}
const before = JSON.stringify({ c: calib[t] || null, h: hitbox[t] || null });
if (Object.keys(entity).length) calib[t] = entity; else delete calib[t];
if (patch.hitbox && Object.keys(patch.hitbox).length) hitbox[t] = patch.hitbox; else delete hitbox[t];
const after = JSON.stringify({ c: calib[t] || null, h: hitbox[t] || null });

const out = header + 'window.LX_ANIM_CALIB = ' + JSON.stringify(calib, null, 2) + ';\n'
  + 'window.LX_ATK_HITBOX = ' + JSON.stringify(hitbox, null, 2) + ';\n';
const tmp = CALIB + '.patchtmp.js';
writeFileSync(tmp, out);
execFileSync('node', ['--check', tmp]);
renameSync(tmp, CALIB);
console.log(`baked ${t}:`);
console.log('  before:', before);
console.log('  after: ', after);
