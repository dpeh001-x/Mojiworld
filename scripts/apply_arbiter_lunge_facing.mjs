// The Arbiter's lunge turned him round to face away from the hero (arbiter lunge facing, 2026-10-16).
// ============================================================================
// Per user: "arbiter lunge facing wrong direction".
// His lunge (traits.hourglassCharge: a 2.4 s brace, then a 360 px eased dash over 700 ms, then a ~170 ms settle) plays its own
// nine-frame set, authored facing RIGHT like every other Arbiter set and mirrored by the boss draw when m.facing < 0 - the art and
// the mirror are both right, and a lunge in open floor faced the hero all the way. The fault is in the monster physics: the
// world-edge clamp for walking mobs (`if (m.x + m.w > worldWidth) { m.x = ...; m.facing = -1; }`, and `facing = 1` at x < 0)
// turns a mob round when it is pushed past an edge - right for a patrol, wrong mid-lunge. The lunge re-asserts its velocity every
// step, so a dash that reaches a wall keeps pressing into it and the clamp turns him round on every step. His court (tower_b5) is
// only 1400 px wide and the dash is 360 px, so any lunge at a hero standing near either wall did this: measured in the game, a
// lunge at a hero to his right reached the wall after 87 px and from then on the charge frames, the settle and the idle after it
// were drawn mirrored - facing away from the hero and from his own travel - and he stayed turned away, because a hero 56 px in
// front of him sits inside the 70 px band where the boss AI does not re-face. Separately, a lunge that carried him past the hero
// turned him round on the first settle frame (the boss AI re-faces the moment the lunge ends), so the settle of a forward lunge
// played facing backwards.
//   Fix: right after the clamp, the direction the lunge locked at its brace (_hgDir) is put back while the lunge runs, and for the
//   two bosses whose settle frames draw after it (the Arbiter, the Sovereign) through that settle. The boss AI turns him toward the
//   hero after it as before. The brace was already locked (the AI writes it each step and the body stands still). No art, no
//   calibration and no other state changes; every other mob's wall turn is unchanged.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('arbiter-lunge-facing - THE LUNGE OWNS HIS FACING')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// the walking-mob world-edge clamp (the flier branch has its own and is untouched)
{
  const A = J(
    "      if (m.x < 0) { m.x = 0; m.facing = 1; }",
    "      if (m.x + m.w > game.mapData.worldWidth) { m.x = game.mapData.worldWidth - m.w; m.facing = -1; }",
    "      checkPlatformCollision(m);");
  once(A, J(
    "      if (m.x < 0) { m.x = 0; m.facing = 1; }",
    "      if (m.x + m.w > game.mapData.worldWidth) { m.x = game.mapData.worldWidth - m.w; m.facing = -1; }",
    "      // v0.30.1791 arbiter-lunge-facing - THE LUNGE OWNS HIS FACING (per user: \"arbiter lunge facing wrong direction\"). The two lines above turn a",
    "      // mob round when it is pushed past a world edge - right for a patrol, wrong mid-lunge: the hourglass dash re-asserts its vx every step, so a",
    "      // dash that reaches a wall presses into it and was turned round on every step. In the Arbiter's 1400 px court a lunge at a hero near either",
    "      // wall drew the charge, the settle and the idle after it facing away from the hero and from his travel. The brace locked _hgDir: it holds",
    "      // through the dash, and through the ~170 ms settle for the two bosses whose settle frames draw (bossAI re-faced on the first one).",
    "      if (m._hgDir && (m._hgCharging || ((m.type === 'towerArbiter' || m.type === 'towerSovereign') && ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) < (m._hgRecoverUntil || 0)))) m.facing = m._hgDir > 0 ? 1 : -1;   // v0.30.1791 arbiter-lunge-facing",
    "      checkPlatformCollision(m);"), 'walking-mob world clamp');
}

const grew = s.length - n0;
if (grew < 700 || grew > 1600) die('size moved ' + grew);
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
console.log('applied: arbiter-lunge-facing (+' + grew + ' chars)');
