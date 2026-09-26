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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Web version: the emoji icons show again, a hiccup on the art server no longer loses a picture, and one monster stops asking for sounds it never had</span></h2>',
  '<p>Three things the pre-launch audit caught on <b>play.moji-studios.com</b>. The Steam and downloaded builds were never affected.</p>',
  '<ul>',
  '<li><b>Blank icons everywhere.</b> Every little icon that stands in for an emoji &mdash; in menus, the HUD, quest text, the shop, dialogs and on the World Map&rsquo;s place markers &mdash; drew as an <em>empty box</em> on the web. Icons painted straight onto the game screen were fine, because an earlier fix sent them to the art server; the ones in the menus and pop-ups still looked for the icon sheet on the game&rsquo;s own site, where it does not live. All three kinds of icon now use the same sheet, from the art server.</li>',
  '<li><b>One retry for art.</b> On the web, pictures stream from a separate art server. Once in a while a single picture fails to arrive (seen once, on an NPC). Most of the game took that as final: the picture stayed missing, or a plain placeholder shape stood in for it. Now a picture that fails is asked for once more a second later. If the second try works you never notice; if the picture is truly missing, the game behaves exactly as before.</li>',
  '<li><b>A quiet error in the console.</b> The Sovereign&rsquo;s Crown Shards have no sound files of their own, yet the game looked for them on the first hit and the first kill (two &ldquo;not found&rdquo; errors per session). It now knows they use the shared family sound and never asks.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/emoji_atlas_cdn_test.mjs</code> rebuilds the web deploy locally: it reads the art-server rewrite from the deploy workflow, applies it, and serves the art from a second address while the site itself has none, just like the live setup. 13 checks: the menu icons, the World Map markers and the on-screen ones all use the same sheet from the art server and it loads; the site is never asked for it; no Crown Shard sound request (while a monster that has sounds still gets them); a picture whose first download fails is retried once and loads; a truly missing one is retried once and then reported; pictures on the site itself are never retried; no page errors. On the build before this fix, 8 of the 13 fail.</p>',
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
