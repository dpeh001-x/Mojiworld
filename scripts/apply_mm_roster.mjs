// The MojiMon roster cards, in the cute style of the cards above them (v0.30.1007 mm-cards).
// ============================================================================
// Per user: "do the same cute style for the roster cards".
//   - each MojiMon is a plush card (stitched seam, star-dot sprinkle, a pastel glow; mint when it is fielded);
//   - its sprite sits in a pastel bubble and bobs while it is out; the name in Fredoka with a mint FIELDED pill;
//   - its stats are pills: 💖 max HP, ⚔ attack, 🛡 damage reduction; its HP while out a rounded candy bar;
//   - ★ H (gold when it holds the H slot) and ✨ Summon (mint; 💤 and greyed on cooldown) are candy buttons;
//   - the bond is a pill, lit mint on the H-slot MojiMon (the only one paying out), with the same tooltip;
//   - Allocate points: a "N free" chip and a "max 15 per stat" chip, and each stat a row of candy - / + steppers,
//     the value, a little meter filling up to the cap, and the bonus - HP pink, ATK butter, DEF sky;
//   - no MojiMon yet: a night-meadow card - the snail crawls over a hill leaving a glitter trail, three "?" slots wait.
// Same handlers (_mojimonUi.upg / assign / summon), same numbers and the same disabled rules (- is now also greyed
// at 0, where it did nothing). Stylesheet: scripts/_mm_roster.css.txt, added once by _mmRosterCss(); the markup is
// scripts/_mm_roster.js.txt.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) mm-roster/.test(s)) { console.log('already applied'); process.exit(0); }
if (!/v0\.30\.\d+ mm-cards/.test(s)) { console.error('ABORT the mm-cards build is not here'); process.exit(1); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const count = (a) => s.split(a).length - 1;
const once = (label, a, z) => { if (count(a) !== 1) die(label + ' matched ' + count(a)); s = s.replace(a, () => z); };
const part = (f) => readFileSync(path.join(HERE, f), 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '');

// 1. the stylesheet, added once, right after the cards' own
const CSS = part('_mm_roster.css.txt');
if (!CSS.includes('#u-pane-mojimon .mmr-card') || /[^\x00-\x7e\n\u2014]/.test(CSS)) die('the stylesheet file looks wrong');
const HELPER = [
  '// v0.30.1012 mm-roster — the roster cards in the same cute style (per user: "do the same cute style for the roster',
  '// cards"). Their stylesheet, added once. See scripts/apply_mm_roster.mjs.',
  'function _mmRosterCss() {',
  "  if (document.getElementById('mm-roster-css')) return;",
  "  const st = document.createElement('style'); st.id = 'mm-roster-css';",
  '  st.textContent = ' + JSON.stringify(CSS) + ';',
  '  document.head.appendChild(st);',
  '}',
  '',
].join(EOL);
once('helper', '// U-panel tab renderer. Rebuilt on every interaction (roster is tiny); the', HELPER + '// U-panel tab renderer. Rebuilt on every interaction (roster is tiny); the');
once('call', '  _mmCardsCss();' + EOL, '  _mmCardsCss();' + EOL + '  _mmRosterCss();' + EOL);

// 2. the roster block
const A0 = '  if (!rosterKeys.length) {', A1 = '  // Progress toward the next binding';
if (count(A0) !== 1 || count(A1) !== 1) die('roster anchors ' + count(A0) + '/' + count(A1));
const j0 = s.indexOf(A0), j1 = s.indexOf(A1);
if (!(j1 > j0 && j1 - j0 < 7000)) die('roster bounds ' + j0 + '..' + j1);
const old = s.slice(j0, j1);
for (const must of ['_mojimonUi.upg(', '_mojimonUi.assign(', '_mojimonUi.summon(', '_mojimonAuraLabel(k)', 'MOJIMON_UPG_PT_CAP', 'MOJIMON_DEF_CAP', 'No MojiMon bound yet.']) {
  if (!old.includes(must)) die('the roster moved: no ' + must);
}
const NEW = part('_mm_roster.js.txt').split('\n').join(EOL) + EOL;
for (const must of ['_mojimonUi.upg(', '_mojimonUi.assign(', '_mojimonUi.summon(', '_mojimonAuraLabel(k)', '_mmUpgPts(rec.upg.def) * MOJIMON_UPG.def']) {
  if (!NEW.includes(must)) die('the new roster lost ' + must);
}
s = s.slice(0, j0) + NEW + s.slice(j1);

if ([...s].some((c) => { const n = c.codePointAt(0); return n >= 0xD800 && n <= 0xDFFF; })) die('lone surrogate');
const grew = s.length - n0;
if (grew < 5000 || grew > 16000) die('size moved ' + grew);
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
console.log('applied: mm-roster (+' + grew + ' chars)');
