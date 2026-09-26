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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> &ldquo;???&rdquo; (Sage Mira) gets a voice that matches her</span></h2>',
  '<p>Per user: <em>&ldquo;regenerate ??? NPC sound voice, as it doesn&rsquo;t match&rdquo;</em>. The mysterious sage who offers the 12-hour boon &mdash; a young-looking elf woman with long silver hair in white-and-gold robes &mdash; used to talk in a low, bored sigh. Her babble is now a soft, airy, gentle young woman&rsquo;s voice with a hint of mystery.</p>',
  '<p>Four takes were rolled with ludo.ai and measured; the one kept sits squarely in a young woman&rsquo;s range (pitch ~380&nbsp;Hz, the old clip was 130&nbsp;Hz) with the most voice in it &mdash; the others were squeaky or thin. The game&rsquo;s asset cache was refreshed too, so returning players hear the new voice straight away instead of the old one from their browser cache.</p>',
  '<p><b>Verified.</b> <code>scripts/sage_voice_test.mjs</code> &mdash; 4 checks: the clip&rsquo;s pitch and voice measures; the asset cache bump; talking to &ldquo;???&rdquo; in game loads exactly this clip; no page errors.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 700 || grew > 4000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
