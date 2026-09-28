// Mournshade's own projectile (v0.30.1360): per user, "For mournshade generate a specific projectile for him to shoot larger
// purple aura power balls". He fires 'mmournorb' (a dark-violet aura power ball with a nine-frame swirl loop) instead of
// the blue 'mlantern' orb, which the Aether Seer keeps. Checks, in the running game: who fires what, that his balls are
// the larger size and slower speed authored for them, that the loop is indexed / loads / is what the renderer draws,
// that the still and the hand flash are registered, and no page errors.
//   [PORT=11222] node scripts/mournshade_orb_test.mjs [candidate.html inside the repo]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PORT = process.env.PORT || '11222';
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = [], bad = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
page.on('response', (r) => { if (/mmournorb/.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(/^.*Sprites\//, '')); });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    try { _playStoryBeat = function () { return false; }; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { if (window._lxBootHold) window._lxBootHold.release('menu'); } catch (e) {}   // this test skips the title menu
    loadMap('forest', 300); await sleep(1500);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    player.cls = 'warrior'; player._god = true; player.level = 80; game.paused = false; game.monsters.length = 0;
    await sleep(800);
    const add = (type, dx) => { const m = spawnMonster(player.x + dx, player.y - 40, type, false); if (m) { m.maxHp = m.hp = m.currentHp = 1e9; m.speed = 0; } return m; };
    add('mournshade', 260); add('towerSeer', -260);
    const shots = {}, t0 = performance.now();
    while (performance.now() - t0 < 15000) {
      for (const p of game.projectiles) {
        if (!p || p.owner !== 'enemy' || p._mtRec) continue; p._mtRec = 1;
        (shots[p.skill] = shots[p.skill] || []).push({ w: p.w, life: p.life, speed: Math.hypot(p.vx, p.vy) });
      }
      if ((shots.mmournorb || []).length >= 4 && (shots.mlantern || []).length >= 2) break;
      await sleep(50);
    }
    const fr = _projAnimFrame('mmournorb');
    return { defs: { mournshade: monsterTypes.mournshade.shoot, towerSeer: monsterTypes.towerSeer.shoot }, shots,
      frameCount: _lxFrameCount('projectiles/anim', 'mmournorb', 0), loop: fr ? String(fr.src || '').replace(/^.*Sprites\//, '') : null,
      animKey: _PROJ_ANIM_KEYS.has('mmournorb'), blit: _PROJ_SPRITE_BLIT.mmournorb || null,
      still: !!(LX_MOB_PROJ.mmournorb && LX_MOB_PROJ.mmournorb.naturalWidth), cast: !!LX_MOB_CAST.mmournorb, ver: GAME_VERSION };
  });
  console.log(`build ${r.ver}`);
  check(r.defs.mournshade === 'mmournorb' && r.defs.towerSeer === 'mlantern', 'Mournshade fires his own power ball; the Aether Seer keeps the blue orb', JSON.stringify(r.defs));
  const M = r.shots.mmournorb || [], L = r.shots.mlantern || [];
  check(M.length >= 3 && L.length >= 1, 'both really fire in play', `${M.length} power balls, ${L.length} orbs`);
  const mw = M.map((s) => s.w), lw = L.map((s) => s.w);
  // base 41 x 1.35 x (76/40)^0.6 x jitter [0.75, 1.40] = 61..114 px; the Seer (w 54) with mlantern's 34 base: 38..71
  check(mw.length && Math.min(...mw) >= 60 && Math.max(...mw) <= 115, 'his balls are the larger authored size (61-114 px)', `${Math.min(...mw)}-${Math.max(...mw)} px`);
  check(M.every((s) => Math.abs(s.speed - 4.6) < 0.3 && s.life === 125), 'and fly slower and longer (4.6 speed, 125 life: same reach as the old shot)', M.slice(0, 2).map((s) => s.speed.toFixed(2) + '/' + s.life).join(', '));
  check(r.animKey && r.frameCount === 9 && /projectiles\/anim\/mmournorb_\d\.webp/.test(r.loop || ''), 'the nine-frame swirl loop is keyed, indexed and is what the renderer draws', `key ${r.animKey}, index ${r.frameCount}, drawing ${r.loop}`);
  check(r.still && r.cast && r.blit && r.blit.mode === 'spin', 'the still, the purple hand flash and the draw mode are registered', JSON.stringify({ still: r.still, cast: r.cast, blit: r.blit }));
  check(!bad.length, 'every mmournorb file is served', bad.slice(0, 3).join(' | '));
  check(!errs.length, 'no page errors', errs.slice(0, 2).join(' | '));
} catch (e) { check(false, 'harness error', String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
