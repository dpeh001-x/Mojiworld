// RAW EXP (per user: "remove all the levers and multipliers and change it to raw values", 2026-09-20).
// A kill pays the number in data/monster_stats.js - no permanent monster knob, no newbie band, no x1.35 host curve -
// and the level costs are <the user's kills for that level> x the raw EXP of a same-level monster:
//   Lv 1->2 in 1 kill, then 10, 40, 100, 250, 280, 300, 350, 400, 800 to Lv 11; 1,500 for 19->20; 3,000 for 24->25.
// What a player earns or chooses still applies (combo, EXP gear, difficulty, co-op, prestige), and an existing save
// crosses to the new scale by the fraction of the level it had.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/exp_raw_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11231';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxLevelCost === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(1500); try { closeAllModals(); } catch (e) {} game.paused = true;
    // a clean slate: nothing the player earns or chooses is in play
    const clean = (lv) => {
      player.level = lv; player.mods.xpBoost = 0; player.equipped = {}; player.boons = []; player.boonsEquipped = [];
      game.comboMult = 1; game.combo = 0; player.buffs.comboXp = 0; game.prestige = null; game.difficulty = 'normal';
      game._diffExpMul = null; player.exp = 0; player.expToNext = _lxLevelCost(lv);
    };
    // 1. a kill pays exactly the table number
    const payFor = (type, lv) => {
      clean(lv); player.expToNext = 1e9;   // measure the award itself: at the new costs a kill can level you, and the level-up spends it
      game.monsters.length = 0;
      const m = spawnMonster(player.x + 200, player.y, type, false); if (!m) return null;
      game.monsters.push(m); const tableExp = LX_MONSTER_STATS[type] ? LX_MONSTER_STATS[type].exp : null;
      m.currentHp = 0; const before = player.exp, carried = m.exp;   // read what it carries BEFORE the kill: the kill path clears it
      try { killMonster(m); } catch (e) {}
      return { type, tableExp, paid: player.exp - before, mExp: carried, fac: { combo: game.comboMult, n: game.combo, ks: (typeof _ksXpMul === 'function') ? _ksXpMul() : 1, gap: _lxExpLevelGapMul(m), dawn: (typeof _lxDawnExpMul === 'function') ? _lxDawnExpMul() : 1, affix: (typeof _affixExpMul === 'function') ? _affixExpMul() : 1, diff: (typeof _diffExpMul === 'function') ? _diffExpMul() : 1, boost: player.mods.xpBoost, eq: getEquipBonus('xpBoost') } };
    };
    out.pays = [payFor('snail', 1), payFor('slime', 4), payFor('mushroom', 9)].filter(Boolean);
    // 2. the rungs, in kills of a same-level monster
    const mobs = Object.entries(LX_MONSTER_STATS).filter(([t, v]) => v && v.exp > 0 && v.lv > 0
      && !(monsterTypes[t] && (monsterTypes[t].boss || monsterTypes[t].isBoss || monsterTypes[t].zodiacSign))
      && !/^(tower|express|ticket|conductor|mirror|octoLeg)/i.test(t) && !(monsterTypes[t] && monsterTypes[t].miniElite)
      && (v.exp / Math.max(1, v.hp)) <= 0.04).map(([t, v]) => ({ lv: v.lv, exp: v.exp }));
    const adjRaw = (L) => { let p = mobs.filter((m) => Math.abs(m.lv - L) <= 2);
      if (!p.length) p = mobs.slice().sort((a, b) => Math.abs(a.lv - L) - Math.abs(b.lv - L)).slice(0, 3);
      return p.reduce((s, m) => s + m.exp, 0) / p.length; };
    out.rungs = {}; for (const L of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19, 24]) out.rungs[L] = Math.round(_lxLevelCost(L) / adjRaw(L));
    // the whole curve, per user "make sure the bumps are more linear": each rung in kills of a same-level
    // monster, and the raw cost beside it
    out.band = {}; out.costs = {}; for (let L = 1; L <= 99; L++) { out.band[L] = Math.round(_lxLevelCost(L) / adjRaw(L)); out.costs[L] = _lxLevelCost(L); }
    out.firstRung = _lxLevelCost(1);
    // 3. one kill takes a fresh hero to Lv 2
    clean(1); game.monsters.length = 0;
    { const m = spawnMonster(player.x + 200, player.y, 'snail', false); game.monsters.push(m); m.currentHp = 0;
      try { killMonster(m); } catch (e) {}
      out.firstKill = { level: player.level, exp: player.exp, need: player.expToNext }; }
    // 4. what the player earns still counts: +100% EXP gear doubles the same kill
    const base = payFor('slime', 4);
    clean(4); player.expToNext = 1e9; player.mods.xpBoost = 1; game.monsters.length = 0;
    { const m = spawnMonster(player.x + 200, player.y, 'slime', false); game.monsters.push(m); m.currentHp = 0;
      const b4 = player.exp, carried = m.exp; try { killMonster(m); } catch (e) {} out.boosted = { carried, boosted: player.exp - b4 }; }
    return out;
  });
  const T = { 1: 1, 2: 10, 3: 40, 4: 100, 5: 250, 6: 280, 7: 300, 8: 350, 9: 400, 10: 800, 19: 1500, 24: 3000 };
  // the spawned monster carries the table number +/- the deliberate reward jitter; what the kill PAYS must be that
  // number itself, with no knob on top
  // raw + only what the player earned: no hidden knob may sit between the monster's number and the award
  const expect = (p) => { const f = p.fac, cb = 1 + Math.min(1, (f.combo - 1) * 0.6);
    return Math.max(1, Math.floor(p.mExp * (1 + f.boost + f.eq) * cb * f.ks * f.gap * f.dawn * f.affix * f.diff)); };
  check(r.pays.length === 3 && r.pays.every((p) => p.paid === expect(p)),
    'a kill pays what the monster carries, times only what the player earned', J(r.pays.map((p) => ({ t: p.type, carried: p.mExp, paid: p.paid, want: expect(p) }))));
  check(r.pays.every((p) => Math.abs(p.mExp - p.tableExp) <= Math.ceil(p.tableExp * 0.12) + 1), '...and that is the stats-table number (within its reward jitter)', J(r.pays));
  const off = Object.entries(T).filter(([L, want]) => Math.abs(r.rungs[L] - want) > Math.max(1, want * 0.06));
  check(off.length === 0, 'every rung costs the kills it is meant to', 'want ' + J(T) + ' got ' + J(r.rungs));
  check(r.firstRung === 1, 'the first rung is one kill', 'cost ' + r.firstRung);
  // The cost of a level never goes down. The mob pool is uneven (Lv 68 monsters pay 2,081 where Lv 67 pay 2,952),
  // so the bake reads a non-decreasing EXP reference; without it a level can ask for less EXP than the one before.
  const costBack = []; for (let L = 2; L <= 99; L++) if (!(r.costs[L] > r.costs[L - 1])) costBack.push(L);
  check(costBack.length === 0, 'no level ever asks for less EXP than the one before it', 'goes backwards at ' + J(costBack));
  // One straight line: Lv 10->19 climbs 800 -> 1,500, and every level from 19 up costs 300 more kills than the last.
  const line = (L) => (L <= 19) ? (800 + (1500 - 800) * (L - 10) / 9) : (1500 + 300 * (L - 19));
  const offLine = []; for (let L = 11; L <= 99; L++) { const d = r.band[L] / line(L) - 1; if (Math.abs(d) > 0.45) offLine.push(L + ':' + r.band[L] + ' vs ' + Math.round(line(L))); }
  check(offLine.length === 0, 'every rung from 11 to 99 sits on the straight line (+300 kills a level from Lv 19)', J(offLine));
  // And it never walls up. Two levels still step up hard and it is the MONSTERS, not the table: the Lv 68 pool
  // pays 2,081 where Lv 67 pays 2,952, and above Lv 80 there are no ordinary monsters left at all. The old curve
  // had ten such steps and a x1.91.
  const jumps = []; let worstJump = 0;
  for (let L = 12; L <= 99; L++) { const x = r.band[L] / Math.max(1, r.band[L - 1]); if (x > worstJump) worstJump = x; if (x > 1.35) jumps.push(L + ':x' + x.toFixed(2)); }
  check(jumps.length <= 2 && worstJump <= 1.7, 'and no level is a wall - at most two step up by a third, none by more than two thirds', J(jumps) + ' worst x' + worstJump.toFixed(2));
  check(r.firstKill.level === 2, 'one kill takes a fresh hero to Lv 2', J(r.firstKill));
  check(r.boosted.boosted >= r.boosted.carried * 2 && r.boosted.boosted <= r.boosted.carried * 2.3,
    '+100% EXP gear still doubles a kill (earned bonuses stay)', J(r.boosted));
  // 5. a save on the old scale crosses over by the fraction of the level it had
  const page2 = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  await page2.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page2.waitForFunction(() => typeof _lxLevelCost === 'function' && typeof _flushSaveStateNow === 'function', null, { timeout: 120000 });
  const seeded = await page2.evaluate(() => {
    player.cls = 'warrior'; player.level = 30;
    player.expToNext = 1356500; player.exp = 678250;        // the v0.30.922 rung for Lv 30, half-filled
    window._lxAwaitingCreation = false;
    const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
    _flushSaveStateNow();
    return { want: Math.floor(0.5 * _lxLevelCost(30)), need: _lxLevelCost(30) };
  });
  await page2.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  await page2.waitForFunction(() => typeof _lxLevelCost === 'function', null, { timeout: 120000 });
  await page2.waitForTimeout(3000);
  const after = await page2.evaluate(() => ({ lv: player.level, exp: player.exp, need: player.expToNext }));
  check(after.lv === 30 && after.need === seeded.need && Math.abs(after.exp - seeded.want) <= 2,
    'an old save keeps its level and its place in the bar (half a level stays half a level)', J({ ...after, want: seeded.want }));
  const qz = await page.evaluate(() => { try { player.level = 1; player.exp = 0; player.expToNext = _lxLevelCost(1); player.quests = { active: {}, completed: {} }; acceptQuest('q_act1_waking'); const a = player.quests.active.q_act1_waking; if (a) a.progress = 999; const b4 = { lv: player.level, exp: player.exp }; _completeQuest('q_act1_waking'); return { b4, lv: player.level, exp: player.exp, need: player.expToNext }; } catch (e) { return { err: String(e).slice(0, 120) }; } });
  check(!qz.err && (qz.lv > qz.b4.lv || qz.exp > qz.b4.exp), 'a Lv 1 quest still pays something (a share of a 1-EXP rung cannot floor to zero)', J(qz));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
