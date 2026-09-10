import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The end credits read DADPEH</span></h2>',
  '<p>Per user: <em>&ldquo;change Dr Daryl Peh at the end credits to DADPEH&rdquo;.</em> Three lines in the credit roll inside <code>_showGameComplete()</code> &mdash; the <b>Created &amp; Directed by</b> name, the <b>Design &middot; Story &middot; Art &middot; Code</b> name, and the closing <em>&mdash; Moji-Studios &middot; &hellip; &mdash;</em> line. The honorific goes with it: the whole string was named, so it reads <code>DADPEH</code> rather than &ldquo;Dr.&nbsp;DADPEH&rdquo;.</p>',
  '<p><b>These were the last holdout.</b> A scope grep first showed <code>DADPEH</code> was already the name in the file&rsquo;s copyright header, its <code>&lt;meta name="copyright"&gt;</code> tag, the loading-screen copy line and the music-credit comments &mdash; only the credit roll still carried the older form, so the two had quietly drifted apart. Nothing else in the 8.5&nbsp;MB file mentioned the old name, and Moji-Studios is untouched.</p>',
  '<p><code>scripts/credits_name_test.mjs</code> &mdash; 5 checks. The roll is assembled by string concatenation, so a source grep alone would not prove the text reaches the page: the test calls <code>_showGameComplete()</code> for real and reads the rendered overlay, asserting both name nodes are exactly <code>DADPEH</code>, the closing line carries studio and name together, no rendered text says the old name, and &mdash; as a control, since the studio shares those same lines &mdash; that <b>Moji-Studios survived</b> the replace. Plus a file-wide check that the old name appears nowhere, which keeps the credits from drifting from the copyright again.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 800 || grew > 4000) { console.error('ABORT: moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars)');
