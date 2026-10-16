// A BOSS FIGHT KEEPS ITS WORKING SET IN THE CANVAS BUDGET (per user: "reduce the boss fight lag"). Since v0.30.1742 the trim
// released this map's copies idle for 15 s whenever the budget was over, and a Gravitos fight's working set (~200-215M px
// against 160M) is always over: his attack sets and the fight's effects were released between uses and decoded again inside
// a frame each time they came back. The real _lxCvTrim is driven with synthetic tracked copies (canvases with no context,
// so no memory) on the arena with the boss alive, then in town:
//   [1] a boss alive, 1.3x the budget, this map's copies idle 20 s: none released (the ceiling is 1.5x)
//   [2] a boss alive, 1.8x the budget: released down to 0.8x the ceiling (1.2x the budget), not to 0.8x the budget
//   [3] a copy drawn in the last 15 s is never released, even past the ceiling
//   [4] no boss (town), 1.3x the budget, idle 20 s: released down to 0.8x the budget, as before
//   [5] _lxCvBossFight: true in the Gravitos arena with him alive, false in town
//   node scripts/boss_budget_test.mjs      PORT / MOJI_SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15431);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 400) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio', '--no-sandbox'] });
const errs = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxCvTrim === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3500);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
    for (const i of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(i); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); player.level = 100; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS || {})) player._storyBeatsSeen[k] = true;
    const B = _LX_CV_BUDGET_PX, out = { budget: B / 1e6 };
    // the game's own copies are set aside so the trim sees only the synthetic ones; each is 4M px with no context (no memory)
    const run = (mult, idleMs, recentN) => {
      const saved = [..._lxCvLru.entries()], savedPx = _lxCvLruPx; _lxCvLru.clear(); _lxCvLruPx = 0;
      const per = 4e6, n = Math.round(B * mult / per), now = performance.now(), map = _lxCvMapNow(), mine = [];
      for (let i = 0; i < n; i++) { const cv = document.createElement('canvas'); cv.width = 4000; cv.height = 1000; _lxCvLru.set(cv, { px: per, evict: null }); _lxCvLruPx += per; cv._lxMapT = map; cv._lxLruT = now - (i < (recentN || 0) ? 2000 : idleMs); mine.push(cv); }
      // the recent ones go to the end (most recently drawn last), as _lxCvTouch would leave them
      for (let i = 0; i < (recentN || 0); i++) { const e = _lxCvLru.get(mine[i]); _lxCvLru.delete(mine[i]); _lxCvLru.set(mine[i], e); }
      const ev0 = _lxCvEvicted; _lxCvTrim();
      const res = { before: +(n * per / B).toFixed(2), after: +(_lxCvLruPx / B).toFixed(2), released: _lxCvEvicted - ev0, recentKept: mine.slice(0, recentN || 0).every((c) => _lxCvLru.has(c)) };
      _lxCvLru.clear(); _lxCvLruPx = savedPx; for (const [c, e] of saved) _lxCvLru.set(c, e);
      return res;
    };
    loadMap('gravitosArena', 300); await sleep(4000); game.paused = false; player.invulnerable = 1e9;
    let boss = (game.monsters || []).find((m) => m && m.type === 'gravitos' && m.currentHp > 0);
    if (!boss) { try { spawnMonster(player.x + 300, player.y - 60, 'gravitos', true); } catch (e) {} boss = (game.monsters || []).find((m) => m && m.type === 'gravitos'); }
    out.bossAlive = !!(boss && boss.currentHp > 0); out.fightArena = typeof _lxCvBossFight === 'function' ? _lxCvBossFight() : 'missing';
    out.a = run(1.3, 20000); out.b = run(1.8, 20000); out.c = run(1.8, 20000, 40);
    loadMap('town', 300); await sleep(2500);
    out.fightTown = typeof _lxCvBossFight === 'function' ? _lxCvBossFight() : 'missing';
    out.d = run(1.3, 20000);
    return out;
  });
  console.log(JSON.stringify(R));
  ok('[1] a boss alive, 1.3x the budget, this map idle 20 s: nothing released (the ceiling is 1.5x)', R.bossAlive && R.a.released === 0 && R.a.after === R.a.before, R.a);
  ok('[2] a boss alive, 1.8x the budget: released down to 0.8x the ceiling (1.2x), not to 0.8x the budget', R.b.released > 0 && R.b.after <= 1.2 && R.b.after > 1.1, R.b);
  ok('[3] copies drawn in the last 15 s stay, even past the ceiling', R.c.recentKept && R.c.released > 0, R.c);
  ok('[4] town (no boss), 1.3x the budget, idle 20 s: released down to 0.8x the budget, as before', R.d.released > 0 && R.d.after <= 0.8 && R.d.after > 0.7, R.d);
  ok('[5] the fight test: true in the Gravitos arena with him alive, false in town', R.fightArena === true && R.fightTown === false, { arena: R.fightArena, town: R.fightTown });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e && e.message).slice(0, 300), false); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
