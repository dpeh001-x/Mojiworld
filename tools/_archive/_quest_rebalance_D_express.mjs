// Phase 1 Batch D — q_clockwork_express coherence + reward-ceiling trim.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // desc step 2 — was "Return to Milo... He opens the Endless Express" (retired flow)
  { old: `Return to Milo on the R-rooftop. He opens the Endless Express — a runaway carriage where the manifest is randomised each ride.`,
    neu: `Accept the run from your Quest Journal (J). The Endless Express is a runaway carriage where the manifest is randomised each ride.` },
  // desc step 4 — clarify HOW you board (Milo still warps you when it's active)
  { old: `Board the Express. Mechs onboard scale to YOUR current level,`,
    neu: `Talk to Milo on the R-rooftop — he warps you aboard the Express. Mechs onboard scale to YOUR current level,` },
  // reward ceiling: 3200+N*80 / 2400+N*70  ->  3200+N*60 / 2400+N*50
  { old: `        mojicoins: 3200 + N * 80,`,
    neu: `        mojicoins: 3200 + N * 60,` },
  { old: `        exp:   2400 + N * 70,`,
    neu: `        exp:   2400 + N * 50,` },
  // sync the floor/ceiling comment
  { old: `      // Floor: 4,000 mojicoins / 3,200 EXP at N=10 (minimum roll).
      // Ceiling: 12,000 mojicoins / 9,400 EXP at N=99 (maximum roll).`,
    neu: `      // Floor: 3,800 mojicoins / 2,900 EXP at N=10 (minimum roll).
      // Ceiling: 9,140 mojicoins / 7,350 EXP at N=99 (maximum roll). // v0.26.823 — trimmed below the spread so the side-run no longer out-pays the S4 finale by much.` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${old.slice(0, 64)}...`); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} express edits applied.`);
