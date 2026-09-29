// BIG-BOSS REACH, BOSS SIDE (v0.30.1432). Four boss attacks were sized from the boss's centre (or left edge) for the old
// 130-160 px boxes and stopped short once the boxes grew to the art. In the running game:
//   1. Aetherion's Echo Step lands 90 px from a standing player and its ring reaches them;
//   2. his Fracture's first column starts at his edge, not inside him;
//   3. Leo's Solar Mane burns a grounded player hugging him (the test was 100 px up/down from his centre);
//   4. Leo's Royal Roar reaches 250 px past his body on BOTH sides (the test was his left edge: 124 px on his right).
//   node scripts/boss_body_reach_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.argv[2] || process.env.PORT || 10257); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(600); player.level = 99; player.maxHp = 1e7;
    game.paused = false; { const tl = performance.now(); while (!player.onGround && performance.now() - tl < 4000) await sleep(30); } await sleep(200);
    const floor = player.y + player.h;
    const stand = (x) => { player.x = x; player.y = floor - player.h; player.vx = 0; player.vy = 0; player.onGround = true; };
    const spawn1 = (type) => { game.monsters.length = 0; game.projectiles = []; game.hazards = []; const def = monsterTypes[type];
      spawnMonster(1200, floor - def.h, type, true); const m = game.monsters.filter((x) => x && x.type === type).pop(); if (m) { m.y = floor - m.h; m.currentHp = m.maxHp = 1e12; } return m; };
    // watch for a hit with a given label: HP drops while the label is set
    const watch = async (label, ms, each) => { player._god = false; player.invulnerable = 0; player.hp = player.maxHp; player._lastDamageSource = ''; let got = 0; const t0 = performance.now();
      while (performance.now() - t0 < ms && !got) { if (each) each(); if (player.hp < player.maxHp - 0.5 && player._lastDamageSource === label) got = Math.round(player.maxHp - player.hp); player.hp = player.maxHp; player.invulnerable = Math.min(player.invulnerable, 0); await sleep(8); }
      player._god = true; player.invulnerable = 1e9; return got; };
    // ---- Aetherion
    let m = spawn1('aetherion'); stand(700); player._god = true; player.invulnerable = 1e9; await sleep(300);
    if (m && m._ae) {
      const A = m._ae; const bx = m.x;
      // 1. Echo Step: he lands 90 px from you; stand still
      // (re-armed until the ring is out: a windup forced while he is busy - staggered, open - is swallowed)
      const hasRing = () => game.hazards.some((h) => h._sourceLabel === "Aetherion's Echo Step");
      { const tE = performance.now(); while (performance.now() - tE < 3000 && !hasRing()) { if (A.st !== 'echoWind') { A.st = 'echoWind'; A.t = 99999; } stand(700); await sleep(8); } }
      const ring = game.hazards.find((h) => h._sourceLabel === "Aetherion's Echo Step");
      out.echoRing = ring ? { maxRadius: Math.round(ring.maxRadius), toPlayer: Math.round(Math.hypot(714 - ring.cx, (floor - 22) - ring.cy)) } : null;
      out.echo = ring ? await watch("Aetherion's Echo Step", 2500, () => { stand(700); A.st = 'idle'; A.t = -1e9; }) : 0;
      // 2. Fracture: the first column's centre against his edge (on the side toward you)
      game.hazards = []; m.x = bx; stand(bx - 400); A.st = 'fractureWind'; A.t = 99999;
      { const t0 = performance.now(); while (performance.now() - t0 < 1500 && !game.hazards.some((h) => h._sourceLabel === "Aetherion's Fracture")) { m.x = bx; stand(bx - 400); await sleep(8); } }
      const cols = game.hazards.filter((h) => h._sourceLabel === "Aetherion's Fracture").map((h) => h.cx);
      const edge = m.x; out.fracture = { n: cols.length, firstPastEdge: cols.length ? Math.round(edge - Math.max(...cols)) : null };   // columns march left: the nearest has the largest cx
      A.st = 'idle'; A.t = -1e9;
    } else out.aeErr = m ? 'no _ae state' : 'no spawn';
    // ---- Leo
    m = spawn1('zodiac_leo'); stand(700); player._god = true; player.invulnerable = 1e9; await sleep(300);
    if (m) {
      const bx = m.x; const hold = () => { m.x = bx; m.vx = 0; };
      // 3. Solar Mane: hug his left side on the floor
      let toast = ''; const oT = window.showToast; window.showToast = function (s) { if (/Solar Mane/.test(String(s))) toast = String(s); return oT.apply(this, arguments); };
      player._maneToastAt = 0; player.burnTimer = 0; player._god = false; player.invulnerable = 0;
      m._maneTickAt = game.time | 0; { const t0 = performance.now(); while (performance.now() - t0 < 800 && !toast) { hold(); m.patternState = 'idle'; m.patternTimer = -1e9; stand(bx - player.w - 2); player.invulnerable = 0; player.hp = player.maxHp; await sleep(8); } }
      window.showToast = oT; out.mane = { toast: !!toast, burn: player.burnTimer > 0 }; player._god = true; player.invulnerable = 1e9; player.burnTimer = 0;
      // 4. Royal Roar at 250 px past his body, left side then right side
      out.roar = {};
      for (const side of ['left', 'right']) {
        // a fresh Leo per side: after any attack he drops into his post-attack opening, which swallows a forced windup
        const L = spawn1('zodiac_leo'); if (!L) { out.roar[side] = 'no spawn'; continue; } const lx = L.x; player._god = true; player.invulnerable = 1e9;
        const px = side === 'right' ? lx + L.w + 250 : lx - 250 - player.w; stand(px); await sleep(300);
        L.patternState = 'roarWindup'; L.patternTimer = 705; L._leoRoarDir = side === 'right' ? 1 : -1;
        out.roar[side] = await watch("Leo's Royal Roar", 1200, () => { L.x = lx; L.vx = 0; stand(px); });
      }
    } else out.leoErr = 'no spawn';
    game.paused = true; return out;
  });
  console.log('build ' + r.ver);
  if (r.aeErr) ok('Aetherion harness: ' + r.aeErr, false);
  else {
    ok("Aetherion's Echo Step ring reaches the player he lands 90 px from", r.echo > 0, { hit: r.echo, ring: r.echoRing });
    ok("his Fracture's first column is centred just past his edge (was: inside him)", !!(r.fracture && r.fracture.n > 0 && r.fracture.firstPastEdge >= 0 && r.fracture.firstPastEdge <= 20), r.fracture);
  }
  if (r.leoErr) ok('Leo harness: ' + r.leoErr, false);
  else {
    ok("Leo's Solar Mane burns a grounded player hugging him", !!(r.mane && r.mane.toast && r.mane.burn), r.mane);
    ok("Leo's Royal Roar reaches 250 px past his RIGHT side (was: 124 px)", r.roar.right > 0, r.roar);
    ok("...and 250 px past his left side", r.roar.left > 0, r.roar);
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
