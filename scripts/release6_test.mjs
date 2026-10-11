// RELEASE 6 (per user: "Boss rush cost nothing", and the co-op ticket-mech credit gap "monitor the parallel edit and fix that"):
//   R1. a death in the Boss Rush costs nothing - no coins, no EXP - and the death card says so; a death outside it still pays the toll
//   C3. a guest's ticket-mech kill that moves no Ticket Rush stage falls through to the ordinary quest tick, as the host's does
//   node scripts/release6_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11961), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
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
    player._gravitosCineSeen = true; player.level = 60;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    const clear = () => { try { closeAllModals(); } catch (e) {} game.paused = false; };
    const die = async (inRush) => {
      for (let i = 0; i < 3 && game.currentMap !== (inRush ? 'boss_rush' : 'forest'); i++) { loadMap(inRush ? 'boss_rush' : 'forest', 300); await sleep(1500); }
      clear();
      if (inRush) game.bossRush = { active: true, queue: ['a', 'b'], idx: 0, downs: 0, t0: Date.now(), splits: [] };
      player.mojicoins = 100000; player.bankBalance = 0; player.exp = 1000; player._god = false; player.invulnerable = 0;
      const c0 = player.mojicoins + (player.bankBalance || 0), e0 = player.exp;
      player.hp = 0; triggerDeath(); await sleep(400);
      const sub = (document.getElementById('death-sub') || {}).textContent || '';
      const r = { map: game.currentMap, coins: c0 - (player.mojicoins + (player.bankBalance || 0)), exp: e0 - player.exp, sub };
      try { if (typeof respawnAtTown === 'function') respawnAtTown(); } catch (e) {} await sleep(1500); clear(); game.bossRush = null; player.hp = player.maxHp;
      return r;
    };
    out.rush = await die(true);
    out.field = await die(false);
    const src = [...document.scripts].map((x) => x.textContent).join('\n');
    out.c3 = { fall: src.includes('if (_lxPqTicketFamily(msg.tp, msg.nm) && _lxPqDirectTick()) {'), old: src.includes("if (_lxPqTicketFamily(msg.tp, msg.nm)) _lxPqDirectTick();\n      else if"),
      keep: src.includes("else if (typeof tickQuestKill === 'function') tickQuestKill(msg.tp, !!msg.b);   // v0.30.x coop-audit; v0.30.1698 an echo ticks its quest, as on the host") };
    return out;
  });
  ok('R1. a Boss Rush death costs no coins and no EXP', R.rush.coins === 0 && R.rush.exp === 0, R.rush);
  ok('R1. ...and the death card says so', /Boss Rush death costs nothing/.test(R.rush.sub), R.rush.sub);
  ok('R1. a death outside it still pays the toll (10% of coins up to the cap, 5% EXP)', R.field.coins > 0 && R.field.exp === 50 && !/Boss Rush/.test(R.field.sub), R.field);
  ok('C3. a guest ticket-mech kill that moved no stage falls through to the quest tick (the v0.30.1698 line kept)', R.c3.fall && !R.c3.old && R.c3.keep, R.c3);
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
