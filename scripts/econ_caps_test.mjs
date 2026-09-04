// Coin caps on the party quest and the expedition tower, and chest potions on
// the ground (v0.30.381). Boots the game headless.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9927); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof player === 'object' && player && typeof QUESTS === 'object', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  await page.evaluate(() => { try { _lxBootGateDone = true; } catch (e) {} try { _prologueActive = false; _prologuePending = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } if (!player.cls) player.cls = 'warrior'; });
  const r = await page.evaluate(() => {
    const o = { ver: typeof GAME_VERSION === 'string' ? GAME_VERSION : '?' };
    // expedition
    o.expFn = typeof _lxExpeditionCoinReward === 'function';
    if (o.expFn) o.exp = [_lxExpeditionCoinReward(1), _lxExpeditionCoinReward(80), _lxExpeditionCoinReward(300)];
    const wasExp = game.expedition; game.expedition = { active: true, floor: 3 }; const w0 = player.mojicoins || 0; o.towerGrant = _grantMojicoins(1000); o.towerDelta = (player.mojicoins || 0) - w0; game.expedition = wasExp;
    // quest turn-in ceiling
    player.level = 80; player.mojicoins = 0; player.quests = player.quests || {}; player.quests.completed = player.quests.completed || {}; player.quests.active = player.quests.active || {}; player.quests.progress = player.quests.progress || {};
    // log the quest grant itself (the {full:true} call), separate from anything else the turn-in pays (a level-up, a streak)
    const _g0 = _grantMojicoins; window._gLog = []; _grantMojicoins = function (n, o) { window._gLog.push([n, !!(o && o.full)]); return _g0.apply(this, arguments); };
    const turnIn = (id) => { delete player.quests.completed[id]; player.quests.active[id] = { started: game.time }; window._gLog = []; try { _completeQuest(id); } catch (e) { return 'ERR ' + (e && e.message); } const f = window._gLog.filter((x) => x[1]); return f.length ? f[0][0] : 0; };
    o.w49table = QUESTS.q_warrior_lv49 && QUESTS.q_warrior_lv49.rewards.mojicoins; o.w49paid = turnIn('q_warrior_lv49');
    o.aethPaid = turnIn('q_boss_aetherion');   // Lv 60, 17,872 x3 = 53,616 under a 300k ceiling
    // party quest: first run vs repeat
    player._pqChainRuns = 0; o.pqFirst = turnIn('q_pq_spire');
    player._pqChainRuns = 1; o.pqRepeat = turnIn('q_pq_spire');
    _grantMojicoins = _g0;
    o.pqSaved = (typeof PLAYER_SAVE_FIELDS !== 'undefined') && PLAYER_SAVE_FIELDS.indexOf('_pqChainRuns') >= 0;
    // chest: coins x1.3, potions on the ground
    game.drops = []; player.consumables = player.consumables || {}; player.consumables.hp_s = 0; player.consumables.mp_s = 0;
    const before = game.chests.length; const ret = spawnChest(player.x, player.y, 'gold'); const c = ret || game.chests[game.chests.length - 1]; if (game.chests.length === before) return Object.assign(o, { chestErr: 'no chest' });
    const wc = player.mojicoins || 0; openChest(c); o.chestCoins = (player.mojicoins || 0) - wc;
    o.hpDrops = game.drops.filter((d) => d.type === 'potion_hp').length; o.mpDrops = game.drops.filter((d) => d.type === 'potion_mp').length; o.bagAfterOpen = [player.consumables.hp_s, player.consumables.mp_s];
    return o;
  });
  console.log('build ' + r.ver);
  ok('expedition reward helper: 2,000 at Lv 1, 10,666 at Lv 80, capped at 12,000', r.expFn && r.exp[0] === 2000 && r.exp[1] === 10666 && r.exp[2] === 12000, JSON.stringify(r.exp));
  ok('inside the tower _grantMojicoins pays nothing', r.towerGrant === 0 && r.towerDelta === 0, r.towerGrant + ' ' + r.towerDelta);
  ok('Lv 80 turning in q_warrior_lv49 is paid the 245,000 ceiling, not x3', r.w49paid === 245000, r.w49table + ' -> ' + r.w49paid);
  ok('a quest under the line keeps its late-game x3 (q_boss_aetherion 53,616)', r.aethPaid === 53616, String(r.aethPaid));
  ok('Ticket Rush stage 2, first run pays its dynamic reward in full', r.pqFirst > 0, String(r.pqFirst));
  ok('Ticket Rush stage 2, repeat run pays 40% of that', r.pqFirst > 0 && Math.abs(r.pqRepeat - Math.round(r.pqFirst * 0.4)) <= 1, r.pqFirst + ' -> ' + r.pqRepeat);
  ok('_pqChainRuns is saved with the player', r.pqSaved === true);
  ok('a gold chest pays 520-975 into the wallet (1,040-1,950 x0.5)', r.chestCoins >= 520 && r.chestCoins <= 975, String(r.chestCoins) + (r.chestErr ? ' ' + r.chestErr : ''));
  ok('a gold chest drops 4 HP + 3 MP potions on the ground, none straight into the bag', r.hpDrops === 4 && r.mpDrops === 3 && r.bagAfterOpen[0] === 0 && r.bagAfterOpen[1] === 0, r.hpDrops + ' ' + r.mpDrops + ' bag ' + JSON.stringify(r.bagAfterOpen));
  // pickup: walk the player over the potions
  const pk = await page.evaluate(() => {
    game.paused = false; player.hp = Math.max(1, player.hp || 1); game.keys = {};
    for (const d of game.drops) if (d.type === 'potion_hp' || d.type === 'potion_mp') { d.x = player.x + (player.w || 30) / 2; d.y = player.y + (player.h || 40) / 2; d.vy = 0; }
    let err = null; for (let i = 0; i < 12; i++) { try { updatePlayer(16); } catch (e) { err = String(e && e.message); break; } }
    return { err, hp: player.consumables.hp_s, mp: player.consumables.mp_s, left: game.drops.filter((d) => d.type === 'potion_hp' || d.type === 'potion_mp').length };
  });
  ok('walking over them banks 4 HP + 3 MP potions and clears the ground', !pk.err && pk.hp === 4 && pk.mp === 3 && pk.left === 0, JSON.stringify(pk));
  const rs = await page.evaluate(() => { const b = player._pqChainRuns | 0; try { _lxPqRestartChain(); } catch (e) { return { err: String(e && e.message) }; } return { b, a: player._pqChainRuns | 0 }; });
  ok('restarting the Ticket Rush marks the run as a repeat', !rs.err && rs.a === rs.b + 1, JSON.stringify(rs));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
