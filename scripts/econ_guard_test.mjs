// ECONOMY LOOPS (v0.30.918 bug audit). Six ways to mint value the audit found, each driven in the running game:
// a reload taken while downed skipped the death toll; the daily parcel paid its weekly gear piece daily after day 7;
// the rank reset billed the wallet only (bank everything: a free reset); a reset bought inside a tower run was refunded
// when the run ended; the Echo Keeper stacked shades; Legosaurus ignored the boss respawn window; summoner adds were uncapped.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/econ_guard_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11312';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const boot = async (page) => { await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadState === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 }); };
const hero = () => {
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (!player.cls || player.level < 50) { applyClass('warrior'); player.level = 50; }
  player._tutorialSeen = true; window.uiConfirm = () => Promise.resolve(true);
};
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await boot(page);
  // 1. downed, then the game closes: the reload still takes the toll
  const d0 = await page.evaluate((h) => { eval(h)(); player.mojicoins = 100000; player.bankBalance = 0; player.exp = 1000;
    // v0.30.931 — give the hero a requirement that matches its level before saving. v0.30.923 rescales EXP on load
    // by exp/expToNext, and this harness sets level 50 on a freshly classed hero whose expToNext is still the Lv 1
    // rung: that fraction clamps to 0.999 and the reload came back with 21 million EXP, which is the harness's
    // fault, not the toll's.
    try { if (typeof _lxLevelCost === 'function') player.expToNext = _lxLevelCost(player.level | 0); } catch (e) {}
    player.exp = 1000;
    const r = _coopTryDowned(); _flushSaveStateNow();
    return { r, downed: !!player._downed, ob: _isOnboardingActive(), exp0: player.exp | 0 }; }, `(${hero})`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }); await boot(page);
  const d1 = await page.evaluate(() => ({ coins: player.mojicoins, exp: player.exp, hp: player.hp, max: getMaxHp(), pend: !!player._downPending }));
  const _expWant = d0.exp0 - Math.floor(d0.exp0 * 0.05);
  check(d0.downed && d1.coins >= 90000 && d1.coins < 91000 && Math.abs(d1.exp - _expWant) <= 2 && d1.hp === d1.max && !d1.pend,
    'a reload taken while downed pays the death toll (10% of 100k, 5% EXP; the login bonus aside) and stands up whole', J({ d0, d1 }));
  // 2. the parcel's gear piece is weekly
  const pc = await page.evaluate((h) => { eval(h)(); checkDaily(); const d = game.dailyState; const got = (k) => { d.streak = k; d.parcelClaimed = false;
    const n = (player.inventory || []).length; _claimDailyParcel(); return (player.inventory || []).length - n; };
    return { d8: got(8), d9: got(9), d14: got(14) }; }, `(${hero})`);
  check(pc.d8 === 0 && pc.d9 === 0 && pc.d14 === 1, 'the parcel gear piece comes on day 14, not on days 8 and 9', J(pc));
  // 3. the rank reset bills the bank when the wallet is empty
  const rp = await page.evaluate(async (h) => { eval(h)();
    const sk = Object.keys(SKILLS).find((k) => SKILLS[k].cls === 'warrior' && !SKILLS[k].job);
    player.mojicoins = 0; player.bankBalance = 100000; player.skillRanks = { [sk]: 1 }; player.skillRankPoints = 0;
    openSkillsReference(); const b = document.getElementById('skl-rp-reset'); if (!b || !b.onclick) return { err: 'no button' };
    await b.onclick(); await new Promise((r) => setTimeout(r, 150));
    return { bank: player.bankBalance, rp: player.skillRankPoints, ranks: Object.keys(player.skillRanks || {}).length }; }, `(${hero})`);
  check(rp.bank === 80000 && rp.rp === 1 && rp.ranks === 0, 'an empty wallet does not make the rank reset free: 20% of the bank', J(rp));
  // 4. no reset inside a tower run (the run's end restores wallet and bank)
  const tw = await page.evaluate(async (h) => { eval(h)(); try { closeAllModals(); } catch (e) {}
    const id = LEVELUP_OPTIONS[0].id; player._levelUpSpent = { [id]: 2 }; player.mojicoins = 50000; player.bankBalance = 0; player.setshards = 5000;
    game.expedition = game.expedition || {}; const was = game.expedition.active; game.expedition.active = true;
    try { resetStats(); } catch (e) {} await new Promise((r) => setTimeout(r, 300));
    const out = { coins: player.mojicoins, spent: (player._levelUpSpent || {})[id] | 0 }; game.expedition.active = was; return out; }, `(${hero})`);
  check(tw.coins === 50000 && tw.spent === 2, 'Reset Stats is refused inside a tower run', J(tw));
  // 5. one Echo Keeper shade at a time
  const ec = await page.evaluate(async (h) => { eval(h)(); try { closeAllModals(); } catch (e) {}
    const npc = { role: 'echoKeeper', name: 'Echo Keeper', _bossType: 'king', x: player.x + player.w / 2, y: 436 };
    const summon = () => { openNPC(npc); const b = [...document.querySelectorAll('#dialog-options button')].find((x) => /Summon the echo/.test(x.textContent)); if (b) b.click(); return !!b; };
    const a = summon(); await new Promise((r) => setTimeout(r, 100)); const b2 = summon(); await new Promise((r) => setTimeout(r, 100));
    const n = game.monsters.filter((x) => x && x._echoBoss && x.currentHp > 0).length;
    try { closeDialog(); } catch (e) {} game.monsters = game.monsters.filter((x) => !(x && x._echoBoss)); return { a, b2, n }; }, `(${hero})`);
  check(ec.a && ec.n === 1, 'a second summon while a shade stands does not add another', J(ec));
  // 6. Legosaurus: no respawn inside the boss window, one per visit
  const lg = await page.evaluate(async (h) => { eval(h)(); const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const count = () => game.monsters.filter((x) => x && x.type === 'legosaurus' && x.currentHp > 0).length;
    game.bossDefeated = game.bossDefeated || {}; game._bossDefeatedAt = game._bossDefeatedAt || {};
    game.bossDefeated.blockland_apex = true; game._bossDefeatedAt.blockland_apex = game._playMs || 0;
    loadMap('blockland_apex', 200); await wait(1400); const inWindow = count();
    delete game.bossDefeated.blockland_apex; loadMap('town', 400);
    loadMap('blockland_apex', 200); loadMap('town', 400); loadMap('blockland_apex', 200); await wait(1400); const quick = count();
    loadMap('town', 400); return { inWindow, quick }; }, `(${hero})`);
  check(lg.inWindow === 0 && lg.quick === 1, 'Legosaurus keeps the 10-minute boss window, and a quick leave-and-return spawns one', J(lg));
  // 7. summoner adds are capped at four
  const sm = await page.evaluate(async (h) => { eval(h)(); loadMap('graniteBluffs', 200); await new Promise((r) => setTimeout(r, 600));
    game.monsters = []; const m0 = spawnMonster(player.x + 300, player.y - 40, 'stoneling', false, false);
    const m = m0 || game.monsters.find((x) => x && x.type === 'stoneling'); if (!m) return { err: 'no stoneling' };
    for (let i = 0; i < 5; i++) MONSTER_SKILL_FNS.summon(m);
    const adds = game.monsters.filter((x) => x && x._isMinion && x.currentHp > 0).length; game.monsters = []; loadMap('town', 400); return { adds }; }, `(${hero})`);
  check(sm.adds === 4, 'a summoner keeps at most four live adds', J(sm));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
