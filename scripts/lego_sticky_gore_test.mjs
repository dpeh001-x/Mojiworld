#!/usr/bin/env node
// Per user: "For legosaurus make fights smoother, and have him deal 50% of
// player's max HP when charging, legosaurus should be abit more sticky when
// attacking phase".
//
// Live Legosaurus in blockland_apex. Two behaviours, each with a
// player-visible assertion that FAILS on the previous build:
//   GORE   the player stands in the charge lane; the connect must cost about
//          half their max HP and raise the GORED toast (previously the charge
//          carried no gore block, so only incidental contact damage landed).
//   STICKY the player steps back during the swing telegraph; the boss must
//          creep toward them through the windup (previously vx = 0 dead-root,
//          zero displacement).
//
//   node scripts/lego_sticky_gore_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9985);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Probe');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*rogue\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const out = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 130) });
  let goredToasts = 0;
  new MutationObserver((muts) => {
    for (const mu of muts) for (const nd of mu.addedNodes) {
      if ((nd.textContent || '').includes('GORED')) goredToasts++;
    }
  }).observe(document.body, { childList: true, subtree: true });
  const waitFor = async (cond, ms) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { if (cond()) return true; await wait(50); }
    return false;
  };

  // Rogue (no warrior DR muddying the gore fraction), overlevelled, real HP.
  // AT-LEVEL (boss 59): the explicit-level pipeline lands the authored 50%
  // at the 1.3x at-level baseline = ~65% of max HP before contact noise.
  player.level = 59; player._god = false;
  // Direct level assignment grants no HP growth (audit lesson): give a real
  // pool so incidental contact damage cannot read as half the bar by itself.
  player.maxHp = 4000;
  player.baseDef = 0; player.mods.def = 0; player.equipped = {};
  loadMap('blockland_apex');
  await wait(1500);
  game.paused = false;
  if (!game.monsters.some((m) => m && m.type === 'legosaurus')) {
    try { spawnMonster(900, 300, 'legosaurus', true, false); } catch (e) {}
  }
  const lg = game.monsters.find((m) => m && m.type === 'legosaurus');
  if (!lg) { ok('legosaurus spawned', false); return res; }
  ok('legosaurus spawned', true);
  lg.hp = lg.maxHp = 9e9; lg.currentHp = 9e9;
  lg.aggro = true; lg.aggroTarget = player;

  // ---- STICKY WINDUP -------------------------------------------------------
  // Park the player just inside swing range, force the swing, then step back.
  lg._braceDashing = false; lg._bdCd = 99999;          // no charge interference
  lg._columnCd = 99999;
  // centre-to-centre 150px, inside the 180px swing range (the first version
  // parked 186px out and the telegraph never started)
  // v0.30.420 grew his box to the art (224 -> 388 wide), so a fixed 150px centre gap now parks the player INSIDE his
  // body (the overlap shoved him back ~15px) and the step-back left an edge gap under the creep's 40px floor. Park
  // 10px off his edge instead - still inside the 262px swing range - so the step-back opens a real 100px gap. He is
  // The player is then HELD there: parked at his feet level, off whatever ground is under that spot, they fell and a
  // void reset threw them 900px away mid-windup - and he dutifully crept after them, undoing the measurement.
  player.x = lg.x + lg.w + 10; player.y = lg.y + lg.h - player.h;
  let _hold = { x: player.x, y: player.y };
  const _pin = setInterval(() => { player.x = _hold.x; player.y = _hold.y; player.vy = 0; }, 4);
  player.hp = getMaxHp(); player.invulnerable = 4000;   // survive the swing; we measure motion
  lg._bigMeleeFiring = false; lg._bigMeleeCd = 0;
  ok('swing telegraph starts', await waitFor(() => lg._bigMeleeFiring === true, 4000), '_bigMeleeFiring ' + lg._bigMeleeFiring);
  const x0 = lg.x;
  player.x += 90; _hold = { x: player.x, y: player.y };   // the step-back that used to make him whiff
  await waitFor(() => lg._bigMeleeFiring === false, 3000);
  clearInterval(_pin);
  const moved = lg.x - x0;
  ok('boss CREEPS toward the player through the windup', moved > 8,
     'moved ' + moved.toFixed(1) + 'px (dead-root = ~0)');

  // ---- GORE = ~50% MAX HP --------------------------------------------------
  lg._bigMeleeCd = 99999;                               // isolate the charge
  lg._bdCd = 0; lg._braceDashing = false;
  player.invulnerable = 0; player.blockTimer = 0; player._aegis = false;
  player.hp = getMaxHp();
  const hp0 = player.hp, mh = getMaxHp();
  // Read the GORE's own damage at the choke point it goes through. The HP drop across a wait of up to 12 s also
  // carries contact hits from the charge itself (more of them since v0.30.420 grew his box to the art): 65% of
  // max HP from the gore read as 79-86% in total, over the 85% ceiling one run in three.
  let goreHit = null; const _dd = _diffDmg;
  window._diffDmg = function (d, lv, cap) { const r = _dd.apply(this, arguments); if (cap && d === Math.max(1, Math.floor(mh * 0.5))) goreHit = r; return r; };
  // Stand in the lane at charge range and stay there.
  player.x = lg.x + lg.w / 2 + 400 - player.w / 2;
  player.y = lg.y + lg.h - player.h;
  const goreLanded = await waitFor(() => goredToasts >= 1, 12000);
  window._diffDmg = _dd;
  ok('the charge GORES a player standing in the lane', goreLanded, goredToasts + ' GORED toast(s)');
  if (goreLanded) {
    await wait(200);
    const lost = goreHit != null ? goreHit : hp0 - player.hp;
    const frac = lost / mh;
    ok('gore costs about half max HP (x1.3 at-level baseline)', frac >= 0.45 && frac <= 0.85,
       'lost ' + lost + ' of ' + mh + ' (' + (frac * 100).toFixed(0) + '%)');
  } else {
    ok('gore costs about half max HP', false, 'gore never landed');
  }

  return res;
});
await browser.close(); server.kill();

const pad = Math.max(...out.map((r) => r.n.length));
console.log('\n  ' + PAGE + '\n');
for (const r of out) console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = out.filter((r) => !r.pass).length;
console.log('\n' + (bad ? ('  ' + bad + '/' + out.length + ' FAILED') : ('  all ' + out.length + ' passed')));
process.exit(bad ? 1 : 0);
