// KING GLOOPALOO - mechanic verification against the LIVE fight.
// =============================================================================
// Drives the real boss through bossAI and asserts the reported bugs are gone
// and the new telegraphs actually exist in game state. Nothing here
// re-implements the mechanics.
//   1. RESIDUE    no puddles while airborne / mid-warp; on the sole line
//   2. PLANE      every ranged spawn stays body-relative at EVERY size tier
//   3. TELEPORT   keeps his footing; destination locked at vanish, honoured
//   4. QUAKE      wind-up lengthened to a true ~1.2 s of reaction time
//   5. PUNISH     joins the shared stagger loop; 'leap' does not trigger it
// Run: node scripts/gloopaloo_fight_test.mjs   (MOJI_GAME_FILE overrides target)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9112;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const R = await page.evaluate(async () => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog','area-title']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest'); game.paused = false;
  player.cls = 'warrior'; player.level = 40; player.maxHp = 999999; player.hp = 999999;
  player.x = 400; player.y = 300; player.facing = 1; player.invulnerable = 99999;

  const puddles = () => (game.hazards || []).filter(h => h && h.type === 'gloop_puddle');
  const mkKing = (px, py) => {
    game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0;
    const m = spawnMonster(900, 300, 'king', true);
    m.x = px; m.y = py; m.vx = 0; m.vy = 0; m.onGround = true;
    m.patternState = 'idle'; m.patternTimer = 0;
    m._stagger = 0; m._staggerCd = 0; m._punishPrev = 'idle';
    m._leapCD = 99999;                       // keep _bossSeekPlatform out of the way
    return m;
  };
  const tick = (n, m) => { for (let i = 0; i < n; i++) { game.time++; try { bossAI(m, 16.667, 300); } catch (e) {} } };

  // -- 1. RESIDUE ----------------------------------------------------------
  let m = mkKing(800, 300);
  m.onGround = false; m.y = 120;             // mid-leap, high above the floor
  m._brimLeakCD = 0;
  tick(120, m);
  ok('no residue puddles while airborne', puddles().length === 0, `${puddles().length} spawned mid-air`);

  m = mkKing(800, 300);
  m.onGround = true; m._teleporting = true; m._brimLeakCD = 0;
  tick(120, m);
  ok('no residue puddles mid-warp', puddles().length === 0, `${puddles().length} spawned while warping`);

  m = mkKing(800, 300);
  m.onGround = true; m._teleporting = false; m._brimLeakCD = 0;
  tick(120, m);
  const pud = puddles();
  ok('residue puddles still drip while grounded', pud.length > 0, `${pud.length} puddles`);
  const soleGap = pud.length ? Math.abs(pud[0].cy - (m.y + m.h - 2)) : 999;
  ok('puddle sits on the sole line', soleGap <= 2, `cy off by ${soleGap.toFixed(1)} px`);

  // -- 2. PLANE: spawn stays body-relative across size tiers ---------------
  // The bug was a FIXED `m.y + 14` offset: at his authored 98 px that is 14%
  // down the sprite, but he grows to 186 px, where the same offset is 7.5% --
  // the muzzle drifts off his body. Assert the RATIO is tier-invariant.
  const gooRatio = (h) => {
    const b = mkKing(800, 300);
    b.w = Math.round(112 * (h / 98)); b.h = h;
    game.projectiles.length = 0;
    b.patternState = 'gooBarrage'; b.patternTimer = 0; b._gooFired = 0; b._gooNextAt = 0;
    for (let i = 0; i < 60 && !game.projectiles.length; i++) { game.time++; try { bossAI(b, 16.667, 300); } catch (e) {} }
    const p = game.projectiles[0];
    return p ? { r: (p.y - b.y) / b.h, y: p.y, top: b.y, bot: b.y + b.h } : null;
  };
  const rSmall = gooRatio(98), rBig = gooRatio(186);
  ok('goo barrage fires at both size tiers', !!rSmall && !!rBig, `${!!rSmall}/${!!rBig}`);
  if (rSmall && rBig) {
    ok('goo spawn is tier-invariant on his body',
       Math.abs(rSmall.r - rBig.r) < 0.01 && rSmall.r > 0.3 && rSmall.r < 0.6,
       `ratio ${rSmall.r.toFixed(3)} vs ${rBig.r.toFixed(3)}`);
    ok('goo spawn is inside his body at max size',
       rBig.y > rBig.top && rBig.y < rBig.bot, `y ${rBig.y.toFixed(0)} in [${rBig.top}, ${rBig.bot}]`);
  }

  // -- 3. TELEPORT ---------------------------------------------------------
  m = mkKing(800, 300);
  player.x = 400; player.y = 60;             // player mid-jump, far above the floor
  const yBefore = m.y;
  m.patternState = 'teleport'; m.patternTimer = 0;
  m._teleportFired = false; m._teleportAnnounced = false; m._teleportVanished = false;
  for (let i = 0; i < 12; i++) { game.time++; try { bossAI(m, 16.667, 300); } catch (e) {} }
  const locked = m._tpDestX;
  ok('teleport locks a destination at vanish', locked != null, `dest ${locked}`);
  player.x = 1600;                            // player dodges AWAY after the lock
  for (let i = 0; i < 40 && !m._teleportFired; i++) { game.time++; try { bossAI(m, 16.667, 300); } catch (e) {} }
  ok('teleport emerges at the telegraphed spot, not the new player position',
     m._teleportFired && Math.abs(m.x - locked) < 1, `x ${m.x.toFixed(0)} vs locked ${locked}`);
  ok('teleport keeps his footing (never snaps to a mid-air player)',
     Math.abs(m.y - yBefore) < 1, `y ${m.y.toFixed(0)} vs ${yBefore.toFixed(0)} (player.y 60)`);

  // -- 4. QUAKE wind-up ----------------------------------------------------
  m = mkKing(800, 300);
  player.x = 820; player.y = 300; player.onGround = true;
  m.patternState = 'quake'; m.patternTimer = 0; m._quakeAnnounced = false; m._quakeFired = false;
  let firedAt = -1;
  for (let i = 0; i < 200 && firedAt < 0; i++) { game.time++; try { bossAI(m, 16.667, 300); } catch (e) {} if (m._quakeFired) firedAt = m.patternTimer; }
  ok('quake still fires', firedAt > 0, `at patternTimer ${firedAt.toFixed(0)}`);
  ok('quake wind-up is a true ~1.2 s (>=1560 pattern-ms)', firedAt >= 1560, `${firedAt.toFixed(0)} >= 1560`);

  // -- 5. PUNISH window ----------------------------------------------------
  m = mkKing(800, 300);
  ok('king is eligible for the punish loop', _bossCanPunish(m) === true, `${_bossCanPunish(m)}`);
  m.patternState = 'leap'; m._punishPrev = 'leap'; m._stagger = 0; m._staggerCd = 0;
  m.patternState = 'idle'; _maybeStartBossStagger(m);
  ok('a leap does NOT open a punish window', !(m._stagger > 0), `stagger ${m._stagger | 0}`);
  m._stagger = 0; m._staggerCd = 0;
  m._punishPrev = 'gooBarrage'; m.patternState = 'idle'; _maybeStartBossStagger(m);
  ok('a committed cast DOES open a punish window', m._stagger > 0, `stagger ${m._stagger | 0}`);

  return res;
});

let pass = 0, failed = 0;
for (const r of R) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed || errs.length ? 1 : 0);
