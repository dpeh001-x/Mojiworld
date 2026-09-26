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
// the header's own Discord link follows the invite too (the quoted request in the v0.30 social-links entry stays verbatim)
const OLD_LINK = 'https://discord.gg/9CqQwXKcv"', NEW_LINK = 'https://discord.gg/csHmcWceZA"';
const nl = s.split(OLD_LINK).length - 1;
if (nl > 1) { console.error('ABORT: header Discord link matched ' + nl); process.exit(1); }
if (nl === 1) s = s.replace(OLD_LINK, () => NEW_LINK);
const ENTRY = J(
  '</header>',
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The Discord link no longer expires</span></h2>',
  '<p>The pre-launch audit found that the Discord invite on the title screen, in the README and in this changelog&rsquo;s header was a temporary one &mdash; it would have stopped working on 16 October, three weeks after launch. All three now use the server&rsquo;s permanent invite (<a href="https://discord.gg/csHmcWceZA">discord.gg/csHmcWceZA</a>), which never expires.</p>',
  '<p><b>Verified.</b> <code>scripts/discord_invite_test.mjs</code> &mdash; the title screen&rsquo;s Discord link, the README&rsquo;s two links and this header all point at the permanent invite and nothing points at the old one; the full social-links suite (all four title-screen links, their icons, the README and the changelog header) still passes.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 300 || grew > 3000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
