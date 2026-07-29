// v0.29.296 — RUNTIME certification of the milestone ability verbs.
// Boots the real game and drives execute / lifesteal / chain / mark /
// refundOnKill through the actual hitMonster pipeline. Structural coverage
// lives in skill_milestone_test.mjs; this proves the mechanics fire.
//
//   node serve.js 8772 && node scripts/skill_milestone_runtime_test.mjs 8772
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8772';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!EXE) { console.error('no browser'); process.exit(2); }
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof game !== 'undefined' && typeof hitMonster === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const out = {};
    const mkMob = (hp, maxHp, x) => ({ uid: 7000 + (x | 0), type: 'slime', name: 'Dummy',
      x: (x || 300), y: 300, w: 40, h: 40, currentHp: hp, maxHp: maxHp || hp,
      exp: 0, mojicoins: 0, facing: -1, vx: 0, vy: 0, hitFlash: 0, traits: {}, level: 1 });
    const reset = () => { game.monsters.length = 0; player._msWin = null;
      player.hp = player.maxHp = 100000; player.skillCooldowns = {}; };
    const openWin = (w) => { player._msWin = Object.assign({ id: 'test' }, w, { until: (game.time || 0) + 999999 }); };

    // ---- EXECUTE: normal foe under threshold dies outright ----
    reset();
    let m = mkMob(1000, 10000); game.monsters.push(m);
    openWin({ execute: { frac: 0.20, bossMul: 1.3 } });
    hitMonster(m, 10, false, 'aoe');                    // tiny hit, target at 10% HP
    out.executeNormal = { hp: m.currentHp, flagged: !!m._msExecuted };

    // ---- EXECUTE: boss is NEVER threshold-killed ----
    reset();
    let bo = mkMob(1000, 10000); bo.isBoss = true; game.monsters.push(bo);
    openWin({ execute: { frac: 0.20, bossMul: 1.3 } });
    const bossBefore = bo.currentHp;
    hitMonster(bo, 100, false, 'aoe');
    out.executeBoss = { before: bossBefore, after: bo.currentHp, dealt: bossBefore - bo.currentHp, alive: bo.currentHp > 0 };

    // ---- EXECUTE does NOT fire above the threshold ----
    reset();
    m = mkMob(9000, 10000); game.monsters.push(m);
    openWin({ execute: { frac: 0.20, bossMul: 1.3 } });
    hitMonster(m, 10, false, 'aoe');
    out.executeAbove = { alive: m.currentHp > 0, hp: m.currentHp };

    // ---- LIFESTEAL ----
    // Measured against the damage that ACTUALLY landed, not the raw number
    // passed in: hitMonster runs a long multiplier + DEF stack first, and
    // lifesteal is deliberately a share of the final figure.
    reset();
    m = mkMob(1e9, 1e9); game.monsters.push(m);
    player.hp = 1000;
    openWin({ lifesteal: 0.25 });
    const mobBefore = m.currentHp;
    hitMonster(m, 400, false, 'aoe');
    const landed = mobBefore - m.currentHp;
    out.lifesteal = { healed: player.hp - 1000, landed, expected: Math.floor(landed * 0.25) };

    // lifesteal must never overheal — assert the invariant, not a magic number
    reset(); m = mkMob(1e9, 1e9); game.monsters.push(m);
    player.maxHp = 1000; player.hp = 400;
    openWin({ lifesteal: 0.5 });
    hitMonster(m, 5000, false, 'aoe');
    out.lifestealCap = { hp: player.hp, maxHp: player.maxHp,
                         healed: player.hp - 400, within: player.hp <= player.maxHp };
    player.maxHp = 100000; player.hp = 100000;

    // ---- CHAIN: arcs to N nearby, and arcs do NOT spawn arcs ----
    reset();
    const prim = mkMob(1e9, 1e9, 300);
    const n1 = mkMob(1e9, 1e9, 340), n2 = mkMob(1e9, 1e9, 380), n3 = mkMob(1e9, 1e9, 420);
    game.monsters.push(prim, n1, n2, n3);
    const hp0 = [prim, n1, n2, n3].map(x => x.currentHp);
    openWin({ chain: { n: 2, frac: 0.5, range: 400 } });
    hitMonster(prim, 1000, false, 'aoe');
    const dealt = [prim, n1, n2, n3].map((x, i) => hp0[i] - x.currentHp);
    out.chain = { primary: dealt[0], arcs: dealt.slice(1),
                  arced: dealt.slice(1).filter(d => d > 0).length };

    // chain respects range
    reset();
    const p2 = mkMob(1e9, 1e9, 300), far = mkMob(1e9, 1e9, 5000);
    game.monsters.push(p2, far);
    const farHp = far.currentHp;
    openWin({ chain: { n: 2, frac: 0.5, range: 190 } });
    hitMonster(p2, 1000, false, 'aoe');
    out.chainRange = { farUntouched: far.currentHp === farHp };

    // ---- MARK: amplifies damage from ALL sources, then expires ----
    reset();
    const mk = mkMob(1e9, 1e9); game.monsters.push(mk);
    openWin({ mark: { mul: 1.5, ms: 999999 } });
    hitMonster(mk, 1000, false, 'aoe');                 // applies the mark
    const afterMark = mk.currentHp;
    hitMonster(mk, 1000, false, 'melee');               // different tag entirely
    const markedHit = afterMark - mk.currentHp;
    player._msWin = null;
    mk._msMarkUntil = 0; mk._msMarkMul = 1;             // expire it
    const beforePlain = mk.currentHp;
    hitMonster(mk, 1000, false, 'melee');
    out.mark = { markedHit, plainHit: beforePlain - mk.currentHp };

    // ---- REFUND ON KILL ----
    reset();
    const rk = mkMob(50, 10000); game.monsters.push(rk);
    player.skillCooldowns = { warlord_ult: 10000 };
    player._msWin = { id: 'warlord_ult', refundOnKill: 0.30, until: (game.time || 0) + 999999 };
    hitMonster(rk, 100000, false, 'aoe');
    out.refund = { cd: player.skillCooldowns.warlord_ult, dead: rk.currentHp <= 0 };

    // no refund when nothing dies
    reset();
    const alive = mkMob(1e9, 1e9); game.monsters.push(alive);
    player.skillCooldowns = { warlord_ult: 10000 };
    player._msWin = { id: 'warlord_ult', refundOnKill: 0.30, until: (game.time || 0) + 999999 };
    hitMonster(alive, 10, false, 'aoe');
    out.refundNoKill = { cd: player.skillCooldowns.warlord_ult };

    // ---- WINDOW LIFECYCLE ----
    reset();
    player._msWin = { id: 'x', lifesteal: 0.5, until: (game.time || 0) - 1 };   // already lapsed
    const lm = mkMob(1e9, 1e9); game.monsters.push(lm);
    player.hp = 1000;
    hitMonster(lm, 1000, false, 'aoe');
    out.lapsed = { healed: player.hp - 1000, cleared: player._msWin === null };

    // priority: a shorter window must not stomp a longer one
    reset();
    player._msWin = null;
    const L10 = SKILL_LV10_BONUS;
    player.skillRanks = { warlord_ult: 10, slash: 10 };
    _msOpenWindow('warlord_ult');
    const longUntil = player._msWin && player._msWin.until;
    _msOpenWindow('slash');                              // 4 s vs the ult's 10 s
    out.priority = { keptId: player._msWin && player._msWin.id, sameUntil: player._msWin && player._msWin.until === longUntil };

    // a real rank-10 cast opens a real window
    reset();
    player.skillRanks = { doombringer_ult: 10 };
    player._msWin = null;
    _msOpenWindow('doombringer_ult');
    out.realOpen = { id: player._msWin && player._msWin.id, hasExecute: !!(player._msWin && player._msWin.execute) };

    // rank 4 opens nothing (below the rank-5 gate)
    reset();
    player.skillRanks = { doombringer_ult: 4 };
    player._msWin = null;
    _msOpenWindow('doombringer_ult');
    out.belowGate = { win: player._msWin };

    // rank 5 opens the weaker tier
    reset();
    player.skillRanks = { doombringer_ult: 5 };
    player._msWin = null;
    _msOpenWindow('doombringer_ult');
    out.rank5 = { ms: player._msWin && player._msWin.ms,
                  frac: player._msWin && player._msWin.execute && player._msWin.execute.frac };
    return out;
  });

  ok('EXECUTE slays a normal foe under the threshold', r.executeNormal.hp === 0 && r.executeNormal.flagged, r.executeNormal);
  ok('EXECUTE never threshold-kills a boss (bonus damage instead)',
     r.executeBoss.alive && r.executeBoss.dealt > 100, r.executeBoss);
  ok('EXECUTE does not fire above the threshold', r.executeAbove.alive, r.executeAbove);
  ok('LIFESTEAL heals the declared share of damage LANDED',
     r.lifesteal.healed > 0 && r.lifesteal.healed === r.lifesteal.expected, r.lifesteal);
  ok('LIFESTEAL heals but never overheals past maxHp',
     r.lifestealCap.healed > 0 && r.lifestealCap.within, r.lifestealCap);
  ok('CHAIN arcs to exactly N nearby foes', r.chain.arced === 2, r.chain);
  ok('CHAIN arcs land reduced damage', r.chain.arcs.filter(d => d > 0).every(d => d < r.chain.primary), r.chain);
  ok('CHAIN respects its range', r.chainRange.farUntouched, r.chainRange);
  ok('MARK amplifies damage from ANY source', r.mark.markedHit > r.mark.plainHit, r.mark);
  // The mark multiplies EARLY (with the global multipliers), so the armour
  // curve downstream compresses a declared 1.5x into a smaller final ratio.
  // That is intended — asserting the raw 1.5x here would be asserting that
  // DEF does not exist. Check it lands meaningfully above 1 and under the cap.
  ok('MARK lands a real, DEF-compressed amplification (1.15-1.5x)',
     (r.mark.markedHit / r.mark.plainHit) > 1.15 && (r.mark.markedHit / r.mark.plainHit) <= 1.5,
     { ratio: +(r.mark.markedHit / r.mark.plainHit).toFixed(3), declared: 1.5 });
  ok('REFUND ON KILL cuts the cooldown', r.refund.dead && r.refund.cd === 7000, r.refund);
  ok('no refund when nothing dies', r.refundNoKill.cd === 10000, r.refundNoKill);
  ok('a lapsed window applies nothing and self-clears',
     r.lapsed.healed === 0 && r.lapsed.cleared, r.lapsed);
  ok('a short window cannot stomp a longer active one',
     r.priority.keptId === 'warlord_ult' && r.priority.sameUntil, r.priority);
  ok('a rank-10 cast opens its real window', r.realOpen.id === 'doombringer_ult' && r.realOpen.hasExecute, r.realOpen);
  ok('rank 4 opens no window (below the rank-5 gate)', r.belowGate.win === null, r.belowGate);
  ok('rank 5 opens the weaker tier', r.rank5.ms === 4500 && r.rank5.frac === 0.11, r.rank5);
  ok('no uncaught page errors during the whole run', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x !== undefined ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} runtime checks passed`);
process.exit(fail ? 1 : 0);
