// Summons keep fighting while the player is DOWNED (the knocked-down state a co-op partner can revive).
// ============================================================================
// Bug: v0.30.1213 (summon-cc) made the player's summons keep acting while the player is stunned, frozen or shackled, by
// wrapping the three summon blocks inside updatePlayer as hoisted function declarations (_lxSummonWardTick,
// _lxSummonTurretTick, _lxSummonPetTick) and calling them from each crowd-control early return. It left one early
// return out: the DOWNED gate near the top of updatePlayer (`if (player._downed) { ... _coopDownedTick(dt); return; }`).
// So for the whole down window (30 s, or until a partner revives you):
//   - War Machine turrets, Mirror Shadow clones and the Sovereign Shade stopped firing / striking;
//   - the Soul Ward, Grand Hex and Divine Aegis orbs hung in the air and struck nothing;
//   - pack wolves, the Wild Bond wolf, the Apex Bond werewolf and the Skyhunter eagle froze mid-stride;
//   - and all their lifetimes stopped, so a down also stretched them.
// Going down does not dismiss summons (only death, respawn and a map change clear them), a revive hands them back
// intact, and the necromancer's minions and the MojiMon (game.minions, main loop) already fought on while you were down.
// Nothing in the code or changelog says the rest should idle, so they now run too.
// Fix: the downed gate calls the same three ticks before _coopDownedTick, then returns as before: one tick a frame (the
// gate returns, so the normal-frame spots are skipped). The downed tick runs last, so it keeps the final word on hp,
// position and i-frames, and a bleed-out's death cleanup still clears the summons that same frame. Every player action
// stays blocked (input, movement, skills, the Siege Volley channel). Needs summon-cc (v0.30.1213) applied first.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const RUN = '_lxSummonWardTick(dt); _lxSummonTurretTick(dt); _lxSummonPetTick(dt);';
if (s.includes('if (player._downed) { ' + RUN)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// summon-cc must be in: the three ticks exist exactly once each, as nested declarations inside updatePlayer, below the gate
const GATE = "  if (player._downed) { if (typeof _coopDownedTick === 'function') _coopDownedTick(dt); return; }";
const U0 = s.indexOf('function updatePlayer(dt) {');
if (U0 < 0 || s.indexOf('function updatePlayer(dt) {', U0 + 1) >= 0) die('updatePlayer not found cleanly');
const U1 = s.indexOf(EOL + '}' + EOL, U0);
const G = s.indexOf(GATE);
if (!(U0 < G && G < U1)) die('the downed gate is not inside updatePlayer');
for (const fn of ['_lxSummonWardTick', '_lxSummonTurretTick', '_lxSummonPetTick']) {
  const a = s.indexOf('  function ' + fn + '(dt) {');
  if (a < 0 || s.indexOf('function ' + fn + '(', a + 5) >= 0) die(fn + ' missing or duplicated (apply summon-cc first)');
  if (!(G < a && a < U1)) die(fn + ' is not below the downed gate inside updatePlayer');
}

// the downed gate runs your summons, orbs and auras before the downed tick, then returns as before
once(J('  // Solo play never enters this state (_coopTryDowned requires a live peer).', GATE),
  J('  // Solo play never enters this state (_coopTryDowned requires a live peer).',
    '  // v0.30.1237 coop-downed-summons - YOUR SUMMONS, ORBS AND AURAS FIGHT ON WHILE YOU ARE DOWN. A down keeps them (a revive',
    '  // hands them back) and game.minions already fought on, but this return skipped the three summon ticks, so turrets,',
    '  // clones, wolves, the eagle and the ward orbs froze with their timers stopped. They run first: the downed tick keeps',
    '  // the last word on hp / position / i-frames, and a bleed-out\'s death cleanup still clears them this same frame.',
    "  if (player._downed) { " + RUN + " if (typeof _coopDownedTick === 'function') _coopDownedTick(dt); return; }   // v0.30.1237 coop-downed-summons - one tick a frame"),
  'the downed gate');

const grew = s.length - n0;
if (grew < 400 || grew > 1400) die('size moved ' + grew);
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
console.log('applied: coop-downed-summons (+' + grew + ' chars)');
