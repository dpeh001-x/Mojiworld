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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Co-op: standing still no longer chatters to the server 14 times a second</span></h2>',
  '<p>In co-op the game told the server where you were every 70&nbsp;ms, whether you were running, standing in town, reading a menu or had the game in a background tab. That is about fifteen messages a second per player, all day long &mdash; and on the co-op server every message counts against a daily allowance, so a few idle players could use it up.</p>',
  '<ul>',
  '<li><b>Moving, jumping, fighting:</b> nothing changes &mdash; your partner still gets every step at the same pace.</li>',
  '<li><b>Standing still:</b> one short &ldquo;still here&rdquo; about every 1.25&nbsp;seconds instead of fourteen a second. The moment you move again, your partner sees it (well under a fifth of a second in testing).</li>',
  '<li><b>A menu open or the game in a background tab:</b> one every 2&nbsp;seconds.</li>',
  '<li>Your partner never loses you: the game treats a partner as gone only after 5&nbsp;seconds of silence at the earliest, well above these gaps.</li>',
  '<li>No more bobbing: the partner&rsquo;s screen used to &ldquo;settle&rdquo; a silent player onto the platform it guessed was under them, and on some spots (a few in the Mushroom map, one in the underpass lobby) that guess is 100&ndash;240&nbsp;px off. The game now keeps a quicker beat on those spots and while you are in the air, so even a partner on an older build sees you where you are &mdash; and new builds no longer apply that settle to a player standing still.</li>',
  '<li>Works with the current co-op server and the older one; nothing else changes (monster sync, hits, chat, emotes and pings are sent exactly as before).</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/mp_idle_traffic_test.mjs</code> &mdash; two game windows and a message counter on a local copy of the co-op server: idle 0.8 messages a second (was 11), a menu open or a hidden tab 0.5 (was 12), a moving player sends on every beat as before, the partner keeps the idle player for 35&nbsp;seconds (never more than 2&nbsp;s since the last word) drawn exactly in place, the first step shows within 22&ndash;115&nbsp;ms, the quick beat on a misguessed spot (gaps under 320&nbsp;ms), the same on the older server, no page errors. The three rate checks fail on the previous build; all pass three runs in a row.</p>',
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
