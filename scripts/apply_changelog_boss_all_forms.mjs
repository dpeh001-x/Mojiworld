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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Every Gravitos fight goes through all three forms</span></h2>',
  '<p>When you fought Gravitos again through the Echo Keeper, beating his first form ended the battle: the game counted him as beaten and he never became his Awakened (second) or Ascendant (final) form. The same happened to the Nightmare echo, the Duo Trial and his echo in the Hall of Echoes Boss Rush. Only the story fight went through all three forms.</p>',
  '<p>Now every fight against Gravitos goes form 1, then form 2, then form 3, exactly like the story fight: the same health, attacks, look, arena collapse and finale. The battle is only won when his final form falls, and that is when the rewards, quest progress and the Boss Rush count arrive, once. An echo also keeps its &ldquo;(Echo)&rdquo; or &ldquo;(Nightmare)&rdquo; name through the forms.</p>',
  '<p>The short memory of him at the very start of the game is unchanged. Other bosses with a second form (the Tower Sovereign, Mira and Aetherion) already changed form in every fight and are unchanged.</p>',
  '<p><b>Verified.</b> A browser test fights Gravitos through the Echo Keeper (free and Nightmare), the Boss Rush and the story arena, knocking each form down in turn: all four play forms 1, 2 and 3 with the story fight&rsquo;s health, nothing is credited before the final form falls, and the win is credited exactly once. On the previous build the Echo, Nightmare and Boss Rush fights ended after form 1.</p>',
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
