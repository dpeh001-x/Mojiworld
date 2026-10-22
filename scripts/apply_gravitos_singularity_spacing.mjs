// Gravitos: strict spacing for the Singularity one-shot, and a lock that can never trap you in one (per user:
// "Gravitos at all forms does OHKO singularity attack way too quickly, there needs to be strict spacing, also need to strictly
// space with celestial lock if not players are unable to escape", then "gravitos singularity on all forms need a strict gap,
// minimum 30s at the last form, longer for the earlier forms").
// ============================================================================
// What the player saw (measured in live fights against his own AI, scripts/gravitos_singularity_spacing_test.mjs):
//  - Singularity casts came 42 s apart in form 1 and closer in later forms; the floor (22 s from cast, v0.29.830) was the same
//    in every form and a form change kept him "ready", so the new form could open on one a few seconds in.
//  - The boss lock (the arrow-key QTE - "Gravity Bind" on Gravitos, the "celestial lock" in the report) ran on its own 12-18 s
//    clock with no idea a one-shot was coming: it landed during the Singularity warning and inside its 5.5 s field, and inside
//    Collapse Rain boxes (1.4 s each). A locked hero cannot move for 3.6 s (up to 5.1 s with wrong keys), so most of those
//    fields could not be escaped at all.
// What changes (all on the fight clock, game.time steps - 60 a second, hit-stop and slow-mo do not shorten it, a solo pause
// does not spend it):
//  (1) Singularity gap, one rule nothing bypasses: no Singularity warning until _GRAV_SING_GAP_S[form] seconds after the last
//      Singularity was CAST (form 1 50 s, form 2 40 s, form 3 30 s). The stamp lives on the boss and survives form changes,
//      HP tiers and timers. Plus a first-cast delay: none in the first _GRAV_SING_FIRST_S (20 s) of the fight or of a new form.
//  (2) The lock never begins while a one-shot is warned, running or its field is up, nor within 1.5 s after one ends, nor
//      when a one-shot is due within one lock plus the escape time; a lock already in flight when a one-shot starts fizzles.
//  (3) No one-shot is warned while a lock holds the hero, while one is being thrown, or until LX_GS_ESCAPE_F (4.7 s - the
//      slowest hero's walk from the farthest floor spot to the nearest shelter, plus 1 s to react) after it ends.
//  (4) Co-op: all of it is host-side (guests run no boss AI); a lock the host throws at a partner counts as a full lock, and a
//      guest refuses a lock that would land while a lethal field is up on its screen.
// Untouched: damage, hazard geometry and timing, the warn lengths, the rotation, the regular attacks (they fill the gaps).
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxGsSingOk(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); if (/[^\x09\x0a\x0d\x20-\x7e]/.test(b.split(a).join(''))) die(what + ': non-ASCII in the insert'); s = s.replace(a, () => b); };
const T = 'v0.30.1852 gravitos-singularity-spacing';

// (1) constants + helpers, after the Collapse Rain rest constants
{
  const A = 'const LX_GRAV_RAIN_REST_F3 = 300;   // form 3: 5 s';
  once(A, J(A,
    `// ${T} - per user: "Gravitos at all forms does OHKO singularity attack way too quickly, there needs to be strict spacing, also need to`,
    '// strictly space with celestial lock if not players are unable to escape", then "gravitos singularity on all forms need a strict gap, minimum 30s',
    '// at the last form, longer for the earlier forms". Every stamp below is game.time (the fixed 60 Hz fight clock: hit-stop and slow-mo do not',
    '// shorten it, a solo pause shifts it like the other OHKO stamps), kept on the boss so a form change, an HP tier or a timer never resets it.',
    `const _GRAV_SING_GAP_S = { 1: 50, 2: 40, 3: 30 };   // ${T} - least time from one Singularity CAST to the next one's warning, by form`,
    `const _GRAV_SING_FIRST_S = 20;   // ${T} - no Singularity in the first 20 s of the fight or of a new form (his title card, then room to fight)`,
    `const LX_GS_ESCAPE_SPEED = 2.1;   // ${T} - px per step: base walk 3.5 x warrior 0.80 x MOVE_SPEED_SCALE 0.75, the slowest unbuffed hero`,
    `const LX_GS_ESCAPE_FAR_PX = 460;   // ${T} - farthest floor spot from its nearest shelter: x 1040 (left of the centre vent) with shelter 2 rolled`,
    '                                   //   left-most (ends 592) and shelter 4 right-most (starts 1440) - 448 px, rounded up',
    `const LX_GS_ESCAPE_F = Math.ceil(LX_GS_ESCAPE_FAR_PX / LX_GS_ESCAPE_SPEED) + 60;   // ${T} - 280 steps (4.7 s): that walk plus 1 s to react`,
    `const LX_GS_LOCK_HOLD_F = Math.ceil((3600 + 1500) / (1000 / 60));   // ${T} - 306: a landed lock's 3.6 s plus the most wrong keys can add`,
    `const LX_GS_LOCK_MAX_F = LX_GS_LOCK_HOLD_F + 51;   // ${T} - 357: and its 850 ms telegraph`,
    `const LX_GS_LOCK_PRE_F = LX_GS_LOCK_MAX_F + LX_GS_ESCAPE_F;   // ${T} - 637 (10.6 s): no lock begins this close to a due one-shot`,
    `const LX_GS_LOCK_POST_F = 90;   // ${T} - nor in the 1.5 s after one ends`,
    `function _lxGsOhkoLive(m) {   // ${T} - a one-shot warned, running, or a lethal field still up`,
    "  if (m._ohkoWarnUntil != null || m.patternState === 'singularity' || m.patternState === 'collapseRain' || m.patternState === 'soulDrain') return true;",
    "  const hz = game.hazards; if (hz) for (let i = 0; i < hz.length; i++) { const h = hz[i]; if (h && h.type === 'gravitos_singularity' && h.life > 0) return true; }",
    '  return false;',
    '}',
    `function _lxGsStamp(m) {   // ${T} - once a step (bossAI and the lock try both call it): the fight / form start, the last one-shot step, the last locked step`,
    '  const now = game.time | 0; if (m._gsStampT === now) return; m._gsStampT = now;',
    '  const form = (m._gravitosPhase | 0) || 1;',
    '  if (m._gsForm !== form) { m._gsForm = form; m._gsFormAt = now; }',
    '  if (_lxGsOhkoLive(m)) m._gsOhkoEndAt = now;',
    "  if (typeof _QTE !== 'undefined' && _QTE.active) m._gsLockEndAt = Math.max(m._gsLockEndAt == null ? -1e9 : m._gsLockEndAt, now);",
    '}',
    `function _lxGsSingWait(m, now) {   // ${T} - steps until the Singularity's own floors open (0 = open)`,
    '  const form = (m._gravitosPhase | 0) || 1, gap = (_GRAV_SING_GAP_S[form] || _GRAV_SING_GAP_S[3]) * 60;',
    '  const a = (m._gsSingAt == null) ? 0 : m._gsSingAt + gap - now, b = (m._gsFormAt == null) ? _GRAV_SING_FIRST_S * 60 : m._gsFormAt + _GRAV_SING_FIRST_S * 60 - now;',
    '  return Math.max(0, a, b);',
    '}',
    `function _lxGsSingOk(m, now) { _lxGsStamp(m); return _lxGsSingWait(m, now) <= 0; }   // ${T}`,
    `function _lxGsLockClear(m, now) {   // ${T} - no one-shot warning while the hero is locked, a lock is in flight, or before they could reach a shelter`,
    "  if ((typeof _QTE !== 'undefined' && _QTE.active) || m._shackleTele != null) return false;",
    '  return m._gsLockEndAt == null || now - m._gsLockEndAt >= LX_GS_ESCAPE_F;',
    '}',
    `function _lxGsDue(m, now, winAt, phase) {   // ${T} - earliest step any one-shot could be warned (the lock keeps clear of it)`,
    '  const st = (t) => Math.max(0, (t || 0) / ((1000 / 60) * 1.3));   // the one-shot timers run on bossAI\'s x1.30 clock',
    '  let ready = Math.max(st(m._instaTimer), _lxGsSingWait(m, now), (m._lastSingAt != null) ? m._lastSingAt + _GRAV_SING_MIN_GAP - now : 0);',
    '  if (phase >= 2) ready = Math.min(ready, st(m._rainTimer));',
    '  ready = Math.min(ready, st(m._soulTimer));',
    '  const skill = (m._lastSkillAt != null) ? m._lastSkillAt + 8 * 60 - now : 0;',
    '  return now + Math.ceil(Math.max(0, winAt - now, ready, skill));',
    '}',
    `function _lxGsLockHold(m) {   // ${T} - _qteShackleTry: true = no lock now (its cooldown waits). A lock in flight when a one-shot starts fizzles.`,
    '  _lxGsStamp(m);',
    '  const now = game.time | 0, live = _lxGsOhkoLive(m);',
    '  if (m._shackleTele != null) {',
    '    if (!live) return false;',
    '    m._shackleTele = null; m._shackleTgt = null; m._shackleCd = 12000 + Math.random() * 6000;',
    "    if (player && player.hp > 0) for (let i = 0; i < 6; i++) game.particles.push({ x: player.x + player.w / 2 + (Math.random() - 0.5) * 40, y: player.y + player.h / 2 + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 1.5, vy: -0.6 - Math.random(), life: 14, color: '#6f6394', size: 2 });",
    '    return true;',
    '  }',
    '  if (live) return true;',
    '  if (m._gsOhkoEndAt != null && now - m._gsOhkoEndAt < LX_GS_LOCK_POST_F) return true;',
    '  return m._gsDueAt != null && m._gsDueAt - now < LX_GS_LOCK_PRE_F;',
    '}'), 'constants anchor');
}

// (2) bossAI: the stamps run every Gravitos step
{
  const A = "_lxGravTpTick(m, _rawDt);   // v0.30.x grav-tp";
  const i = s.indexOf(A); if (i < 0) die('tp anchor'); const e = s.indexOf(EOL, i);
  const line = s.slice(s.lastIndexOf(EOL, i) + EOL.length, e);
  once(line + EOL, J(line, `    _lxGsStamp(m);   // ${T}`, ''), 'grav-tp line');
}
// (3) the gates: the Singularity's floors join _singOk (the picker falls through to Rain / Drain), the lock gate joins the OHKO window
once('const _singOk = (_nowOhko - (m._lastSingAt || -999999)) >= _GRAV_SING_MIN_GAP;',
  `const _singOk = (_nowOhko - (m._lastSingAt || -999999)) >= _GRAV_SING_MIN_GAP && _lxGsSingOk(m, _nowOhko);   // ${T} - + the per-form gap and the first-cast delay`, '_singOk');
once('const _ohkoSpaced = (_nowOhko - _ohkoFrom) >= _OHKO_GAP;',
  `const _ohkoSpaced = (_nowOhko - _ohkoFrom) >= _OHKO_GAP && _lxGsLockClear(m, _nowOhko);   // ${T} - never while the hero is locked, nor before they can run`, '_ohkoSpaced');
{
  const A = '                         (m._soulTimer  <= 0));';
  once(A, J(A, `      m._gsDueAt = _lxGsDue(m, _nowOhko, _ohkoFrom + _OHKO_GAP, phase);   // ${T} - what the lock keeps clear of`), '_ohkoReady tail');
}
{
  const A = 'm._lastSingAt = _nowOhko;   // v0.29.830';
  once(A, `m._gsSingAt = _nowOhko; ${A}`, 'cast stamp');
}
// (4) the lock
{
  const A = 'm._shackleCd = 8000 + Math.random() * 5000;  // grace window at fight start';
  const i = s.indexOf(A); if (i < 0) die('shackle anchor'); const e = s.indexOf(EOL, i);
  const line = s.slice(s.lastIndexOf(EOL, i) + EOL.length, e);
  once(line + EOL, J(line, `  if (m.type === 'gravitos' && !m._coopMirror && _lxGsLockHold(m)) return;   // ${T} - held clear of every one-shot (host and partner locks alike)`, ''), 'shackle cd line');
}
once("_lxBossExec('qteLock', { to, u: m.uid });",
  `{ _lxBossExec('qteLock', { to, u: m.uid }); if (m.type === 'gravitos') m._gsLockEndAt = (game.time | 0) + LX_GS_LOCK_HOLD_F; }   /* ${T} - a partner's lock counts as a full one */`, 'peer send');
once('    _qteShackleStart(src);', J(
  `    if (src.type === 'gravitos' && ((game.hazards || []).some((h) => h && h.type === 'gravitos_singularity' && h.life > 0) || src.patternState === 'singularity' || src.patternState === 'collapseRain' || src.patternState === 'soulDrain')) return false;   // ${T} - never into a one-shot on my screen`,
  '    _qteShackleStart(src);'), 'guest qteLock');
// (5) solo pause: the new stamps move with the clock, as the ohko-gap ones do
{
  const A = '/* v0.30.836 ohko-gap — the OHKO gap does not run out behind a menu */';
  const i = s.indexOf(A); if (i < 0) die('pause anchor'); const e = s.indexOf(EOL, i);
  if (s.slice(i + A.length, e).trim() !== '') die('pause anchor not at line end');
  s = s.slice(0, e) + EOL + `    if (_sfMs) for (const _sfM of _sfMs) if (_sfM && _sfM.type === 'gravitos') { for (const _k of ['_gsSingAt', '_gsFormAt', '_gsOhkoEndAt', '_gsLockEndAt', '_gsDueAt', '_gsStampT']) if (_sfM[_k] != null) _sfM[_k]++; }   /* ${T} - its stamps do not run out behind a menu */` + s.slice(e);
}

const grew = s.length - n0;
if (grew < 6000 || grew > 11000) die('size moved ' + grew);
const marks = [...s.matchAll(/v0\.30\.(?:x|\d+) gravitos-singularity-spacing/g)].length;   // the ship chain retags x to the real version, here and in this file
if (marks !== 25) die('markers ' + marks);
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
console.log('applied: gravitos-singularity-spacing (+' + grew + ' chars, ' + marks + ' marks)');
