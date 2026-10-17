// boss-lag-ios: boss_set_pin_test's check [8] learns that an iPhone-class budget now keeps Gravitos's form 3 whole at DPR 2.5.
// [8] asserted the pre-bands rule ("his form 3 (169M px) cannot be kept whole under the cap - released down to 0.8x as before");
// with boss frames stored as their inked bands the form is ~60M px of canvas and fits the unchanged 100M px pin cap, so the trim
// keeps it and holds the rest to the line (pinned + half the budget = 2.0x here). Run by the ship chain AFTER the file is re-synced
// from origin (LX_EXTRA), so the edit lands on origin's copy. One exact-line swap, count-guarded; idempotent; LF/CRLF preserved.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const abort = (m) => { console.error('ABORT ' + m); process.exit(1); };
const F = path.join(DIR, 'boss_set_pin_test.mjs');
const raw = readFileSync(F, 'utf8'); const crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
const OLD = "  check(w8.loaded === w8.n && r8.gone.g3 > 0 && r8.after <= 0.8 && r8.after > 0.7, '[8] iPhone at DPR 2.5: his form 3 (169M px) cannot be kept whole under the cap - released down to 0.8x as before', { w8, r8 });";
const NEW = "  { const b8 = await P.p.evaluate(() => ({ bands: typeof _LX_BAND_ON !== 'undefined' && _LX_BAND_ON === true, kept: _lxCvUseStamp() > 0 })); check(w8.loaded === w8.n && b8.bands && b8.kept && !r8.gone.g3 && r8.gone.misc > 0 && r8.after > 1.9 && r8.after <= 2.05, '[8] iPhone at DPR 2.5: his form 3 is kept whole (band-stored frames, boss-lag-ios) - the rest trimmed to the line (2.0x), the pool under the 2.5x pin cap', { w8, r8, b8 }); }";
if (s.includes(NEW)) { console.log('boss_set_pin_test.mjs: already applied'); process.exit(0); }
const c = s.split(OLD).length - 1;
if (c !== 1) abort('boss_set_pin_test.mjs / [8] check: matched ' + c + ', expected 1');
s = s.replace(OLD, () => NEW);
writeFileSync(F + '.tmp', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) abort('rename kept failing: ' + lastErr.code);
}
console.log('boss_set_pin_test.mjs: patched ([8] kept whole with band-stored frames)');
