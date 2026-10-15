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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Each boss warns of its big swing in its own way</span></h2>',
  '<p>Per user: <i>&ldquo;it seems to appear on ALL bosses identically&rdquo;</i>, <i>&ldquo;it should be a prewarn striking swing sprite before impact&rdquo;</i>, <i>&ldquo;remove the yellow and black&rdquo;</i>. When a boss wound up a big swing, the spot it was about to hit was marked with the same orange arc with yellow-and-black hazard stripes on every boss &mdash; or, for bosses with their own swing art, a faint copy of the hit itself, so the warning and the strike looked alike.</p>',
  '<p>Now six bosses mark their windup with a warning sprite of their own, one you picked for each of them:</p>',
  '<ul>',
  '<li><b>Aetherion</b> &mdash; violet tear-crystals poised to fall; once he becomes the <b>Tearborn Ascendant</b>, gold tears in halos.</li>',
  '<li><b>Distorted Mira</b> (the Woman Who Turned Back) &mdash; her frost blade laid along her reach; after she rises again, a row of planted feathers.</li>',
  '<li><b>The Ossuary Tyrant</b> &mdash; glowing bone crowns. As a rare elite in the Ossuary Sprawl his swing was never marked at all; it is now.</li>',
  '<li><b>The Master Conductor</b> &mdash; red-lit pocket watches.</li>',
  '</ul>',
  '<p>The warning covers exactly the ground the swing will hit, faces the way the boss swings, and charges up as the windup runs: faint at first, then nearly solid just before impact. The swing itself looks the same as before. The warning art loads with the boss&rsquo;s arena, so it is ready before the first swing. On the Last Step the old arc was also drawn above where Mira&rsquo;s swing actually lands; her warnings now sit on the real hit area. Other bosses keep their current warning for now.</p>',
  '<p><b>Verified.</b> A browser test spawns each boss in its own arena, holds a heavy-swing windup and records what is drawn: each of the six draws its own warning over the hit area (in both of Aetherion&rsquo;s forms and both of Mira&rsquo;s lives, mirrored for a left-facing swing) and never the striped arc or a swing ghost; the warning brightens on the same schedule the arc did; each arena asks for its warning art on arrival; the swings that follow are unchanged; a boss without a warning of its own (Aries) draws exactly as before; no page errors. The warning checks fail on the build before this change.</p>',
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
