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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The HUD gets out of the way: the first quest&rsquo;s exit, the kill feed, the phone&rsquo;s top bar and the prologue&rsquo;s portal sign</span></h2>',
  '<p>A pre-launch playthrough from a fresh save found four places where the interface sat on top of something the player needed to see. The HUD keeps its look; only where things sit, and when they fade, changed.</p>',
  '<ul>',
  '<li><b>The first quest&rsquo;s way out was hidden.</b> After accepting <em>I &middot; The Waking</em>, the Emerald Thicket portal at the right end of Everdawn Central, its <b>Enter</b> sign and your hero all sat under the quest list, the <b>Hotkeys &amp; Skills</b> and <b>Taxi</b> buttons and the minimap. The same happened at the right edge of the Void. Now any of those panels fades to a see-through ghost while your hero or a portal is under it. You can still click it, and pointing at it brings it straight back.</li>',
  '<li><b>&ldquo;+XP &middot; +coins&rdquo; landed on the quest list.</b> The kill feed and the quest list shared the same corner, so every pill covered your quest&rsquo;s text. The pills now stack just above the list, or beside it when a long list leaves no room.</li>',
  '<li><b>Phones: the top buttons hid things.</b> The row of round menu buttons (MAP &hellip; STYLE, CHAT) covered the area name and the day&rsquo;s map bonus (&ldquo;LUCID +12% EXP&rdquo;), and on the right it covered the quest list and the Multiplayer button. All four now sit just under the row. The bonus and the Multiplayer button share a line, with the quest list below them.</li>',
  '<li><b>Prologue: a portal sign hid behind the boss bar.</b> During the Gravitos memory, the sign for the Zodiac Sanctum portal on the high ledge was pushed to the very top of the screen, behind the boss&rsquo;s name and health bar and the memory timer. A portal sign that would land under the boss bar, that timer or the area name now hangs just below its portal&rsquo;s ledge.</li>',
  '</ul>',
  '<p><b>Verified.</b> An automated check measures where everything lands on screen at 1280&times;720 and 1920&times;1080, and on 844&times;390 and 667&times;375 touch phones. It checks: the Everdawn exit portal, its sign and the hero standing at it; the hero at the Void&rsquo;s right edge; a forced &ldquo;+XP&rdquo; pill; the phone top bar against the bonus, the area name, the quest list and the Multiplayer button; and the prologue&rsquo;s portal sign against the boss bar and the memory timer. All 12 fail on the build before this fix and pass three runs in a row after it, with no page errors.</p>',
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
