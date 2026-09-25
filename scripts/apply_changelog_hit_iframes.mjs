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
  '<h2>' + VER + ' <span class="tag"><span class="pill balance">balance</span> 100 ms more immunity after a hit, and no coin text on your character</span></h2>',
  '<p>Per user: <em>&ldquo;when being hit, add about 100ms more immunity time&rdquo;</em> and <em>&ldquo;To reduce lag can also omit and not show the gain in mojicoin on the character&rdquo;</em>.</p>',
  '<p><b>Immunity.</b> Every hit that gives you an immunity window now gives you <b>100 ms more</b> of it &mdash; a boss slam&rsquo;s 600&nbsp;ms is now 700&nbsp;ms, and every other hit&rsquo;s window grows the same. It is added once, when a hit opens a fresh window: damage ticks that give no immunity (a burn, a poison) still give none, and a hit that only tops up a window already running adds nothing.</p>',
  '<p><b>Coin text.</b> Picking up Mojicoins no longer pops a yellow &ldquo;+N&rdquo; over your character &mdash; one text drawn per pickup, dozens at once in a coin shower. The coins, the pickup sound and the coin pill for pickups worth 50 or more are unchanged.</p>',
  '<p><b>Verified.</b> <code>scripts/hit_iframes_test.mjs</code> &mdash; 7 checks: a real 600&nbsp;ms hit window reads 667 one update in and lasts 43 updates (716&nbsp;ms of game time; it lasted 36 before); a damage tick opens no window; a top-up adds nothing; a coin pickup grants its coins with no text; no page errors. The current build fails 3 of the 7.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 800 || grew > 5000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
