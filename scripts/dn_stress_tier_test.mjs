// THE SECOND FX TIER REACHES THE DAMAGE NUMBERS (v0.30.941 boss-fight lag). A screenful of figures already draws
// the cheap way - flat fill, outline and shadow, no halo, no rim, no gradient - which is three passes instead of
// five: a 40% smaller sheet to bake and two fewer blits per figure per frame. Only the count on screen asked for
// it, so a machine already in veryLowFx still paid for haloes it had lost everywhere else.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/dn_stress_tier_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11331';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: PAGE };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(/_dnStress = game\.damageNumbers\.length > 18 \|\| \(typeof _perfVeryLowFx/.test(src), 'the tier is part of the stress test');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof drawDamageNumbers === 'function' && typeof _LX_DN_ATLAS !== 'undefined', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; loadMap('forest', 300); await new Promise((r) => setTimeout(r, 900));
  });
  // one crit, four figures on screen, drawn once in each tier: how many rows does its sheet carry?
  const rows = await page.evaluate(() => {
    const run = (very) => {
      _LX_DN_ATLAS.clear();
      LX_PERF.lowFx = true; LX_PERF.veryLowFx = very;
      if (game._lowFxCache) game._lowFxCache.frame = -1;
      game.damageNumbers.length = 0;
      for (let i = 0; i < 4; i++) game.damageNumbers.push({ x: player.x + i * 30, y: player.y - 40, vy: -1.8,
        text: '48213', life: 40, maxLife: 41, color: '#ffd84a', crit: true, size: 22 });
      for (let f = 0; f < 8; f++) drawDamageNumbers();          // one sheet a frame, so give it a few
      const sheets = [..._LX_DN_ATLAS.values()].filter(Boolean);
      const out = { n: sheets.length, rows: sheets.map((a) => a.rows), h: sheets.map((a) => a.cv.height) };
      game.damageNumbers.length = 0;
      return out;
    };
    const calm = run(false), eased = run(true);
    LX_PERF.lowFx = false; LX_PERF.veryLowFx = false;
    return { calm, eased };
  });
  const minCalm = Math.min(...(rows.calm.rows.length ? rows.calm.rows : [0]));
  const maxEased = Math.max(...(rows.eased.rows.length ? rows.eased.rows : [9]));
  check(rows.calm.n > 0 && minCalm >= 4, 'a crit still carries its halo pass while the frames hold', J(rows.calm));
  check(rows.eased.n > 0 && maxEased === 3, 'in the second FX tier the same crit bakes three', J(rows.eased));
  check(Math.max(...rows.eased.h) < Math.max(...rows.calm.h), 'and its sheet is smaller to bake and to upload',
    J({ calm: Math.max(...rows.calm.h), eased: Math.max(...rows.eased.h) }));
  // the same six crits, drawn ten frames in each tier, counting what the canvas is actually asked to do
  const ops = await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype, names = ['drawImage', 'fillText', 'strokeText', 'save', 'restore', 'setTransform', 'beginPath', 'fill', 'clip'];
    const orig = {}; let n = 0;
    for (const k of names) { orig[k] = P[k]; P[k] = function () { n++; return orig[k].apply(this, arguments); }; }
    const run = (very) => {
      _LX_DN_ATLAS.clear();
      LX_PERF.lowFx = true; LX_PERF.veryLowFx = very;
      if (game._lowFxCache) game._lowFxCache.frame = -1;
      game.damageNumbers.length = 0;
      for (let i = 0; i < 6; i++) game.damageNumbers.push({ x: player.x + i * 30, y: player.y - 40, vy: 0,
        text: '48213', life: 40, maxLife: 41, color: '#ffd84a', crit: true, size: 22 });
      for (let f = 0; f < 6; f++) drawDamageNumbers();          // let the sheets bake (one a frame)
      const before = n;
      for (let f = 0; f < 10; f++) { for (const d of game.damageNumbers) d.life = 30; drawDamageNumbers(); }
      const used = n - before;
      game.damageNumbers.length = 0;
      return used;
    };
    const calm = run(false), eased = run(true);
    for (const k of names) P[k] = orig[k];
    LX_PERF.lowFx = false; LX_PERF.veryLowFx = false;
    return { calm, eased, ratio: +(eased / Math.max(1, calm)).toFixed(2) };
  });
  check(ops.eased < ops.calm * 0.85, 'six crits cost the canvas less in the second tier', J(ops));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
