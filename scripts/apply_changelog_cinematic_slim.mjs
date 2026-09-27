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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Cinematics load faster: the ten biggest clips are under a quarter of their old size, same picture</span></h2>',
  '<p><b>What you saw.</b> The painted cinematics are streamed from the web the moment they play. The ten biggest were 6&ndash;16&nbsp;MB each, 100&nbsp;MB together, and two of them &mdash; the prologue&rsquo;s dagger fight and the punch that ends it &mdash; play for <em>every</em> new player, about 10&nbsp;MB each. On a slow connection or a phone that meant a dark screen or a stutter before the clip got going, and a lot of mobile data spent in the first minutes. Most of them also kept their table of contents at the <em>end</em> of the file, so the browser had to fetch the tail before it could show the first frame.</p>',
  '<p><b>What happens now.</b> All ten were re-encoded to the same size, frame rate, length and soundtrack, with the table of contents at the front so they start sooner. Together they are 22.5&nbsp;MB instead of 100&nbsp;MB:</p>',
  '<ul>',
  '<li>The prologue dagger fight: 10.4 &rarr; 3.1&nbsp;MB. The prologue punch: 10.1 &rarr; 2.7&nbsp;MB. The fall into the Void: 6.9 &rarr; 2.3&nbsp;MB.</li>',
  '<li>Waking up in Everdawn: 8.2 &rarr; 1.4&nbsp;MB (still full HD). Gravitos&rsquo;s epilogue: 15.9 &rarr; 3.1&nbsp;MB. The Warden&rsquo;s fall: 12.6 &rarr; 1.0&nbsp;MB.</li>',
  '<li>The Sundered Forge: 11.9 &rarr; 2.6&nbsp;MB. The Chains&rsquo; End arrival: 10.8 &rarr; 1.9&nbsp;MB. The Restless Frontier arrival: 6.1 &rarr; 3.5&nbsp;MB. Gravitos&rsquo;s defeat: 7.5 &rarr; 1.0&nbsp;MB.</li>',
  '</ul>',
  '<p>They play in every browser that played them before. Nothing else about the cinematics changed.</p>',
  '<p><b>Verified.</b> Each clip was compared frame by frame against its original and kept only if it scored at least 0.985 out of 1 on a standard picture-similarity measure, and only if it came out at least 30% smaller; all ten did, saving 43&ndash;92%. Side-by-side stills of the two prologue clips were checked by eye. A test confirms every file is the new one, with the original picture size, frame rate, soundtrack and length (to within a twentieth of a second), then boots the game and has each clip load through the scene that really plays it &mdash; the prologue cutscenes, the story-beat backdrops, the Everdawn welcome and Gravitos&rsquo;s defeat &mdash; with no page errors.</p>',
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
