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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Gravitos stands on the floor and stays one size (forms 1 and 2), and the tower bosses keep their footing</span></h2>',
  '<p><b>Gravitos</b>, forms 1 and 2, was recalibrated pose by pose. Before, his feet shuffled when he changed pose, some poses were drawn bigger or further forward than his standing pose, his walks were off size, and his feet floated above the floor.</p>',
  '<ul>',
  '<li><b>On the floor.</b> Forms 1 and 2 now stand a little deeper so both heels touch the floor (form 1 by 5 pixels, form 2 by 6). Every pose of a form moves together. Form 3 is not changed in this update.</li>',
  '<li><b>Same place, same size.</b> His attack, punch, laser and soul poses start where his idle stands and at its size. Form 2’s attack was about 4% too big and is now right.</li>',
  '<li><b>Walks.</b> His form-1 and form-2 walks are now the same height as his idle and walk on the same body line. Both walks had been drawn slightly too big; the planted foot also slides less.</li>',
  '<li><b>Form 2’s supernova.</b> It no longer jumps when the cast starts and ends. It used to pop up to 56 pixels into the air and grow, then sink into the floor when it finished; now it switches cleanly. It also stands where his body stands, with his back heel on the ground and no visible size change from frame to frame.</li>',
  '<li><b>Form 2’s laser</b> frames now stand level with each other.</li>',
  '</ul>',
  '<p><b>Tower Sovereign:</b> his walk and five of his attacks stood up to 23 pixels off his standing spot and now start on it. <b>Tower Arbiter:</b> checked frame by frame; his feet already stayed put, so nothing of his changed.</p>',
  '<p><b>Not changed:</b> his hit areas and reach (checked frame by frame against the previous version: identical), his timing, and his attacks.</p>',
  '<p><b>Verified.</b> Feet, body position and size were measured on screen in the game, facing left and right, on every frame. Browser tests cover the footing, the floor depth of each form, walk size, the supernova and that his hit areas did not move. The existing Gravitos and tower-boss tests still pass; the Gravitos floor test now expects the deeper stance.</p>',
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
