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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The taxi sets you down at a tower&rsquo;s base, not a few jumps from its summit</span></h2>',
  '<p>Found in a bug hunt. Taking the taxi to <b>Frozen Peak</b> or <b>Interdimensional Ascension</b> (from the Taxi Uncle, or the world map&rsquo;s &ldquo;back to&rdquo; row) dropped you about 13,600&nbsp;px up the tower &mdash; a few jumps from the summit portals to the Stardust Atrium and Zodiac Hall, skipping the whole climb. Honeycomb Hollow did the same on a smaller scale. Both taxi routes forced a fixed drop point after the map had already placed you correctly.</p>',
  '<p>That override is gone, so the taxi now sets you down exactly where walking in does: on the ground floor. Ordinary maps are unchanged.</p>',
  '<p><b>Verified.</b> <code>scripts/taxi_tower_test.mjs</code> &mdash; 5 checks through the real taxi and world-map clicks: Frozen Peak and Interdimensional Ascension land you on the ground floor, an ordinary map still does, the &ldquo;back to&rdquo; row lands you at Frozen Peak&rsquo;s base, no page errors. The three tower checks fail on the build before this fix.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 700 || grew > 4000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
