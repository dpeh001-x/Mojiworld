import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
// the header's own support link: the one clickable Patreon link in this file
const HL = '<a href="https://www.patreon.com/c/Mojiworld" style="color:#c9a6ff;">&hearts; Support on Patreon</a>';
const hc = s.split(HL).length - 1;
if (hc === 1) s = s.replace(HL, '<a href="https://ko-fi.com/mojistudios" style="color:#c9a6ff;">&hearts; Support on Ko-fi</a>');
else if (!s.includes('href="https://ko-fi.com/mojistudios"')) { console.error('ABORT: header support link matched ' + hc); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The support link is Ko-fi now, not Patreon</span></h2>',
  '<p>Per user: <em>&ldquo;remove the patreon link and change it to https://ko-fi.com/mojistudios&rdquo;</em>.</p>',
  '<p><b>The change.</b> The one support line on the title screen (added in v0.30.445) keeps its place under the menu cards, its weight and its <code>target="_blank" rel="noopener noreferrer"</code>; it now reads <code>&hearts; Support Mojiworld on Ko-fi</code> and opens <a href="https://ko-fi.com/mojistudios" style="color:#c9a6ff;">ko-fi.com/mojistudios</a>. The same swap is made everywhere else the project pointed at Patreon: the link in this changelog&rsquo;s header, the &ldquo;Support the project&rdquo; line in the README, and the footer the promo-poster generator prints (<code>scripts/gen_monster_contact_sheet.mjs</code>), so the next poster carries the right page. Older entries below keep their wording &mdash; they are a record of what shipped then &mdash; but none of them is a clickable Patreon link.</p>',
  '<p><b>Verified.</b> <code>scripts/support_link_test.mjs</code> &mdash; 11 checks against the real title screen and the files beside it: the link is inside the main menu, carries exactly the Ko-fi URL, opens safely in a new tab, names Ko-fi, is visible and hittable, sits below the menu cards; no Patreon link or mention is left on the title screen; the README and the poster generator point at Ko-fi; this changelog has no clickable Patreon link. <code>scripts/patreon_link_test.mjs</code> is kept as a forwarder to it so nothing that calls the old name breaks.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1200 || grew > 5000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
