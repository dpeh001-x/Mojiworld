// Every Gravitos fight goes through all three forms (boss all forms, 2026-10-23).
// ============================================================================
// Per user: "when u fight echo gravitos and beat his first form, the game registers that u beaten him without going to form 2 and
// form 3 ... please ensure all fights go through form 1 2 and 3".
// Gravitos's form changes live in killMonster: form 1's "death" turns him into form 2 (Awakened), form 2's into form 3 (Ascendant),
// and only form 3's death is a real kill. That branch (and the curse-hex "not a real death" test beside it) skipped any echo:
// `!m._echoBoss && !m._rushBoss`. Every Echo Keeper summon (the free echo, the Nightmare echo, the Duo Trial) and every Boss Rush
// echo is tagged _echoBoss, so form 1's fall went straight on into the kill: the shade was laid to rest, the Rush counted him
// down and the next echo came - the fight was over after one form.
// Fix: one gate, _lxGravFormsOn(m), for both tests: Gravitos changes form in every fight of him. The forms are the story fight's
// own code path (same HP, stats, art, singularity spacing, one-shot rework, arena collapse in his arena), so nothing about the
// forms themselves changes; the win, its rewards, quest / Rush credit and the defeated flags still come once, from form 3's death.
// The one exception is the prologue's memory (a 30 s scene he cannot lose, tagged an echo by _prologueHardenBoss): unchanged.
// An echo also keeps its "(Echo)" / "(Nightmare)" / "(Duo Trial)" name tag through the form changes.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxGravFormsOn(m)')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const TAG = 'v0.30.1875 boss-all-forms';

// 1) the gate, just above killMonster
once('function killMonster(m) {', J(
  '// ' + TAG + ' - per user ("beat echo gravitos form 1 and the battle just ends ... ensure all fights go through form 1 2 and 3"):',
  '// Gravitos changes form in EVERY fight of him - the story fight, an Echo Keeper echo (free, Nightmare, Duo Trial) and a Boss Rush',
  '// echo. Echoes used to skip the form changes, so form 1\'s fall was the whole fight. Only the prologue\'s memory keeps one form (a',
  '// 30 s scene he cannot lose, tagged an echo by _prologueHardenBoss).',
  'function _lxGravFormsOn(m) { return !!(m && m.type === \'gravitos\' && !m._gravitosFinalForm && !(window._prologueActive && m._echoBoss)); }   // ' + TAG,
  'function killMonster(m) {'), 'killMonster signature');
// 2) the curse hex's "not a real death" test reads the same gate
once("|| (m.type === 'gravitos' && !m._gravitosFinalForm && !m._echoBoss && !m._rushBoss));",
  "|| _lxGravFormsOn(m));   // " + TAG + " - an echo's form change is not a death either", 'curse-hex fake death');
// 3) the form-change branch itself
once("  if (m.type === 'gravitos' && !m._gravitosFinalForm && !m._echoBoss && !m._rushBoss) {",
  "  if (_lxGravFormsOn(m)) {   // " + TAG + " - echoes (Echo Keeper, Nightmare, Duo Trial, Boss Rush) go through all three forms too", 'form-change branch');
// 4) an echo keeps its name tag through the form changes (the forms rename him)
once(J('    const B = m._gravitosBase;', '    if (phase === 1) {'), J(
  '    const B = m._gravitosBase;',
  "    const _lxEchoSfx = m._echoBoss ? ([' (Echo)', ' (Nightmare)', ' (Duo Trial)'].find((t) => String(m.name || '').endsWith(t)) || '') : '';   // " + TAG,
  '    if (phase === 1) {'), 'form base');
once('    // Reset timers / pattern / hazards so the new form starts fresh', J(
  "    if (_lxEchoSfx) m.name += _lxEchoSfx;   // " + TAG + " - the shade stays named a shade",
  '    // Reset timers / pattern / hazards so the new form starts fresh'), 'form reset comment');

const grew = s.length - n0;
if (grew < 900 || grew > 2000) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: boss-all-forms (+' + grew + ' chars)');
