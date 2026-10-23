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
  '<h2>' + VER + ' <span class="tag"><span class="pill feat">feat</span> Gravitos&rsquo;s Collapse Rain and Singularity each get their own look</span></h2>',
  '<p>Collapse Rain and the Singularity looked exactly alike: the same dark violet veil, the same gold shelters and the same &ldquo;3, 2, 1&rdquo; countdown. Since Collapse Rain now only drops you to 1 HP while the Singularity kills, nothing on screen told you which one was coming. Each now has its own look, with new art made for it.</p>',
  '<ul>',
  '<li><b>Collapse Rain</b> falls from the sky: a navy night under a violet sky, a tear across the top edged with aurora light, and comets with white-hot heads and long cyan-violet tails raining down at different depths. They burst in crystal shards on the floor, never on a shelter, and each box lands with a shake. Each shelter is a crystal portal on the floor under one clear beam of light, marked with a crystal shield. Its countdown is a slim crystal ring with a down arrow, ice-white numbers and the title COLLAPSE RAIN over &ldquo;REACH THE LIGHT OR DROP TO 1 HP&rdquo;.</li>',
  '<li><b>The Singularity</b> is far more devastating: the great sphere above the arena becomes a black hole that swells as the count runs. It has a blazing accretion disc, a ring of bent light turning round it, debris spiralling in and shockwaves pulsing out, and it ends in a collapse flash. Its countdown is an ornate violet and gold clock face with Roman numerals, a gold arc draining each second, gold numbers and the title SINGULARITY over &ldquo;REACH THE LIGHT&rdquo;. Its gold shelters are unchanged.</li>',
  '</ul>',
  '<p>Only the look changed. Where the shelters appear, their size, the timing, the damage and how each attack is survived are exactly as before. In co-op, everyone sees the same look. Other bosses&rsquo; collapses (the Tower Sovereign, Aetherion, the Last Step) keep the old look.</p>',
  '<p><b>Verified.</b> A browser test runs both attacks from Gravitos himself. Each draws its own art and countdown and none of the other&rsquo;s. The Singularity&rsquo;s field, shelters and one-hit kill are unchanged, as are the rain&rsquo;s four boxes 4 s apart, its shelters and its drop to 1 HP / 1 MP. A co-op partner gets the same look, and another boss&rsquo;s collapse still draws the old one. On the previous build the attacks shared one look.</p>',
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
