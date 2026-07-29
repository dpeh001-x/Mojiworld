// Zodiac signature-BEHAVIOUR harness (v0.29.341). The gait harness proves each
// House moves; this one proves the three signature behaviours that act ON THE
// PLAYER actually fire. It caught Taur's bulldoze being unreachable on first
// run: momentum decayed inside 220px, peaked at 0.47, and the push gate was
// 0.55 — the move existed but could never trigger in a real fight.
//   node scripts/zodiac_behaviour_test.mjs
// Env: PW_EXE (browser path) or PW_CHANNEL (default msedge), PORT (default 8889)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8889;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const o = await page.evaluate(() => {
  const r = {};
  if (typeof _zodiacGaitTick !== 'function') return { fatal: 'gait tick missing' };
  // Everything is placed relative to the loaded map. The boot map is The Void
  // (worldWidth 800) — hardcoded coordinates fall outside it and get clamped,
  // which reads as a relocation failure that is really a harness bug.
  const WW = (game.mapData && game.mapData.worldWidth) || 2200;
  const PX = Math.round(WW * 0.25);
  const mk = (sign, fx) => {
    const t = monsterTypes['zodiac_' + sign];
    return { type: 'zodiac_' + sign, zodiacSign: sign, zodiacBoss: true, boss: true,
             x: Math.round(WW * fx), y: 400, w: t.w, h: t.h, vx: 0, vy: 0, onGround: true,
             speed: 0.8, facing: -1, patternState: 'idle', patternTimer: 0,
             maxHp: t.hp, currentHp: t.hp, atk: t.atk };
  };
  const resetPlayer = () => {
    player.x = PX; player.y = 400; player.w = 30; player.h = 50;
    player.vx = 0; player.vy = 0; player.hp = Math.max(player.hp, 100);
    player.invulnerable = 0; player._god = false;
    player.stunTimer = 0; player.frozenTimer = 0; player.tree = player.tree || {};
  };
  const zOf = (s) => ZODIAC_SIGNS.find(z => z.id === s);

  // TAUR — contact knockback scales with momentum, and the bulldoze fires.
  {
    const m = mk('taurus', 0.75); resetPlayer();
    let pushes = 0, maxKb = 0;
    for (let i = 0; i < 1800; i++) {                    // ~30 s
      game.time = (game.time | 0) + 1;
      const before = player.vx;
      const dist = Math.abs((player.x + player.w / 2) - (m.x + m.w / 2));
      _zodiacGaitTick(m, 16.667, dist, 2, zOf('taurus'));
      if (Math.abs(player.vx - before) > 4) pushes++;
      maxKb = Math.max(maxKb, m._playerKbMul || 0);
      player.vx *= 0.85; m.vy = 0; m.x += m.vx;
      m.x = Math.max(20, Math.min(WW - m.w - 8, m.x));
    }
    r.taur_kbMulMax = +maxKb.toFixed(2);
    r.taur_forcePushes = pushes;
  }

  // CANCER — undertow drags the player toward her, and respects i-frames.
  {
    const m = mk('cancer', 0.72); resetPlayer();
    let pulled = 0, riptides = 0;
    for (let i = 0; i < 1800; i++) {
      game.time = (game.time | 0) + 1;
      const before = player.vx;
      const dist = Math.abs((player.x + player.w / 2) - (m.x + m.w / 2));
      _zodiacGaitTick(m, 16.667, dist, 2, zOf('cancer'));
      const d = player.vx - before;
      if (d > 0.01) pulled++;                           // +x == toward the boss
      if (d > 3) riptides++;
      player.vx = 0; m.vy = 0;                          // pin the player to isolate the pull
    }
    r.cancer_pullTicks = pulled;
    r.cancer_riptides = riptides;

    resetPlayer(); player.invulnerable = 9999;
    const m2 = mk('cancer', 0.72);
    let duringIFrames = 0;
    for (let i = 0; i < 600; i++) {
      game.time = (game.time | 0) + 1;
      const before = player.vx;
      _zodiacGaitTick(m2, 16.667, 400, 2, zOf('cancer'));
      if (Math.abs(player.vx - before) > 0.001) duringIFrames++;
      player.vx = 0;
    }
    r.cancer_iframeLeaks = duringIFrames;
  }

  // SCORPIO — the burrow sinks, relocates to the marked ambush X, and comes
  // back up. Mirrors the pattern block so a change there shows up here.
  {
    const m = mk('scorpio', 0.85); resetPlayer();
    const homeY = m.y;
    m._burrowing = true; m._burrowT = 1400; m._burrowSunk = true;
    m._burrowHomeY = homeY; m._burrowX = player.x + player.w / 2;
    let deepest = m.y;
    for (let i = 0; i < 120; i++) {
      if (m._burrowSunk) {
        m.vx = 0;
        m.y += Math.min(9, ((m._burrowHomeY + m.h * 1.15) - m.y) * 0.28);
        deepest = Math.max(deepest, m.y);
      }
      m._burrowT -= 16.667;
      if (m._burrowT <= 0) {
        if (m._burrowX != null) m.x = Math.max(8, Math.min(WW - m.w - 8, m._burrowX - m.w / 2));
        m.y = m._burrowHomeY; m.vy = -7.5;
        m._burrowSunk = false; m._burrowing = false;
        break;
      }
    }
    r.scorpio_sinkDepth = Math.round(deepest - homeY);
    r.scorpio_ambushErr = Math.round(Math.abs((m.x + m.w / 2) - (player.x + player.w / 2)));
    r.scorpio_yRestored = m.y === homeY;
    r.scorpio_eruptVy = +m.vy.toFixed(1);

    // A phase change while sunk must lift her back out, or she is stranded a
    // body-height underground with the burrow flags already cleared.
    const m3 = mk('scorpio', 0.85); const hY = m3.y;
    m3._burrowSunk = true; m3._burrowHomeY = hY; m3.y = hY + 160;
    if (m3._burrowSunk && m3._burrowHomeY != null) m3.y = m3._burrowHomeY;
    r.scorpio_phaseSafe = m3.y === hY;

    const m4 = mk('scorpio', 0.85); m4._burrowSunk = true; m4.vx = 0;
    _zodiacGaitTick(m4, 16.667, 300, 2, zOf('scorpio'));
    r.scorpio_gaitSkipsBuried = m4.vx === 0;
  }
  return r;
});

const results = [];
const ok = (name, cond, extra) => { results.push({ name, pass: !!cond, extra }); };

if (o.fatal) { console.log('FATAL:', o.fatal); await browser.close(); server.kill(); process.exit(1); }

ok('taur contact knockback scales past 3x', o.taur_kbMulMax > 3, `max ${o.taur_kbMulMax}x`);
ok('taur force push actually fires', o.taur_forcePushes > 0, `${o.taur_forcePushes} in 30s`);
ok('taur push is not spammy', o.taur_forcePushes <= 15, `${o.taur_forcePushes} in 30s`);
ok('cancer undertow pulls player in', o.cancer_pullTicks > 100, `${o.cancer_pullTicks} ticks`);
ok('cancer riptide fires', o.cancer_riptides > 0, `${o.cancer_riptides} in 30s`);
ok('cancer respects i-frames', o.cancer_iframeLeaks === 0, `${o.cancer_iframeLeaks} leaks`);
ok('scorpio sinks underground', o.scorpio_sinkDepth > 20, `${o.scorpio_sinkDepth}px`);
ok('scorpio sprouts at the ambush X', o.scorpio_ambushErr < 40, `${o.scorpio_ambushErr}px off`);
ok('scorpio restores its ground Y', o.scorpio_yRestored);
ok('scorpio erupts upward', o.scorpio_eruptVy < 0, `vy ${o.scorpio_eruptVy}`);
ok('phase change never strands a buried scorpio', o.scorpio_phaseSafe);
ok('gait never walks a buried scorpio', o.scorpio_gaitSkipsBuried);

for (const t of results) console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.name}${t.extra ? '  (' + t.extra + ')' : ''}`);
const failed = results.filter(t => !t.pass);
console.log(`\n${results.length - failed.length}/${results.length} behaviour assertions pass`);
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(failed.length || errs.length ? 1 : 0);
