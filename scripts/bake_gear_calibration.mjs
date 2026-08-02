// Bake a Gear Align export into data/gear_calibration.js.
//
//   node scripts/bake_gear_calibration.mjs <exported.js> [--dry]
//
// The export is a full `window.LX_EQ_ATTACH_DATA = {...}` snapshot of every
// calibrated sprite, so this REPLACES the table wholesale rather than merging.
// It prints an added/removed/changed diff first, then writes atomically
// (tmp -> node --check -> rename) per the file-safety rules in CLAUDE.md.
import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const [srcPath, ...flags] = process.argv.slice(2);
const DRY = flags.includes('--dry');
if (!srcPath) { console.error('usage: bake_gear_calibration.mjs <exported.js> [--dry]'); process.exit(1); }

const TARGET = 'data/gear_calibration.js';
const FIELDS = ['scale', 'dx', 'dy', 'rot', 'flipX', 'flipY', 'scaleX', 'scaleY'];

// Evaluate a `window.LX_EQ_ATTACH_DATA = {...}` file in a sandbox.
const evalTable = (code, label) => {
  const sandbox = { window: {} };
  try { vm.runInNewContext(code, sandbox, { timeout: 5000 }); }
  catch (e) { console.error(`${label}: failed to evaluate — ${e.message}`); process.exit(1); }
  const t = sandbox.window.LX_EQ_ATTACH_DATA;
  if (!t || typeof t !== 'object') { console.error(`${label}: no LX_EQ_ATTACH_DATA object`); process.exit(1); }
  return t;
};

const oldSrc = readFileSync(TARGET, 'utf8');
const newSrc = readFileSync(srcPath, 'utf8');
const oldT = evalTable(oldSrc, 'current');
const newT = evalTable(newSrc, 'export');

// ---- Validate before touching anything -------------------------------------
const bad = [];
for (const [k, v] of Object.entries(newT)) {
  if (!/^(wpn|arm):[a-z0-9_]+$/.test(k)) bad.push(`${k}: malformed key`);
  if (!v || typeof v !== 'object') { bad.push(`${k}: not an object`); continue; }
  for (const f of Object.keys(v)) if (!FIELDS.includes(f)) bad.push(`${k}: unknown field '${f}'`);
  for (const f of ['scale', 'dx', 'dy', 'rot']) {
    if (typeof v[f] !== 'number' || !Number.isFinite(v[f])) bad.push(`${k}: ${f} is not a finite number`);
  }
  for (const f of ['flipX', 'flipY']) if (f in v && typeof v[f] !== 'boolean') bad.push(`${k}: ${f} is not a boolean`);
  for (const f of ['scaleX', 'scaleY']) {
    if (f in v && (typeof v[f] !== 'number' || !Number.isFinite(v[f]) || v[f] <= 0)) bad.push(`${k}: ${f} invalid`);
  }
  if (typeof v.scale === 'number' && (v.scale <= 0 || v.scale > 8)) bad.push(`${k}: scale ${v.scale} out of range`);
  if (typeof v.rot === 'number' && Math.abs(v.rot) > Math.PI * 2 + 1e-9) bad.push(`${k}: rot ${v.rot} out of range`);
}
if (bad.length) { console.error('REFUSING TO BAKE — invalid entries:\n  ' + bad.join('\n  ')); process.exit(1); }

// ---- Diff ------------------------------------------------------------------
const oldKeys = new Set(Object.keys(oldT)), newKeys = new Set(Object.keys(newT));
const added = [...newKeys].filter(k => !oldKeys.has(k));
const removed = [...oldKeys].filter(k => !newKeys.has(k));
const changed = [];
for (const k of [...newKeys].filter(x => oldKeys.has(x))) {
  const a = oldT[k], b = newT[k], deltas = [];
  for (const f of FIELDS) {
    const av = a[f], bv = b[f];
    if (av === bv) continue;
    if (av === undefined && bv === undefined) continue;
    const fmt = x => x === undefined ? '-' : (typeof x === 'number' ? +x.toFixed(4) : x);
    deltas.push(`${f} ${fmt(av)} -> ${fmt(bv)}`);
  }
  if (deltas.length) changed.push({ k, deltas });
}

console.log(`current ${oldKeys.size} entries -> export ${newKeys.size} entries`);
if (added.length)   console.log(`\nADDED (${added.length}):\n  ` + added.join('\n  '));
if (removed.length) console.log(`\nREMOVED (${removed.length}):\n  ` + removed.join('\n  '));
if (changed.length) {
  console.log(`\nCHANGED (${changed.length}):`);
  for (const c of changed) console.log(`  ${c.k}\n      ${c.deltas.join('\n      ')}`);
}
if (!added.length && !removed.length && !changed.length) console.log('\nNo differences — the export matches what is already baked.');
if (DRY) { console.log('\n--dry: nothing written.'); process.exit(0); }

// ---- Write atomically ------------------------------------------------------
// Keep the existing header comment; replace only the data object.
const headerEnd = oldSrc.indexOf('window.LX_EQ_ATTACH_DATA');
if (headerEnd < 0) { console.error('could not locate the data object in ' + TARGET); process.exit(1); }
const header = oldSrc.slice(0, headerEnd);

const lines = ['window.LX_EQ_ATTACH_DATA = {'];
for (const k of Object.keys(newT)) {
  const v = newT[k];
  const ordered = {};
  for (const f of FIELDS) if (f in v) ordered[f] = v[f];
  lines.push(`  '${k}': ${JSON.stringify(ordered)},`);
}
lines.push('};', '');
const out = header + lines.join('\n');

// Must keep a .js extension: `node --check` rejects unknown extensions, so a
// bare `.tmp` makes the verify step fail and the bake refuse to write.
// Same directory as the target so the rename stays atomic (same filesystem).
const tmp = 'data/_gear_calibration.bake.tmp.js';
writeFileSync(tmp, out, 'utf8');
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  const back = evalTable(readFileSync(tmp, 'utf8'), 'baked');
  if (Object.keys(back).length !== newKeys.size) throw new Error('entry count mismatch after write');
  for (const k of newKeys) {
    for (const f of FIELDS) {
      if ((newT[k][f] === undefined) !== (back[k][f] === undefined)) throw new Error(`${k}.${f} presence changed`);
      if (newT[k][f] !== back[k][f]) throw new Error(`${k}.${f} value changed`);
    }
  }
} catch (e) {
  try { unlinkSync(tmp); } catch (_) {}
  console.error('VERIFY FAILED, target untouched — ' + e.message);
  process.exit(1);
}
renameSync(tmp, TARGET);
console.log(`\nBaked ${newKeys.size} entries to ${TARGET} (verified, atomic).`);
