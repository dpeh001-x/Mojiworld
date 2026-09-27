// FIGHT LAG, the cinematic flag (v0.30.1245). Per user: "reduce the lag of the game especially fights and boss fights
// even more". _lxSyncCinematic mirrors the death / story beat / boss intro / void intro overlays onto body.cinematic 4x a
// second; it asked a four-selector querySelector (a whole-document walk, ~2 ms a call at 4x CPU). Now four id lookups.
//   - SAME: body.cinematic follows each of the four overlays on and off exactly as before
//   - NO WALK: the function no longer calls querySelector
//   - COST: a call costs a fraction of the old selector walk, measured in the same page
//   [SERVE_ROOT=<dir with serve.js, data/, art>] [PORT=12406] node scripts/cinematic_sync_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12406';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxSyncCinematic === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('mushroom', 600); await W8(1500);
    const pairs = [['death-overlay', 'on'], ['story-beat-overlay', 'on'], ['boss-intro-overlay', 'on'], ['void-intro-overlay', 'show']];
    for (const [id, k] of pairs) { const e = document.getElementById(id); if (e) e.classList.remove(k); }
    _lxSyncCinematic(); const base = document.body.classList.contains('cinematic');
    const same = {};
    for (const [id, k] of pairs) { const e = document.getElementById(id); if (!e) { same[id] = 'missing'; continue; }
      e.classList.add(k); _lxSyncCinematic(); const on = document.body.classList.contains('cinematic');
      e.classList.remove(k); _lxSyncCinematic(); const off = document.body.classList.contains('cinematic'); same[id] = on && !off; }
    const src = String(_lxSyncCinematic);
    const T = (fn, n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t0) / n; };
    const oldQ = () => !!document.querySelector('#death-overlay.on, #story-beat-overlay.on, #boss-intro-overlay.on, #void-intro-overlay.show');
    T(oldQ, 200); T(_lxSyncCinematic, 200);
    return { base, same, walks: /querySelector/.test(src), oldUs: +(1000 * T(oldQ, 3000)).toFixed(2), newUs: +(1000 * T(_lxSyncCinematic, 3000)).toFixed(2) };
  });
  check(r.base === false && Object.values(r.same).every((v) => v === true), 'SAME: body.cinematic follows each of the four overlays on and off', J(r.same));
  check(!r.walks, 'NO WALK: _lxSyncCinematic no longer calls querySelector', J({ walks: r.walks }));
  check(r.newUs < r.oldUs * 0.5, 'COST: a call costs under half of the old selector walk (same page)', J({ oldUs: r.oldUs, newUs: r.newUs }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
