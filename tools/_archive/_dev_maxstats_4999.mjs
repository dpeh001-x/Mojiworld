// Dev panel (key 0) MAX STATS: 999 -> 4999 per user. Speed cap (10) and the
// jump-preservation rule untouched.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  { old: `  combSec.appendChild(btn('🏆 MAX STATS (999 + 50k HP/MP)', () => {
    player.baseAtk   = 999;
    player.baseDef   = 999;
    player.baseAcc   = 999;
    player.baseCrit  = 999;`,
    neu: `  combSec.appendChild(btn('🏆 MAX STATS (4999 + 50k HP/MP)', () => {   // v0.26.906 — 999 → 4999 per user
    player.baseAtk   = 4999;
    player.baseDef   = 4999;
    player.baseAcc   = 4999;
    player.baseCrit  = 4999;` },
  { old: `    if (typeof showToast === 'function') showToast('🏆 MAX STATS — 999 across the board (speed +10), 50k HP/MP', 'legendary');`,
    neu: `    if (typeof showToast === 'function') showToast('🏆 MAX STATS — 4999 across the board (speed +10), 50k HP/MP', 'legendary');` },
  { old: `    devLog('Max stats applied: ATK/DEF/ACC/CRIT=999, SPD=10, HP/MP=50000, SP=1000 (jump preserved)');`,
    neu: `    devLog('Max stats applied: ATK/DEF/ACC/CRIT=4999, SPD=10, HP/MP=50000, SP=1000 (jump preserved)');` },
];

let n = 0;
for (let { old, neu } of reps) {
  let o = old, r = neu;
  if (src.split(o).length - 1 !== 1) { o = old.replace(/\n/g, '\r\n'); r = neu.replace(/\n/g, '\r\n'); }
  const c = src.split(o).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(o, r); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' max-stats edits applied.');
