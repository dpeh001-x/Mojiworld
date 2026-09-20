// LAUNCH SWEEP - economy bugs (v0.30.833): Sage Mira's wait really waits, a reward-less echo drops no gear, the first
// Ticket Rush run is paid in full, and a shop sale pays the quoted price.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/launch_econ_fixes_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11135';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _completeQuest === 'function' && typeof _lxBossGearGate === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3500);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 60; loadMap('forest', 600); game.paused = false; });
  // ---- 1. Sage Mira ----
  const sage = await page.evaluate(() => { const now = _monoNow(); player._sageNextAt = now + 3600000; const waiting = !_sageReady(), at = _sageReadyAt(), label = _sageWaitText();
    player._sageNextAt = now - 1000; const past = _sageReady(); player._sageNextAt = 0; const never = _sageReady(); player._sageNextAt = NaN; const nan = _sageReady(); player._sageNextAt = 0;
    return { waiting, exact: at === now + 3600000, label: !!label, past, never, nan }; });
  check(sage.waiting && sage.exact && sage.label && sage.past && sage.never && sage.nan, 'Sage Mira: an hour left means NOT ready (and says so); past, never-bought and a bad stamp are ready', J(sage));
  // ---- 2. reward-less echoes ----
  const gate = await page.evaluate(() => { const W = { slot: 'weapon', name: 't' }, P = { slot: null, type: 'potion' }; // v0.30.861 gave a PAYING echo one gear roll per 10 play-minutes, keyed per boss (game._echoGearAt). These mocks
    // carry no type, so every one of them hashes to the same key and the second paying echo was gated by the first's
    // stamp. Each probe is its own boss here; the cooldown has its own coverage in econ_guard_test.
    const g = (m, it) => { game._echoGearAt = {}; return _lxBossGearGate(Object.assign({ isBoss: true }, m), it || W, true); };
    return { live: g({}), free: g({ _echoBoss: true }), rush: g({ _echoBoss: true, _rushBoss: true, zodiacBoss: true }), prologue: g({ _echoBoss: true, type: 'gravitos' }),
      nightmare: g({ _echoBoss: true, _nightmareEcho: true }), duo: g({ _echoBoss: true, _duoTrial: true }), zodiac: g({ _echoBoss: true, zodiacBoss: true }), potion: g({ _echoBoss: true }, P) }; });
  check(gate.live && !gate.free && !gate.rush && !gate.prologue && gate.nightmare && gate.duo && gate.zodiac && gate.potion, 'gear gate: free echo, Boss Rush echo and the prologue memory drop none; live boss, Nightmare, Duo Trial, zodiac echo and non-gear are untouched', J(gate));
  const kills = await page.evaluate(() => { const gear = (d) => d && d.type === 'item' && d.item && ['weapon', 'armor', 'accessory', 'accessorie'].includes(d.item.slot);
    const run = (echo) => { game.drops.length = 0; const m = spawnMonster(player.x + 200, player.y - 40, 'king', true, false); if (echo) { m.exp = 0; m.mojicoins = 0; m._echoBoss = true; } m.currentHp = 0; killMonster(m); return game.drops.filter(gear).length; };
    let live = 0, echo = 0; for (let i = 0; i < 6; i++) { live += run(false); echo += run(true); } game.drops.length = 0; return { live, echo }; });
  check(kills.live >= 6 && kills.echo === 0, 'six real kills each way: the live boss drops its gear, the free echo drops none', J(kills));
  // ---- 3. the first Ticket Rush run ----
  const pq = await page.evaluate(() => { const id = 'q_pq_spire'; const pay = () => { delete player.quests.completed[id]; player.quests.active[id] = { progress: 9999, count: 1, acceptedAt: Date.now() }; player.level = 40; player.exp = 0; const c0 = player.mojicoins; _completeQuest(id); return { coins: player.mojicoins - c0, exp: (player.level - 40) * 1e9 + player.exp }; };
    // a throwaway turn-in first: the very first quest of a save also pays a one-off achievement (3,000 coins and a level), which hid this bug
    delete player.quests.completed.q_pq_carriage; player.quests.active.q_pq_carriage = { progress: 9999, count: 1 }; _completeQuest('q_pq_carriage');
    player.level = 40; player.exp = 0; player._pqChainRuns = 0; player._pqStagePaid = {}; player.mojicoins = 0; const first = pay(), second = pay(); return { first, second, mul: LX_PQ_REPEAT_MUL, expMul: LX_PQ_REPEAT_EXP_MUL }; });
  check(pq.second.coins > 0 && pq.first.coins >= pq.second.coins * 3.5 && pq.first.exp >= pq.second.exp * 1.9, 'Ticket Rush: the FIRST run of a stage pays in full (4x the coins, 2x the EXP of a repeat run)', J(pq));
  // ---- 4. a sale pays the quoted price ----
  const sale = await page.evaluate(() => { player._storyBeatsSeen = player._storyBeatsSeen || {}; player._storyBeatsSeen.epilogue_gravitos = 1; const fav = _lxDawnCoinMul(); const ks = _ksCoinMul();
    player.mojicoins = 0; const earned = _grantMojicoins(1000, { full: true }); player.mojicoins = 0; const sold = _grantMojicoins(1000, { full: true, sale: true }); return { fav, ks, earned, sold }; });
  check(sale.fav > 1 && sale.earned === Math.floor(1000 * sale.ks * sale.fav) && sale.sold === Math.floor(1000 * sale.ks), 'Dawn\u2019s Favor adds 10% to coins I earn and nothing to a shop sale', J(sale));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
