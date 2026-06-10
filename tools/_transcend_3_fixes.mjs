// Transcendence · Batch 3 — audit fixes:
// (1) Reforge excludes transcended gear (reforge's key-strip would wipe the
//     800◈ bake irreversibly — pre-existing strip flaw, but transcendence
//     raises the stakes; the reborn base stats are now declared permanent).
// (2) Bake rounding: 4dp for |v|<1 so small percent stats (lifesteal 0.03)
//     actually retain their transcend premium instead of rounding it away.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // (1a) candidate filter
  { old: `    if (it && it.affixes && (it.dropLevel || 0) >= 50) candidates.push({ slot, item: it });`,
    neu: `    // v0.26.842+ — transcended (🜂) gear is reforge-ineligible: the reforge
    // key-strip deletes every affix-capable stat key, which would wipe the
    // baked transcend premium irreversibly (transcended flag survives, so it
    // could never re-bake). The reborn base stats are permanent by design.
    if (it && it.affixes && (it.dropLevel || 0) >= 50 && !it.transcended) candidates.push({ slot, item: it });` },
  // (1b) explain it in the confirm body
  { old: `    '• Only equipped, Lv 50+ gear that carries rolled affixes qualifies.\\n\\n' +`,
    neu: `    '• Only equipped, Lv 50+ gear that carries rolled affixes qualifies.\\n' +
    '• 🜂 Transcended gear cannot be reforged — its reborn base stats are permanent.\\n\\n' +` },
  // (2) bake rounding — 4dp for sub-1 fractions
  { old: `    it[k] = Math.round(it[k] * _keepMul * 100) / 100;`,
    neu: `    // 4dp for fractional (percent-style) stats so small values like
    // lifesteal 0.03 keep their premium (0.0324) instead of rounding it away.
    it[k] = Math.abs(it[k]) < 1 ? Math.round(it[k] * _keepMul * 10000) / 10000
                                : Math.round(it[k] * _keepMul * 100) / 100;` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' audit fixes applied.');
