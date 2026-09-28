// The Lantern Wisp's own projectile (v0.30.1376): per user, "make the lantern wisp shoot its own projectile too". It had no
// ranged shot (a close lantern pulse and a death burst); it now fires 'mwisplight', a golden wisp-light orb ringed with
// flames, with a nine-frame flicker loop. Checks, in the running game: it fires in play (the pulse and death burst stay),
// its shots are the authored size / speed / life, the loop is indexed / loads / is what the renderer draws, the still,
// the hand flash and the upright draw mode are registered, and no page errors.
//   [PORT=11240] node scripts/wisp_shot_test.mjs [candidate.html inside the repo]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PORT = process.env.PORT || '11240';
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = [], bad = [], okFrames = new Set();
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
page.on('response', (r) => { if (!/mwisplight/.test(r.url())) return; const u = r.url().replace(/^.*Sprites\//, '');
  if (r.status() >= 400) bad.push(r.status() + ' ' + u); else if (/anim\/mwisplight_\d/.test(u)) okFrames.add(u); });
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
    const m = spawnMonster(player.x + 300, player.y - 60, 'lanternWisp', false); if (m) { m.maxHp = m.hp = m.currentHp = 1e9; m.speed = 0; }
    // each shot is read the moment fireMonsterProjectile pushes it (a poll sees it a few frames old)
    const shots = [], t0 = performance.now(), orig = fireMonsterProjectile;
    fireMonsterProjectile = function () {
      const n0 = game.projectiles.length, ret = orig.apply(this, arguments);
      for (const p of game.projectiles.slice(n0)) if (p && p.owner === 'enemy') shots.push({ skill: p.skill, w: p.w, life: p.life, speed: Math.hypot(p.vx, p.vy) });
      return ret;
    };
    while (performance.now() - t0 < 16000 && shots.length < 3) await sleep(50);
    fireMonsterProjectile = orig;
    const fr = _projAnimFrame('mwisplight');   // an Image, or (the v0.30.1271 loop hold) a baked canvas of one
    const t = monsterTypes.lanternWisp;
    return { def: { shoot: t.shoot, shootCd: t.shootCd, pulse: !!(MONSTER_SKILLS.lanternWisp && MONSTER_SKILLS.lanternWisp.kind === 'lanternPulse'), explodes: !!(t.traits && t.traits.explodesOnDeath) },
      live: m ? m.shoot : null, shots, frameCount: _lxFrameCount('projectiles/anim', 'mwisplight', 0), loopOk: !!(fr && (fr.naturalWidth || fr.width) > 0),
      loop: fr ? (fr.src ? String(fr.src).replace(/^.*Sprites\//, '') : 'baked ' + (fr.width | 0) + 'px canvas') : null,
      animKey: _PROJ_ANIM_KEYS.has('mwisplight'), blit: _PROJ_SPRITE_BLIT.mwisplight || null,
      still: !!(LX_MOB_PROJ.mwisplight && LX_MOB_PROJ.mwisplight.naturalWidth), cast: !!LX_MOB_CAST.mwisplight, ver: GAME_VERSION };
  });
  console.log(`build ${r.ver}`);
  check(r.def.shoot === 'mwisplight' && r.def.shootCd === 2200 && r.live === 'mwisplight' && r.def.pulse && r.def.explodes,
    'the Lantern Wisp fires its own wisp-light and keeps its lantern pulse and death burst', JSON.stringify({ def: r.def, live: r.live }));
  const S = r.shots.filter((s) => s.skill === 'mwisplight');
  check(S.length >= 2, 'it really fires in play', `${S.length} wisp-lights (${r.shots.length} shots)`);
  // base 40 x 1.35 x (27/40)^0.6 x jitter [0.75, 1.40] = 32..60 px
  check(S.length && Math.min(...S.map((s) => s.w)) >= 31 && Math.max(...S.map((s) => s.w)) <= 61, 'its shots are the authored size (32-60 px)', S.map((s) => s.w).join(', '));
  check(S.every((s) => Math.abs(s.speed - 5.4) < 0.35 && s.life === 110), 'and the authored flight (5.4 speed, 110 life)', S.slice(0, 2).map((s) => s.speed.toFixed(2) + '/' + s.life).join(', '));
  check(r.animKey && r.frameCount === 9 && r.loopOk && okFrames.size === 9, 'the nine-frame flicker loop is keyed, indexed, all nine frames load, and the renderer gets a frame', `key ${r.animKey}, index ${r.frameCount}, ${okFrames.size}/9 frames served, drawing ${r.loop}`);
  check(r.still && r.cast && r.blit && r.blit.mode === 'static', 'the still, the hand flash and the upright draw mode are registered', JSON.stringify({ still: r.still, cast: r.cast, blit: r.blit }));
  check(!bad.length, 'every mwisplight file is served', bad.slice(0, 3).join(' | '));
  check(!errs.length, 'no page errors', errs.slice(0, 2).join(' | '));
} catch (e) { check(false, 'harness error', String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
