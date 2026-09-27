import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>';
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Your summons keep fighting while you are downed</span></h2>',
  '<p>When you went <b>down</b> (the knocked-out window before you respawn, where a co-op partner can pick you up), everything you had summoned stopped with you until you got up or bled out:</p>',
  '<ul>',
  '<li><b>War Machine</b> turrets and <b>Mirror Shadow</b> clones stopped shooting and striking, and the <b>Sovereign Shade</b> stopped echoing.</li>',
  '<li><b>Call of the Wild</b> wolves, the <b>Wild Bond</b> wolf, the <b>Apex Bond</b> werewolf and the <b>Eye of the Tempest</b> eagle froze mid-stride.</li>',
  '<li><b>Soul Ward</b>, <b>Grand Hex</b> and <b>Divine Aegis</b> orbs hung in the air and hit nothing.</li>',
  '</ul>',
  '<p>Their timers stopped too. Necromancer minions and your MojiMon already kept fighting while you were down, and v0.30.1213 fixed the same freeze for stuns, freezes and shackles &mdash; going down was the one case left.</p>',
  '<p><b>Now</b> your summons, orbs and auras carry on while you are down, so they can hold the line while a partner comes to pick you up, and their timers keep running. You still cannot move, jump, attack or cast while down, and a revive hands everything back as normal. The Siege Volley channel is something you perform, so it still pauses.</p>',
  '<p><b>Verified.</b> <code>scripts/coop_downed_summons_test.mjs</code> &mdash; a co-op room simulated on one machine with a partner beside you. You go down the way a lethal hit does it, then the partner revives you. Four summons (a War Machine turret, Mirror Shadow clones, the Wild Bond wolf and Soul Ward orbs) are watched up, down and after the revive. They must keep attacking (the wolf and the orbs moving too) and tick their timers exactly once per frame in all three. Your own keys must do nothing while you are down and work again after the revive. On the build before this fix the 8 down checks fail: every summon stood still with its timer stopped. All 22 checks pass with the fix, and the stun and freeze test from v0.30.1213 still passes.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 300 || grew > 6000) { console.error('ABORT: moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars)');
