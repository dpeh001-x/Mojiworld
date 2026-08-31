#!/usr/bin/env node
// Per user: "Currently virga feels very difficult, reduce the damage done by
// virga whilst making attack rotation fun still" (v0.30.332).
//
// Live Virga, real config, real damage paths:
//   * pillar dmgMul read off her spawned trait (2.4 -> 1.8)
//   * radiance: a real enemy column projectile carrying HER radiance config
//     connects with the roll forced — measures the actual HP fraction lost
//     (was ~99.9% / left at 1 HP; now 72% flat, so _diffDmg's no-level punish
//     cannot re-inflate it)
//   * per-volley near-death odds derived from the shipped chance
//     (0.2 -> 0.08 per pillar; >=1-in-3-pillar-volley 49% -> 22%)
//   * judgment execute at 5 sins measures ~75% of max HP (was 95%)
//   * the ROTATION is untouched: starburst cadence/waves, mark cycle length
//     and sin threshold are asserted unchanged.
//
//   node scripts/virga_tune_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 10411);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
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

  const md = document.getElementById('class-select-modal'); if (md) md.style.display = 'none';
  game.paused = false;
  player.level = 82; player.maxHp = 8000; player.baseDef = 0;
  player.mp = player.maxMp = 9999; player.hp = getMaxHp();
  player.blockTimer = 0; player._aegis = false;
  loadMap('forest');
  await wait(800); game.paused = false;
  for (const q of (game.monsters || [])) q.currentHp = 0;
  game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
  try { spawnMonster(700, 300, 'zodiac_virgo', true, false); } catch (e) {}
  const mm = game.monsters.find((q) => q && q.zodiacSign === 'virgo');
  if (!mm) { ok('virga spawned', false); return res; }
  ok('virga spawned', true);
  mm.hp = mm.maxHp = 9e9; mm.currentHp = 9e9;
  mm.aggro = true; mm.aggroTarget = player;

  // ---- config assertions ---------------------------------------------------
  const cs = mm.traits && mm.traits.columnStrike;
  ok('pillar dmgMul is 1.8 (was 2.4)', cs && cs.dmgMul === 1.8, 'dmgMul ' + (cs && cs.dmgMul));
  ok('radiance chance is 0.08/pillar (was 0.2)', cs && cs.radiance && cs.radiance.chance === 0.08, 'chance ' + (cs && cs.radiance && cs.radiance.chance));
  const volleyOdds = cs && cs.radiance ? (1 - Math.pow(1 - cs.radiance.chance, (cs.volley && cs.volley.count) || 3)) : 1;
  ok('>=1 radiance per 3-pillar volley ~22% (was 49%)', volleyOdds > 0.15 && volleyOdds < 0.30, (volleyOdds * 100).toFixed(0) + '%');
  ok('radiance is flat (immune to the no-level punish re-inflation)', cs && cs.radiance && cs.radiance.flat === true, 'flat ' + (cs && cs.radiance && cs.radiance.flat));

  // ---- radiance connect: real projectile, forced roll ----------------------
  // chance is forced via config spread (chance:1) rather than stubbing
  // Math.random: a zeroed random also forces the rogue's 20% dodge roll to
  // SUCCEED, which is how the first version measured a 0-damage 'connect'.
  const mh = getMaxHp();
  let lost = 0;
  for (let tryN = 0; tryN < 6 && lost <= 0; tryN++) {
    player.x = 400; player.y = 380; player.vx = 0; player.vy = 0;
    player.invulnerable = 0; player.hp = getMaxHp();
    const hp0 = player.hp;
    game.projectiles.push({
      x: player.x - 6, y: player.y - 8, vx: 0, vy: 0, w: 60, h: 80, life: 20,
      damage: 10, owner: 'enemy', skill: 'column',
      _radiance: { ...cs.radiance, chance: 1 }, _sourceLabel: 'Virga pillar (test)', noGravity: true,
    });
    await wait(350);
    lost = hp0 - player.hp;
  }
  const frac = lost / mh;
  ok('radiance connect costs ~72% of max HP (was ~99.9%, left at 1)', frac >= 0.65 && frac <= 0.80, 'lost ' + lost + '/' + mh + ' (' + (frac * 100).toFixed(0) + '%)');

  // ---- judgment execute at 5 sins ------------------------------------------
  player.hp = getMaxHp(); player.invulnerable = 0;
  player._virgoMarker = mm; player._virgoSin = 5;
  const hp1 = player.hp;
  const fired = await (async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      if (player.hp < hp1) return true;
      await wait(60);
    }
    return false;
  })();
  const jl = hp1 - player.hp;
  const jf = jl / mh;
  ok('judgment execute fires on 5 sins', fired, 'lost ' + jl);
  ok('judgment costs ~75% of max HP (was 95%)', jf >= 0.70 && jf <= 0.80, (jf * 100).toFixed(0) + '%');

  // ---- rotation untouched --------------------------------------------------
  const src = String(ZODIAC_AI && ZODIAC_AI.virgo || '');
  ok('starburst cadence unchanged (13000/10500/8400)', /13000/.test(src) && /10500/.test(src) && /8400/.test(src));
  ok('mark cycle unchanged (360-frame steps)', /360/.test(src));
  ok('sin threshold unchanged (5)', /_virgoSin \| 0\) >= 5/.test(src) || /_virgoSin\|0\) >= 5/.test(src) || src.includes('>= 5'));

  return res;
});
await browser.close(); server.kill();

const pad = Math.max(...out.map((r) => r.n.length));
console.log('\n  ' + PAGE + '\n');
for (const r of out) console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = out.filter((r) => !r.pass).length;
console.log('\n' + (bad ? ('  ' + bad + '/' + out.length + ' FAILED') : ('  all ' + out.length + ' passed')));
process.exit(bad ? 1 : 0);
