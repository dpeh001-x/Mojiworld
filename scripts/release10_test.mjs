// RELEASE 10 (per user): the game starts offline after one visit; music is answered offline with a real 206 slice; no dev lock on
// phones (still on desktop web); "Apprentice" is Lv 10 and "Adept" Lv 20.
//   node scripts/release10_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
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
const URL = `http://localhost:${PORT}/${FILE}`;
const menuUp = (page, t) => page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: t || 180000 });
try {
  // ---- offline start (service worker ON)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 }); await menuUp(page);
  await page.waitForFunction(() => !!navigator.serviceWorker && !!navigator.serviceWorker.controller, null, { timeout: 60000 }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' }); await menuUp(page); await page.waitForTimeout(4000);   // a controlled visit stores the page and tables
  const AUD = 'audio/Blockland.mp3';
  const on = await page.evaluate(async (a) => { const r = await fetch(a, { headers: { Range: 'bytes=0-' } }); const b = await r.arrayBuffer(); await new Promise((x) => setTimeout(x, 3000)); return { status: r.status, size: b.byteLength, ctl: !!navigator.serviceWorker.controller }; }, AUD);
  await ctx.setOffline(true);
  let offOk = false, offErr = '';
  try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await menuUp(page, 120000); offOk = true; } catch (e) { offErr = String(e.message).slice(0, 160); }
  const off = offOk ? await page.evaluate(async (a) => {
    const tables = typeof LX_MONSTER_STATS !== 'undefined' && typeof QUESTS !== 'undefined';
    let rs = 0, len = 0, cr = '';
    try { const r = await fetch(a, { headers: { Range: 'bytes=100-199' } }); rs = r.status; cr = r.headers.get('content-range') || ''; len = (await r.arrayBuffer()).byteLength; } catch (e) { cr = 'threw'; }
    return { tables, rs, len, cr, online: navigator.onLine };
  }, AUD) : null;
  await ctx.setOffline(false); await ctx.close();
  // ---- dev lock + achievements
  const dp = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  dp.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await dp.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 }); await menuUp(dp); await dp.waitForTimeout(1500);
  const D = await dp.evaluate(() => ({ lock: !!document.getElementById('lx-dev-lock'), lv10: (ACHIEVEMENTS.find((a) => a.id === 'lv10') || {}).name, lv20: (ACHIEVEMENTS.find((a) => a.id === 'lv20') || {}).name }));
  const mp = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' })).newPage();
  await mp.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 }); await menuUp(mp); await mp.waitForTimeout(1500);
  const M = await mp.evaluate(() => ({ lock: !!document.getElementById('lx-dev-lock'), touch: typeof _lxIsTouchDevice === 'function' && _lxIsTouchDevice() }));
  ok('the service worker controls the page after the first visit, and a music range request is answered online', on.ctl && (on.status === 206 || on.status === 200) && on.size > 1000, on);
  ok('offline, a reload brings the title back with its data tables', offOk && off && off.tables && off.online === false, offOk ? off : offErr);
  ok('offline, a music range request gets a real 206 slice of the stored track', off && off.rs === 206 && off.len === 100 && /^bytes 100-199\//.test(off.cr), off);
  ok('the dev lock shows on desktop web and not on a phone', D.lock === true && M.touch && M.lock === false, { desktop: D.lock, phone: M });
  ok('"Apprentice" is the Lv 10 achievement and "Adept" the Lv 20 one', D.lv10 === 'Apprentice' && D.lv20 === 'Adept', D);
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
