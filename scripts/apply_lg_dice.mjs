// Innate Growth's bonus rolls, condensed into three tossed dice.
// ============================================================================
// Per user, on the Innate Growth card: "condense the bonus roll section, there is no need for bar charts for that
// section, but make it easy to understand", then "and make the design artistic".
// The three bar-chart columns (bars on one scale, dashed "typical" ticks) become one row of three tossed dice - a +0
// face (a dash), a +1 face (one pip), a +2 face (two pips), drawn in CSS, grey to white like the columns were, each
// tilted as if just thrown - each with how often it came up ("+1 x58"), and a white "= +90 SP" pill: the dice add up
// to the bonus SP the card's SP bar shows. The luck pill and the note stay (the note now says it is a die: +0, +1
// or +2 SP); the tally, the tooltips and the colour rules (black and white outside the four stat tiles) are the
// same. Hovering a die gives it a spin. The dice keep the .lg-col class and "+0x13" text innate_card_test reads.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) lg-dice/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const count = (a) => s.split(a).length - 1;
const L = (...x) => x.join(EOL);

// 1. the markup
const A0 = '      const top = Math.max(1, ...counts, ...expect);', A1 = "      h += '</div></div>';";
if (count(A0) !== 1) die('rolls start matched ' + count(A0));
const j0 = s.indexOf(A0), j1 = s.indexOf(A1, j0);
if (!(j1 > j0 && j1 - j0 < 2500)) die('rolls bounds ' + j0 + '..' + j1);
const old = s.slice(j0, j1 + A1.length);
for (const must of ['lg-chart', 'lg-luck t-', 'Bonus rolls', 'counts[i]', 'expect[i]']) if (!old.includes(must)) die('the rolls block moved: no ' + must);
const NEW = L(
  '      // v0.30.1070 lg-dice — the bonus rolls, condensed: three tossed dice (+0 / +1 / +2, pips drawn in CSS), each with how often',
  '      // it came up, adding up to the bonus SP (per user: "condense the bonus roll section, there is no need for bar charts for',
  '      // that section, but make it easy to understand" / "make the design artistic"). Same tally, same luck pill.',
  "      const _dice = ['<span class=\"lg-die f0\"></span>', '<span class=\"lg-die f1\"><i></i></span>', '<span class=\"lg-die f2\"><i></i><i></i></span>'];",
  "      h += '<div class=\"lg-rolls\"><div class=\"lg-rolls-head\"><span class=\"lg-label\">&#127922; Bonus rolls</span>'",
  "        + '<span class=\"lg-luck t-' + luck[0] + '\" title=\"Your bonus SP per level-up, on average. 1.00 is normal.\">' + luck[1] + ' &middot; avg +' + avg.toFixed(2) + '</span></div>'",
  "        + '<div class=\"lg-note-row\"><div class=\"lg-note\">Each level rolls <b>+0, +1 or +2 SP</b>.</div>'",
  "        + '<div class=\"lg-dice-sum\" title=\"What your bonus dice have added up to\">Total <b>+' + bonus + '</b> SP</div></div><div class=\"lg-dice\">';",
  '      for (let i = 0; i < 3; i++) {',
  '        const n = counts[i] || 0;',
  "        h += '<div class=\"lg-col lg-dc r' + i + '\" title=\"+' + i + ' SP rolled ' + n + ' time' + (n === 1 ? '' : 's') + ' (about ' + Math.round(expect[i]) + ' is typical)\">'",
  "          + _dice[i] + '<b>+' + i + '</b><span class=\"lg-n\">&times;' + n + '</span></div>';",
  '      }',
  "      h += '</div></div>';");
s = s.slice(0, j0) + NEW + s.slice(j1 + A1.length);

// 2. the look, in the card's own stylesheet, after the old column rules
const C0 = '  #lp-innate .lg-col > span { margin-top: 3px;';
if (count(C0) !== 1) die('css anchor matched ' + count(C0));
const cEnd = s.indexOf(EOL, s.indexOf(C0)) + EOL.length;
const CSS = L(
  '  /* v0.30.1070 lg-dice — the bonus rolls as three tossed dice in one row, each with its count, and "= +N SP" (see apply_lg_dice.mjs):',
  '     grey to white by face value, like the columns they replace; ink pips; each tilted as if just thrown; a spin on hover */',
  '  #lp-innate .lg-note-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 10px; margin-top: 8px; }',
  '  #lp-innate .lg-note-row .lg-note { margin-top: 0; white-space: nowrap; }',
  '  #lp-innate .lg-dice { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin-top: 11px; }',
  '  #lp-innate .lg-col.lg-dc { flex-direction: row; align-items: center; gap: 6px; }',
  '  #lp-innate .lg-col.lg-dc.r0 { --df: #5a5a63; --rt: -10deg; }',
  '  #lp-innate .lg-col.lg-dc.r1 { --df: #b8b8c1; --rt: 7deg; }',
  '  #lp-innate .lg-col.lg-dc.r2 { --df: #ffffff; --rt: -5deg; }',
  '  #lp-innate .lg-col.lg-dc > .lg-die { position: relative; flex: none; width: 25px; height: 25px; margin: 0; box-sizing: border-box; border-radius: 7px;',
  '    background: linear-gradient(145deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), var(--df); border: 2px solid #0c0c0f; outline: 1.5px solid rgba(255,255,255,0.4);',
  '    transform: rotate(var(--rt)); transition: transform 0.45s cubic-bezier(.3,1.6,.5,1); }',
  '  #lp-innate .lg-col.lg-dc:hover > .lg-die { transform: rotate(calc(var(--rt) + 360deg)) scale(1.1); }',
  '  #lp-innate .lg-die i { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #0c0c0f; }',
  '  #lp-innate .lg-die.f1 i { left: 8px; top: 8px; }',
  '  #lp-innate .lg-die.f2 i:nth-child(1) { left: 3px; top: 3px; }',
  '  #lp-innate .lg-die.f2 i:nth-child(2) { right: 3px; bottom: 3px; }',
  "  #lp-innate .lg-die.f0::after { content: ''; position: absolute; left: 6px; right: 6px; top: 9px; height: 3px; border-radius: 2px; background: rgba(12,12,15,0.55); }",
  "  #lp-innate .lg-col.lg-dc > b { margin: 0; font: 900 11.5px/1 'Nunito', system-ui, sans-serif; color: #9d9da7; }",
  "  #lp-innate .lg-col.lg-dc > .lg-n { margin: 0; font: 1000 15.5px/1 'Nunito', system-ui, sans-serif; color: #fff; }",
  "  #lp-innate .lg-dice-sum { flex: none; padding: 4px 9px 3px; border-radius: 999px; white-space: nowrap; background: #fff; color: #0c0c0f; font: 800 11px/1 'Nunito', system-ui, sans-serif; }",
  '  #lp-innate .lg-dice-sum b { font-weight: 1000; font-size: 12.5px; }',
  '  @media (prefers-reduced-motion: reduce) { #lp-innate .lg-col.lg-dc > .lg-die { transition: none; } }',
  '');
s = s.slice(0, cEnd) + CSS + s.slice(cEnd);

// 3. no "Last level: +N SP" banner (per user: "remove the part of the last level"); the level-1 note stays
const B0 = "    if (typeof lastR === 'number') {", B1 = '    if (inn._lgHtml !== h) { inn.innerHTML = h; inn._lgHtml = h; }';
if (count(B0) !== 1 || count(B1) !== 1) die('last-level anchors ' + count(B0) + '/' + count(B1));
const k0 = s.indexOf(B0), k1 = s.indexOf(B1);
if (!(k1 > k0 && k1 - k0 < 1500)) die('last-level bounds ' + k0 + '..' + k1);
const oldLast = s.slice(k0, k1);
if (!oldLast.includes('Last level:') || !oldLast.includes('No level-ups yet')) die('the last-level block moved');
const noteLine = oldLast.split(EOL).find((l) => l.includes('No level-ups yet'));
s = s.slice(0, k0) + L(
  '    // v0.30.1070 lg-dice — no "Last level: +N SP" banner any more (per user: "remove the part of the last level"): the dice above',
  '    // tally every roll. The level-1 note stays - with no level-ups the card has nothing else to say yet.',
  "    if (typeof lastR !== 'number') {",
  noteLine,
  '    }',
  '') + s.slice(k1);

const grew = s.length - n0;
if (grew < 1500 || grew > 5000) die('size moved ' + grew);
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
console.log('applied: lg-dice (+' + grew + ' chars)');
