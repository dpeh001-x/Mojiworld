#!/usr/bin/env node
// The ENDGAME Gravitos walks at you between moves (per user: "Yes fix the endgame Gravitos fight too").
// =============================================================================
// v0.30.1333 gave the prologue memory a stride start: his idle drift begins at 0.08 px a tick, under the walk-latch
// threshold (speed x 0.35 = 0.49), and the latch kill zeroes anything under it every tick - so he stood frozen between
// moves. The real fight in the Singularity arena kept the freeze (measured 0 / 0 / 16 px walked between moves in 30 s of
// forms 1 / 2 / 3). This drives the real arena, parks the hero far from him, and per SIM STEP (deduped on game.time)
// checks the steps he is free to walk: idle pattern, past the v0.29.938 recovery beat (patternTimer >= 600 - those
// 600 ms of idle art after each move are kept on purpose), no teleport warning, not casting, hero > 260 px away.
//   1-2. form 1 / form 2: he moves in most free steps and covers real ground
//   3-4. never slides: a step that moves him while idle has the walk latch on (the walk set plays)
//   PORT=<port> [MOJI_GAME_FILE=<repo-relative candidate>] node scripts/gravitos_endgame_walk_test.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), PORT = +(process.env.PORT || 10461);
const server = spawn(process.execPath, ['serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore', env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const results = []; const check = (name, ok, info) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  - ' + info : ''}`); };
try {
  const cx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const page = await cx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof applyClass === 'function' && typeof killMonster === 'function' && game.mapData, null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    try { _lxBootGateDone = true; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('rogue'); player._gravitosCineSeen = true;
  });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { window._prologueActive = false; window._prologueAfterCreation = false; player._gravitosCineSeen = true; player.level = Math.max(player.level || 1, 80); loadMap('gravitosArena');
    setInterval(() => { if ('maxHp' in player) player.maxHp = 1e7; for (const k of ['hp', 'currentHp']) if (k in player) player[k] = 1e7; }, 50); });
  const boss = () => page.evaluate(() => game.monsters.some((q) => q && q.type === 'gravitos'));
  for (let i = 0; i < 15 && !(await boss()); i++) await page.waitForTimeout(1000);
  // the entrance clip and each form's story beat: skipped the way a player can (Skip / Escape while a beat is up)
  const clear = async () => {
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(1000);
      const sk = page.locator('button:visible, [role=button]:visible').filter({ hasText: /^\s*Skip/ });
      if (await sk.count()) { await sk.first().click().catch(() => {}); continue; }
      if (await page.evaluate(() => document.body.classList.contains('cinematic'))) { await page.keyboard.press('Escape').catch(() => {}); continue; }
      if (i >= 2) break;
    }
    const r = page.locator('button:visible, [role=button]:visible').filter({ hasText: /^\s*\W*\s*Resume/ });
    if (await r.count()) await r.first().click().catch(() => {});
    await page.evaluate(() => { game.paused = false; });
  };
  await clear();
  // per sim step: his position, pattern clock and walk latch; the hero is moved away from him every 1.5 s
  const sample = async (secs) => page.evaluate(async (secs) => {
    const m = game.monsters.find((q) => q && q.type === 'gravitos'); if (!m) return null;
    const S = []; let lastT = null; const t0 = performance.now(), ww = (game.mapData && game.mapData.worldWidth) || 2400;
    const park = () => { const bc = m.x + m.w / 2, far = bc < ww / 2 ? ww - 120 : 90; player.x = far - player.w / 2; player.vx = 0; };
    park(); let lastPark = performance.now();
    await new Promise((res) => { (function tick() {
      if (performance.now() - lastPark > 1500) { park(); lastPark = performance.now(); }
      if (game.time !== lastT) { lastT = game.time; S.push({ x: m.x, w: m.w, ps: m.patternState || '', pt: m.patternTimer || 0, tw: !!m._tpWarn, cast: typeof _mobCasting === 'function' && _mobCasting(m), lat: !!m._walkLatch, px: player.x + player.w / 2, paused: !!game.paused }); }
      if (performance.now() - t0 < secs * 1000) requestAnimationFrame(tick); else res(); })(); });
    return S;
  }, secs);
  const judge = (S) => {
    let free = 0, moved = 0, walked = 0, slides = 0;
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1], b = S[i], dx = Math.abs(b.x - a.x);
      if (dx > 40 || b.paused || (b.ps && b.ps !== 'idle') || b.tw) continue;   // teleports and patterns are not strides
      if (dx > 0.3 && !b.lat) slides++;
      if (b.pt < 600 || b.cast || Math.abs((b.x + b.w / 2) - b.px) < 260) continue;
      free++; if (dx > 0.05) { moved++; walked += dx; }
    }
    return { free, moved, walked: Math.round(walked), slides, share: free ? moved / free : 0 };
  };
  const f1 = judge(await sample(14) || []);
  check('form 1: walks in most free steps', f1.free >= 20 && f1.share >= 0.6 && f1.walked >= 60, `${f1.moved}/${f1.free} free steps moved, ${f1.walked} px`);
  check('form 1: never slides under idle art', f1.slides === 0, `${f1.slides} moving steps without the walk latch`);
  await page.evaluate(() => { const m = game.monsters.find((q) => q && q.type === 'gravitos'); if (m) killMonster(m); });   // the pool's end is the form change
  await clear();
  const form = await page.evaluate(() => { const m = game.monsters.find((q) => q && q.type === 'gravitos'); return m ? m._phaseSprite || '' : 'gone'; });
  const f2 = judge(await sample(14) || []);
  check('form 2: walks in most free steps', form === 'gravitos2' && f2.free >= 20 && f2.share >= 0.6 && f2.walked >= 60, `form ${form}; ${f2.moved}/${f2.free} free steps moved, ${f2.walked} px`);
  check('form 2: never slides under idle art', f2.slides === 0, `${f2.slides} moving steps without the walk latch`);
  if (errs.length) console.log('page errors:', errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
const bad = results.filter((r) => !r).length;
console.log(bad ? `${bad}/${results.length} FAILED` : `all ${results.length} passed`);
process.exit(bad ? 1 : 0);
