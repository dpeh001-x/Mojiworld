// The Skills tab's Rank Points pool, more pop comic: the number on a starburst with a deep ink shadow.
// ============================================================================
// Per user, on the RANK POINTS (RP) bar (a white tag, "995" on a violet disc, "to invest", Reset RP): "this can be
// better improved, the number can have more shadow, can have more pop comic feel, after that can ship".
//   - the pool number is bigger (30 px Nunito 900) with a thick ink stroke and a four-step ink EXTRUSION (1-4 px down
//     and right) finished by a drop in the class's deep shade: a comic numeral that stands off the card;
//   - behind it the plain disc becomes a comic STARBURST - twelve points, in the class colour with a halftone screen
//     and a top light - sitting on a black burst offset down and right, which is both its ink outline and its hard
//     shadow; the whole sticker is tilted like a slapped-on label;
//   - "to invest" becomes an upright white caption in caps.
// Pseudo-elements only: #rank-pool keeps its id and text (the pool count updates in place), the tag, the Reset RP
// button and the card are untouched. The burst is clip-path + backgrounds, no box-shadow, so it holds in the
// low-graphics mode.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) rp-pop/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const count = (a) => s.split(a).length - 1;
const L = (...x) => x.join(EOL);

// a twelve-point starburst, as a clip-path polygon (outer 50%, inner 36% of the box, from 12 o'clock)
const pts = [];
for (let k = 0; k < 24; k++) {
  const a = (k / 24) * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 36 : 50;
  pts.push((50 + Math.cos(a) * r).toFixed(1) + '% ' + (50 + Math.sin(a) * r).toFixed(1) + '%');
}
const BURST = 'polygon(' + pts.join(', ') + ')';

const A = "      .skl-sp-card > span:nth-of-type(3) { color: rgba(244,241,234,0.72) !important; font: 800 11px 'Nunito', system-ui, sans-serif !important; }";
if (count(A) !== 1) die('anchor matched ' + count(A));
if (count('<span id="rank-pool" class="skl-sp-num">') !== 1) die('the pool number moved');
const CSS = L(
  '      /* v0.30.1072 rp-pop — the RP pool, more pop comic (per user: "the number can have more shadow, can have more pop comic feel"):',
  '         a bigger numeral with a four-step ink extrusion and a class-shade drop, on a twelve-point starburst in the class colour',
  '         with a halftone screen, over a black burst offset down-right (its outline and hard shadow); tilted. See apply_rp_pop.mjs. */',
  '      .skl-sp-card .skl-sp-num {',
  '        position: relative; z-index: 0; isolation: isolate; min-width: 64px; height: 52px; padding: 0 15px; margin: -4px 4px -4px 2px;',
  '        background: none; border: 0; box-shadow: none; border-radius: 0; transform: rotate(-6deg);',
  "        font: 900 30px/1 'Nunito', system-ui, sans-serif; color: #ffffff; -webkit-text-stroke: 5px #0c0b10; paint-order: stroke fill;",
  '        text-shadow: 1px 1px 0 #0c0b10, 2px 2px 0 #0c0b10, 3px 3px 0 #0c0b10, 4px 4px 0 #0c0b10, 6px 6px 0 var(--sp-dp, #3b1d6e);',
  '      }',
  "      .skl-sp-card .skl-sp-num::before, .skl-sp-card .skl-sp-num::after { content: ''; position: absolute; z-index: -1; pointer-events: none; clip-path: " + BURST + '; }',
  '      .skl-sp-card .skl-sp-num::before { inset: -4px -5px -8px -3px; background: #0c0b10; }',
  '      .skl-sp-card .skl-sp-num::after { inset: -3px -6px -3px -6px;',
  '        background: radial-gradient(circle, rgba(255,255,255,0.28) 1.1px, rgba(0,0,0,0) 1.7px) 0 0 / 6px 6px,',
  '                    radial-gradient(60% 50% at 40% 25%, rgba(255,255,255,0.45), rgba(255,255,255,0) 70%), var(--sp-c, #8a4dff); }',
  "      .skl-sp-card > span:nth-of-type(3) { color: #f4f1ea !important; font: 900 11px 'Nunito', system-ui, sans-serif !important; letter-spacing: 1.2px; text-transform: uppercase !important; }",
  '');
s = s.replace(A, () => A + EOL + CSS.replace(/\r?\n$/, ''));

const grew = s.length - n0;
if (grew < 1500 || grew > 4000) die('size moved ' + grew);
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
console.log('applied: rp-pop (+' + grew + ' chars)');
