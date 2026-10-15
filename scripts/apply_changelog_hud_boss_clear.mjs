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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Bosses are no longer cut off at the sides: the HUD fades out of their way</span></h2>',
  '<p>Per user: <i>King Krook, the Arbiter and Caprikor look cut off at the sides</i>, and <i>ensure that the other bosses are not affected at the flanks as well</i>.</p>',
  '<ul>',
  '<li><b>What was wrong.</b> The boss art was always drawn whole. The side panels covered it: the quest tracker, Hotkeys &amp; Skills, Taxi and the minimap on the right, and the stats card on the left. A boss standing near either edge lost an arm, a tail or half a cape behind them. The panels already faded when <em>you</em> or a portal were under them, but never for a boss.</li>',
  '<li><b>What happens now.</b> Any panel with a boss behind it fades to see-through, the same way it does for you. This works for every boss, zodiac signs and mini-bosses included, and it goes by the boss as you see it on screen, not by its hit box. Many bosses are drawn much wider than they can be hit: Distorted Mira&rsquo;s art is about four times as wide as her hit box. The stats card fades for bosses too.</li>',
  '<li><b>Only when it matters.</b> A panel fades only when a boss covers at least 12% of it, so a boss brushing its edge leaves it alone. When the boss moves off, the panel comes back. Panels still take clicks while faded, and pointing at one brings it back at once. This works on desktop and on phones.</li>',
  '</ul>',
  '<p><b>Verified.</b> Ten bosses were held under the right-hand panels, under the stats card and then mid-screen, at 1280&times;720 and 1920&times;1080: King Krook, Caprikor, the Arbiter, Gravitos, King Slime, Mooma, Aetherion, Distorted Mira, Leo and Libra. Two of them were also checked on a phone screen. The test measured each boss&rsquo;s drawn shape on its own, separately from the game. Every panel it covered faded, every panel it didn&rsquo;t cover stayed fully visible, every panel it left came back, and a boss grazing a panel didn&rsquo;t fade it. The cover checks fail on the build before this fix. The earlier test for you and portals still passes, with no page errors.</p>',
  '');
s = s.replace(ANCHOR, () => ENTRY);
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
