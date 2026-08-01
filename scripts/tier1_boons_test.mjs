#!/usr/bin/env node
// v0.29.362 — Tier-1 boon roster consistency test.
//
//   node scripts/tier1_boons_test.mjs
//
// The ten mechanics were verified in a live client (they run deep in game
// state — dash windows, aggro pools, cast timers — which a node harness
// can't boot). What CAN silently rot without a booted client is the
// three-way contract this file pins:
//   1. every Tier-1 POWERUPS entry exists, is `unique`, and its id matches
//      a real icon at Sprites/boons/<id>.png (v0.29.355 bound them);
//   2. every stat the entries write is declared in the player.mods literal
//      (the `for k in M` reset can only zero keys that exist);
//   3. every FX key the render sites spawn is registered in LX_FX and its
//      file exists on disk;
//   4. the Second Skin inversion stays sane: roll 2..8 -> cooldown 14..8 s.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');

const TIER1 = {
  waltz:     { stat: 'waltzSlow',     fx: 'time_ripple' },
  mirror:    { stat: 'mirrorTaunt',   fx: null },            // procedural afterimage
  crescendo: { stat: 'crescendoCrit', fx: 'crescendo_hit' },
  execute:   { stat: 'executeCull',   fx: 'execute_mark' },
  riposte:   { stat: 'riposteNova',   fx: 'nova_ring' },     // reuse, by design
  skin:      { stat: 'skinCd',        fx: 'skin_ward' },
  rampage:   { stat: 'rampStacks',    fx: 'rampage_aura' },
  goldblood: { stat: 'goldBlood',     fx: 'coin_burst' },
  overflow:  { stat: 'overflowCarry', fx: 'overflow_arc' },
  doppel:    { stat: 'doppelChance',  fx: 'doppel_flash' },
};

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  if (ok) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail ? '  [' + detail + ']' : '')); }
};

console.log('\n== POWERUPS entries ==');
for (const [id, meta] of Object.entries(TIER1)) {
  const re = new RegExp(`\\{ id:'${id}',[^\\n]*stat:'${meta.stat}'[^\\n]*unique:true`);
  check(`${id}: entry exists, stat '${meta.stat}', unique`, re.test(src));
}

console.log('\n== icons on disk (ids bound in v0.29.355) ==');
for (const id of Object.keys(TIER1)) {
  const p = path.join(ROOT, 'Sprites', 'boons', id + '.png');
  check(`Sprites/boons/${id}.png`, fs.existsSync(p) && fs.statSync(p).size > 5000);
}

console.log('\n== mods literal declares every stat ==');
const modsBlock = src.match(/mods: \{[\s\S]*?overflowCarry:0, doppelChance:0 \}/);
check('mods literal block found', !!modsBlock);
if (modsBlock) {
  for (const meta of Object.values(TIER1)) {
    check(`mods.${meta.stat} declared`, new RegExp(`${meta.stat}:0`).test(modsBlock[0]));
  }
}

console.log('\n== FX registered + on disk ==');
for (const [id, meta] of Object.entries(TIER1)) {
  if (!meta.fx) continue;
  check(`LX_FX.${meta.fx} registered`, new RegExp(`${meta.fx}:\\s*'${meta.fx}\\.webp'`).test(src));
  const p = path.join(ROOT, 'Sprites', 'fx', meta.fx + '.webp');
  check(`Sprites/fx/${meta.fx}.webp`, fs.existsSync(p) && fs.statSync(p).size > 5000);
}

console.log('\n== read-sites exist ==');
for (const anchor of ['_waltzMulAt', '_mirrorDecoy', '_crescendoN', '_cullNoOverflow',
                      '_riposteAt', '_skinReadyAt', '_rampN', 'goldBlood > 0',
                      'overflowCarry > 0', '_doppelCasting']) {
  check(`anchor "${anchor}"`, src.includes(anchor));
}
check("'overflow' is MISS_EXEMPT", /MISS_EXEMPT_SKILLS = new Set\(\[[^\]]*'overflow'/.test(src));

console.log('\n== Second Skin inversion ==');
const skinEntry = src.match(/id:'skin',[^\n]*min:(\d+),\s+max:(\d+)[^\n]*scale:r=>16 - r/);
check('skin: scale is 16 - r', !!skinEntry);
if (skinEntry) {
  const lo = 16 - Number(skinEntry[2]), hi = 16 - Number(skinEntry[1]);
  check(`cooldown band is ${lo}..${hi}s (want 8..14)`, lo === 8 && hi === 14);
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + fail} checks\n`);
process.exit(fail ? 1 : 0);
