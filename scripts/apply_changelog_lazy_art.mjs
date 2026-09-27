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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The title screen no longer waits for 400&nbsp;MB of art, and boss and map art loads when it is needed</span></h2>',
  '<p>The pre-launch audits found that a first visit downloaded almost the whole game before the title screen: every boss&rsquo;s animation frames, every map&rsquo;s backdrop and every effect, monster, equipment and NPC sheet. That was about 400&nbsp;MB and 2,300 files. On the local and desktop builds the title waited for all of it. On the web the title came sooner, but the same 380&nbsp;MB then poured in behind it, competing with the first map.</p>',
  '<ul>',
  '<li><b>Before the title</b>, only the title screen, the towns and the map you start on are loaded, on every build. On the local test build that is about 60&nbsp;MB instead of 416&nbsp;MB, and the title appears in about 5&ndash;8&nbsp;s instead of 22&nbsp;s.</li>',
  '<li><b>Boss animations</b> load when they are needed: when you enter the arena, when you enter a map with a portal to it, or when the boss is summoned. His portrait comes along. Until then none of the roughly 860 boss frames are downloaded.</li>',
  '<li><b>Map backdrops</b> load for the map you are on and the maps its portals lead to. The other 73 wait until you get near them.</li>',
  '<li>Effects, monsters, equipment and NPCs still stream in behind the title, as before.</li>',
  '<li>Entering a map now waits briefly behind its fade (with a time limit) for the boss&rsquo;s frames and the backdrop. A boss never opens on a stand-in pose, and a map never opens on a blank sky.</li>',
  '<li><b>Also fixed:</b> a map entered within about four seconds of the previous one could have its fade lifted early by the previous map, before its own art was ready. Only the newest map entry lifts the fade now.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/lazy_art_test.mjs</code> runs these checks:</p>',
  '<ul>',
  '<li>A cold boot from a fresh profile reaches the title after 60.6&nbsp;MB, against 420&nbsp;MB before. No boss frame and none of the 73 far backdrops has been fetched by then, or in the 20&nbsp;s after.</li>',
  '<li>King Gloopaloo, Gravitos and Scorpio, entered cold, are drawn from their own animation frames from the first frame after the fade. They are the same size as on a later visit, and their measured sizes match the original measurement.</li>',
  '<li>King Krook&rsquo;s frames and backdrop arrive while you stand next door. A Mooma summoned on a field map fetches her own frames. Twelve maps from across the level range show their backdrop within 2 frames of the fade.</li>',
  '<li>There are no page errors.</li>',
  '</ul>',
  '<p>On the build before the fix, the three download checks fail: 863 boss frames and all 73 far backdrops were fetched before the title.</p>',
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
