// arbiter-verdict-calib, the calibration half (the pipeline's LX_APPLY2; runs AFTER the LX_EXTRA files are re-synced from origin).
// Per user: "calibrate the verdict sprites such that the foot is in the same position as the idle". Measured in the game (both
// facings, every frame): the Tower Arbiter's verdict pose (attack/towerArbiterverdict, the sword held inverted) drew his boots
// ~40 px BEHIND where his idle stands - same size, same feet line, but the whole figure sat one boot-length back, so switching
// idle -> verdict slid him backwards and verdict -> idle slid him forward again. His walk stood ~13 px ahead of the idle the
// same way (its art is the idle's canvas, feet at the same spot; only its x nudge differed), so it is aligned too. His swing,
// pillar and lunge already stand in the idle's footprints (<= 2 px) and are not touched.
// The fix is CALIBRATION ONLY: data/anim_calib.js x nudges (dx, a fraction of his drawn height), baked the project's way - one
// LX_ANIM_PATCH:1 blob per entity through scripts/apply_anim_patch.mjs. Sizes (s), feet lines (dy), frame timings (ft) and hit
// boxes are kept. No art, manifest or cache change: data/anim_calib_manifest.js describes the art (unchanged) and sw.js serves
// .js network-first.
// GUARDED PER STATE: each listed (entity, state) must hold EITHER the old s/dx/dy (then it is patched) OR the new one (already
// applied); anything else means someone recalibrated it on origin since - abort before writing. Everything else in the entity
// (other states, fs/ft, its hit boxes) is carried over from the CURRENT file, so a parallel change elsewhere in the same entity
// is kept, and checked unchanged after the bake (restored + abort if not).
// Idempotent. LX_ASSET_ROOT points it at a mirror of the repo (testing without touching the working copy).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const ROOT = process.env.LX_ASSET_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (v) => JSON.stringify(v === undefined ? null : v);
const atomic = (f, data) => {
  fs.writeFileSync(f + '.tmp', data);
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { fs.renameSync(f + '.tmp', f); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing on ' + f + ': ' + lastErr.code);
};
// [entity, state, old {s,dx,dy}, new {s,dx,dy}] - measured by scripts/arbiter_verdict_calib_test.mjs's foot read-out (see the
// header of scripts/apply_arbiter_verdict_calib.mjs for the numbers)
const CAL = [
  ['towerArbiterverdict', 'attack', { s: 1.9895, dx: 0.0975, dy: 0.0024 }, { s: 1.9895, dx: 0.1632, dy: 0.0024 }],
  ['towerArbiter', 'walk', { s: 0.9956, dx: 0.0664, dy: 0.0149 }, { s: 0.9956, dx: 0.045, dy: 0.0149 }],
];
const calF = path.join(ROOT, 'data', 'anim_calib.js');
if (!fs.existsSync(calF)) die('data/anim_calib.js missing');
const read = () => { const s = fs.readFileSync(calF, 'utf8'), a = s.indexOf('window.LX_ANIM_CALIB = '), b = s.indexOf('window.LX_ATK_HITBOX = ');
  if (a < 0 || b < 0) die('data/anim_calib.js: unexpected shape');
  return { src: s, calib: JSON.parse(s.slice(a + 23, b).trim().replace(/;$/, '')), hitbox: JSON.parse(s.slice(b + 22).trim().replace(/;\s*$/, '')) }; };
const sdd = (v) => (v ? { s: +v.s, dx: +v.dx, dy: +v.dy } : null);
const same = (a, b) => !!a && !!b && a.s === b.s && a.dx === b.dx && a.dy === b.dy;
const before = read();
const todo = new Map();   // entity -> [[state, new]]
for (const [ent, st, ov, nv] of CAL) {
  const cur = sdd(before.calib[ent] && before.calib[ent][st]);
  if (same(cur, nv)) { console.log('anim_calib.js: ' + ent + '.' + st + ' already calibrated'); continue; }
  if (!same(cur, ov)) die('anim_calib.js: ' + ent + '.' + st + ' is ' + J(cur) + ', neither the old ' + J(ov) + ' nor the new ' + J(nv) + ' - re-measure on the current values');
  if (!todo.has(ent)) todo.set(ent, []);
  todo.get(ent).push([st, nv]);
}
if (!todo.size) { console.log('arbiter-verdict-calib calibration: already applied'); process.exit(0); }
const PATCHER = path.join(ROOT, 'scripts', 'apply_anim_patch.mjs');
if (!fs.existsSync(PATCHER)) die('scripts/apply_anim_patch.mjs missing');
// a pure-default state ({1,0,0}, no fs / ft) is a no-op the patcher drops - compare without them
const norm = (blk) => { const o = {}; for (const [k, v] of Object.entries(blk || {})) if (!(+v.s === 1 && +v.dx === 0 && +v.dy === 0 && !v.fs && !v.ft)) o[k] = v; return o; };
for (const [ent, list] of todo) {
  const cal = JSON.parse(J(before.calib[ent])), hb = before.hitbox[ent] ? JSON.parse(J(before.hitbox[ent])) : null;
  for (const [st, nv] of list) Object.assign(cal[st], nv);   // only s/dx/dy move; fs / ft / ftAuto ride along
  const blob = Object.assign({ LX_ANIM_PATCH: 1, type: ent, calib: cal }, hb ? { hitbox: hb } : {});
  const bf = path.join(ROOT, 'scripts', '_arbiter_verdict_calib_patch_' + ent + '.json');
  fs.writeFileSync(bf, J(blob));
  try { execFileSync(process.execPath, [PATCHER, bf], { cwd: ROOT, stdio: 'pipe' }); }
  catch (e) { atomic(calF, before.src); die('apply_anim_patch.mjs failed for ' + ent + ': ' + String(e.stderr || e.message).slice(0, 200)); }
  finally { try { fs.unlinkSync(bf); } catch (e) {} }
  const after = read();
  const okEnt = J(norm(after.calib[ent])) === J(norm(cal)) && J(after.hitbox[ent] || null) === J(hb);
  const others = Object.keys(Object.assign({}, before.calib, after.calib)).filter((k) => k !== ent).every((k) => J(after.calib[k]) === J(before.calib[k]))
    && Object.keys(Object.assign({}, before.hitbox, after.hitbox)).filter((k) => k !== ent).every((k) => J(after.hitbox[k]) === J(before.hitbox[k]));
  if (!okEnt || !others) { atomic(calF, before.src); die('anim_calib.js: ' + ent + ' did not take the patch cleanly (restored) ' + J(after.calib[ent]).slice(0, 200)); }
  before.calib = after.calib; before.hitbox = after.hitbox;
  console.log('anim_calib.js: ' + ent + ' ' + list.map(([st, nv]) => st + ' -> ' + J(nv)).join(', '));
}
console.log('arbiter-verdict-calib calibration: baked');
