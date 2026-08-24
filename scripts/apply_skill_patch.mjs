#!/usr/bin/env node
// Bake a patch from tools/skill_tuner.html into the SKILLS table.
//   node scripts/apply_skill_patch.mjs 'LX_SKILL_PATCH:1 {"warlord_warcry":{"cd":21000}}'
//   node scripts/apply_skill_patch.mjs --check '<patch>'     # report, write nothing
//
// Only `cd` and `mp` are patchable, because those are the only per-skill
// numbers that exist as fields. Damage is computed inside each skill's own
// function, at different times and through different paths, so there is nothing
// here to edit for it - see the note in the tuner.
//
// Same contract as apply_anim_patch.mjs: declarative for the ids it names,
// every other skill untouched, and the write is atomic (tmp + rename) because
// mojiworld_game.html is 8 MB and a failed in-place write has zeroed it before.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(ROOT, 'mojiworld_game.html');
const argv = process.argv.slice(2);
const check = argv.includes('--check');
const raw = argv.filter((a) => a !== '--check').join(' ').trim();

if (!raw) {
  console.error('Usage: node scripts/apply_skill_patch.mjs [--check] \'LX_SKILL_PATCH:1 {...}\'');
  process.exit(1);
}
const m = raw.match(/LX_SKILL_PATCH:1\s*([\s\S]+)$/);
if (!m) { console.error('Not an LX_SKILL_PATCH:1 blob.'); process.exit(1); }

let patch;
try { patch = JSON.parse(m[1]); } catch (e) { console.error('Bad JSON: ' + e.message); process.exit(1); }
const ids = Object.keys(patch);
if (!ids.length) { console.error('Patch is empty.'); process.exit(1); }

let src = await readFile(GAME, 'utf8');
const lines = src.split('\n');
const start = lines.findIndex((l) => /^const SKILLS = \{/.test(l));
if (start < 0) { console.error('SKILLS table not found.'); process.exit(1); }
let end = lines.length;
for (let i = start + 1; i < lines.length; i++) if (/^\};/.test(lines[i])) { end = i; break; }

let changed = 0, skipped = 0;
for (const id of ids) {
  const want = patch[id] || {};
  const fields = Object.keys(want).filter((k) => k === 'cd' || k === 'mp');
  if (!fields.length) { console.log('  ' + id + ' — nothing patchable (only cd and mp are fields)'); skipped++; continue; }

  // find this skill's single line inside SKILLS
  let li = -1;
  for (let i = start; i <= end; i++) {
    if (new RegExp('^\\s{2}' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*\\{').test(lines[i])) { li = i; break; }
  }
  if (li < 0) { console.log('  ' + id + ' — NOT FOUND in SKILLS, skipped'); skipped++; continue; }

  let L = lines[li], touched = [];
  for (const f of fields) {
    const v = Math.round(Number(want[f]));
    if (!isFinite(v) || v < 0) { console.log('  ' + id + '.' + f + ' — bad value, skipped'); continue; }
    const re = new RegExp('(\\b' + f + ':\\s*)(\\d+)');
    const hit = L.match(re);
    if (!hit) { console.log('  ' + id + '.' + f + ' — no existing ' + f + ' field, skipped'); continue; }
    if (+hit[2] === v) continue;                     // already that value
    touched.push(f + ' ' + hit[2] + '->' + v);
    L = L.replace(re, '$1' + v);
  }
  if (!touched.length) { skipped++; continue; }
  lines[li] = L;
  changed++;
  console.log('  ' + id + '  ' + touched.join(', '));
}

if (!changed) { console.log('Nothing to change.'); process.exit(0); }

const out = lines.join('\n');
// guard: the file must not shrink meaningfully — a botched regex is how 8 MB
// becomes 0 bytes, and this file has been zeroed twice by failed writes.
if (out.length < src.length * 0.99) {
  console.error('ABORT: output shrank from ' + src.length + ' to ' + out.length + ' bytes.');
  process.exit(1);
}
if (check) { console.log('\n--check: ' + changed + ' skill(s) would change, ' + skipped + ' skipped. Nothing written.'); process.exit(0); }

await writeFile(GAME + '.tmp', out, 'utf8');
await rename(GAME + '.tmp', GAME);
console.log('\nBaked ' + changed + ' skill(s), ' + skipped + ' skipped.');
console.log('Now: extract <script> and run node --check before committing.');
