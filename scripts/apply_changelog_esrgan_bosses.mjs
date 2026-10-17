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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Sharper bosses, and the Tomb Keeper no longer stretched</span></h2>',
  '<p><b>What you saw:</b> several bosses looked soft or slightly blurry. Some of their moves were drawn bigger than the art behind them (the Tower Sovereign’s arrow volley, drain, sweep and pillar; Aetherion’s first form; Legosaurus; the Tower Arbiter’s swing, pillar and verdict; Path’s Bane’s swing), so the game had to stretch them. Others were simply soft at their own size. The Tomb Keeper looked stretched in every pose.</p>',
  '<ul>',
  '<li><b>Stored bigger, drawn the same.</b> The moves that were stretched now carry 1.6 to 2 times more detail. They are drawn exactly where and as big as before, facing either way (checked on every frame, to within half a pixel), so footing, size and reach do not move. The hit areas are the same boxes in the world.</li>',
  '<li><b>Sharper at their own size.</b> The Tower Sovereign’s lunge, collapse and strike, and Gravitos’s first and second forms (slam, punch, soul drain, beam, supernova) were redrawn sharp on their own frames. Mira Fallen, Aetherion’s second form, the rest of Gravitos’s second form and King Krook were sharpened with the same free method used for the Tower Arbiter earlier. Outlines did not change.</li>',
  '<li><b>How.</b> The detail comes from a free AI upscaler run on this machine (Real-ESRGAN). Each frame was cleaned of compression blocks, upscaled, then reduced once to its size. Two guards keep it faithful: dark shadows keep their original depth, and no new dark or bright rims appear around flames and glows.</li>',
  '<li><b>Tomb Keeper.</b> He was drawn from a picture made for a smaller size and then stretched by his own size setting, giving about half a pixel of art per screen pixel. That picture is now made at the size he is shown, so he is crisp. The same applies to every monster drawn larger than its base size (including the Forgewight, Octobaby and the Smith Golem).</li>',
  '</ul>',
  '<p><b>Not changed:</b> timing, attacks, positions and hit areas. Memory during a boss fight stays within the limit that keeps a boss’s whole form loaded. The download grows by about 18 MB, mostly from the larger frames.</p>',
  '<p><b>Verified.</b> Every replaced frame is checked file by file. In the game, each enlarged move was compared with the previous version on every frame and both facings: same place and size within half a pixel, same hit areas. The Tomb Keeper now reaches the screen at full sharpness. The existing boss tests still pass.</p>',
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
