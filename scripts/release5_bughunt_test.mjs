// RELEASE HUNT 5 (per user: "keep hunting bugs", "ok yes", "do not enforce it") - the second-round hunters' fixes stay fixed:
//   M1 world-map travel lands clear of doors      W2 the world map asks before leaving a live boss fight
//   M3 the out-of-world safety net lands clear    A1 the Gravitos Arena's door to the Stair has no Lv 70 (never enforced)
//   E1 the Godforged weapon is sell-guarded       E2 the looted-gear popup shows the change the game really makes
//   E3 the HP tooltip states the real death toll  E4 a fixed deposit never loses coins at the vault cap
//   G1 Auron's owed Conductor duel skips the replay cooldown
//   C1 Disconnect drops the host's monster copies and runs solo again
//   node scripts/release5_bughunt_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11951), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    player._tutorialSeen = true; window._prologueAfterCreation = false;
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._gravitosCineSeen = true; player.level = 80; player.invulnerable = 1e9; player._god = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    const clear = () => { try { closeAllModals(); } catch (e) {} const d = document.getElementById('dialog'); if (d && d.style.display === 'block') try { closeDialog(); } catch (e) {} game.paused = false; };
    const go = async (map, x) => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[map] = true; for (let i = 0; i < 3 && game.currentMap !== map; i++) { loadMap(map, x); await sleep(1500); } clear(); };
    const src = [...document.scripts].map((x) => x.textContent).join('\n');
    const onDoor = () => (game.mapData.portals || []).some((p) => p && typeof p.x === 'number' && Math.abs(player.x + player.w / 2 - p.x) < 50);
    // M1 - forest x 1440 -> Everdawn Central through the real world-map node
    for (const k of Object.keys(MAPS)) game.visitedMaps[k] = true;
    await go('forest', 1440); player.x = 1440;
    toggleWorldMap(); await sleep(700);
    const node = document.querySelector('#worldmap-grid [data-map-id="town"]'); if (node) node.dispatchEvent(new MouseEvent('click', { bubbles: true })); await sleep(2000); clear();
    out.m1 = { node: !!node, map: game.currentMap, x: Math.round(player.x), onDoor: onDoor() };
    // M3 (source) / G1 (source) / E3 / E4 (source)
    out.m3 = src.includes("player.x = (typeof _lxClearArrivalX === 'function' && game.mapData) ? _lxClearArrivalX(game.mapData, 100) : 100; player.y = _resetY;");
    out.g1 = src.includes('if (_finaleDone && !_lxOwed && game.bossDefeated');
    out.e3 = (document.querySelector('#hp-bar') && document.querySelector('#hp-bar').closest('.bar') || {}).title || '';
    out.e4 = src.split("if (1e12 - (player.bankBalance || 0) < 1000) {").length - 1 + src.split("if (1e12 - (player.bankBalance || 0) < 10000) {").length - 1;
    // W2 - Krook at half HP, the world map asks first
    await go('krookThrone', 300);
    let k = null; for (let i = 0; i < 30 && !k; i++) { k = game.monsters.find((q) => q.type === 'kingKrook' && q.currentHp > 0); if (!k) await sleep(250); }
    const asks = []; const _uc = window.uiConfirm; window.uiConfirm = (o) => { asks.push(o && o.title); return Promise.resolve(false); };
    if (k) { k.currentHp = Math.floor(k.maxHp / 2); toggleWorldMap(); await sleep(700); const n2 = document.querySelector('#worldmap-grid [data-map-id="town"]'); if (n2) n2.dispatchEvent(new MouseEvent('click', { bubbles: true })); await sleep(1500); }
    window.uiConfirm = _uc; clear();
    out.w2 = { boss: !!k, asks, map: game.currentMap };
    // A1
    const door = (MAPS.gravitosArena.portals || []).find((p) => p.dest === 'weightbearerStair');
    out.a1 = { door: door && { name: door.name, gate: door.levelGate || 0 }, wm: (typeof _wmMaxLevelGate === 'function') ? _wmMaxLevelGate('weightbearerStair') : null };
    // E1
    out.e1 = (typeof _lxMakeGodWeapon === 'function') ? _lxSellGuarded(_lxMakeGodWeapon()) : null;
    // E2 - two armours, the popup's DEF change against the real one
    const arm = ITEM_POOL.armors.filter((a) => !a.setId && (!a.cls || a.cls === 'warrior' || a.cls === 'any') && a.def).sort((a, b) => (a.tier | 0) - (b.tier | 0));
    const lo = { ...arm[0], slot: 'armor' }, hi = { ...arm[arm.length - 1], slot: 'armor' };
    player.equipped.armor = lo; player._equipBonusCache = null; const d0 = getEquipBonus('def');
    const pop = (gearDeltas(lo, hi).find((d) => d.key === 'def') || {}).delta;
    player.equipped.armor = hi; player._equipBonusCache = null; const d1 = getEquipBonus('def');
    player.equipped.armor = lo; player._equipBonusCache = null;
    out.e2 = { lo: lo.tier, hi: hi.tier, popup: pop && Math.round(pop), real: Math.round(d1 - d0), back: player.equipped.armor === lo };
    // C1 - a host's monster copy, then Disconnect
    game.monsters.push({ type: 'snail', _coopMirror: true, currentHp: 10, maxHp: 10, x: 400, y: 300, w: 30, h: 30 });
    net.isHost = false; net.hostId = 1; net.myId = 2; mpDisconnect();
    out.c1 = { mirrors: game.monsters.filter((q) => q._coopMirror).length, host: net.isHost, hostId: net.hostId };
    return out;
  });
  ok('M1. world-map travel lands clear of doors (Forest x 1440 -> Everdawn Central)', R.m1.node && R.m1.map === 'town' && !R.m1.onDoor, R.m1);
  ok('M3. the out-of-world safety net lands clear of doors', R.m3);
  ok('W2. the world map asks "Leave the fight?" out of a live boss fight, and stays when you say no', R.w2.boss && R.w2.asks.includes('Leave the fight?') && R.w2.map === 'krookThrone', R.w2);
  ok('A1. the Gravitos Arena door to the Stair has no Lv 70, and the world map does not lock the Stair', R.a1.door && R.a1.door.gate === 0 && !/Lv 70/.test(R.a1.door.name) && !R.a1.wm, R.a1);
  ok('E1. the Godforged weapon is sell-guarded', R.e1 === true, R.e1);
  ok('E2. the looted-gear popup shows the DEF change the game really makes', R.e2.hi > R.e2.lo && R.e2.popup === R.e2.real && R.e2.back, R.e2);
  ok('E3. the HP tooltip states the real death toll', /10% of your TOTAL Mojicoins/.test(R.e3) && /400 × your level/.test(R.e3) && !/35%/.test(R.e3), R.e3.slice(0, 160));
  ok('E4. both fixed deposits check the vault room first', R.e4 === 2, R.e4);
  ok('G1. an owed Conductor duel skips the replay cooldown', R.g1);
  ok('C1. Disconnect drops the host\'s monster copies and runs solo', R.c1.mirrors === 0 && R.c1.host === true && R.c1.hostId === 2, R.c1);
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
