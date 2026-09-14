#!/usr/bin/env node
// Legosaurus EARTHQUAKE — the stomp is animated.
//
// Per user: "make the legosaurus boss animations less disjointed and clunky ... it needs to have
// smoother movements and not flail all the time."
//
// The quake drops a 560px shockwave, flashes the screen, shakes it by 14 and toasts
// "LEGOSAURUS — EARTHQUAKE!" every 6 seconds, and its own design note says the read is "his footstomp
// shakes the arena". But it stamped neither patternState nor atkAnimUntil, and _bossAttacking needs
// one of them — so the arena shook while the dinosaur stood there playing an idle frame. That is the
// one piece of the reported disjointedness that is code and not art.
//
// Measuring this is harder than it looks: at any range where the boss is on screen it is ALSO
// swinging (bigMelee 262), casting (columnStrike 560) or charging (braceDash 700), and those stamp
// atkAnimUntil themselves — a first pass "confirmed" the fix against a build that did not have it.
// The quake has no range gate of its own (it only needs a living player), so the player is parked
// 3000px away where nothing else can fire. Then atkAnimUntil moving is the quake's doing, and only
// the quake's.
//   node scripts/legosaurus_quake_stomp_test.mjs      MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10789);
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(8000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(2000);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false; player._god = true; player.hp = player.maxHp = 999999;
    const m = spawnMonster(1400, 360, 'legosaurus', true);
    if (!m) return { err: 'no spawn' };
    m.maxHp = 9e9; m.currentHp = 9e9;
    await sleep(6000);
    const o = { ver: GAME_VERSION, ftSum: (_lxCalibFt('legosaurus', 'attack') || []).reduce((a, c) => a + c, 0) };
    // out of reach of melee (262), columnStrike (560) and braceDash (700): only the quake can fire
    player.x = m.x + 3000; player.y = m.y;
    m._bdCd = 99999;
    await sleep(400);
    m.atkAnimUntil = 0;                                  // clear any window an earlier quake opened
    const hz0 = game.hazards.filter((h) => h.type === 'mob_quake').length;
    o.before = m.atkAnimUntil || 0;
    m._legosaurusQuakeAt = (game.time | 0);              // fire on the next tick
    const t0 = performance.now();
    while (performance.now() - t0 < 400) await new Promise((res) => requestAnimationFrame(res));
    o.after = m.atkAnimUntil || 0;
    o.now = performance.now();
    o.quakeFired = game.hazards.filter((h) => h.type === 'mob_quake').length > hz0;
    // the quake itself must be untouched: still a real hazard with damage and its telegraph
    const hz = game.hazards.filter((h) => h.type === 'mob_quake').pop();
    o.hazard = hz ? { w: hz.w, life: hz.maxLife, dmg: hz.damage > 0, stun: hz.stun } : null;
    return o;
  });
  if (r.err) { console.log('FAILED ' + r.err); fail++; }
  else {
    console.log(`build ${r.ver}   attack ft total ${r.ftSum}ms`);
    ok('the earthquake actually fired', r.quakeFired, { quakeFired: r.quakeFired });
    ok('it opens an attack-draw window, so the boss animates its stomp instead of standing there',
      r.after > r.before, { atkAnimUntil: `${r.before} -> ${Math.round(r.after)}`, was: 'never stamped — the arena shook while the dino idled' });
    ok('the window is one authored attack pass (~775ms), not an open-ended lock',
      r.after - r.now > 300 && r.after - r.now <= 820, { msLeft: Math.round(r.after - r.now), ftSum: r.ftSum });
    ok('the quake hazard itself is unchanged — 560px band, 90-frame telegraph, damage + stun',
      !!r.hazard && r.hazard.w === 560 && r.hazard.life === 90 && r.hazard.dmg && r.hazard.stun === 700, r.hazard);
    ok('no page errors', errs.length === 0, errs);
  }
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
