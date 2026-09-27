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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Your summons keep fighting while you are stunned or frozen</span></h2>',
  '<p>Whenever you were staggered, stunned, frozen or shackled, everything you had summoned stopped with you:</p>',
  '<ul>',
  '<li><b>War Machine</b> turrets and <b>Mirror Shadow</b> clones stopped shooting and striking, and the <b>Sovereign Shade</b> stopped echoing.</li>',
  '<li><b>Call of the Wild</b> wolves, the <b>Wild Bond</b> wolf, the <b>Apex Bond</b> werewolf and the <b>Eye of the Tempest</b> eagle froze mid-stride.</li>',
  '<li><b>Soul Ward</b>, <b>Grand Hex</b> and <b>Divine Aegis</b> orbs hung in the air and hit nothing, and the Arch Bishop&rsquo;s <b>Hallowed Field</b> ran out.</li>',
  '</ul>',
  '<p>Their timers stopped too, so a stun quietly made them last longer. Necromancer minions and your MojiMon were never affected.</p>',
  '<p><b>Now</b> your summons, orbs and auras carry on while you are stunned or frozen, and their timers keep running. You still cannot move, jump, attack or cast until it wears off.</p>',
  '<p><b>Verified.</b> <code>scripts/summon_cc_test.mjs</code> &mdash; five summons across three classes (War Machine turret, Mirror Shadow clones, pack wolves, the eagle, Soul Ward orbs), each watched free, staggered, stunned and frozen. It checks that they attack and move, and that their timers tick exactly once per frame in every state. It also checks that held move, jump and attack keys do nothing while you are stunned or frozen, and no page errors. On the build before this fix the 15 stunned or frozen checks and the 5 timer checks fail: every summon stood still with its timer stopped. All 30 checks pass with the fix.</p>',
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
