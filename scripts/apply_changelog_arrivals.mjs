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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Portals no longer set you down on another portal, and the Singularity always lets you out</span></h2>',
  '<p>Found by the pre-launch world audit, which walked every one of the game&rsquo;s portals.</p>',
  '<ul>',
  '<li><b>Everdawn Central from the Void.</b> Stepping into town from the Void &mdash; every new game and every respawn &mdash; set you down right on the Bastion door, so your first <kbd>&uarr;</kbd> (which is also climb) sent you on to The Bastion. Coming back from the Clockwork Spire or the Inner Dimension did the same.</li>',
  '<li><b>The Hall of Echoes.</b> Walking in from Interdimensional Ascension put you on the hall&rsquo;s only exit, so one <kbd>&uarr;</kbd> threw you back out to the Void before the rush began.</li>',
  '<li><b>The Singularity.</b> Its only way out, to the Zodiac Sanctum, was sealed below Lv&nbsp;70, while the way in only warned you. A lower-level hero who walked in could not walk out.</li>',
  '</ul>',
  '<p><b>Now:</b> when a map has no door leading back to where you came from, you land on the nearest clear spot, away from every door. Doors that come in pairs (town and the forest, and all the others) still set you down exactly where they always did. A door out of a boss arena is never sealed, so you can always leave a fight you walked into; the Lv&nbsp;40 door into Confused Vigil still holds.</p>',
  '<p><b>Verified.</b> A new automated test walks the real portals: the Void, the Inner Dimension and the Clockwork Spire into town, and Interdimensional Ascension into the Hall of Echoes, each land on the ground clear of every door, and <kbd>&uarr;</kbd> there goes nowhere; a Lv&nbsp;50 hero leaves the Singularity; the Confused Vigil gate still stops a Lv&nbsp;30 hero; three paired routes land where they did before; no page errors. The first five checks fail on the build before this fix.</p>',
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
