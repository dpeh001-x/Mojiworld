// RELEASE 20a (user-approved balance, 2026-10-13) stays in:
//   [1] Scorpio's touch floor is 15% of the hero's max HP (was 28%): a real Scorpio contact on a Lv 80 hero whose HP sits far above
//       her touch band lands exactly the floor; the co-op guest line reads 0.15 too
//   [2] Lv 20-50 story bosses spawn with x2 HP (the Conductor, King Krook, the Sundered Smith), Octobaby with x1.5 and Young Barnaby with x4;
//       Mirror Self keeps 275,000 (his hits take 1% of max HP whatever it is); exp / coin of every boss row unchanged
//   [3] Octobaby's arms spawn with 1,188,000 HP (x1.5 with his body; per user Octobaby is x1.5, not x2)
//   [4] Lv 70+ ordinary roster monsters carry -28% HP, the spawnChance elites keep theirs, the Withering Tide four carry x0.5;
//       a kill of every changed mob pays the same coins through the coin curve and the same EXP
//   [5] the comment above _DMG_BAND_TABLE states the measured hits-to-die, not the old targets
//   node release20a_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15201), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
// the rows as they stood before release20: [type, hp, exp, coin]
const OLD = { pqConductor: [81290, 5962, 1256], young_confused_barnaby: [461340, 33832, 7130], kingKrook: [1311310, 96163, 20266], sundered_smith: [1311310, 96163, 20266],
  octobaby: [1311310, 96163, 20266], mirrorSelf: [275000, 17197, 3622],
  mirageStalker: [219541, 5852, 14971], shardlich: [295450, 7877, 20144], lichkin: [294416, 7851, 20074], boneWraith: [484926, 12930, 33064], sepulchreHound: [202762, 5408, 13824],
  tombKeeper: [554936, 14799, 37837], mournshade: [495333, 13209, 33774], lanternWisp: [218458, 5827, 14895], echoKnight: [1329061, 35441, 90618],
  bonebosn: [77740, 2072, 5301], drownedCur: [56261, 1499, 3837], spectreCannoneer: [56584, 1509, 3858], brinekraken: [80665, 2152, 5500],
  blightElder: [1089200, 29046, 74462], ossuaryTyrant: [1759362, 46916, 119957], pathsBane: [2601370, 69369, 177366] };
const BOSS_MUL = { pqConductor: 2, young_confused_barnaby: 4, kingKrook: 2, sundered_smith: 2, octobaby: 1.5, mirrorSelf: 1 };
const MOB_MUL = { mirageStalker: 0.72, shardlich: 0.72, lichkin: 0.72, boneWraith: 0.72, sepulchreHound: 0.72, tombKeeper: 0.72, mournshade: 0.72, lanternWisp: 0.72, echoKnight: 0.72,
  bonebosn: 0.5, drownedCur: 0.5, spectreCannoneer: 0.5, brinekraken: 0.5, blightElder: 1, ossuaryTyrant: 1, pathsBane: 1 };
const html = readFileSync(path.join(ROOT, FILE), 'utf8').split('\r\n').join('\n');
ok('[1] the co-op guest touch floor reads 15%', /\* 0\.15\)\)\);\s+\/\/ Scorpio: at least 15% of max HP/.test(html) && !/\* 0\.28\)\)\);\s+\/\/ Scorpio: at least 28%/.test(html));
ok('[5] the band comment states the measured hits-to-die', html.includes('//   Lv 20  ~10-20\n') && html.includes('//   Lv 70+ ~5-14\n') && !html.includes('(~5 hits — the anchor the user set)'));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  const R = await page.evaluate(async ([OLD, BOSS_MUL, MOB_MUL]) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; window.showToast = function () {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const unblock = () => { game.paused = false; try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } };
    const go = async (map) => { unblock(); game._worldStateByMap = game._worldStateByMap || {}; game._worldStateByMap[map] = null; loadMap(map, 300); await sleep(900); unblock(); };
    // the live loop is held; only these steps move the world (counted in sim steps)
    window.requestAnimationFrame = () => 0; await sleep(100);
    const step = (n) => { for (let i = 0; i < n; i++) { _lxSimOnly = true; _lxSimAccumMs = _LX_SIM_STEP_MS; try { loop(lastTime); } catch (e) {} finally { _lxSimOnly = false; } } };
    const clear = () => { for (const q of game.monsters) if (q) q.currentHp = 0; game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0; };
    const out = { rows: {}, spawn: {}, mobs: {} };
    for (const k in OLD) { const T = LX_MONSTER_STATS[k]; out.rows[k] = T ? { hp: T.hp, exp: T.exp, coin: T.coin, pays: _lxCoinCurve(T.coin, T.hp, !!BOSS_MUL[k]) } : null; }
    // [2] bosses as spawned (no jitter on a boss), at the boss's own level
    await go('forest');
    for (const k in BOSS_MUL) {
      clear(); player.level = (LX_MONSTER_STATS[k] || {}).lv || 30;
      spawnMonster(player.x + 400, 200, k, true, false); const m = game.monsters.find((q) => q && q.type === k);
      out.spawn[k] = m ? m.maxHp : null;
    }
    // [4] a Lv 70+ ordinary mob, a spawnChance elite and a Withering Tide mob as spawned (+-5% jitter; elite rolls skipped)
    for (const k of ['echoKnight', 'mirageStalker', 'blightElder', 'bonebosn', 'brinekraken']) {
      let hp = null; for (let i = 0; i < 12 && hp == null; i++) { clear(); spawnMonster(player.x + 300, 200, k, false, false); const m = game.monsters.find((q) => q && q.type === k); if (m && !m.isElite && !m.isMiniBoss) hp = m.maxHp; }
      out.mobs[k] = hp;
    }
    clear();
    // [3] Octobaby's arms as his fight grows them
    player.level = 50; await go('octopusGrotto');
    let arms = null; for (let i = 0; i < 400 && !arms; i++) { unblock(); step(1); const h = game.monsters.find((q) => q && q.type === 'octobaby'); if (h && Array.isArray(h._legRefs) && h._legRefs.length) arms = h._legRefs.map((l) => l.maxHp); }
    out.arms = arms; out.armType = monsterTypes.octoLegPoison.hp;
    out.armPays = ['octoLegPoison', 'octoLegFreeze', 'octoLegSkillLock', 'octoLegStun'].map((k) => _lxCoinCurve(monsterTypes[k].mojicoins, monsterTypes[k].hp, false));
    // [1] a real Scorpio contact on a Lv 80 hero far above her touch band
    player.level = 80; player.maxHp = 20000; await go('forest'); clear(); step(20); player.hp = getMaxHp(); player._god = false;
    let landed = null; const orig = window._lxContactLanding;
    window._lxContactLanding = function (m, dmg, shown, took) { if (m && m.zodiacSign === 'scorpio' && took > 0 && landed == null) landed = took; return orig.apply(this, arguments); };
    spawnMonster(player.x, player.y, 'zodiac_scorpio', true, false); const sc = game.monsters.find((q) => q && q.type === 'zodiac_scorpio');
    for (let i = 0; i < 1200 && landed == null && sc; i++) { unblock(); sc.x = player.x + player.w / 2 - sc.w / 2; sc.y = player.y + player.h - sc.h; player.invulnerable = 0; player.hp = getMaxHp(); game.projectiles.length = 0; game.hazards.length = 0; step(1); }
    window._lxContactLanding = orig;
    out.scorp = { landed, maxHp: getMaxHp(), pct: landed == null ? null : +(landed / getMaxHp() * 100).toFixed(2) };
    clear();
    return out;
  }, [OLD, BOSS_MUL, MOB_MUL]);
  const S = R.scorp;
  ok('[1] a Scorpio contact on a Lv 80 hero above her band lands the 15% floor (was 28%)', S.landed != null && S.landed === Math.max(1, Math.floor(S.maxHp * 0.15)), S);
  for (const k in BOSS_MUL) {
    const want = OLD[k][0] * BOSS_MUL[k], row = R.rows[k];
    ok(`[2] ${k} hp ${want} (x${BOSS_MUL[k]}) in the table and as spawned`, row && row.hp === want && R.spawn[k] === want, { row: row && row.hp, spawned: R.spawn[k] });
    ok(`[2] ${k} exp / coin unchanged`, row && row.exp === OLD[k][1] && row.coin === OLD[k][2], row);
  }
  ok('[3] an arm kill still pays the coins it did (88: 1800 x (3300 / 792000)^0.55)', R.armPays && R.armPays.every((c) => Math.abs(c - 88) <= 1), R.armPays);
  ok('[3] Octobaby grows four arms of 1,188,000 HP (was 792,000)', R.armType === 1188000 && R.arms && R.arms.length === 4 && R.arms.every((h) => h === 1188000), { type: R.armType, arms: R.arms });
  for (const k in MOB_MUL) {
    const [oh, oe, oc] = OLD[k], row = R.rows[k], want = Math.round(oh * MOB_MUL[k]);
    const paid = Math.floor(oc * Math.pow(3300 / oh, 0.55));
    ok(`[4] ${k} hp ${want}${MOB_MUL[k] === 1 ? ' (kept)' : ''}, exp kept, a kill pays the same coins (${paid})`, row && row.hp === want && row.exp === oe && Math.abs(row.pays - paid) <= 1, row);
  }
  for (const k in R.mobs) { const want = Math.round(OLD[k][0] * MOB_MUL[k]); ok(`[4] ${k} spawns within the +-5% jitter of ${want}`, R.mobs[k] != null && Math.abs(R.mobs[k] / want - 1) <= 0.051, R.mobs[k]); }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
