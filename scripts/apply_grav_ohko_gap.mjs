// Gravitos: the gap between one-hit-KOs is strict - nothing the game or the player does can shorten it.
// ============================================================================
// Per user: "for the 3rd form ensure strict time gap of the OHKO, it is still casting back to back".
//
// Measured first (scripts/_grav_ohko_census.mjs - three live form-3 fights, 14 minutes, every warn / cast / lethal
// field / end logged): separate OHKO MOVES were never closer than 25 s after the last one ended. The back-to-back
// casts are the COLLAPSE RAIN'S BOXES - each one a full-screen lethal field with its own veil, countdown and kill -
// and the clock between them was the leaky one:
//   * v0.30.796 put the boxes 4 s apart on the WALL clock (performance.now), spawn to spawn. But a box LIVES on the
//     world's clock: 84 world frames. Hit-stop holds the world (and the box) while the wall clock runs - with a
//     player landing hits a 1.4 s box measured ~2.1 s, so the rest after it shrank to ~1.9 s. A slow phone that
//     simulates 25 frames a second makes the same box last 3.4 s: 0.6 s of rest. At 20 a second the next box spawns
//     BEFORE the last one has resolved - two lethal fields with different shelters, which nobody survives.
//   * a solo PAUSE (menu, inventory) stops the world but not the wall clock: back from a 5 s menu the next box
//     landed on top of the one still counting down.
//   * between moves the gap ran from the CAST, so a long field ate it (a 13-21 s rain out of a 25-28 s window), and
//     game.time - the gap's clock - runs on through a solo pause (v0.30.633 seal-fix had the same bug), so a menu
//     could spend the whole window and the next OHKO greeted the player on the way out.
// Now:
//   1. A rain box never spawns while another lethal field is live, and then only after a REST counted in frames
//      the boss AI actually ran (so hit-stop, lag and pause cannot spend it): 2.6 s in forms 1-2 (the old nominal
//      rest, now guaranteed) and 5 s in FORM 3. The 4 s wall-clock floor stays underneath.
//   2. FORM 3: the OHKO-to-OHKO window (28-58 s / 25-60 s / 30 s by HP tier) runs from the moment the last OHKO
//      ENDED, not from its cast. A lethal field still on screen counts as the OHKO still running, in every form.
//   3. Solo pause: the OHKO stamps move with the clock, like the warn window already did.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) ohko-gap/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, a, b) => { const c = s.split(a).length - 1; if (c !== 1) { console.error('ABORT ' + label + ': matched ' + c + ', expected 1'); process.exit(1); } s = s.split(a).join(b); };

sub('constants', 'const _GRAV_SING_MIN_GAP = 22 * 60;',
  J('const _GRAV_SING_MIN_GAP = 22 * 60;',
    '// v0.30.836 ohko-gap — per user: "for the 3rd form ensure strict time gap of the OHKO, it is still casting back to back".',
    '// The clear air between one Collapse Rain box RESOLVING and the next one APPEARING, counted in frames the boss AI',
    '// actually ran - so hit-stop, a slow device and a pause cannot spend it (the 4 s wall-clock tick could be eaten by',
    '// all three: a box lives on the world clock, the tick ran on the wall clock).',
    'const LX_GRAV_RAIN_REST = 156;      // forms 1-2: 2.6 s - the old nominal rest (4 s tick less the 1.4 s box), now guaranteed',
    'const LX_GRAV_RAIN_REST_F3 = 300;   // form 3: 5 s'));

sub('rain gate', J('      if (m._rainNextAt == null) m._rainNextAt = _rainNow;', '      if (m._rainIdx < RAIN_COUNT && _rainNow >= m._rainNextAt) {'),
  J('      if (m._rainNextAt == null) m._rainNextAt = _rainNow;',
    '      // v0.30.836 ohko-gap — STRICT REST. Never a box while a lethal field is live (two fields with different shelters',
    '      // cannot be survived), and after it resolves a rest counted HERE, one per AI frame - this block does not run in',
    '      // hit-stop or a pause, and runs slower on a slow device, exactly as the box itself does.',
    "      const _rainFieldLive = game.hazards.some((h) => h && h.type === 'gravitos_singularity' && h.life > 0);",
    '      if (_rainFieldLive) m._rainRestF = ((m._gravitosPhase | 0) >= 3) ? LX_GRAV_RAIN_REST_F3 : LX_GRAV_RAIN_REST;',
    '      else if (m._rainRestF > 0) m._rainRestF--;',
    '      if (m._rainIdx === 0) m._rainRestF = 0;   // the first box of a rain owes no rest - the OHKO window has already cleared the air',
    '      if (m._rainIdx < RAIN_COUNT && _rainNow >= m._rainNextAt && !_rainFieldLive && !(m._rainRestF > 0)) {'));

sub('rain cast reset', 'm._rainNextAt = null;   // v0.30.796 sz-all — the real-time clock starts with the pattern',
  'm._rainNextAt = null;   // v0.30.796 sz-all — the real-time clock starts with the pattern' + EOL + '            m._rainRestF = 0;   // v0.30.836 ohko-gap — and so does the rest');

sub('live field is the OHKO still running', '      const _GAP = 8 * 60;   // 8 seconds, in 60-fps frames',
  J('      const _GAP = 8 * 60;   // 8 seconds, in 60-fps frames',
    '      // v0.30.836 ohko-gap — a lethal field still on screen IS the OHKO still running, whatever ended its pattern (an HP-tier',
    '      // change resets the pattern to idle and leaves the field live, with no end stamp).',
    "      if (game.hazards.some((h) => h && h.type === 'gravitos_singularity' && h.life > 0)) m._lastOhkoEndAt = _nowOhko;"));

sub('gap from the end', '      const _ohkoSpaced = (_nowOhko - (m._lastOhkoAt || -999999)) >= _OHKO_GAP;',
  J('      // v0.30.836 ohko-gap — FORM 3: the window runs from the moment the last OHKO ENDED. From the cast, a long field ate it:',
    '      // a rain is 13-21 s of a 25-28 s window. Forms 1-2 keep the cast-based clock they were tuned on.',
    '      const _ohkoFrom = ((m._gravitosPhase | 0) >= 3) ? Math.max(m._lastOhkoAt || -999999, m._lastOhkoEndAt || -999999) : (m._lastOhkoAt || -999999);',
    '      const _ohkoSpaced = (_nowOhko - _ohkoFrom) >= _OHKO_GAP;'));

sub('pause', '_sfM._ohkoWarnUntil > _sfT) _sfM._ohkoWarnUntil++; }',
  "_sfM._ohkoWarnUntil > _sfT) _sfM._ohkoWarnUntil++; if (_sfM && _sfM.type === 'gravitos') { if (_sfM._lastOhkoAt != null) _sfM._lastOhkoAt++; if (_sfM._lastOhkoEndAt != null) _sfM._lastOhkoEndAt++; if (_sfM._lastSkillAt != null) _sfM._lastSkillAt++; if (_sfM._lastSingAt != null) _sfM._lastSingAt++; } }   /* v0.30.836 ohko-gap — the OHKO gap does not run out behind a menu */");

const grew = s.length - n0;
if (grew < 1800 || grew > 4400) { console.error('ABORT: size moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) { console.error('ABORT: tmp small'); process.exit(1); }
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: ohko-gap (+' + grew + ' chars)');
