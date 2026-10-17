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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Sharper map backdrops, Dawn Gate, Dawn crest and Arcane Burst ring</span></h2>',
  '<p><b>What you saw:</b> 18 map backdrops (the forest, meadow, misty and dungeon plates, the two underwater cinematics, nine of the newer maps such as Elderwood Grove, Bloomhaven and Storm Crest, Ossuary Sprawl and both Glasswind Steppes) were painted about half as wide as the screen they fill, so they were stretched up to twice their size and looked soft and blocky. The town\u2019s Dawn Gate, the Dawn\u2019s Favor crest and the Mage\u2019s Arcane Burst shockwave ring had the same problem, and the death screen\u2019s art showed square compression blocks in its dark sky.</p>',
  '<ul>',
  '<li><b>Redrawn sharp.</b> Each picture was cleaned of its compression blocks, enlarged by an AI upscaler running on our own machine, then shrunk once to its new size, colour-matched to the original so no shadow got darker and no colour shifted, and lightly sharpened. The backdrops are now about 2900 pixels wide, like the rest of the maps, so on a high-resolution screen every screen pixel gets its own picture pixel instead of a smeared one.</li>',
  '<li><b>Same place, same size.</b> Every picture keeps its exact old shape, so each backdrop, the gate, the crest and the shockwave ring are drawn in exactly the same spot and at the same size as before. The ring still grows and plays at the same speed. Only the detail inside is sharper.</li>',
  '<li><b>Death screen and story backdrop.</b> The death screen art no longer shows blocks in its night sky. The story-card and character-creation backdrop is rebuilt from its original lossless master at twice the size.</li>',
  '</ul>',
  '<p><b>Download:</b> these 32 files grow from 4.2 MB to 10.9 MB. Most of that is the map backdrops, which only download when you enter their map; the forest, meadow, misty and dungeon backdrops still load in the background after the title screen.</p>',
  '<p><b>Verified.</b> In-game captures before and after on every map at high resolution, with the same framing; a test checks every file, that each backdrop, the gate, the crest and the ring are drawn in exactly their old size and position, that the ring plays the same frames on the same beat, and that each is now drawn from at least one picture pixel per screen pixel.</p>',
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
