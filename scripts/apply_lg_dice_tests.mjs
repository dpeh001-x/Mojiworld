// innate_card_test after the bonus rolls became dice (apply_lg_dice.mjs): step 3's "column heights are the tally,
// ticks the typical roller" becomes "no bar chart: three dice showing 0, 1 and 2 pips, adding up to the bonus".
// The tally check ("+0x13" ...) and the luck pill check are untouched. Guarded, idempotent.
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/scripts/innate_card_test.mjs';
let s = readFileSync(F, 'utf8');
if (s.includes('lg-dice')) { console.log('innate_card_test.mjs: already patched'); process.exit(0); }
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const R = [
  ['//   3. the roll columns carry the tally, their heights are the tally on one scale with the typical' + EOL + '//      tick, and the luck pill reads the average against 1 per level',
   '//   3. the roll dice carry the tally (lg-dice: three dice with 0 / 1 / 2 pips, no bar chart) and add' + EOL + '//      up to the bonus, and the luck pill reads the average against 1 per level'],
  ["    h: [...c.querySelectorAll('.lg-col')].map((e) => [parseFloat(e.style.getPropertyValue('--h')), parseFloat(e.style.getPropertyValue('--e'))]),",
   "    h: [...c.querySelectorAll('.lg-col')].map((e) => e.querySelectorAll('.lg-die i').length), chart: c.querySelectorAll('.lg-chart, .lg-bar, .lg-track').length,"
   + " sum: (c.querySelector('.lg-dice-sum') || {}).textContent || null,"],
  ["  // one scale for bars and ticks: the largest of the counts and the typical counts (59 x .25/.5/.25)" + EOL
   + "  const top = Math.max(13, 22, 24, 29.5), wantH = [13, 22, 24].map((n) => n / top), wantE = [14.75, 29.5, 14.75].map((n) => n / top);" + EOL
   + "  ok('3. column heights are the tally, ticks the typical roller, on one scale', A.h.length === 3 && A.h.every(([hh, ee], i) => Math.abs(hh - wantH[i]) < 0.002 && Math.abs(ee - wantE[i]) < 0.002), JSON.stringify(A.h));",
   "  // lg-dice: no bar chart - three dice with 0, 1 and 2 pips, and a pill adding them up (13x0 + 22x1 + 24x2 = 70; the card's bonus is 63)" + EOL
   + "  ok('3. no bar chart: three dice showing 0, 1 and 2 pips, and the sum pill names the bonus SP', A.h.join() === '0,1,2' && A.chart === 0 && /\\+63\\s*SP/.test(A.sum || ''), JSON.stringify([A.h, A.chart, A.sum]));"],
  ['//   4. the last-roll line: jackpot / lucky / plain by the roll, "No level-ups yet" at level 1',
   '//   4. no "Last level" banner once you have levelled (lg-dice, per user); "No level-ups yet" at level 1'],
  ["  ok('4. a +2 roll is a jackpot sticker', A.last && /jackpot/.test(A.last.cls) && /\\+2 SP/.test(A.last.txt) && /JACKPOT/.test(A.last.txt), JSON.stringify(A.last));",
   "  ok('4. no \"Last level\" banner after a +2 roll (removed per user)', A.last === null, JSON.stringify(A.last));"],
  ["  ok('4. a +1 roll is a lucky sticker', K.last && /lucky/.test(K.last.cls) && !/jackpot/.test(K.last.cls), JSON.stringify(K.last));",
   "  ok('4. no \"Last level\" banner after a +1 roll either', K.last === null, JSON.stringify(K.last));"],
  ["  ok('4. a +0 roll is a plain sticker, and one level-up gives 30 / 12 / 3 / 2', U.last && !/lucky|jackpot/.test(U.last.cls) && /unlucky/i.test(U.last.txt) && U.stats.length === 4 && /^\\+30HP/.test(U.stats[0]), JSON.stringify([U.last, U.stats]));",
   "  ok('4. no banner after a +0 roll, and one level-up gives 30 / 12 / 3 / 2', U.last === null && U.stats.length === 4 && /^\\+30HP/.test(U.stats[0]), JSON.stringify([U.last, U.stats]));"],
];
for (const [a, z] of R) { if (s.split(a).length !== 2) die('anchor matched ' + (s.split(a).length - 1) + ': ' + a.slice(0, 70)); s = s.replace(a, () => z); }
writeFileSync(F, s);
console.log('innate_card_test.mjs: patched (bars -> dice)');
