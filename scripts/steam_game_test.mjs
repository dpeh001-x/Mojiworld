// STEAM, GAME SIDE (v0.30.898 launch audit). A stand-in window.SteamAPI: a dropped file does not navigate the page; the
// per-frame Steam Input snapshot (a synchronous IPC call, null when no Steam controller exists) backs off; Steam stats
// report an ascended hero's level as the cap, clamp to setInt's 32-bit range and are stored at most once a minute.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/steam_game_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11217';
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
  await ctx.addInitScript(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
    window.__snaps = 0; window.__stats = [];
    window.SteamAPI = { available: true, deck: false,
      input: { snapshot() { window.__snaps++; return null; } },
      stats: { set(o) { window.__stats.push(o); return Promise.resolve(true); } },
      achievement: { unlock() { return Promise.resolve(true); } },
      cloud: { read: async () => null, write: async () => true, writeSync: () => true } };
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxSteamPushStats === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    // 1. a dropped file
    const dt = new DataTransfer(); try { dt.items.add(new File(['x'], 'probe.txt', { type: 'text/plain' })); } catch (e) {}
    const ov = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }); document.body.dispatchEvent(ov);
    const dr = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }); document.body.dispatchEvent(dr);
    out.drop = { over: ov.defaultPrevented, drop: dr.defaultPrevented };
    // 2. the Steam Input snapshot over ~4 s of frames
    const s0 = window.__snaps, t0 = performance.now(); await wait(4000); out.snaps = { calls: window.__snaps - s0, ms: Math.round(performance.now() - t0) };
    // 3. stats
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 1; player.mojicoins = 1e12; game.prestige = Object.assign(game.prestige || {}, { count: 1 });
    try { _lxSteamStatsAt = 0; } catch (e) {}
    window.__stats.length = 0; _lxSteamPushStats(); _lxSteamPushStats(); _lxSteamPushStats();
    out.stats = { pushes: window.__stats.length, first: window.__stats[0] || null };
    // 4. the prologue's apex fight must not leave its combo record behind (restore path, as _prologueFinish runs it)
    const src = [...document.scripts].map((x) => x.textContent).join('\n');
    out.snapWrites = /comboRecord: game\.comboRecord \|\| 0, dailyState: game\.dailyState \|\| null/.test(src);
    window._prologueSnapP = JSON.stringify(player);
    window._prologueSnapG = JSON.stringify({ mojidexSeen: {}, bestiary: {}, bossDefeated: {}, kills: 0, early: null, achievements: null, comboRecord: 0, dailyState: null });
    game.comboRecord = 120; game.dailyState = { probe: true };
    window._prologueActive = true;   // _prologueFinish only runs for a prologue in progress
    try { _prologueFinish(true); } catch (e) { out.finishErr = String(e.message); }
    out.prologue = { comboRecord: game.comboRecord, daily: game.dailyState ? Object.keys(game.dailyState) : null };
    return out;
  });
  check(r.drop.over && r.drop.drop, 'a file dropped on the window is refused (it navigated the page away from the game)', J(r.drop));
  check(r.snaps.calls < 120, 'with no Steam controller, the synchronous Steam Input call backs off (was every frame)', J(r.snaps));
  check(r.stats.pushes === 1 && r.stats.first && r.stats.first.highest_level === 100 && r.stats.first.lifetime_coins === 2147483647, 'Steam stats: an ascended hero reports Lv 100, coins clamp to 32 bits, one store a minute', J(r.stats));
  check(r.snapWrites && r.prologue.comboRecord === 0 && !(r.prologue.daily || []).includes('probe'), 'the Lv 100 prologue leaves no combo record or daily progress behind (combo achievements unlocked on Steam for a Lv 1 hero)', J({ snap: r.snapWrites, after: r.prologue, err: r.finishErr }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
