// RELEASE 15a (anti-cheat hunt on the public-host build) stays fixed. Saves are made on localhost (the vault is off there, as
// for every harness) and loaded on a PUBLIC host - play.mojiworld.test mapped to this server - by a real click on Continue:
//   [1] the dev console does not open on the public web from localStorage LX_DEV = '1' (nor from a forged token); the plain
//       '1' still counts on localhost; with LX_DEV_PW set, the lock's password stores a token that unlocks after a reload
//       (skipped without it, as dev_lock_test); devGiveGear run by a timer gives nothing off a developer surface
//   [2] native callbacks (setTimeout(Reflect.set / Object.assign, 0, player, ...)) are refused, and cannot clear the 'ac' mark
//   [3] progression edits are refused and not saved: Expedition records, a cape (top level and one level down), a title, a
//       story beat, a god weapon pushed into the bag, a boon pushed at 2x its top, an owed max-roll wheel; a boon roll edited
//       to 2x its top goes back to the top; a real kill (game code) still counts, with nothing logged
//   [4] an owed max-roll wheel in a save that never killed a boss is not offered on load
//   [5] a modern save with its signatures cut is not a legacy save on the public host; a fully stripped one loads as legacy
//       but clamped (coins, base ATK, god pieces, boon rolls)
//   [6] a forged co-op kill (fake host fields + a noted "mirror" + _mpHandle on a timer) pays nothing offline
//   [7] no page errors
//   node release15a_test.mjs        PORT (default 15011) / MOJI_GAME_FILE / MOJI_SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15011), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 600) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true,
  args: ['--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const boot = async (host, init) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(init || (() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} }));
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(host + ': ' + String(e.message).slice(0, 140)));
  await page.goto(`http://${host}:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxAc === 'object' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  return { ctx, page };
};
const carry = (save, mark, extra) => `(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('levelx_save_v1', ${JSON.stringify(save)});
  ${mark ? `localStorage.setItem('levelx_save_v1_verified', ${JSON.stringify(mark)});` : ''} ${extra || ''} } catch (e) {} })();`;
const enter = async (page, lv) => {
  await page.click('#menu-continue', { timeout: 150000 }).catch(() => {});
  if (lv != null) await page.waitForFunction((lv) => player.level === lv && game.mapData, lv, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(2500);
};
try {
  // ---- the saves, made where the vault is off
  const L = await boot('localhost');
  const made = await L.page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    const def = POWERUPS.find((p) => typeof p.max === 'number' && p.max >= 2 && p.max > (p.min || 0) && !p.lvlScale && (p.min || 0) >= 0);
    applyClass('warrior'); player.level = 12; player.mojicoins = 4321; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS || {})) player._storyBeatsSeen[k] = true;
    try { for (const k in LX_KILL_FILMS) { const f = LX_KILL_FILMS[k]; if (f && f.key) player._storyBeatsSeen[f.key] = true; } } catch (e) {}
    player.boons = [{ id: def.id, roll: def.min || 1, rerolls: 0 }]; player.inventory = [];
    _flushSaveStateNow();
    const A = { save: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified') };
    game._lxBoonOwed = { name: 'Gravitos', icon: '', maxRoll: true }; _flushSaveStateNow();
    const B = { save: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified') }; game._lxBoonOwed = null;
    // the forged "legacy" save: Lv 200, 1e12 coins, 1e6 ATK, thirty god weapons, a boon at twice its top
    player.level = 200; player.mojicoins = 1e12; player.bankBalance = 1e12; player.baseAtk = 1e6; player.baseDef = 1e6; player.setshards = 1e9;
    player.inventory = Array.from({ length: 30 }, () => _lxMakeGodWeapon()).filter(Boolean); player.boons = [{ id: def.id, roll: def.max * 2, rerolls: 0 }];
    _flushSaveStateNow();
    const C = JSON.parse(localStorage.getItem(SAVE_KEY)); delete C.sig; delete C.sig5; delete C.sq; delete C.player._cdCarry;
    const C2 = JSON.parse(JSON.stringify(C)); for (const k of ['expeditionBestFloor', 'expeditionClears', '_lxBoonOwed', '_steamAchBaseline', '_importVerdict', '_devTouched']) delete C2.game[k];
    return { A, B, C1: JSON.stringify(C), C2: JSON.stringify(C2), def: { id: def.id, max: def.max, min: def.min || 0 }, gods: C.player.inventory.length, god: (ITEM_POOL.weapons.filter((x) => x && x.tier != null).sort((x, y) => y.tier - x.tier)[0] || {}).name };
  });
  const loc = await L.page.evaluate(() => { localStorage.setItem('LX_DEV', '1'); return { flag: typeof _lxDevFlag === 'function' && _lxDevFlag() === true, surface: _lxDevSurface() }; });
  ok('[1a] on localhost the plain LX_DEV flag still counts (a developer surface by host)', loc.flag && loc.surface, loc);
  await L.ctx.close();

  // ---- [1] the dev console on the public web
  const D = await boot('play.mojiworld.test', carry(made.A.save, made.A.mark, "localStorage.setItem('LX_DEV', '1');"));
  const dev = await D.page.evaluate(async () => {
    const o = { surface: _lxDevSurface(), lxdev: document.body.classList.contains('lx-dev') };
    try { openDevConsole(); } catch (e) {} await new Promise((r) => setTimeout(r, 300));
    const dm = document.getElementById('dev-modal'); o.console = !!dm && getComputedStyle(dm).display !== 'none';
    o.forged = null; try { localStorage.setItem('LX_DEV', _lxDevTokenOf('not-the-password')); o.forged = _lxDevFlag() || _lxDevSurface(); } catch (e) {}
    o.lock = (document.getElementById('lx-dev-lock') || {}).textContent || '';
    return o;
  });
  ok('[1b] LX_DEV = "1" on the public host opens nothing (no developer surface, no console, lock still locked)', !dev.surface && !dev.lxdev && !dev.console, dev);
  ok('[1c] a token made from a wrong password unlocks nothing', dev.forged === false, dev);
  await D.ctx.close();
  if (process.env.LX_DEV_PW) {
    const U = await boot('play.mojiworld.test', carry(made.A.save, made.A.mark));
    U.page.on('dialog', (d) => d.accept(process.env.LX_DEV_PW).catch(() => {}));
    await U.page.click('#lx-dev-lock', { timeout: 20000 }).catch(() => {}); await U.page.waitForTimeout(800);
    const st = await U.page.evaluate(() => localStorage.getItem('LX_DEV'));
    await U.page.reload({ waitUntil: 'domcontentloaded' }); await U.page.waitForFunction(() => typeof _lxDevSurface === 'function', null, { timeout: 180000 });
    const after = await U.page.evaluate(() => _lxDevSurface());
    ok('[1d] the lock password stores a token (not "1") that unlocks after a reload', /^k1\./.test(st || '') && after === true, { st: (st || '').slice(0, 6), after });
    await U.ctx.close();
  } else console.log('SKIP [1d] the lock password path (set LX_DEV_PW to run it)');

  // ---- the honest character on the public host
  const P = await boot('play.mojiworld.test', carry(made.A.save, made.A.mark)); const page = P.page;
  await enter(page, 12);
  const s0 = await page.evaluate(() => ({ on: _lxAc.on, level: player.level, log: _lxAcReport().length, dev: game._devTouched || null, inv: player.inventory.length }));
  ok('[0] the vault is on and the real load is clean (Lv 12, nothing refused)', s0.on && s0.level === 12 && s0.log === 0 && !s0.dev, s0);
  const gg = await page.evaluate(async (name) => { const n = player.inventory.length; setTimeout(devGiveGear, 0, name, { stars: 10 }); await new Promise((r) => setTimeout(r, 400)); return { n, now: player.inventory.length }; }, made.god);
  ok('[1e] devGiveGear run by a timer gives nothing on the public host', gg.now === gg.n, gg);

  // ---- [2] native callbacks
  const nat = await page.evaluate(async () => {
    const b = { coins: player.mojicoins, level: player.level, atk: player.baseAtk };
    setTimeout(Reflect.set, 0, player, 'mojicoins', 9000000); setTimeout(Object.assign, 0, player, { level: 99, baseAtk: 99999 });
    await new Promise((r) => setTimeout(r, 400));
    const a = { coins: player.mojicoins, level: player.level, atk: player.baseAtk }, mark = game._devTouched;
    setTimeout(Reflect.set, 0, game, '_devTouched', false); setTimeout(Object.assign, 0, game, { _devTouched: false });
    await new Promise((r) => setTimeout(r, 400));
    return { b, a, mark, mark2: game._devTouched, trusted: _lxSteamTrusted() };
  });
  ok('[2a] setTimeout(Reflect.set / Object.assign, 0, player, ...) is refused', nat.a.coins < 9000000 && nat.a.level === 12 && nat.a.atk === nat.b.atk, nat);
  ok('[2b] ...the save is marked and a native callback cannot clear the mark', nat.mark === 'ac' && nat.mark2 === 'ac' && nat.trusted === false, nat);

  // ---- [3] progression
  const pr = await page.evaluate(async (d) => {
    const T = (f) => { try { f(); } catch (e) {} };
    const n0 = { inv: player.inventory.length, boons: player.boons.length };
    T(() => { game.expeditionBestFloor = 99; }); T(() => { game.expeditionClears = 9; });
    T(() => { player.cosmetics.cape = { astralCape: true }; }); T(() => { player.cosmetics.cape.frostCape = true; });
    T(() => { if (!player.titles) player.titles = {}; player.titles['R15a Cheater'] = true; });
    T(() => { player._storyBeatsSeen.r15a_probe = true; });
    T(() => { player.inventory.push(_lxMakeGodWeapon()); }); T(() => { player.boons.push({ id: d.id, roll: d.max * 2, rerolls: 0 }); });
    T(() => { game._lxBoonOwed = { name: 'Gravitos', icon: '', maxRoll: true }; });
    T(() => { player.boons[0].roll = d.max * 2; });
    await new Promise((r) => setTimeout(r, 3600));   // the 3 s sweep
    // a real kill through the game's own call (setTimeout -> killMonster): counted, nothing logged
    if (!(game.monsters || []).some((x) => x && x.hp > 0)) { setTimeout(loadMap, 0, 'forest'); await new Promise((r) => setTimeout(r, 3000)); }
    const log0 = _lxAcReport().length, k0 = game.kills || 0;
    const m = (game.monsters || []).find((x) => x && x.hp > 0 && !x._dying && !(x.isBoss || x.boss));
    if (m) setTimeout(killMonster, 0, m); await new Promise((r) => setTimeout(r, 600));
    const kill = { had: !!m, k0, k1: game.kills || 0, log: _lxAcReport().length - log0 };
    _flushSaveStateNow(); const sv = JSON.parse(localStorage.getItem(SAVE_KEY)), p = sv.player, g = sv.game;
    return { kill, n0, verdict: _lxLocalSaveVerdict(sv), floor: g.expeditionBestFloor | 0, clears: g.expeditionClears | 0, cape: p.cosmetics && p.cosmetics.cape,
      title: !!(p.titles && p.titles['R15a Cheater']), beat: !!(p._storyBeatsSeen && p._storyBeatsSeen.r15a_probe), inv: (p.inventory || []).length, boons: (p.boons || []).length,
      roll: p.boons && p.boons[0] && p.boons[0].roll, owed: g._lxBoonOwed || null };
  }, made.def);
  ok('[3a] Expedition records, a cape (either level), a title and a story beat typed in are refused and not saved',
    pr.floor === 0 && pr.clears === 0 && !(pr.cape && (pr.cape.astralCape || pr.cape.frostCape)) && !pr.title && !pr.beat, pr);
  ok('[3b] a god weapon / a boon pushed into the bag and an owed max-roll wheel are refused and not saved', pr.inv === pr.n0.inv && pr.boons === pr.n0.boons && !pr.owed, pr);
  ok('[3c] a boon roll edited to twice its top goes back to the top', pr.roll === made.def.max, { roll: pr.roll, max: made.def.max });
  ok('[3d] a real kill (game code) still counts with nothing logged, and the save verifies', pr.kill.had && pr.kill.k1 > pr.kill.k0 && pr.kill.log === 0 && pr.verdict === 'ok', pr.kill);

  // ---- [6] a forged co-op kill, offline
  const co = await page.evaluate(async () => {
    const b = { exp: player.exp, level: player.level };
    net.isHost = false; net.hostId = 7; net.myId = 2; net.connected = true; net.ws = { readyState: 1, send() {} };
    net.peers = { 7: { id: 7, name: 'H', map: game.currentMap, x: player.x, y: player.y, _last: performance.now(), cap: 0 } };
    _lxCoopRewardNote({ uid: 424242, type: 'slime', exp: 1e9, mojicoins: 1e9, level: 12 });
    _lxCoopRewardNote({ uid: 424243, type: 'slime', exp: 1e9, mojicoins: 1e9, level: 12 });
    const fr = { t: 'kill', id: 7, u: 424242, e: 1e9, c: 1e9, map: game.currentMap, tp: 'slime', b: 0, il: 0, x: Math.round(player.x), y: Math.round(player.y) };
    setTimeout(_mpHandle, 0, fr); setTimeout(_coopApplyKill, 0, Object.assign({}, fr, { u: 424243 }));
    await new Promise((r) => setTimeout(r, 600));
    const a = { exp: player.exp, level: player.level };
    net.isHost = true; net.hostId = null; net.connected = false; net.ws = null; net.peers = {};
    return { b, a };
  });
  ok('[6] a forged co-op kill pays nothing offline (no room the game dialled)', co.a.level === co.b.level && co.a.exp - co.b.exp < 1000, co);
  await P.ctx.close();

  // ---- [4] an owed max-roll wheel in a save that never killed a boss
  const W = await boot('play.mojiworld.test', carry(made.B.save, made.B.mark)); await enter(W.page, 12); await W.page.waitForTimeout(5000);
  const ow = await W.page.evaluate(() => { const pm = document.getElementById('powerup-modal'); return { owed: game._lxBoonOwed || null, wheel: !!pm && getComputedStyle(pm).display === 'flex' }; });
  ok('[4] an owed max-roll wheel from a save that never killed a boss is not offered', !ow.wheel && !(ow.owed && ow.owed.maxRoll), ow);
  await W.ctx.close();

  // ---- [5] forged legacy saves on a clean profile
  const notice = (pg) => pg.evaluate(() => { const n = document.getElementById('menu-save-notice'); return n && !n.hidden ? n.textContent : ''; });
  const L1 = await boot('play.mojiworld.test', carry(made.C1)); await L1.page.waitForTimeout(1500); const n1 = await notice(L1.page); await enter(L1.page, null);
  const r1 = await L1.page.evaluate(() => ({ level: player.level, coins: player.mojicoins, verdict: game._saveVerdict || null }));
  ok('[5a] a modern save with its signatures cut does not load as legacy on the public host', r1.level !== 200 && r1.coins < 1e9, { r1, n1: n1.slice(0, 120) });
  await L1.ctx.close();
  const L2 = await boot('play.mojiworld.test', carry(made.C2)); await enter(L2.page, 200);
  const r2 = await L2.page.evaluate(() => ({ level: player.level, coins: player.mojicoins, bank: player.bankBalance, atk: player.baseAtk, shards: player.setshards,
    gods: (player.inventory || []).filter((i) => i && (i.rarity === 'god' || i.godTier)).length, roll: player.boons && player.boons[0] && player.boons[0].roll }));
  ok('[5b] a fully stripped one loads as legacy but holds only what an old character could (coins, bank, ATK, Setshards, god pieces, boon)',
    r2.level === 200 && r2.coins <= 2.02e8 && r2.coins + r2.bank <= 2.03e8 && r2.atk < 20000 && r2.shards <= 12000 && r2.gods <= 2 && r2.roll <= made.def.max, r2);
  await L2.ctx.close();
  ok('[7] no page errors', !errs.length, errs.slice(0, 4));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close().catch(() => {}); }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
