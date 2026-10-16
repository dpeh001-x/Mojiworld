// THE SUNDERED SMITH'S TOLL WAVES RIDE THE FLOOR / PLATFORM (per user: "sundered smith shockwave projectile should be on the floor / platform").
// The Ring of the Broken Anvil's two waves were spawned at his feet height and flew at that fixed y, so a wave born on a ledge (or while he was airborne) hung in the air, and the starburst art was centred on its box.
//   code : the toll waves carry _smithToll + the art-on-the-box-bottom flags (and a guest's copy keeps them); Taurus's quake shots are untouched
//   live : a toll fired by the real code stands on the floor; a toll fired with the Smith on a ledge is born on that ledge, rides it, falls to the floor where it ends,
//          passes UNDER a higher ledge, and every step its box bottom sits on a surface (or is falling to one)
//   node scripts/smith_toll_floor_test.mjs [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10411);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxTollRide === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'story-beat-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {}; applyClass('warrior'); player.level = 60; player._god = true; player.invulnerable = 9e9; player.maxHp = player.hp = 9e9;
    Object.assign(LX_PERF, { lowFx: false, lowFxUntil: 0, slowFrames: 0, veryLowFx: false, veryLowFxUntil: 0 });
    loadMap('sundered_forge', 200); await W8(2500); game.paused = false; for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const plats = game.mapData.platforms, floor = plats.find((p) => p.type === 'ground').y, ledge = plats.find((p) => p.type === 'platform' && p.x === 560);   // y 340, x 560..760
    const out = { floor, ledge: [ledge.x, ledge.y, ledge.w] };
    let m = game.monsters.find((x) => x.type === 'sundered_smith'); if (!m) m = spawnMonster(1200, floor - 300, 'sundered_smith', true, false);
    m._introDone = true; m.currentHp = m.maxHp = 9e12; m.jump = 0; m.shoot = null; m.aggroTarget = null; m._noGravity = true; player.x = 60; player.y = floor - player.h;
    const track = (label, ms) => { const rows = []; return (async () => { const t0 = performance.now(); while (performance.now() - t0 < ms) { await frame(); m.vx = 0; m.vy = 0; m.x = m._holdX; m.y = m._holdY;
      for (const p of game.projectiles) if (p && p._smithToll) { if (!window._ft) window._ft = { g: p._pGround, pad: p._pGroundPad, ng: p.noGravity, skill: p.skill, h: p.h }; rows.push({ id: (p._tid = p._tid || Math.random()), dir: p.vx > 0 ? 1 : -1, x: +(p.x + p.w / 2).toFixed(1), bottom: +(p.y + p.h).toFixed(1), tvy: +(p._tvy || 0).toFixed(2) }); } } return rows; })(); };
    const fire = async (cx, feet, ms) => {   // the REAL toll code, with the Smith held at (cx, feet)
      game.projectiles = []; m._holdX = cx - m.w / 2; m._holdY = feet - m.h; m.x = m._holdX; m.y = m._holdY; m._smithHeat = 'quenched'; m._smithTollAt = 0;
      return track('toll', ms); };
    // ---- the code carries the flags
    out.flags = { fn: typeof _lxTollSurfaceY, ride: typeof _lxTollRide };
    // ---- 1. on the floor
    const rowsA = await fire(800, floor, 5000); out.A = { n: rowsA.length, bottoms: [...new Set(rowsA.map((r) => r.bottom))], flagged: game.projectiles.length };
    // ---- 2. on the ledge x 560..760 (feet on y 340)
    const rowsB = await fire(660, ledge.y, 5000); const first = rowsB.filter((r) => r.dir === 1), left = rowsB.filter((r) => r.dir === -1);
    out.B = { n: rowsB.length, bornAt: rowsB.length ? rowsB[0].bottom : null, firstBottoms: first.slice(0, 8).map((r) => r.bottom), right: first.map((r) => [r.x, r.bottom]).filter((_, i) => i % 6 === 0), left: left.map((r) => [r.x, r.bottom]).filter((_, i) => i % 6 === 0) };
    out.flagsOn = window._ft || null;   // the first live toll wave seen above
    return out;
  });
  const A = R.A, B = R.B;
  ok('the toll code exists (_lxTollSurfaceY, _lxTollRide)', R.flags.fn === 'function' && R.flags.ride === 'function', R.flags);
  ok('floor: the real toll fires two waves and their box bottom sits on the floor line every step', A.n > 40 && A.bottoms.length === 1 && Math.abs(A.bottoms[0] - R.floor) <= 2, { n: A.n, bottoms: A.bottoms.slice(0, 5), floor: R.floor });
  ok('ledge: born on the ledge the Smith stands on (bottom = ledge top), not on the floor and not in the air', B.n > 40 && B.firstBottoms.every((b) => Math.abs(b - R.ledge[1]) <= 3), { born: B.firstBottoms, ledgeTop: R.ledge[1] });
  const onLedge = B.right.filter(([x]) => x < R.ledge[0] + R.ledge[2] - 6), overGap = B.right.filter(([x, b]) => x > R.ledge[0] + R.ledge[2] + 6 && b < R.ledge[1] + 1);
  ok('ledge: it rides the ledge to its edge...', onLedge.length >= 2 && onLedge.every(([, b]) => Math.abs(b - R.ledge[1]) <= 3), { onLedge });
  const endBottoms = B.right.slice(-3).map(([, b]) => b), endBottomsL = B.left.slice(-3).map(([, b]) => b);
  ok('ledge: ...then falls to the floor where the ledge ends (both waves end on the floor, none hangs at ledge height past the edge)', endBottoms.every((b) => Math.abs(b - R.floor) <= 3) && endBottomsL.every((b) => Math.abs(b - R.floor) <= 3) && overGap.length <= 2, { endR: endBottoms, endL: endBottomsL, hangingSamples: overGap.length });
  const rightRows = B.right.map(([, b]) => b), passUnder = B.right.filter(([x]) => x > 840 && x < 1040);
  ok('ledge: past the edge the wave passes UNDER the next ledge (y 340, x 840..1040): it stays on the floor, never climbs onto it', passUnder.every(([, b]) => Math.abs(b - R.floor) <= 3), { passUnder });
  ok('the live toll shot is a floor rider: art-on-box-bottom flags + noGravity + skill quake', R.flagsOn && R.flagsOn.g === true && R.flagsOn.pad === 0.15 && R.flagsOn.ng === true && R.flagsOn.skill === 'quake' && R.flagsOn.h === 26, R.flagsOn);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
