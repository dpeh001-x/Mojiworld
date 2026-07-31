// Telegraph honesty. Boss ground hazards draw their warning circle from the
// hazard's `radius`; this proves the area that actually DAMAGES you is the same
// circle, so a dodge that looks clean is clean. Guards a bug class this project
// has hit before (a black-hole telegraph drawn 56 px smaller than its kill
// radius — visually dodged, still lethal).
//
// Method: spawn a meteor_warn of known radius with NO monsters present, so
// contact damage and projectiles cannot confound the result, then binary-search
// the outermost player-centre distance that still takes damage. The expected
// boundary is radius + playerHalfWidth (box-vs-circle, not centre-vs-circle);
// varying the player's width proves the boundary tracks the box rather than
// being a hardcoded fudge that happens to look right at the default size.
//   node scripts/hazard_telegraph_test.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8904)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8904;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const rows = await page.evaluate(() => {
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

  const hitsAt = (radius, pw, centreDist) => {
    game.monsters.length = 0;
    for (const k of ['projectiles', 'particles', 'hazards', 'minions']) if (game[k]) game[k].length = 0;
    game.keys = {};
    player.level = 200; player.maxHp = 9999999; player.hp = 9999999;
    player.invulnerable = 0; player._god = false; player.stunTimer = 0; player.frozenTimer = 0;
    player.blockTimer = 0; player._aegis = false;
    player.w = pw; player.y = gy - 60; player.vx = 0; player.vy = 0;
    const cx = ww * 0.5;
    player.x = cx + centreDist - pw / 2;
    game.hazards.push({ type: 'meteor_warn', x: cx - radius, y: gy - 40, cx, timer: 20,
      damage: 5000, color: '#f84', owner: 'enemy', radius });
    const hp0 = player.hp;
    for (let i = 0; i < 90 && game.hazards.length; i++) step(16.667);
    return player.hp < hp0;
  };
  const boundary = (radius, pw) => {
    let lo = 0, hi = radius * 3;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (hitsAt(radius, pw, mid)) lo = mid; else hi = mid; }
    return Math.round(lo);
  };

  const origW = player.w;
  const out = [];
  for (const [radius, pw] of [[90, 30], [90, 10], [90, 80], [180, 30], [180, 80], [60, 30]]) {
    const b = boundary(radius, pw);
    out.push({ radius, pw, boundary: b, effective: b - pw / 2 });
  }
  player.w = origW;
  return { out };
});

if (rows.fatal) { console.log('FATAL:', rows.fatal); await browser.close(); server.kill(); process.exit(1); }

console.log('radius  playerW  damage boundary  effective radius (boundary - halfW)');
console.log('-'.repeat(70));
const fails = [];
for (const r of rows.out) {
  const ok = Math.abs(r.effective - r.radius) <= 3;
  console.log(`  ${String(r.radius).padStart(4)}   ${String(r.pw).padStart(4)}       ${String(r.boundary).padStart(5)}px            ${String(r.effective).padStart(5)}px  ${ok ? 'ok' : 'MISMATCH'}`);
  if (!ok) fails.push(`radius ${r.radius} / playerW ${r.pw}: damages out to an effective ${r.effective}px, telegraph drawn at ${r.radius}px`);
}
console.log(`\n${rows.out.length} geometries probed`);
if (fails.length) { console.log('FAIL — damage area does not match the drawn telegraph:'); fails.forEach(f => console.log('  ' + f)); }
else console.log('PASS — damage area equals the drawn telegraph in every geometry (box-vs-circle)');
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(fails.length || errs.length ? 1 : 0);
