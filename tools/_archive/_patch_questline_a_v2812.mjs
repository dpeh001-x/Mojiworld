// v0.28.12 questline hardening — patch A (small guarded edits, atomic write).
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

// 1. Gravitos finale: enforce the full pilgrimage + apex reward raise.
rep(`    name: 'Petition the Weight-Bearer', icon: '\u{1F30C}', levelReq: 90, prereq: 'q_boss_aetherion',   // v0.26.831+ — Act 4 reads "Convince the Warden, then the Weight-Bearer"; now enforced`,
`    // v0.28.12 — QUESTLINE HARDENING. The finale previously required only the
    // Warden (1 of 5 fragments) — a Lv 90 player could skip the Smith, the
    // Hourglass, the First-Born and the Twelve entirely and still end the
    // game. Act 4's own text ("carry every fragment to the Singularity") is
    // now ENFORCED: the petition unlocks only with the full pilgrimage done.
    name: 'Petition the Weight-Bearer', icon: '\u{1F30C}', levelReq: 90,
    prereq: ['q_boss_aetherion', 'q_boss_aries', 'q_zodiac_twelve', 'q_boss_sundered_smith', 'q_hourglass_5', 'q_long_dawn_2'],`);

rep(`    desc: 'Reach the Singularity. Defeat Gravitos — not as enemy, but as the law you must convince to let the world dream again. Every face`,
`    desc: 'Reach the Singularity. Defeat Gravitos — not as enemy, but as the law you must convince to let the world dream again. The Weight-Bearer does not hear half-finished petitions: come carrying every Dawn Fragment — the Forge-Ember, the Stilled Hour, the First-Born Sunmote, the Warden\\'s Keystone, the Unrefused Hour — or the Singularity will not so much as open. Every face`);

rep(`    rewards: { mojicoins: 20000, exp: 10000, gearChance: 1.0, gearSlot: 'accessory', gearTier: 5, dawnFragment: 'frag_dawn', potions: { hp_l: 6, full: 3 } },  // v0.26.435 — top-of-curve final boss`,
`    rewards: { mojicoins: 26000, exp: 13000, gearChance: 1.0, gearSlot: 'accessory', gearTier: 5, dawnFragment: 'frag_dawn', potions: { hp_l: 6, full: 3 } },  // v0.28.12 — raised (was 20000/10000) so the hardened finale stays the single-quest apex above the new Long Dawn chain`);

// 2. Endless Express: raise the random-manifest floor 10 -> 45 (a lucky
//    10-roll paid near-full rewards for two minutes of work).
rep(`    dynamicCountRange: [10, 99],`,
`    dynamicCountRange: [45, 99],   // v0.28.12 — floor raised 10 → 45; a min-roll paid ~60% of ceiling rewards for ~10% of the work`);
rep(`the manifest rolls a random TARGET COUNT between 10 and 99 Ticket Mechs`,
`the manifest rolls a random TARGET COUNT between 45 and 99 Ticket Mechs`);
rep(`      // Floor: 3,800 mojicoins / 2,900 EXP at N=10 (minimum roll).`,
`      // Floor (v0.28.12): ~6,125 mojicoins / ~4,650 EXP at N=45 (minimum roll).`);

// 3. Sundered Smith: was a floating one-off; now caps Brok's Act 2 errand
//    arc (Forge-Key + Reef Toll), so the Act 2 fragment is earned.
rep(`    name: 'The Forge That Broke', icon: '⚔', levelReq: 45,
    story: true,                                   // v0.26.477 — Everdawn Cycle arc (Dawn Fragment)
    kind: 'boss', target: 'sundered_smith', count: 1,
    desc: 'Brok\\'s ledger mentions a smith who shattered the anvil that made him. The forge still rings. End his shift in the Sundered Forge off Magma Foundry.',`,
`    name: 'The Forge That Broke', icon: '⚔', levelReq: 45,
    prereq: ['q_visit_lavaCavern', 'q_visit_coralReef'],   // v0.28.12 — Brok's errands (Forge-Key + Reef Toll) now open his ledger; the Act 2 fragment is earned, not stumbled into
    story: true,                                   // v0.26.477 — Everdawn Cycle arc (Dawn Fragment)
    kind: 'boss', target: 'sundered_smith', count: 1,
    desc: 'Only after running Brok\\'s errands — the recovered Forge-Key, the reef pearls — does he trust you with the last page of his ledger: a smith who shattered the anvil that made him. The Key opens the Sundered Forge off Magma Foundry. The forge still rings. End his shift.',`);

// 4. tickQuestUnlocks: also prune unlocked-but-unmet-prereq quests, so
//    existing saves migrate onto the hardened gates (mirrors boss prune).
rep(`      if (_q && _q.kind === 'boss' && (player.level || 1) < (_q.levelReq || 1)
          && !(player.quests.active && player.quests.active[_id])
          && !(player.quests.completed && player.quests.completed[_id])) {
        delete player.quests.unlocked[_id];
      }`,
`      if (_q && _q.kind === 'boss' && (player.level || 1) < (_q.levelReq || 1)
          && !(player.quests.active && player.quests.active[_id])
          && !(player.quests.completed && player.quests.completed[_id])) {
        delete player.quests.unlocked[_id];
      }
      // v0.28.12 — prune unlocked entries whose prereq chain is no longer
      // satisfied (quest gates hardened this release). Not accepted, not
      // completed → the journal entry simply re-locks until the chain is
      // done. Accepted/completed quests are never touched.
      if (_q && _q.prereq
          && !(player.quests.active && player.quests.active[_id])
          && !(player.quests.completed && player.quests.completed[_id])
          && ![].concat(_q.prereq).every(p => player.quests.completed && player.quests.completed[p])) {
        delete player.quests.unlocked[_id];
      }`);

// 5. Version bump (tolerant — the parallel session may have bumped already).
try { rep(`const GAME_VERSION = 'v0.28.11';`, `const GAME_VERSION = 'v0.28.12';`); }
catch (e) { console.log('version bump skipped: ' + e.message); }

for (const ch of s) { const c = ch.codePointAt(0); if (c >= 0xD800 && c <= 0xDFFF) throw new Error('lone surrogate!'); }
fs.writeFileSync(P + '.tmp', s);
if (fs.statSync(P + '.tmp').size < 5_500_000) throw new Error('tmp too small');
fs.renameSync(P + '.tmp', P);
console.log('patch A ok — ' + n + ' edits, ' + s.length + ' chars');
