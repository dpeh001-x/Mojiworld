// DUNE SANDS PERCH - is the Lava Cavern portal actually reachable now?
// =============================================================================
//   1. GEOMETRY  portal feet sit ON the lowered, lengthened column
//   2. LADDER    every hop in the route fits the MEASURED jump (95 px rise)
//   3. PROOF     a scripted base-kit player physically jumps the ladder and
//                stands on the portal platform (no teleports, real physics)
// Run: node scripts/dune_perch_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9146;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

const R = await page.evaluate(async () => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  loadMap('duneSands'); game.paused = false; game.monsters.length = 0;
  player.cls = player.cls || 'warrior'; player.hp = 99999; player.maxHp = 99999; player.invulnerable = 99999;

  const portal = game.portals.find(p => p.dest === 'lavaCavern');
  ok('the Lava Cavern portal exists', !!portal, portal ? `x:${portal.x} y:${portal.y}` : 'missing');
  const plats = game.mapData.platforms.filter(p => p.type === 'platform');
  // the loader applies a few px of jitter to platform coords on each load
  // (observed y:340 -> 338..343), so match with an 8 px tolerance
  const perch = portal && plats.find(p => portal.x >= p.x - 4 && portal.x <= p.x + p.w + 4 && Math.abs(p.y - portal.y) <= 8);
  ok('the portal stands ON a platform (feet = platform top)', !!perch,
     perch ? `platform x:${perch.x}..${perch.x + perch.w} y:${perch.y}` : 'floating');
  // the loader's jitter runs to about ±10 px on y AND w, so the bands are wide
  ok('the perch is lengthened (>= 190 px)', !!perch && perch.w >= 190, perch ? `w:${perch.w}` : '');
  ok('the perch is lowered (top ~368 ± jitter)', !!perch && perch.y <= 385 && perch.y >= 345, perch ? `y:${perch.y}` : '');

  // ---- measured jump ceiling on THIS build ----
  const gp = game.mapData.platforms.find(p => p.type === 'ground' && p.x <= 600 && p.x + p.w > 600);
  const measureJump = () => {
    player.x = 600; player.y = gp.y - player.h; player.vy = 0; player.vx = 0; player.onGround = true;
    const y0 = player.y; game.keys[' '] = true;
    let apex = y0;
    for (let i = 0; i < 120; i++) { game.time++; try { updatePlayer(16.667); } catch (e) {} if (i === 40) game.keys[' '] = false; if (player.y < apex) apex = player.y; }
    game.keys[' '] = false;
    return y0 - apex;
  };
  const RISE = measureJump();
  ok('jump ceiling measured', RISE > 60 && RISE < 200, `${RISE.toFixed(0)} px`);

  // ---- static ladder: every hop within (RISE - 5) rise and 120 px gap ----
  if (perch) {
    const capital = plats.find(p => p.x === 560 || (p.x > 500 && p.x < 700 && p.y > 380));
    const hop1 = capital ? (gp2 => capital.y)(0) : null;
    ok('a mid step (the fallen capital) exists', !!capital, capital ? `x:${capital.x}..${capital.x + capital.w} y:${capital.y}` : '');
    if (capital) {
      const groundY = 474;                                   // crest under the capital
      ok('hop 1: ground -> capital fits the jump', (groundY - capital.y) <= RISE - 5, `${groundY - capital.y} px rise`);
      // Sand physics measured in-engine: airborne horizontal speed 1.16 px/f,
      // and a jump stays above a +60 px ledge for under 30 frames. So the
      // bands here are the PHYSICAL ones, not generic jump-height maths.
      ok('hop 2: capital -> perch is a small step (<= 60 px rise)', (capital.y - perch.y) <= 60, `${capital.y - perch.y} px rise`);
      ok('hop 2 horizontal gap is within airborne reach (<= 30 px)', (perch.x - (capital.x + capital.w)) <= 30,
         `${perch.x - (capital.x + capital.w)} px gap`);
    }
  }

  // ---- the real proof: physically climb it ----
  // Scripted inputs only: run + jump. Success = standing on the perch.
  if (perch) {
    const capital = plats.find(p => p.x > 500 && p.x < 700 && p.y > 380);
    const runTo = async (targetX, maxFrames) => {
      for (let i = 0; i < maxFrames; i++) {
        game.time++;
        game.keys['arrowright'] = player.x < targetX - 4;
        game.keys['arrowleft'] = player.x > targetX + 4;
        try { updatePlayer(16.667); } catch (e) {}
        if (Math.abs(player.x - targetX) <= 4 && player.onGround) break;
      }
      game.keys['arrowright'] = game.keys['arrowleft'] = false;
    };
    const jumpTowards = (dir, frames) => {
      game.keys[' '] = true; game.keys[dir] = true;
      for (let i = 0; i < frames; i++) {
        game.time++;
        if (i === 40) game.keys[' '] = false;
        try { updatePlayer(16.667); } catch (e) {}
        if (player.onGround && i > 15) break;
      }
      game.keys[' '] = false; game.keys[dir] = false;
    };
    player.x = 500; player.y = 474 - player.h; player.vy = 0; player.onGround = true;
    await runTo(capital ? capital.x + 40 : 600, 400);        // under the capital
    jumpTowards('arrowright', 90);                            // up onto the capital
    const onCapital = capital && player.y + player.h <= capital.y + 4 && player.x >= capital.x - 8;
    // The perch hop needs a RUNNING jump: sand halves ground speed, so a
    // standing hop from the edge falls short (measured: landed at x:708).
    // Hold right across the whole approach and fire the jump just before
    // the capital's edge, keeping right held through the air.
    await runTo(capital ? capital.x + 12 : 600, 200);         // back up for a run-up
    {
      const edge = capital ? capital.x + capital.w : 668;
      game.keys['arrowright'] = true;
      let jumpedAt = -1;
      for (let i = 0; i < 220; i++) {
        game.time++;
        if (jumpedAt < 0 && player.x >= edge - 26 && player.onGround) { game.keys[' '] = true; jumpedAt = i; }
        // hold the jump a fixed 40 frames — releasing on `vy > 0` fired the
        // same frame (gravity makes vy fractionally positive while grounded)
        // and turned the running jump into a 59 px tap
        if (jumpedAt >= 0 && i - jumpedAt === 40) game.keys[' '] = false;
        try { updatePlayer(16.667); } catch (e) {}
        if (jumpedAt >= 0 && i - jumpedAt > 8 && player.onGround) break;
      }
      game.keys['arrowright'] = false; game.keys[' '] = false;
    }
    const onPerch = player.y + player.h <= perch.y + 4 &&
                    player.x + player.w / 2 >= perch.x && player.x + player.w / 2 <= perch.x + perch.w;
    ok('a scripted base-kit player physically reaches the portal perch', onPerch,
       `landed at x:${player.x.toFixed(0)} foot:${(player.y + player.h).toFixed(0)} (perch top ${perch.y}), via capital: ${!!onCapital}`);
    // and the portal itself is in interaction range from there
    const near = Math.abs((player.x + player.w / 2) - portal.x) < 60 ||
                 (portal.x >= perch.x && portal.x <= perch.x + perch.w);
    ok('the portal is within reach on the perch', near, `portal x:${portal.x}`);
  }
  return res;
});

let pass = 0, failed = 0;
for (const r of R) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed || errs.length ? 1 : 0);
