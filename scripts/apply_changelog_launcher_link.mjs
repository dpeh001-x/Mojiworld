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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The Windows launcher&rsquo;s &ldquo;no Node.js&rdquo; fallback opens play.moji-studios.com too</span></h2>',
  '<p><b>What you saw.</b> On a PC without Node.js, every Windows launcher offers to open the game in your browser instead. Since v0.30.1180 <code>Mojiworld.cmd</code> and the portable zip&rsquo;s <code>PLAY_ME_FIRST.txt</code> send you to <a href="https://play.moji-studios.com/">play.moji-studios.com</a>, but the small <code>Mojiworld.exe</code> launcher still opened the old developer preview link: the raw branch copy, a few minutes behind every update and with no link preview when shared.</p>',
  '<p><b>What happens now.</b> The <code>Mojiworld.exe</code> launcher opens <a href="https://play.moji-studios.com/">play.moji-studios.com</a> as well, so all three launchers agree. Its file details now show the version it was built from.</p>',
  '<p><b>Where the exe comes from.</b> It is not in the download: the portable zip ships <code>Mojiworld.cmd</code>, and the Steam build&rsquo;s <code>Mojiworld.exe</code> is the full desktop app, which has no browser fallback. This small exe is built by hand from its source and is unsigned, so it stays out of the repo until it can be signed. The next time it is built, it has the new link.</p>',
  '<p><b>Verified.</b> A test reads every launcher and packaging file and finds no old preview link left, checks that the exe, <code>Mojiworld.cmd</code> and <code>PLAY_ME_FIRST.txt</code> all name the same address, compiles the exe from its source with the build script&rsquo;s own settings and confirms the new address is inside it and the old one is not, then boots the game with no page errors. The link checks fail on the build before this change.</p>',
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
