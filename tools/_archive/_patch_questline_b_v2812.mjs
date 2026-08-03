// v0.28.12 questline hardening — patch B: THE LONG DAWN chain + 6th fragment.
import fs from 'node:fs';
const P = 'mojiworld_game.html';
let s = fs.readFileSync(P, 'utf8');
if (s.length < 5_500_000) throw new Error('file suspiciously small: ' + s.length);
let n = 0;
function rep(anchor, replacement) {
  anchor = anchor.replace(/\r?\n/g, '\r\n');           // game file is CRLF
  replacement = replacement.replace(/\r?\n/g, '\r\n');
  const c = s.split(anchor).length - 1;
  if (c !== 1) throw new Error('anchor x' + c + ': ' + anchor.slice(0, 60));
  s = s.replace(anchor, replacement);
  n++;
}

// 6. THE LONG DAWN — Act 4 bridge questline (Lv 76–82). Fills the empty
//    stretch between the Twelve Houses (70) and the Singularity (90).
const LONG_DAWN = `
  // v0.28.12 — THE LONG DAWN (Act 4 bridge). After the Twelve fall the sky
  // is open — but twelve ages of refusal don't drain quietly. Chapter I is
  // a heavy elite cull on the Vigil road; Chapter II is a three-boss
  // pilgrimage that grants the 6th Dawn Fragment (frag_vigil). Both are
  // prerequisites (via q_long_dawn_2) for the hardened Gravitos petition,
  // so Act 4 now has a real spine instead of a 20-level silence.
  q_long_dawn_1: {
    name: 'The Long Dawn I — What Refusal Leaves', icon: '\u{1F304}', levelReq: 76, prereq: 'q_zodiac_twelve',
    story: true,                                   // Everdawn Cycle arc (Act 4 bridge)
    kind: 'kill', target: 'wraith', count: 88,
    objectives: [ { target: 'wraith', count: 30 }, { target: 'mournshade', count: 24 }, { target: 'lanternWisp', count: 20 }, { target: 'echoKnight', count: 14 } ],
    desc: 'The Twelve Houses stand empty — and the sky, open for the first time in twelve ages, has begun to shed. What falls is not rain: it is residue. Every refusal the Zodiac hoarded is sloughing off the heavens and pooling along the Wayfarer\\'s road, thickening into wraiths, feeding the mournshades, overfilling the lantern-wisps, and stirring every echo-knight on the pilgrim path to a war footing. Clear the fall — 30 wraiths, 24 mournshades, 20 lantern-wisps, 14 echo-knights — before the residue sets, or the dawn you have been buying piece by piece will arrive over a road too grief-clogged to walk. This is the long part of the Long Dawn: nobody said giving a world its dream back was one fight.',
    rewards: { mojicoins: 21000, exp: 10500, gearChance: 1.0, gearSlot: 'accessory', gearTier: 4, potions: { hp_l: 6, mp_l: 3 } },
  },
  q_long_dawn_2: {
    name: 'The Long Dawn II — The Three Tyrants', icon: '\u{1F451}', levelReq: 82, prereq: 'q_long_dawn_1',
    story: true,                                   // Everdawn Cycle arc (grants frag_vigil)
    kind: 'boss', target: 'blockRexy', count: 3,
    objectives: [ { target: 'blockRexy', count: 1 }, { target: 'koopaKing', count: 1 }, { target: 'octobaby', count: 1 } ],
    desc: 'Three tyrants felt the sky open and pulled their loops tighter: Rexy, the Warped Tyrant of Blockland; King Koopaloo, the Ember Tyrant on his half-melted throne; and Octobaby, the Eight-Mood Tyrant sulking in the grotto. Each was offered the same morning as everyone else — each chose the nightmare it already knew. Walk the old roads a final time and end all three refusals for good. (If a throne room stands empty, the loop takes about ten minutes to re-knot — the world holds its breath, then tries the nightmare again.) When the last tyrant lets go, the hour they were hoarding falls loose: the Unrefused Hour, the sixth Dawn Fragment. Only then will the Singularity hear you.',
    rewards: { mojicoins: 23500, exp: 12000, gearChance: 1.0, gearSlot: 'accessory', gearTier: 5, dawnFragment: 'frag_vigil', potions: { hp_l: 6, full: 2 } },
  },
};`;
rep(`dawnFragment: 'frag_hourglass', potions: { hp_l: 6, full: 2 } },  // v0.26.831+ — capstone now grants The Stilled Hour fragment
  },
};`,
`dawnFragment: 'frag_hourglass', potions: { hp_l: 6, full: 2 } },  // v0.26.831+ — capstone now grants The Stilled Hour fragment
  },` + LONG_DAWN);

// 7. Register the 6th Dawn Fragment.
rep(`  frag_dawn:      { name: 'The Weight of Morning',  act: 4, from: 'Gravitos, the Weight-Bearer' },`,
`  frag_vigil:     { name: 'The Unrefused Hour',      act: 4, from: 'The Three Tyrants' },   // v0.28.12 — Long Dawn II capstone
  frag_dawn:      { name: 'The Weight of Morning',  act: 4, from: 'Gravitos, the Weight-Bearer' },`);

// 8. Saga act derivation: holding frag_vigil also means Act 4.
rep(`  if (held.indexOf('frag_aetherion') !== -1 || held.indexOf('frag_dawn') !== -1) act = 4;`,
`  if (held.indexOf('frag_aetherion') !== -1 || held.indexOf('frag_vigil') !== -1 || held.indexOf('frag_dawn') !== -1) act = 4;   // v0.28.12 — frag_vigil counts into Act 4`);

for (const ch of s) { const c = ch.codePointAt(0); if (c >= 0xD800 && c <= 0xDFFF) throw new Error('lone surrogate!'); }
fs.writeFileSync(P + '.tmp', s);
if (fs.statSync(P + '.tmp').size < 5_500_000) throw new Error('tmp too small');
fs.renameSync(P + '.tmp', P);
console.log('patch B ok — ' + n + ' edits, ' + s.length + ' chars');
