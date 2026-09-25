// The MojiMon tab's Hunt progress, in the cute style of the cards above it (mm-cards, mm-roster).
// ============================================================================
// Per user: "do the same cute style for the hunt progress".
//   - the list sits in a plush card (stitched seam, star dots, a pink glow) under a 🐾 HUNT PROGRESS title, with a
//     gold "10,000 kills to bind" chip;
//   - each species is a pill row: its sprite in a pastel bubble, its name in Fredoka, a candy progress bar (a dark
//     track with milestone dots at 25 / 50 / 75%, a glossy lilac-to-pink fill) and its count on a pill;
//   - a species you can bind now goes mint: mint row and bar, its sprite bobs, and the count pill says
//     "⛓ Ready to bind!"; the eligible note under the list is a mint pill.
// Same list (top 8 unbound species by kills), same order, same numbers. Stylesheet: scripts/_mm_hunt.css.txt, added
// once by _mmHuntCss(); the markup is scripts/_mm_hunt.js.txt.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) mm-hunt/.test(s)) { console.log('already applied'); process.exit(0); }
if (!/v0\.30\.\d+ mm-roster/.test(s)) { console.error('ABORT the mm-roster build is not here'); process.exit(1); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const count = (a) => s.split(a).length - 1;
const once = (label, a, z) => { if (count(a) !== 1) die(label + ' matched ' + count(a)); s = s.replace(a, () => z); };
const part = (f) => readFileSync(path.join(HERE, f), 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '');

// 1. the stylesheet, added once, after the roster's
const CSS = part('_mm_hunt.css.txt');
if (!CSS.includes('#u-pane-mojimon .mmh-card') || /[^\x00-\x7e\n\u2014]/.test(CSS)) die('the stylesheet file looks wrong');
const HELPER = [
  '// v0.30.1020 mm-hunt — Hunt progress in the same cute style (per user: "do the same cute style for the hunt',
  '// progress"). Its stylesheet, added once. See scripts/apply_mm_hunt.mjs.',
  'function _mmHuntCss() {',
  "  if (document.getElementById('mm-hunt-css')) return;",
  "  const st = document.createElement('style'); st.id = 'mm-hunt-css';",
  '  st.textContent = ' + JSON.stringify(CSS) + ';',
  '  document.head.appendChild(st);',
  '}',
  '',
].join(EOL);
once('helper', '// U-panel tab renderer. Rebuilt on every interaction (roster is tiny); the', HELPER + '// U-panel tab renderer. Rebuilt on every interaction (roster is tiny); the');
once('call', '  _mmRosterCss();' + EOL, '  _mmRosterCss();' + EOL + '  _mmHuntCss();' + EOL);

// 2. the hunt block
const A0 = '  // Progress toward the next binding — top uncaptured species by kills.', A1 = "  html += '</div>';   // close the themed shell";
if (count(A0) !== 1 || count(A1) !== 1) die('hunt anchors ' + count(A0) + '/' + count(A1));
const j0 = s.indexOf(A0), j1 = s.indexOf(A1);
if (!(j1 > j0 && j1 - j0 < 3500)) die('hunt bounds ' + j0 + '..' + j1);
const old = s.slice(j0, j1);
for (const must of ['HUNT PROGRESS', 'prog.slice(0, 8)', 'MOJIMON_KILLS_REQ', 'Eligible species found', 'mm.roster[k]']) if (!old.includes(must)) die('the hunt block moved: no ' + must);
const NEW = part('_mm_hunt.js.txt').split('\n').join(EOL) + EOL;
for (const must of ['prog.slice(0, 8)', 'mm.roster[k]', 'prog.sort((a, b) => b[1] - a[1]);', 'Eligible species found']) if (!NEW.includes(must)) die('the new hunt block lost ' + must);
s = s.slice(0, j0) + NEW + s.slice(j1);

if ([...s].some((c) => { const n = c.codePointAt(0); return n >= 0xD800 && n <= 0xDFFF; })) die('lone surrogate');
const grew = s.length - n0;
if (grew < 4000 || grew > 12000) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: mm-hunt (+' + grew + ' chars)');
