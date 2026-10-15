// A SWING NEVER OPENS MID-LUNGE (per user: "distorted mira has occasional slip and sliding motion, ensure that when she attacks she is
// kept still without sliding around"). Her hourglass lunge dashes ~48 px a step; her heavy swing used to open DURING the dash, and its pose
// skated ~144 px over three frames (the dash overwrote the swing's vx = 0 every tick). Forced here on a controlled clock (33 ms a step):
// Distorted Mira spawned 450 px from a god-mode hero who stands still, her lunge armed and her swing ready, her other moves held off.
// What _drawBossSprite is handed each step is recorded (its own attack flag), with her x:
//   1. the lunge still happens (she covers 200+ px in its dash)
//   2. no step that draws attack art moves her more than 4 px (the dash draws her walk; the swing opens planted)
//   3. she still swings - the heavy opens after the dash, standing still for its whole windup and strike
//   4. her own kit waits too: the Turn Back blink never fires mid-cast, her lunge never opens out of a cast pose, no cast opens mid-lunge
//      (each still happens once the other is over)
//   node scripts/mira_lunge_plant_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 9833);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + JSON.stringify(x).slice(0, 500))); };
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 560 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.clock.install();
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {} if (!player.cls) applyClass('warrior'); player.level = 99; player._god = true; player.invulnerable = 1e9;
    try { for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true; } catch (e) {}
    game.paused = false; loadMap('forest', 300); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    game.monsters.length = 0; game.projectiles && (game.projectiles.length = 0);
    player.x = 700; player.y = 480 - player.h; player.vx = 0; player.vy = 0; player.facing = 1;
    const m = spawnMonster(1150, 480 - monsterTypes.miraFallen.h, 'miraFallen', true) || game.monsters[game.monsters.length - 1];
    window.__m = m; m.aggroTarget = player; m._introDone = true; m.currentHp = m.maxHp;
    window.__keep = () => { const m = window.__m; m.currentHp = m.maxHp; player.hp = getMaxHp(); player.invulnerable = 1e9; player.vx = 0; player.x = 700;
      for (const id of ['boss-intro-overlay', 'story-beat-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      // her own moves held off (the step-teleport, the Eleven, the Gate, feathers, sand) and the column: only the lunge and the swing are in play
      const far = (game.time | 0) + 1e6; for (const k of (window.__hold || ['_miraStepAt', '_miraGateAt', '_miraFeatherAt', '_miraSandAt', '_miraElevenAt'])) m[k] = far; m._columnCd = 1e9; };
    const uc = window.updateCamera; window.updateCamera = function () { uc.apply(this, arguments); const mm = window.__m; if (mm) { const ww = game.mapData.worldWidth || 960; game.camera.x = Math.max(0, Math.min(ww - 960, mm.x + mm.w / 2 - 480)); } };
    const DB = window._drawBossSprite; window.__atk = null;
    window._drawBossSprite = function (sprite, mm, sx, sy, isAtk) { if (mm === window.__m) window.__atk = !!isAtk; return DB.apply(this, arguments); };
  });
  for (let i = 0; i < 20; i++) { await page.evaluate(() => window.__keep()); await page.waitForTimeout(300); }   // art decode, real time
  const now = await page.evaluate(() => Date.now()); await page.clock.pauseAt(now + 1000);
  // arm the lunge toward the hero and ready the swing (it would open the moment the dash brings her into reach)
  await page.evaluate(() => { const m = window.__m; m.x = 1150; m.vx = 0; m._hgCharging = false; m._hgCd = 0; m._bigMeleeCd = 0; m._bigMeleeFiring = false; });
  const F = [];
  for (let i = 0; i < 150; i++) {
    await page.evaluate(() => { window.__keep(); window.__atk = null; }); await page.clock.runFor(33);
    F.push(await page.evaluate(() => { const m = window.__m;
      return { x: m.x, atk: window.__atk, hg: m._hgCharging ? m._hgPhase : '', heavy: !!m._bigMeleeFiring, key: (m._bossAtkKey && (game.time | 0) < (m._bossAtkUntil | 0)) ? m._bossAtkKey : '' }; }));
  }
  let dash = 0, worst = { dx: 0 }, swingAt = -1, swingMoved = 0;
  for (let i = 1; i < F.length; i++) {
    const dx = Math.abs(F[i].x - F[i - 1].x);
    if (F[i].hg === 'dash' || F[i - 1].hg === 'dash') dash += dx;
    if (F[i].atk && dx > worst.dx) worst = { i, dx: +dx.toFixed(1), hg: F[i].hg, heavy: F[i].heavy, key: F[i].key };
    if (F[i].heavy && swingAt < 0) swingAt = i;
    if (F[i].heavy) swingMoved += dx;
  }
  ok('the lunge still happens (200+ px in its dash)', dash >= 200, { dash: Math.round(dash) });
  ok('no step that draws attack art moves her more than 4 px (was 48 px a step: the swing pose skated with the dash)', worst.dx <= 4, worst);
  ok('she still swings after the lunge, and the swing opens once the dash is over', swingAt > 0 && !F[swingAt].hg, { swingAt, hg: swingAt > 0 ? F[swingAt].hg : null });
  ok('she stands still for the whole swing (windup and strike)', swingAt > 0 && swingMoved <= 4, { swingMoved: +swingMoved.toFixed(1) });
  // ---- her own kit waits for her attacks too ----
  const pose = () => page.evaluate(() => { const m = window.__m; return !!(m._bossAtkKey && (game.time | 0) < (m._bossAtkUntil | 0)); });
  // (a) the Turn Back blink is due while a cast pose is live (hero 550 px off): she holds still until the pose ends, then blinks
  await page.evaluate(() => { const m = window.__m; window.__hold = ['_miraGateAt', '_miraFeatherAt', '_miraSandAt', '_miraElevenAt'];
    m._hgCharging = false; m._hgCd = 1e9; m._bigMeleeFiring = false; m._bigMeleeCd = 1e9; m.vx = 0; m.x = 1250; _lxSovAtkPose(m, 'collapse', 90); m._miraStepAt = (game.time | 0); });
  const A = [];
  for (let i = 0; i < 90; i++) { await page.evaluate(() => { window.__keep(); const m = window.__m; m._hgCd = 1e9; m._bigMeleeCd = 1e9; }); await page.clock.runFor(33); A.push({ x: await page.evaluate(() => window.__m.x), pose: await pose() }); }
  let posedMove = 0, blinkAfter = false;
  for (let i = 1; i < A.length; i++) { const dx = Math.abs(A[i].x - A[i - 1].x); if (A[i].pose && A[i - 1].pose) posedMove = Math.max(posedMove, dx); if (!A[i].pose && dx > 40) blinkAfter = true; }
  ok('her Turn Back blink waits while a cast pose is live (it popped her 300-380 px mid-cast)', posedMove <= 4, { posedMove: +posedMove.toFixed(1) });
  ok('and still fires the moment the pose ends', blinkAfter, A.filter((a, i) => i % 10 === 0));
  // (b) her lunge is ready while a cast pose is live (hero in lunge range): it opens only after the pose
  await page.evaluate(() => { const m = window.__m; window.__hold = null; m.x = 1150; m.vx = 0; m._hgCharging = false; m._hgCd = 0; m._bigMeleeCd = 1e9; _lxSovAtkPose(m, 'drain', 45); });
  const B = [];
  for (let i = 0; i < 70; i++) { await page.evaluate(() => { window.__keep(); const m = window.__m; m._bigMeleeCd = 1e9; }); await page.clock.runFor(33); B.push({ hg: await page.evaluate(() => !!window.__m._hgCharging), pose: await pose() }); }
  ok('her lunge never opens out of a cast pose (the collapse pose skated 48 px a step)', !B.some((b) => b.hg && b.pose), B.findIndex((b) => b.hg && b.pose));
  ok('and still opens once the pose is over', B.some((b) => b.hg && !b.pose));
  // (c) her feathers fall due in the middle of the lunge: no cast pose opens until the lunge is over, then the volley flies
  const C = [];
  for (let i = 0; i < 70; i++) { await page.evaluate(() => { window.__hold = ['_miraStepAt', '_miraGateAt', '_miraSandAt', '_miraElevenAt']; window.__keep(); const m = window.__m; m._bigMeleeCd = 1e9; if (m._hgCharging) m._miraFeatherAt = (game.time | 0); }); await page.clock.runFor(33);
    C.push({ hg: await page.evaluate(() => !!window.__m._hgCharging), pose: await pose() }); }
  ok('no cast opens in the middle of her lunge', !C.some((c) => c.hg && c.pose), C.findIndex((c) => c.hg && c.pose));
  ok('her volley still flies once the lunge is over', C.some((c, i) => i > 0 && !c.hg && c.pose && C.slice(0, i).some((d) => d.hg)));
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
