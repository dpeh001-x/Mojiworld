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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Skill effects, projectiles, summons and gear icons load for your character and the map you are on</span></h2>',
  '<p>The last two updates stopped boss animations, far-away backdrops and other maps&rsquo; monsters from downloading at start-up. About 60&nbsp;MB still downloaded right after the title: every skill effect of all four classes, every piece of gear&rsquo;s icon, every projectile, every summon and every boon icon. Once you were playing, the game then fetched every effect, projectile and summon animation in the game in the background (well over 100&nbsp;MB more). They loaded up front so a skill would never pop in the first time you cast it.</p>',
  '<ul>',
  '<li><b>Your character&rsquo;s skills</b> now load right after the title: every skill your class, job and master can use (learned or not), plus your hit sparks and block stance. When you change job or master, the new skills&rsquo; art is fetched straight away.</li>',
  '<li><b>Monster attacks</b> load with the map: the shots, cast flashes and attack effects of the map you enter, and of the maps behind its portals a few seconds later. A boss that turns up (or is summoned) brings his own.</li>',
  '<li><b>Your equipped gear&rsquo;s icons</b> load after the title. The inventory, the shops, the equipment slots and the forge windows fetch the icons they show, so nothing appears as a blank.</li>',
  '<li><b>Boon icons</b> load where they are shown.</li>',
  '<li>As a safety net, a skill fetches its art the moment you cast it, and anything drawn before its art has arrived keeps its old stand-in look until the file lands. Boon effects, the parry, the boss health bar and potions still load up front.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/lazy_fx_test.mjs</code> runs these checks:</p>',
  '<ul>',
  '<li>A cold boot from a fresh profile fetched 110&nbsp;MB in 640 files by 20&nbsp;s after the title, down from about 172&nbsp;MB in 1,100. By then it had fetched 38 of 226 effect sprites, 3 of 116 projectiles, 9 of 129 gear icons (the potions), no summons and no boon icons. The title still comes up after about 60&nbsp;MB, as before.</li>',
  '<li>The background loader no longer fetches every animation in the game.</li>',
  '<li>A Ninja, an Archmage and a Ranger each cast every skill on the bar for the first time. Every effect, projectile and summon was drawn from loaded art, with none falling back to its stand-in.</li>',
  '<li>On five maps entered cold, from level 18 to 80, every monster shot was drawn from its loaded sprite and animation.</li>',
  '<li>The inventory showed loaded icons for eight gear pieces that had not been downloaded before it opened, and so did the weapon shop. There were no page errors.</li>',
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
