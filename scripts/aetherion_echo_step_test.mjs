// Aetherion's Echo Step is telegraphed and lands where it said (per user, with a clip: "aetherion seems to randomly teleport to
// different coordinates of the map, fix it"). Before the fix the step was a bare ~600 px snap: nothing marked the landing, the
// landing could sit half off screen or on the hero at a wall, and he landed facing his old side.
// Four forced steps - open floor from either side, the hero at each wall. Per step:
//   echo     - through the windup his echo is drawn at the landing spot (alpha >= 0.4 by the end) while his body fades (<= 0.6)
//   truthful - he lands where the echo stood on the last windup frame (within 2 px)
//   in view  - his box lands inside the 960 px play window
//   clear    - at least 20 px between his box and the hero's (never on top of you)
//   facing   - he lands facing the hero
//   [MOJI_GAME_FILE=x] node scripts/aetherion_echo_step_test.mjs [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const { chromium } = createRequire(import.meta.url)('playwright-core');
const PORT = Number(process.argv[2] || 10283); const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
let fails = 0; const check = (ok, name, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!ok) fails++; };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    player.hp = player.maxHp = 9e7; player.invulnerable = 9e9; player._god = true;
    loadMap('sanctum', 300); await new Promise((r) => setTimeout(r, 3500)); game._mapFadeTimer = 0; game.paused = false;
    for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
    let m = game.monsters.find((x) => x && x.type === 'aetherion');
    if (!m) m = spawnMonster(1200, 300, 'aetherion', true);
    try { _lxWarmBossFrames('aetherion'); } catch (e) {} await new Promise((r) => setTimeout(r, 2500));
    const ww = (game.mapData && game.mapData.worldWidth) || 2000;
    const draws = []; const orig = window._drawBossSprite;
    window._drawBossSprite = function (sprite, mm, sx) { if (mm === m) draws.push({ sx, a: ctx.globalAlpha }); return orig.apply(this, arguments); };
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const out = [];
    // [hero x, boss starts left (-1) or right (+1) of the hero]
    for (const [label, hx, bSide] of [['open floor, from the left', 1000, -1], ['open floor, from the right', 1000, 1], ['hero at the right wall', ww - 110, -1], ['hero at the left wall', 60, 1]]) {
      m.currentHp = Math.floor(m.maxHp * 0.7);
      for (let i = 0; i < 400 && m._ae && m._ae.st !== 'idle'; i++) await frame();
      for (let i = 0; i < 40; i++) { player.x = hx; player.vx = 0; m.x = bSide < 0 ? hx - m.w - 260 : hx + player.w + 260; m.x = Math.max(40, Math.min(ww - m.w - 40, m.x)); m.vx = 0; await frame(); }
      const A = m._ae || {}; A.cd = A.cd || {}; A.cd.echo = 0; m._dirFleeT = 900;   // cornered -> Echo Step
      let wind = false, lastEcho = null, minBody = 1, maxEcho = 0, x0 = m.x; const T = performance.now();
      while (performance.now() - T < 4000) {
        draws.length = 0; player.x = hx; player.vx = 0; await frame();
        const st = m._ae && m._ae.st;
        if (st === 'echoWind') {
          wind = true;
          if (m._aeEcho) lastEcho = { x: m._aeEcho.x };
          const camX = game.camera.x, body = draws.find((d) => Math.abs(d.sx - (m.x - camX)) < 2), echo = lastEcho && draws.find((d) => Math.abs(d.sx - (m.x - camX)) >= 2);
          if (body) minBody = Math.min(minBody, body.a);
          if (echo) maxEcho = Math.max(maxEcho, echo.a);
        } else if (wind) break;
      }
      const pcx = player.x + player.w / 2, bcx = m.x + m.w / 2;
      const pcam = (typeof _lxPlayCamX === 'function') ? _lxPlayCamX() : game.camera.x;
      const gap = m.x > player.x ? m.x - (player.x + player.w) : player.x - (m.x + m.w);
      out.push({ label, wind, x0: Math.round(x0), x: Math.round(m.x), echoX: lastEcho ? Math.round(lastEcho.x) : null, minBody: +minBody.toFixed(2), maxEcho: +maxEcho.toFixed(2),
        inView: m.x >= pcam - 1 && m.x + m.w <= pcam + 960 + 1, view: [Math.round(pcam), Math.round(pcam + 960)], gap: Math.round(gap), faces: (m.facing > 0) === (pcx > bcx) });
    }
    window._drawBossSprite = orig;
    return { out, ver: GAME_VERSION };
  });
  console.log(R.ver);
  for (const o of R.out) {
    console.log(`-- ${o.label}: ${o.x0} -> ${o.x} (echo ${o.echoX}), view ${o.view.join('..')}, gap ${o.gap}`);
    check(o.wind, `${o.label}: the Echo Step fired`);
    check(o.echoX != null && o.maxEcho >= 0.4 && o.minBody <= 0.6, `${o.label}: echo at the landing spot, body fading`, `echo alpha ${o.maxEcho}, body ${o.minBody}`);
    check(o.echoX != null && Math.abs(o.echoX - o.x) <= 2, `${o.label}: lands where the echo stood`);
    check(o.inView, `${o.label}: lands inside the play window`);
    check(o.gap >= 20, `${o.label}: lands clear of the hero`, `gap ${o.gap} px`);
    check(o.faces, `${o.label}: lands facing the hero`);
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
