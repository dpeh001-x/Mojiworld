// Bake a Gear Align "Export Erase" block into data/gear_erase.js.
//
//   node scripts/bake_gear_erase.mjs <exported.js> [--dry]
//   node scripts/bake_gear_erase.mjs -            [--dry]     (read stdin)
//
// The sibling of bake_gear_calibration.mjs, which data/gear_erase.js never had.
// That gap is not cosmetic: gear_calibration.js had a script and stayed current,
// while gear_erase.js was last baked 2026-07-28 with 40 armors and exactly ONE
// weapon, because its documented procedure was "paste the copied block over this
// file and commit it" — a hand edit on a 3 MB generated file that nobody reaches
// for. Per user, weapon/armor outline edits were made and their tester still saw
// the original art: the edits were still in localStorage, which is per-origin,
// so they existed on exactly one machine.
//
// The export is a FULL snapshot — the overlay merges the baked file with live
// localStorage before copying (live wins, a cleared sprite is dropped) — so this
// REPLACES the table wholesale rather than merging, exactly like the calibration
// bake. It diffs first, then writes atomically (tmp -> node --check -> rename)
// per the file-safety rules in CLAUDE.md, which matter here more than most: the
// target is megabytes and a half-written one is a silently art-less game.
import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const [srcPath, ...flags] = process.argv.slice(2);
const DRY = flags.includes('--dry');
if (!srcPath) {
  console.error('usage: bake_gear_erase.mjs <exported.js|-> [--dry]');
  process.exit(1);
}
const TARGET = 'data/gear_erase.js';

const evalTable = (code, label) => {
  const sandbox = { window: {} };
  try { vm.runInNewContext(code, sandbox, { timeout: 20000 }); }
  catch (e) { console.error(`${label}: failed to evaluate — ${e.message}`); process.exit(1); }
  const t = sandbox.window.LX_EQ_ERASE_DATA;
  if (!t || typeof t !== 'object') { console.error(`${label}: no LX_EQ_ERASE_DATA object`); process.exit(1); }
  return t;
};

const newSrc = (srcPath === '-') ? readFileSync(0, 'utf8') : readFileSync(srcPath, 'utf8');
const oldSrc = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : 'window.LX_EQ_ERASE_DATA = {};';
const oldT = evalTable(oldSrc, 'current');
const newT = evalTable(newSrc, 'export');

// ---- Validate before touching anything -------------------------------------
// Every value is a WebP data-URL of the cleaned sprite. A truncated clipboard
// paste is the realistic failure here, and it produces a string that still looks
// broadly right — so the prefix and a plausible length are both checked.
const bad = [];
for (const [k, v] of Object.entries(newT)) {
  if (!/^(wpn|arm):[a-z0-9_]+$/.test(k)) { bad.push(`${k}: malformed key`); continue; }
  if (typeof v !== 'string') { bad.push(`${k}: not a string`); continue; }
  if (!/^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(v)) bad.push(`${k}: not a base64 image data-URL`);
  else if (v.length < 500) bad.push(`${k}: data-URL is only ${v.length} chars — truncated paste?`);
}
if (!Object.keys(newT).length) bad.push('the export is empty — nothing to bake');
if (bad.length) { console.error('REFUSING TO BAKE — invalid entries:\n  ' + bad.join('\n  ')); process.exit(1); }

// ---- Diff (keys and sizes only; never dump the base64) ----------------------
const oldKeys = new Set(Object.keys(oldT)), newKeys = new Set(Object.keys(newT));
const added = [...newKeys].filter((k) => !oldKeys.has(k));
const removed = [...oldKeys].filter((k) => !newKeys.has(k));
const changed = [...newKeys].filter((k) => oldKeys.has(k) && oldT[k] !== newT[k]);
const kb = (s) => (s.length / 1024).toFixed(0) + ' KB';

console.log(`current ${oldKeys.size} entries -> export ${newKeys.size} entries`);
if (added.length)   console.log(`\nADDED (${added.length}):\n  ` + added.map((k) => `${k}  ${kb(newT[k])}`).join('\n  '));
if (removed.length) console.log(`\nREMOVED (${removed.length}):\n  ` + removed.join('\n  '));
if (changed.length) console.log(`\nCHANGED (${changed.length}):\n  ` + changed.map((k) => `${k}  ${kb(oldT[k])} -> ${kb(newT[k])}`).join('\n  '));
if (!added.length && !removed.length && !changed.length) {
  console.log('\nNo difference — the export matches what is already baked.');
  console.log('If you expected your edits here, the export was almost certainly taken from a');
  console.log('DIFFERENT ORIGIN than the one you edited on. localStorage does not travel between');
  console.log('http://localhost:8765, file:// and raw.githack — export from the origin you edited on.');
  process.exit(DRY ? 0 : 2);
}
if (DRY) { console.log('\n--dry: nothing written.'); process.exit(0); }

// ---- Atomic write ----------------------------------------------------------
// The header comment DOCUMENTS this file's own format, so it contains the
// literal string `window.LX_EQ_ERASE_DATA` on line 6. A plain indexOf finds
// that mention, not the assignment, and splices the new assignment into the
// middle of a comment line — every entry then lands at top level and the file
// dies on "Unexpected token ':'". Match the assignment at the start of a line.
const assignAt = oldSrc.search(/^window\.LX_EQ_ERASE_DATA\s*=/m);
const header = assignAt > 0 ? oldSrc.slice(0, assignAt) : '';
let out = header;
if (out && !out.endsWith('\n')) out += '\n';
out += 'window.LX_EQ_ERASE_DATA = {\n';
for (const k of Object.keys(newT)) out += '  ' + JSON.stringify(k) + ': ' + JSON.stringify(newT[k]) + ',\n';
out += '};\n';

const tmp = TARGET + '.tmp';
writeFileSync(tmp, out, 'utf8');
try {
  // node --check refuses a .tmp extension, so validate a .js-named copy
  const probe = TARGET + '.checkme.js';
  writeFileSync(probe, out, 'utf8');
  try { execFileSync(process.execPath, ['--check', probe], { stdio: 'pipe' }); }
  finally { try { unlinkSync(probe); } catch (e) {} }
  const back = readFileSync(tmp, 'utf8');
  if (back.length !== out.length) throw new Error('readback size mismatch');
  if (evalTable(back, 'readback') && Object.keys(evalTable(back, 'readback')).length !== newKeys.size) {
    throw new Error('readback entry count mismatch');
  }
} catch (e) {
  try { unlinkSync(tmp); } catch (e2) {}
  console.error('REFUSING TO BAKE — ' + e.message);
  process.exit(1);
}
renameSync(tmp, TARGET);
console.log(`\nbaked ${newKeys.size} entries -> ${TARGET} (${(out.length / 1048576).toFixed(2)} MB)`);
console.log('Now commit data/gear_erase.js (stage that explicit path — see CLAUDE.md).');
