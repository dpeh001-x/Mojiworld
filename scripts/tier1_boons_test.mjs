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

// v0.29.369 — duo-boon combos (BOON_SYNERGIES entries for the new roster).
console.log('\n== duo-boon combos ==');
const COMBOS = {
  supernova:       { pair: ['novastep', 'flamedash'], art: 'syn_supernova' },
  winterGarden:    { pair: ['bloom', 'freeze'],       art: 'syn_wintergarden' },
  quantumDouble:   { pair: ['blink', 'echo'],         art: 'syn_quantumdouble' },
  guillotine:      { pair: ['execute', 'crescendo'],  art: 'syn_guillotine' },
  adrenalineSurge: { pair: ['skin', 'rampage'],       art: 'syn_adrenaline' },
  phantomWaltz:    { pair: ['mirror', 'waltz'],       art: 'syn_phantomwaltz' },
};
for (const [key, c] of Object.entries(COMBOS)) {
  const re = new RegExp(`key: '${key}'[\\s\\S]{0,200}pair: \\['${c.pair[0]}', '${c.pair[1]}'\\][\\s\\S]{0,120}art: '${c.art}'`);
  check(`${key}: entry with pair + art`, re.test(src));
  const p = path.join(ROOT, 'Sprites', 'boons', c.art + '.png');
  check(`  Sprites/boons/${c.art}.png`, fs.existsSync(p) && fs.statSync(p).size > 5000);
  check(`  hook anchor _activeSynergies.${key}`, src.includes(`_activeSynergies.${key}`));
}
check('frost_bloom registered in LX_FX', /frost_bloom:\s*'frost_bloom\.webp'/.test(src));
check('Sprites/fx/frost_bloom.webp', fs.existsSync(path.join(ROOT, 'Sprites', 'fx', 'frost_bloom.webp')));

// v0.29.370 — balance invariants (audit). These pin the two exploit classes
// the engine already patched once and a boon must never reopen:
//   • v0.26.399: dash i-frames must stay SHORTER than the 240ms re-fire gate
//     (and the rogue's 280ms dodge CD, v0.26.966) — else dash-spam holds
//     permanent invincibility. Hyper Teleport shipped at 320ms and did
//     exactly that until this audit.
//   • Bullet Waltz must halve its slow for bosses — full-value permanent
//     slow turns every melee boss into a kite dummy.
console.log('\n== balance invariants ==');
const blinkGrant = src.match(/dashBlink > 0[\s\S]{0,900}?player\.invulnerable = Math\.max\(player\.invulnerable \|\| 0, (\d+)\)/);
check('blink i-frame grant found', !!blinkGrant);
if (blinkGrant) check(`blink i-frames ${blinkGrant[1]}ms < 240ms dash gate`, Number(blinkGrant[1]) < 240);
check('waltz halves boss slow', /_waltzMulAt\(cx, cy, isBoss\)[\s\S]{0,700}if \(isBoss\) s \*= 0\.5;/.test(src));
check('monster call site passes boss flag', /_waltzMulAt\(m\.x \+ m\.w \/ 2, m\.y \+ m\.h \/ 2, !!\(m\.isBoss \|\| m\.boss\)\)/.test(src));
// v0.29.371 (audit 2): the flame trail must throttle ticks PER ENEMY across
// all patches — the per-patch map alone measured 12.6× basic DPS, because
// every dash frame spawns a fresh patch with a fresh map.
check('flame trail has global per-enemy throttle', /_flameTickAt \| 0\)\) < 20\) continue;\s*\n\s*m\._flameTickAt = now;/.test(src));

// v0.29.373 — BOON RARITY. Better outcomes must stay rarer: every POWERUPS
// entry carries a tier, all acquisition paths draw through the weighted
// picker (zero uniform draws left), and the weights keep their ordering.
console.log('\n== boon rarity ==');
const powerupsBlock = src.match(/const POWERUPS = \[[\s\S]*?\n\];/)[0];
const entries = [...powerupsBlock.matchAll(/\{ id:'([a-zA-Z_]+)', tier:'(common|rare|epic)'/g)];
check('all 37 active entries tiered', entries.length === 37, 'got ' + entries.length);
const tiers = Object.fromEntries(entries.map(e => [e[1], e[2]]));
for (const id of ['blink', 'echo', 'doppel', 'waltz', 'execute', 'skin'])
  check(`${id} is epic (audit-flagged strongest)`, tiers[id] === 'epic');
check('no uniform POWERUPS draws remain', !/Math\.random\(\) \* POWERUPS\.length/.test(src));
const w = src.match(/BOON_TIER_WEIGHT = \{ common: (\d+), rare: (\d+), epic: (\d+) \}/);
check('weights exist and are ordered common > rare > epic',
  !!w && Number(w[1]) > Number(w[2]) && Number(w[2]) > Number(w[3]));
check('Bravo bag draws weighted', /_weightedBoonPick\(_bag\)/.test(src));
check('Sage gacha draws weighted', /_weightedBoonPick\(POWERUPS\);\s*\/\/[^\n]*Sage/.test(src));

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + fail} checks\n`);
process.exit(fail ? 1 : 0);
