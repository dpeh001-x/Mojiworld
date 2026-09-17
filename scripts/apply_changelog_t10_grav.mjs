import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill balance">balance</span> T10 gear drops from Gravitos and from nothing else</span></h2>',
  '<p>Per user: <em>&ldquo;ensure that T10 items drop only from gravitos&rdquo;</em> and <em>&ldquo;ensure the zodiac bosses do not drop T10 equipments&rdquo;</em>.</p>',
  '<p><b>Measured first</b>, 3,000 rolls a source in a live game. Kill loot already held: Gravitos is capped at T10, every zodiac boss at <b>T8</b>, every other boss at T7 or lower, and every runtime boss spawn (expedition tower, Echo Keeper, Duo Trial, Boss Rush) is a real boss type, so the cap reaches all of them.</p>',
  '<p><b>The hole was the drop roll&rsquo;s own fallback.</b> <code>rollItemDrop</code> grades by source level when it is not handed a boss cap, and at Lv 85+ a boss-grade roll reached T10 &mdash; 116&ndash;140 in every 3,000. Every <b>quest reward</b> rolls exactly that way; a quest-pinned tier (<code>forceTier</code>) skipped the cap entirely (600 T10 in 600 when pinned to 10); and the &ldquo;never leave the bag empty&rdquo; fallback handed back the whole catalogue. None of those knew what monster was involved.</p>',
  '<p><b>Now</b> the rule lives in that one function, which every mob, boss and quest gear roll goes through: <b>T9 is the ceiling</b>, lifted to T10 only for a roll made <em>for a Gravitos</em>. The kill paths pass the monster in, and its <b>type</b> is checked rather than the cap number, so a boss handed a cap of 10 by mistake still cannot reach it. Nothing below the ceiling moves &mdash; T9 is still reachable where it was.</p>',
  '<p><b>Left alone, because they are not drops:</b> Brok&rsquo;s shop still <em>sells</em> class T10 gear at Lv 90+, and the one-time Godforged weapon reward is built on the top-tier weapon. One side effect worth knowing: the Gravitos quest&rsquo;s own completion reward is a quest payout, not a Gravitos drop, so it now tops out at T9 too &mdash; the kill itself still drops T10.</p>',
  '<p><code>scripts/t10_gravitos_test.mjs</code> &mdash; 9 checks off the real rolls: the Lv 85/90/99 fallback, a pinned quest tier, all twelve zodiac bosses (0 T10 in 4,800 items, highest T8), every other boss, the mistaken-cap case, and controls that Gravitos still drops T10 (143 in 3,000 from its kill roll) and that T9 is untouched. Run against the previous build it fails the five leak checks and passes the zodiac ones &mdash; which is exactly what the census found.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 8000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
