// BIG-BOSS REACH, PLAYER SIDE (v0.30.1432). Bosses stand 293-380 px tall, so their centre sits 146-190 px over their feet,
// and skills that measured a centre (or a left edge) with a small radius missed a boss the player was touching. In the
// running game, the player pressed against the LEFT and the RIGHT side of Gravitos (340x380) and Legosaurus (388x293);
// each skill below must actually reach the boss (a real hitMonster call on it):
//   Nova Step, Riposte Nova, War Cry (its test was the boss's left edge), Evade Burst, a fizzling blast (selfExplode)
//   100 px from the boss's hittable body; Holy Shield lands all three waves; the Beastmaster pack bites Gravitos.
//   node scripts/big_boss_reach_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.argv[2] || process.env.PORT || 10255); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function' && typeof SKILL_FNS === 'object', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ver: GAME_VERSION, bosses: {} };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    player._gravitosCineSeen = true;
    try { loadMap('forest', 300); } catch (e) {} await sleep(600); player.level = 99; player._god = true; player.invulnerable = 1e9;
    game.paused = false; { const tl = performance.now(); while (!player.onGround && performance.now() - tl < 4000) await sleep(30); } await sleep(200);
    const floor = player.y + player.h; player.mods = player.mods || {};
    let cur = null; const hits = {}; const oHit = window.hitMonster;
    window.hitMonster = function (m, dmg, crit, tag) { if (m === cur) hits[tag] = (hits[tag] || 0) + 1; return oHit.apply(this, arguments); };
    const total = () => Object.values(hits).reduce((a, b) => a + b, 0);
    try {
      for (const type of ['gravitos', 'legosaurus']) {
        game.monsters.length = 0; game.projectiles = []; game.hazards = [];
        const def = monsterTypes[type]; spawnMonster(1200, floor - def.h, type, true);
        const m = game.monsters.filter((x) => x && x.type === type).pop(); if (!m) { out.bosses[type] = { err: 'no spawn' }; continue; }
        cur = m; const bx = 1200; const hold = () => { m.x = bx; m.y = floor - m.h; m.vx = 0; m.vy = 0; m.currentHp = m.maxHp = 1e12; m.evasion = 0; };
        const res = {}; out.bosses[type] = res;
        // measure against the body the game actually draws: until the first draw its attack box is the bare authored box
        game.paused = false; { const tv = performance.now(); while (!(m._visW > 0) && performance.now() - tv < 5000) { hold(); player.x = bx - 80; player.y = floor - player.h; await sleep(16); } } res.drawn = m._visW > 0;
        for (const side of ['left', 'right']) {
          const place = () => { hold(); player.x = side === 'left' ? bx - player.w - 2 : bx + m.w + 2; player.y = floor - player.h; player.vx = 0; player.vy = 0; player.onGround = true; player.facing = side === 'left' ? 1 : -1; };
          const once = (name, fn) => { place(); const b = total(); try { fn(); } catch (e) { res[name + ':' + side] = 'ERR ' + e.message; return; } res[name + ':' + side] = total() - b; };
          game.paused = true; hold();
          once('nova', () => { player.mods.dashNova = 1; player._novaAt = -1e9; _dashNovaBurst(); });
          once('riposte', () => { player.mods.riposteNova = 1; player._riposteAt = -1e9; _riposteProc(); });
          once('warCry', () => SKILL_FNS.warCry());
          once('evade', () => SKILL_FNS.evadeRoll());
          place(); game.paused = false;
          // a blast that fizzles 100 px out from the boss's hittable body (its attack box), level with its middle
          { const b = total(); const ab = _atkMonBox(m); const ex = side === 'left' ? ab.x - 100 : ab.x + ab.w + 100, ey = ab.y + ab.h / 2; res['box:' + side] = [Math.round(ab.x - m.x), Math.round(ab.w), Math.round(ab.y - m.y), Math.round(ab.h)];
            const shot = { x: ex - 5, y: ey - 5, w: 10, h: 10, vx: 0, vy: 0, life: 1, owner: 'player', skill: 'fireball', damage: 100, explode: 120, selfExplode: true, noGravity: true, color: '#f80' };
            game.projectiles.push(shot);   // wait for the shot itself: a War Cry / Evade hit-stop holds projectiles while the clock runs
            const t0 = game.time; while (game.projectiles.includes(shot) && game.time - t0 < 120) { place(); await sleep(8); } res['fizzle:' + side] = total() - b; res['fz:' + side] = { gone: !game.projectiles.includes(shot), ex: Math.round(ex - m.x), ey: Math.round(ey - m.y), cam: Math.round(game.camera.x - m.x), inv: m.invulnerable | 0, immune: !!(m._immune || m._ascendImmune) }; }
          // Holy Shield: three waves, 200 / 260 / 320 px
          { const b = hits.holyShield || 0; place(); SKILL_FNS.holyShield(); const t0 = performance.now(); while (performance.now() - t0 < 2500) { place(); await sleep(16); } res['holyShield:' + side] = (hits.holyShield || 0) - b; }
        }
        if (type === 'gravitos') {   // the pack, with the player standing at his feet
          const b = hits.pack || 0; player.x = bx + m.w / 2 - 14; player.y = floor - player.h; SKILL_FNS.beastmaster_pack();
          const t0 = performance.now(); while (performance.now() - t0 < 6000) { hold(); player.x = bx + m.w / 2 - 14; player.vx = 0; await sleep(16); }
          res.packBites = (hits.pack || 0) - b;
        }
        res.bossY = Math.round(m.y - (floor - m.h));
      }
    } finally { window.hitMonster = oHit; game.paused = true; }
    return out;
  });
  console.log('build ' + r.ver);
  for (const [type, res] of Object.entries(r.bosses)) {
    if (res.err) { ok(type + ': ' + res.err, false); continue; }
    for (const side of ['left', 'right']) {
      for (const [k, label] of [['nova', 'Nova Step'], ['riposte', 'Riposte Nova'], ['warCry', 'War Cry'], ['evade', 'Evade Burst'], ['fizzle', 'a blast fizzling 100 px from its body']])
        ok(`${type}, player at its ${side}: ${label} reaches it`, res[k + ':' + side] > 0, k === 'fizzle' ? { hits: res[k + ':' + side], box: res['box:' + side], fz: res['fz:' + side] } : res[k + ':' + side]);
      ok(`${type}, player at its ${side}: Holy Shield lands all three waves`, res['holyShield:' + side] >= 3, res['holyShield:' + side]);
    }
    ok(`${type}: drawn before measuring (its attack box is the drawn body)`, res.drawn, null);
    if (type === 'gravitos') ok('gravitos: the Beastmaster pack bites him', res.packBites > 0, res.packBites);
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
