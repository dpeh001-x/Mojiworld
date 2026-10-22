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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> No more fireballs falling in Gloomspore Verge</span></h2>',
  '<p>Per user: <i>gloomspore maps should not have fireballs, remove it</i>.</p>',
  '<p><b>What you saw.</b> Every few seconds a big molten fireball fell from the sky in Gloomspore Verge, the fungal swamp east of Thornspire Thicket. It was meant to be a bursting spore-pod dropping from the rotten canopy, but it borrowed the same falling-meteor picture that Lava Cavern&rsquo;s eruptions use, so in the swamp it looked like a fireball.</p>',
  '<p><b>What happens now.</b> Nothing falls from the sky in Gloomspore Verge any more. Everything else about the map is the same: the same monsters (Meloncholy, Thornmaw, Pinechad, Elderbark), the Blight Elder and its green blight strike, the loot, the quests and the way in and out. Gloomspore Verge is the only Gloomspore map.</p>',
  '<p><b>Other maps are unchanged.</b> Lava Cavern and the forge maps still erupt, and the maps whose falling hazard is themed as something else keep it too: Hollow Sepulchre and the bone graveyards (falling rib-bones), Ossuary Sprawl (bone avalanches) and the second Wayfarer&rsquo;s Lantern map (ember showers).</p>',
  '<p><b>Verified.</b> A browser test spends a while in every Gloomspore map, also forcing the map&rsquo;s hazard timer to fire again and again (each one stands in for several seconds of play), and records anything that falls from the sky: nothing does. It also checks that Lava Cavern still erupts, that the other maps keep their own falling hazards, and that the Verge keeps its level, layout, art and monsters. On the build before, a fireball fell 18 times in the same visit.</p>',
  '');
s = s.replace(ANCHOR, () => ENTRY);
if (s.includes('@@')) { console.error('ABORT: placeholder left in'); process.exit(1); }
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
