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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Monster, NPC and map art loads for the map you are on and the maps next door</span></h2>',
  '<p>The last update stopped boss animations and far-away backdrops from downloading before the title screen. About 250&nbsp;MB still downloaded right after the title, wherever you were. That included every monster&rsquo;s picture, every NPC, every floor and platform tile (some of them twice) and every town decoration. Once you were playing, the game also worked through every map in the world and every monster type in the background.</p>',
  '<ul>',
  '<li><b>Monsters, NPCs, tiles and town decorations</b> now load for the map you are on. The maps behind its portals load a few seconds after you arrive, so the next map is usually ready before you walk through. Everything else waits until you get near it.</li>',
  '<li><b>A monster that turns up from somewhere else</b> fetches its own picture when it appears. That covers summons, boss and event adds, party-quest waves, Tower floors and co-op partners&rsquo; monsters. Until the picture arrives it shows the same stand-in shape as before, usually for a few frames.</li>',
  '<li>When you enter a map, its fade now waits briefly (with a time limit) for the map&rsquo;s monsters, NPCs, tiles and decorations.</li>',
  '<li><b>The MojiDex, the Ledger and the MojiMon panels</b> fetch the pictures they show, so a monster you met elsewhere never appears as a blank dot.</li>',
  '<li>The background loader now warms only the map you are on and its neighbours, not the whole world.</li>',
  '<li>Effects, projectiles, equipment and skill art still load up front, so nothing pops in the first time you cast.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/lazy_art2_test.mjs</code> runs these checks:</p>',
  '<ul>',
  '<li>A cold boot from a fresh profile fetched about 175&nbsp;MB in 1,100 files by 20&nbsp;s after the title. The previous update fetched 253&nbsp;MB in 1,334 files. No monster picture was fetched, and no NPC, tile or decoration outside the starting map and the one next door. The title still comes up after about 60&nbsp;MB, as before.</li>',
  '<li>Twelve maps across the level range, entered with their art not yet loaded: every monster (150) and NPC (18) had its picture when the fade lifted, or within 30 frames.</li>',
  '<li>A monster from another map, summoned onto a field map, fetched its picture and drew from it within a few frames. So did one put on the map without going through the normal spawn.</li>',
  '<li>The MojiDex list, its portrait and the Ledger showed loaded pictures for six monsters met elsewhere. The background loader stayed within the current map and its neighbours. There were no page errors.</li>',
  '</ul>',
  '<p>On the build before the fix, the download checks and the background-loader check fail.</p>',
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
