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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Login-streak milestones pay once, and a Zodiac Sigil respects a full bag</span></h2>',
  '<p>Found by the pre-launch combat and economy audit.</p>',
  '<ul>',
  '<li><b>Streak milestones could be farmed with the computer&rsquo;s clock.</b> The 14, 30, 60 and 100-day login-streak bonuses paid every time the streak reached them. Moving the clock forward a day at a time, letting the streak lapse and walking it up again paid all four again &mdash; over 120,000 coins a lap.</li>',
  '<li><b>Now each milestone pays once per save</b>, and the save remembers it through reloads. The daily login bonus, the daily challenge and the Postal Wisp parcel are unchanged: a real new day still pays them. A save from before this update counts the milestones its streak had already passed as paid.</li>',
  '<li><b>A Zodiac Sigil ignored a full bag.</b> Beating a zodiac boss with a full Etc tab put the sigil past the last visible slot. Like every other reward, it now drops at your feet when the tab is full (the toast says so) and waits on the ground until you make room.</li>',
  '</ul>',
  '<p><b>Verified.</b> A new automated test moves the clock like a player would: a 100-day lap pays each milestone once; after setting the clock back and reloading, a second 100-day lap pays none; the paid milestones survive the reload; a real next day still pays its login bonus; an older save that had passed 14 days is not paid 14 again, while a first 14-day streak still is; a sigil won with a full Etc tab drops at your feet, and with room goes into the bag; no page errors. Four checks fail on the build before this fix.</p>',
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
