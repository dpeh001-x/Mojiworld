// The expedition does not scale DOWN below Lv 50.
//
// Per user: "work on making difficulty of expedition at lower levels (i.e 30) way harder, when players
// enter below level 50, the base level of the monsters should be 50". Driven through a REAL run:
// _startExpedition at each player level, then the monsters floor 1 actually spawned are read.
//   1. under 50 (Lv 30, 45): every tower mob on floor 1 is Lv 50 and statted as one
//   2. at and above 50 (Lv 50, 60, 90): unchanged - the player's level, capped at 85
//   3. both tower bosses stay "+10 over the tower": Lv 60 for an under-50 run, player+10 above it
//   4. Train Rush shares the old scaler and is untouched (_lxScaledMobLevel(30) is still 30)
//   5. an under-50 entrant is told at the door; a Lv-60 one is not
//   node scripts/expedition_level_floor_test.mjs        (MOJI_GAME_FILE to test a candidate)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT; for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: process.env });
await new Promise((r) => setTimeout(r, 2000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _startExpedition === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.evaluate(() => {
  try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
  document.querySelectorAll('[id^="story-beat"], #lo-stack, #tutorial-modal').forEach((e) => e.remove());
  player.cls = 'warrior'; player.level = 30; player.invulnerable = 9e9;
  loadMap('town', 300); game.paused = false;
});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = { floor: (typeof LX_EXPEDITION_MIN_MOB_LEVEL === 'number') ? LX_EXPEDITION_MIN_MOB_LEVEL : null, runs: {} };
  const toasts = []; const _st = window.showToast; window.showToast = (t, k) => { toasts.push(String(t)); };
  for (const L of [30, 45, 50, 60, 90]) {
    if (game.expedition && game.expedition.active && typeof _endExpedition === 'function') { try { _endExpedition('abandon'); } catch (e) {} await wait(300); }
    player.level = L; player.hp = getMaxHp(); toasts.length = 0;
    const started = _startExpedition();
    await wait(2200);   // floor 1 loads and spawns; the door warning is deferred 1.6 s
    const mobs = (game.monsters || []).filter((m) => m && !m.isBoss && m.currentHp > 0);
    const lv = [...new Set(mobs.map((m) => m.level))];
    const one = mobs[0];
    const base = one ? _lxFieldBaseline(one.level) : null;
    out.runs[L] = { started, map: game.currentMap, n: mobs.length, levels: lv,
      hpRatio: one && base ? +(one.maxHp / base.hp).toFixed(3) : null,
      warned: toasts.some((t) => /does not come down to you/.test(t)) };
    // the bosses, through the real spawner (deferred 1.1 s)
    for (const slot of ['mid', 'final']) {
      game.monsters.length = 0;
      _expeditionSpawnTowerBoss(slot);
      await wait(1400);
      const bm = game.monsters.find((m) => m && m._expeditionBoss);
      out.runs[L][slot] = bm ? bm.level : null;
    }
  }
  if (game.expedition && game.expedition.active) { try { _endExpedition('abandon'); } catch (e) {} }
  window.showToast = _st;
  out.trainRush30 = _lxScaledMobLevel(30);
  out.hpMul = LX_EXPEDITION_MOB_HP_MUL;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}
console.log(JSON.stringify(r, null, 1));
const R = r.runs, is = (L, lv) => R[L] && R[L].n > 0 && R[L].levels.length === 1 && R[L].levels[0] === lv;
ok('the floor exists and is Lv 50', r.floor === 50, r.floor);
ok('Lv 30 entrant: every floor-1 tower mob is Lv 50', is(30, 50), JSON.stringify(R[30]));
ok('Lv 45 entrant: every floor-1 tower mob is Lv 50', is(45, 50), JSON.stringify(R[45]));
ok('...and statted AS a Lv-50 tower mob (HP = Lv-50 field baseline x the tower HP dial)', R[30] && Math.abs(R[30].hpRatio / r.hpMul - 1) < 0.08, `hp/baseline ${R[30] && R[30].hpRatio} vs dial ${r.hpMul}`);
ok('Lv 50 entrant: Lv 50 (unchanged)', is(50, 50), JSON.stringify(R[50]));
ok('Lv 60 entrant: Lv 60 (unchanged)', is(60, 60), JSON.stringify(R[60]));
ok('Lv 90 entrant: capped at 85 (unchanged)', is(90, 85), JSON.stringify(R[90]));
ok('under 50, both tower bosses are Lv 60 (10 over the Lv-50 tower)', R[30] && R[30].mid === 60 && R[30].final === 60 && R[45].mid === 60 && R[45].final === 60, `Lv30 ${R[30] && R[30].mid}/${R[30] && R[30].final}  Lv45 ${R[45] && R[45].mid}/${R[45] && R[45].final}`);
ok('at and above 50 the bosses are unchanged (player + 10, capped)', R[50].mid === 60 && R[60].mid === 70 && R[60].final === 70 && R[90].final === 95, `50:${R[50].mid} 60:${R[60].mid}/${R[60].final} 90:${R[90].final}`);
ok('Train Rush keeps its own scaling (_lxScaledMobLevel(30) is still 30)', r.trainRush30 === 30, r.trainRush30);
ok('an under-50 entrant is warned at the door; a Lv-60 one is not', R[30].warned && R[45].warned && !R[60].warned && !R[90].warned, `30:${R[30].warned} 45:${R[45].warned} 60:${R[60].warned} 90:${R[90].warned}`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
let fail = 0;
for (const x of results) { if (!x.pass) fail++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.pass ? '' : '  -- ' + x.x}`); }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
