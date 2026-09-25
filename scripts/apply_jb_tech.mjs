// DJ Vinyl's console gets a slight tech feel: circuit lines and nodes etched into its background.
// ============================================================================
// Per user, on the v0.30.988 console: "improve on the background of the UI slight tech feel", then "tech lines and
// nodes feel". One small circuit network (traces with 45-degree bends, solid junction nodes, ringed end nodes) is
// drawn as a seamless SVG tile and etched, faint, into:
//   - the faceplate (visible round the edges, the top bar and the footer);
//   - the deck plate, a little brighter, with its nodes lighting up in turn while a track plays;
//   - the pad plate, behind the pads (it scrolls with them, like a board);
//   - the club backdrop, larger and fainter.
// And a data bus runs across the top bar from the name plate to the found counter: a trace with a node at each end
// and a tick scale, with a pulse of light running along it while music plays.
// All of it is background images and borders - no shadows - so it shows in the low-graphics mode too, and the
// animations stop for prefers-reduced-motion. Additive: one CSS block before the jukebox </style>.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) jb-tech/.test(s)) { console.log('already applied'); process.exit(0); }
if (!/v0\.30\.\d+ jb-console/.test(s)) { console.error('ABORT the jb-console build is not here'); process.exit(1); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };

// ---- the network: a 260x180 tile whose traces leave one edge where they enter the opposite one ----
const TRACES = ['M0 30H80l16 16h74l16-16h74', 'M0 132H40l16-16h74l16 16h114', 'M214 0v60l-14 14v36l14 14v56',
  'M130 46v32l12 12h34', 'M70 116V84L58 72V60', 'M40 30V10', 'M180 132v28'];
const JUNC = [[130, 46], [70, 116], [40, 30], [180, 132], [214, 30], [214, 132]];
const ENDS = [[176, 90], [58, 60], [40, 10], [180, 160]];
const svg = (body) => `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='180' viewBox='0 0 260 180'>${body}</svg>`;
const uri = (x) => `url("data:image/svg+xml,${x.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
const net = (lineA, nodeA) => uri(svg(
  `<g fill='none' stroke='#3ee8ff' stroke-opacity='${lineA}' stroke-width='1.2' stroke-linejoin='round'>${TRACES.map((d) => `<path d='${d}'/>`).join('')}</g>` +
  `<g fill='#3ee8ff' fill-opacity='${nodeA}'>${JUNC.map(([x, y]) => `<circle cx='${x}' cy='${y}' r='2.3'/>`).join('')}</g>` +
  `<g fill='#0a090e' stroke='#3ee8ff' stroke-opacity='${nodeA}' stroke-width='1.3'>${ENDS.map(([x, y]) => `<circle cx='${x}' cy='${y}' r='3.4'/>`).join('')}</g>`));
// the nodes that light up, in two sets that take turns
const lit = (set) => uri(svg(set.map(([x, y, c]) => `<circle cx='${x}' cy='${y}' r='7' fill='${c}' fill-opacity='.2'/><circle cx='${x}' cy='${y}' r='2.6' fill='${c}'/>`).join('')));
const LIT_A = lit([[130, 46, '#3ee8ff'], [214, 132, '#3ee8ff'], [58, 60, '#ff4fa3'], [180, 160, '#3ee8ff'], [40, 10, '#ffd84a']]);
const LIT_B = lit([[70, 116, '#3ee8ff'], [214, 30, '#3ee8ff'], [176, 90, '#b98cff'], [40, 30, '#3ee8ff'], [180, 132, '#8dff5a']]);

const CSS = [
  '  /* ===== v0.30.995 jb-tech — circuit lines and nodes etched into the console (per user: "slight tech feel",',
  '     "tech lines and nodes feel"). One seamless 260x180 network tile; see scripts/apply_jb_tech.mjs. ===== */',
  '  #jukebox-modal-bg::before { content: \'\'; position: absolute; inset: 0; pointer-events: none;',
  `    background: ${net(0.07, 0.16)} 40px 20px / 390px 270px repeat; }`,
  '  #jukebox-modal-bg #jukebox-modal {',
  '    background-image: radial-gradient(90% 45% at 50% -8%, rgba(185,140,255,0.13), transparent 70%),',
  '                      repeating-linear-gradient(90deg, rgba(255,255,255,0.022) 0 1px, rgba(0,0,0,0) 1px 3px),',
  `                      ${net(0.10, 0.26)},`,
  '                      linear-gradient(180deg, #1d1c23 0%, #131218 42%, #0b0a0f 100%) !important;',
  '    background-size: auto, auto, 260px 180px, auto !important; background-repeat: no-repeat, repeat, repeat, no-repeat !important;',
  '    background-position: 0 0, 0 0, -34px 6px, 0 0 !important; }',
  '  /* the deck plate: the same network a little brighter; while a track plays its nodes light up in turn */',
  `  #jukebox-modal .jb-deck { background: ${net(0.10, 0.28)} -60px -24px / 260px 180px repeat, linear-gradient(180deg, #0c0b10 0%, #121117 30%, #141319 100%); }`,
  '  #jukebox-modal .jb-deck::before, #jukebox-modal .jb-deck::after { content: \'\'; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none; opacity: 0.14; }',
  `  #jukebox-modal .jb-deck::before { background: ${LIT_A} -60px -24px / 260px 180px repeat; }`,
  `  #jukebox-modal .jb-deck::after { background: ${LIT_B} -60px -24px / 260px 180px repeat; }`,
  '  #jukebox-modal.jb-live .jb-deck::before, #jukebox-modal.jb-live .jb-deck::after { animation: jb-node 1.8s ease-in-out infinite alternate; }',
  '  #jukebox-modal.jb-live .jb-deck::after { animation-delay: -0.9s; }',
  '  @keyframes jb-node { from { opacity: 0.08; } to { opacity: 0.7; } }',
  '  /* the pad plate: the network behind the pads, scrolling with them */',
  `  #jukebox-list { background: ${net(0.10, 0.28)} -10px 30px / 260px 180px repeat local, linear-gradient(180deg, #0e0d12 0%, #121117 100%); }`,
  '  /* the data bus across the top bar: a trace from the name plate to the counter, a pulse running along it while music plays */',
  '  #jukebox-modal .jb-top .jb-grow { position: relative; align-self: center; height: 12px; margin: 0 4px;',
  '    background: radial-gradient(circle, #0a090e 0 2px, rgba(62,232,255,0.6) 2.5px 3.6px, rgba(0,0,0,0) 4px) left center / 10px 10px no-repeat,',
  '                radial-gradient(circle, #0a090e 0 2px, rgba(62,232,255,0.6) 2.5px 3.6px, rgba(0,0,0,0) 4px) right center / 10px 10px no-repeat,',
  '                repeating-linear-gradient(90deg, rgba(62,232,255,0.24) 0 1px, rgba(0,0,0,0) 1px 14px) center / calc(100% - 26px) 7px no-repeat,',
  '                linear-gradient(rgba(62,232,255,0.3), rgba(62,232,255,0.3)) center / calc(100% - 10px) 1px no-repeat; }',
  '  #jukebox-modal .jb-top .jb-grow::after { content: \'\'; position: absolute; left: 5px; right: 5px; top: 50%; height: 3px; margin-top: -1.5px; pointer-events: none; opacity: 0;',
  '    background: linear-gradient(90deg, rgba(62,232,255,0), #3ee8ff 40%, #fff 50%, #3ee8ff 60%, rgba(62,232,255,0)) -70px 0 / 70px 3px no-repeat; }',
  '  #jukebox-modal.jb-live .jb-top .jb-grow::after { opacity: 1; animation: jb-bus 1.4s linear infinite; }',
  '  @keyframes jb-bus { from { background-position: -70px 0; } to { background-position: calc(100% + 70px) 0; } }',
  '  @media (prefers-reduced-motion: reduce) { #jukebox-modal.jb-live .jb-deck::before, #jukebox-modal.jb-live .jb-deck::after, #jukebox-modal.jb-live .jb-top .jb-grow::after { animation: none; } }',
].join(EOL) + EOL;
if (/[^\x00-\x7e\r\n\u2014]/.test(CSS)) die('unexpected non-ASCII in the CSS');

const ANCHOR = '</style>' + EOL + '<div id="jukebox-modal-bg"';
if (s.split(ANCHOR).length - 1 !== 1) die('anchor matched ' + (s.split(ANCHOR).length - 1));
s = s.replace(ANCHOR, CSS + ANCHOR);

const grew = s.length - n0;
if (grew < 4000 || grew > 16000) die('size moved ' + grew);
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
console.log('applied: jb-tech (+' + grew + ' chars)');
