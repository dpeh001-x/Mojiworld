// Downed pose (v0.29.766): the character never flicker-vanishes while down,
// falls to a horizontal facedown rest (90° + settle bounce), holds the blink
// shut for every downed frame, and plays a get-up on revive.
// Run: node scripts/downed_pose_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const require = createRequire('C:/Users/dpeh0/Mojiworld/package.json');
const { chromium } = require('playwright-core');
process.chdir('C:/Users/dpeh0/Mojiworld');
const PORT = 9187;
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const srv = spawn(process.execPath, ['serve.js', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const b = await chromium.launch({ channel: 'msedge', headless: true });
const res = []; const ok = (n, c, x) => res.push({ n, pass: !!c, x: String(x ?? '') });

// save blob so boot resumes into a real map with a real hero
let saveBlob;
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(11000);
  saveBlob = await p.evaluate(() => {
    player.cls = 'warrior'; player.job = 'knight'; player.level = 30; player.hp = getMaxHp();
    player.look = player.look || {}; player.look.name = 'DownProbe';
    window._prologuePending = false; window._prologueActive = false; game._resetting = false;
    _flushSaveStateNow();
    return localStorage.getItem('levelx_save_v1');
  });
  await p.close();
  if (!saveBlob) throw new Error('no save blob');
}
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.addInitScript((blob) => { try { localStorage.setItem('levelx_save_v1', blob); } catch (e) {} }, saveBlob);
await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 90000 });
await p.evaluate(() => { const bs = [...document.querySelectorAll('#lo-auth button')];
  (bs.find(x => /continue/i.test(x.textContent)) || bs[0]).click(); });
await p.waitForFunction(() => !document.getElementById('loading-overlay'), null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => { setInterval(() => { game.paused = false; }, 50); });
await p.waitForTimeout(500);

// instrument: count hero draws + record blink factor + max rotation
await p.evaluate(() => {
  window.__probe = { heroDraws: 0, blinkVals: [], angMax: 0 };
  const _orig = _drawVectorHero;
  window._drawVectorHero_orig = _orig;
  // count only main-canvas local draws (during _lxDownedDraw or not, sx-based)
  const _wrap = function (sx, sy, _c, opts) {
    if (!_c) {   // main canvas
      window.__probe.heroDraws++;
      if (window._lxDownedDraw) {
        window.__probe.blinkVals.push(+(_heroBlinkFactor().toFixed(3)));
        const t = (ctx.getTransform && ctx.getTransform()) || null;
        if (t) window.__probe.angMax = Math.max(window.__probe.angMax, +Math.abs(Math.atan2(t.b, t.a) * 180 / Math.PI).toFixed(1));
      }
    }
    return _orig.apply(this, arguments);
  };
  // eslint-disable-next-line no-global-assign
  _drawVectorHero = _wrap;
});
const alive = await p.evaluate(() => ({ hp: player.hp, downed: !!player._downed }));

// go down (disarm the pre-down revives so _coopTryDowned is what fires)
await p.evaluate(() => {
  if (player.tree) player.tree.secondWindReady = false;
  player._miracleUsedThisMap = true; player._phoenixUsedThisMap = true;
  player.invulnerable = 0; player._god = false;
  window.__probe.heroDraws = 0;
  player.hp = 0; player.lastHitTime = game.time;
});
await p.waitForTimeout(300);
await p.waitForTimeout(1000);
const down = await p.evaluate(() => {
  const pr = window.__probe;
  return { downed: !!player._downed, hp: player.hp, heroDraws: pr.heroDraws,
    angMax: pr.angMax, blinkMin: Math.min(...pr.blinkVals), blinkMax: Math.max(...pr.blinkVals),
    fallFace: player._downFallFace, banner: !!document.getElementById('coop-downed-banner') };
});
// ~1.3s at 60fps ≈ 78 frames; the old flicker would have drawn ~half
ok('the down actually happened (solo downed state active)', down.downed === true, JSON.stringify({ hp: down.hp }));
ok('the character NEVER disappears while down (a draw every frame)', down.heroDraws > 60, down.heroDraws + ' hero draws in ~1.3s');
ok('the body reaches horizontal (rotation rests at 90°)', down.angMax >= 88 && down.angMax <= 99, down.angMax + '°');
ok('the eyes are CLOSED for the whole downed draw', down.blinkMax <= 0.11, `blink factor ${down.blinkMin}..${down.blinkMax} (open=1, blink bottoms at 0.12)`);

// revive via the finish path used by partner revives, then check the get-up
await p.evaluate(() => {
  player._downed = false; player._downedSilent = false; player._downedUntil = 0;
  player.hp = Math.floor(getMaxHp() * 0.5);
  window.__probe.angsAfter = [];
  const _orig = window._drawVectorHero_orig;
  _drawVectorHero = function (sx, sy, _c, opts) {
    if (!_c) {
      const t = (ctx.getTransform && ctx.getTransform()) || null;
      if (t) window.__probe.angsAfter.push(+Math.abs(Math.atan2(t.b, t.a) * 180 / Math.PI).toFixed(1));
    }
    return _orig.apply(this, arguments);
  };
});
await p.waitForTimeout(700);
const up = await p.evaluate(() => {
  const a = window.__probe.angsAfter;
  return { early: a.slice(0, 6), late: a.slice(-6), fallAt: player._downFallAt || 0 };
});
ok('revive plays a get-up (early frames still rotated, then upright)',
   up.early.some(v => v > 15) && up.late.every(v => v < 1), JSON.stringify(up));
for (const r of res) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.x ? '  (' + r.x + ')' : ''}`);
console.log(`${res.filter(r => r.pass).length}/${res.length} passed`);
await b.close(); srv.kill();
process.exit(res.some(r => !r.pass) ? 1 : 0);
