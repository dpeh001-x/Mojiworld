// DJ Vinyl's console: every circuit line and node at 15% opacity.
// ============================================================================
// Per user, on the v0.30.995 lines-and-nodes background: "Make the opacity of the nodes and circuitry 15%".
// Inside the jb-tech block only:
//   - the network tiles (faceplate, deck, pad plate, backdrop): every trace and node 15% (were 7-28%);
//   - the deck's lit nodes: dark at rest, pulsing up to 15% while a track plays (were 14% at rest, 70% at the peak);
//   - the top-bar data bus: its trace, ticks and end nodes 15% (were 24-60%).
// The pulse of light running along the bus is not circuitry and stays as it is.
//
// Guarded (every value matched an exact number of times, inside the block only) + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) jb-tech15/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const i0 = s.search(/v0\.30\.\d+ jb-tech /);
const ANCHOR = '</style>' + EOL + '<div id="jukebox-modal-bg"';
if (i0 < 0) die('the jb-tech block is not here');
if (s.split(ANCHOR).length - 1 !== 1) die('anchor matched ' + (s.split(ANCHOR).length - 1));
const i1 = s.indexOf(ANCHOR);
if (!(i1 > i0 && i1 - i0 < 12000)) die('block bounds ' + i0 + '..' + i1);
let b = s.slice(i0, i1);
const EDITS = [
  ["opacity='0.07'", "opacity='0.15'", 1], ["opacity='0.16'", "opacity='0.15'", 2], ["opacity='0.1'", "opacity='0.15'", 3],
  ["opacity='0.26'", "opacity='0.15'", 2], ["opacity='0.28'", "opacity='0.15'", 4],
  ['pointer-events: none; opacity: 0.14; }', 'pointer-events: none; opacity: 0; }', 1],
  ['@keyframes jb-node { from { opacity: 0.08; } to { opacity: 0.7; } }', '@keyframes jb-node { from { opacity: 0; } to { opacity: 0.15; } }', 1],
  ['rgba(62,232,255,0.6)', 'rgba(62,232,255,0.15)', 2], ['rgba(62,232,255,0.24)', 'rgba(62,232,255,0.15)', 1], ['rgba(62,232,255,0.3)', 'rgba(62,232,255,0.15)', 2],
];
for (const [a, z, n] of EDITS) {
  const c = b.split(a).length - 1;
  if (c !== n) die(`"${a}" matched ${c}, expected ${n}`);
  b = b.split(a).join(z);
}
const NOTE = '  /* v0.30.998 jb-tech15 — every line and node above at 15% opacity (per user: "Make the opacity of the nodes and circuitry 15%") */' + EOL;
s = s.slice(0, i0) + b + NOTE + s.slice(i1);

const grew = s.length - n0;
if (grew < 60 || grew > 400) die('size moved ' + grew);
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
console.log('applied: jb-tech15 (+' + grew + ' chars)');
