// Crowd-control effects must OVERLAP, not queue up behind each other.
//
// The shackle QTE's countdown lives in updatePlayer, after the freeze gate --
// and that gate returns early. So a frozen player's shackle clock stopped
// entirely: every second of freeze added a second of shackle. Measured against
// Capricorn (who both freezes and shackles) a 3 s shackle ran 13 s, and under
// sustained freeze it never ended at all. The boss audit only catches this when
// the RNG happens to land both effects together, so this pins it directly.
//   node scripts/cc_stacking_test.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8908)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8908;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const o = await page.evaluate(() => {
  const step = (dt) => {
    game.time = (game.time | 0) + 1;
    if (typeof updatePlayer === 'function') updatePlayer(dt);
    updateMonsters(dt); updateProjectiles(dt);
  };
  const arena = Object.entries(MAPS)
    .filter(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).some(p => p.w > 900))
    .sort((a, b) => b[1].worldWidth - a[1].worldWidth)[0];
  if (!arena) return { fatal: 'no arena map' };
  loadMap(arena[0]);
  const ww = game.mapData.worldWidth;
  const gy = (game.mapData.platforms || []).filter(p => p.w > 900).sort((a, b) => a.y - b.y)[0].y;
  if (typeof _qteShackleStart !== 'function') return { fatal: '_qteShackleStart missing' };

  // holdFreeze re-applies freeze every frame: the worst case a boss can produce,
  // and the one that previously never terminated.
  const trial = (freezeMs, holdFreeze) => {
    game.monsters.length = 0;
    for (const k of ['projectiles', 'particles', 'hazards', 'minions']) if (game[k]) game[k].length = 0;
    game.keys = {};                                   // zero input: the QTE can only time out
    player.level = 200; player.maxHp = 9999999; player.hp = 9999999;
    player.x = ww * 0.5; player.y = gy - 60; player.vx = 0; player.vy = 0;
    player.invulnerable = 0; player._god = false; player.stunTimer = 0; player.frozenTimer = 0;
    if (typeof _QTE !== 'undefined' && _QTE) _QTE.active = false;
    const m = spawnMonster(ww * 0.5 + 200, gy - 160, 'zodiac_capricorn', true);
    _qteShackleStart(m);
    const declared = player.stunTimer | 0;
    if (freezeMs) player.frozenTimer = freezeMs;
    let frames = 0;
    for (let i = 0; i < 1800; i++) {                  // 30 s ceiling
      if (holdFreeze) player.frozenTimer = Math.max(player.frozenTimer || 0, 500);
      player.hp = player.maxHp;
      step(16.667);
      if ((player.stunTimer | 0) <= 0) break;
      frames++;
    }
    return { declaredMs: declared, sec: +(frames / 60).toFixed(1), neverEnded: frames >= 1799 };
  };

  return { noFreeze: trial(0, false), freezeOnce: trial(3000, false), freezeHeld: trial(3000, true) };
});

if (o.fatal) { console.log('FATAL:', o.fatal); await browser.close(); server.kill(); process.exit(1); }

const declared = o.noFreeze.declaredMs / 1000;
console.log(`shackle declares ${declared}s; measured with zero player input:\n`);
for (const [k, t] of Object.entries(o)) {
  console.log(`  ${k.padEnd(12)} ${String(t.sec).padStart(5)}s${t.neverEnded ? '  (never ended)' : ''}`);
}
const results = [];
const ok = (n, c, e) => results.push({ n, pass: !!c, e });
// 1.5x of the declared duration is generous slack for frame granularity while
// still far below the 2x+ that any real stacking bug produces.
const cap = declared * 1.5;
ok('shackle ends on its own with no input', !o.noFreeze.neverEnded && o.noFreeze.sec <= cap, `${o.noFreeze.sec}s vs ${declared}s declared`);
ok('a single freeze does not extend the shackle', o.freezeOnce.sec <= cap, `${o.freezeOnce.sec}s`);
ok('sustained freeze does not extend the shackle', !o.freezeHeld.neverEnded && o.freezeHeld.sec <= cap, `${o.freezeHeld.sec}s`);

console.log('');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.e ? '  (' + r.e + ')' : ''}`);
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
console.log(failed.length ? 'FAIL — crowd control is stacking end-to-end instead of overlapping' : 'PASS — freeze and shackle overlap; neither pauses the other\'s clock');
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(failed.length || errs.length ? 1 : 0);
