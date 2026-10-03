// THE DISTORTED CAPTAINS' KITS (per user: "Generate the animation sprites and strike and distinct projectile sprites for the 4
// distorted captains", "make their attacks and projectiles look real intense and powerful", "Lady honk should be a bowmaster",
// "Harea should cast a spell that does a powerful magical explosion", "Taiger should have blitz lightning speed which shoot
// kunai and does fancy slashes", "Taiger should be a very fast and mobile monster", "Harea and honk should be a very cautious
// monster that attacks from a distance", "Willeo attacking sprite can be regenerated as there is a cutoff").
//   [1] kits: Taiger fast (speed >= 2.5), kunai volley, violet blitz dash, his slash; Harea her own bursting bolt + eruption;
//       Lady Honk a bowmaster (no smash: arrows, a 3-volley, an arrow storm); both casters keep their distance
//   [2] art: the three shots' stills + 9-frame loops, the burst, both beams + both warnings, Taiger's slash set, and every
//       idle / walk / attack frame of all four decode
//   [3] a 3-volley: one Lady Honk shot tick fires three arrows; one Taiger tick three kunai
//   [4] cautious: Harea and Lady Honk back away from a hero 110 px off, facing him; at 330 px they hold their ground
//   [5] Harea's bolt bursts (LX_ORB_BURST with the harea_burst art)
//   [6] strike timing held on the frame the art strikes on: Taiger f2, Harea f3, Willeo f3, Lady Honk f4
//   [7] Willeo's attack frames are wider than his still (room for the punch) with the same height, so nothing is cut
//   [8] no failed request, no page error
//   node scripts/distorted_captains_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 9967);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 500) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
const errs = [], bad = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  page.on('response', (r) => { if (r.status() >= 400 && /taiger|harea|lady_honk|willeo|mkunai|mhonkarrow|fx_col_|tg_col_|harea_burst/.test(r.url())) bad.push(r.status() + ' ' + r.url().split('/').slice(-2).join('/')); });
  await page.goto(`http://localhost:${PORT}/${PAGE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof updateMonsters === 'function' && typeof monsterTypes === 'object' && window.LX_ANIM_CALIB, null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const T = (k) => monsterTypes[k] || {}, tr = (k) => T(k).traits || {};
    out.kit = { taiger: { speed: T('taiger').speed, shoot: T('taiger').shoot, volley: tr('taiger').volleyShot, dash: tr('taiger').lateralDash, swing: !!tr('taiger').bigMelee },
      harea: { shoot: T('harea').shoot, col: (tr('harea').columnStrike || {}).sprite, kd: tr('harea').keepsDistance },
      honk: { shoot: T('lady_honk').shoot, melee: !!tr('lady_honk').bigMelee, volley: tr('lady_honk').volleyShot, col: (tr('lady_honk').columnStrike || {}).sprite, kd: tr('lady_honk').keepsDistance } };
    // ---- art
    const want = (im) => { if (im && im._lxLazy && typeof _lxWantImg === 'function') _lxWantImg(im, true); };
    const shots = ['mkunai', 'mharea', 'mhonkarrow'], fx = ['harea_burst', 'fx_col_harea', 'fx_col_lady_honk', 'tg_col_harea', 'tg_col_lady_honk'];
    const frames = []; for (const k of ['taiger', 'harea', 'lady_honk', 'willeo']) for (const s of ['idle', 'walk', 'attack']) for (let i = 0; i < 9; i++) { const im = new Image(); im.src = `Sprites/monsters/${s}/${k}_${i}.webp`; frames.push(im); }
    const slash = [...Array(9).keys()].map((i) => { const im = new Image(); im.src = `Sprites/fx/anim/swing_taiger_${i}.webp`; return im; });
    const ready = (im) => im && im.complete && im.naturalWidth > 0;
    for (let t = 0; t < 120; t++) {
      for (const k of shots) { _projAnimFrame(k); _lxMobProjReady(LX_MOB_PROJ[k]); } for (const k of fx) want(LX_FX[k]);
      if (shots.every((k) => ready(LX_MOB_PROJ[k]) && (PROJ_ANIM_FRAMES[k] || []).filter(ready).length === 9) && fx.every((k) => ready(LX_FX[k])) && frames.every(ready) && slash.every(ready)) break;
      await sleep(250);
    }
    out.art = { shots: Object.fromEntries(shots.map((k) => [k, [ready(LX_MOB_PROJ[k]), (PROJ_ANIM_FRAMES[k] || []).filter(ready).length, !!_PROJ_SPRITE_BLIT[k]]])),
      fx: Object.fromEntries(fx.map((k) => [k, ready(LX_FX[k])])), frames: frames.filter(ready).length, slash: slash.filter(ready).length };
    out.willeo = { static: [], attack: [] };
    { const st = new Image(); st.src = 'Sprites/monsters/willeo.webp'; for (let t = 0; t < 40 && !ready(st); t++) await sleep(100); out.willeo.static = [st.naturalWidth, st.naturalHeight];
      const a = frames.find((im) => /attack\/willeo_3/.test(im.src)); out.willeo.attack = [a.naturalWidth, a.naturalHeight]; }
    // ---- live behaviour on a flat stretch
    const a = Object.entries(MAPS).filter(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).some((p) => p.w > 1200)).sort((x, y) => y[1].worldWidth - x[1].worldWidth)[0];
    loadMap(a[0]); await sleep(1200); game.paused = false;   // a fresh boot sits on the title menu, paused: the mob AI does not run
    const gnd = (game.mapData.platforms || []).filter((p) => p.w > 1200).sort((x, y) => x.y - y.y)[0];
    const cx = gnd.x + gnd.w / 2, gy = gnd.y;
    const fresh = () => { game.monsters.length = 0; game.projectiles.length = 0; player.x = cx; player.y = gy - player.h; player.vx = 0; player.vy = 0; player.invincible = 99999;
      if (game.camera) { game.camera.x = cx - W_PLAY / 2; game.camera.y = gy - H / 2; } };   // AI runs only near the camera (the far tier skips it)
    // [3] volleys
    out.volley = {};
    for (const [k, shot] of [['lady_honk', 'mhonkarrow'], ['taiger', 'mkunai']]) { fresh(); const m = spawnMonster(cx + 300, gy - 100, k, false); _fireShotFor(m);
      out.volley[k] = game.projectiles.filter((p) => p.owner === 'enemy' && (p.skill === shot || p.type === shot || p.sprite === shot || p.kind === shot)).length || game.projectiles.filter((p) => p.owner === 'enemy').length; }
    // [4] cautious: start 110 px off (back away) and 330 px off (hold), shooting / columns parked so only movement runs
    out.kd = {};
    for (const k of ['harea', 'lady_honk']) for (const d of [110, 330]) {
      fresh(); const m = spawnMonster(cx + d, gy - 100, k, false); m.x = cx + d - m.w / 2 + player.w / 2; m.y = gy - m.h; m.onGround = true; m.vy = 0;
      m.shootTimer = 1e9; m._columnCd = 1e9; m.aggroTarget = player;
      const x0 = m.x; let face = 0;
      for (let i = 0; i < 90; i++) { player.x = cx; player.vx = 0; game.time++; m.aggroTarget = player; updateMonsters(16); if (m.facing < 0) face++; }
      out.kd[k + '@' + d] = { moved: +(m.x - x0).toFixed(1), facedHero: face };
    }
    // [5] the burst
    out.burst = (typeof LX_ORB_BURST !== 'undefined' && LX_ORB_BURST.mharea) ? { fx: LX_ORB_BURST.mharea.fx, splash: LX_ORB_BURST.mharea.splash } : null;
    // [6] timing: the frame each attack set holds longest
    const C = window.LX_ANIM_CALIB, peak = (k) => { const ft = C[k] && C[k].attack && C[k].attack.ft; return ft ? ft.indexOf(Math.max(...ft)) : null; };
    out.peak = { taiger: peak('taiger'), harea: peak('harea'), willeo: peak('willeo'), lady_honk: peak('lady_honk') };
    return out;
  });
  const K = R.kit;
  ok('[1] Taiger: fast (speed >= 2.5), throws kunai in a volley, blitz-dashes on violet lightning, still slashes', K.taiger.speed >= 2.5 && K.taiger.shoot === 'mkunai' && K.taiger.volley === 3 && K.taiger.dash && K.taiger.dash.trail === '#b06bff' && K.taiger.swing, K.taiger);
  ok('[1] Harea: her own crystal bolt and eruption beam, and she keeps her distance', K.harea.shoot === 'mharea' && K.harea.col === 'fx_col_harea' && K.harea.kd && K.harea.kd.min > 0, K.harea);
  ok('[1] Lady Honk is a bowmaster: arrows in a 3-volley, an arrow storm, no ground-smash, keeps her distance', K.honk.shoot === 'mhonkarrow' && !K.honk.melee && K.honk.volley === 3 && K.honk.col === 'fx_col_lady_honk' && K.honk.kd, K.honk);
  ok('[2] the three shots load a still and a 9-frame loop and have a blit row', Object.values(R.art.shots).every(([s, n, b]) => s && n === 9 && b), R.art.shots);
  ok('[2] the burst, both eruption / storm beams and both warnings load', Object.values(R.art.fx).every(Boolean), R.art.fx);
  ok('[2] every idle / walk / attack frame of the four captains and all nine of Taiger\'s slash frames decode', R.art.frames === 108 && R.art.slash === 9, { frames: R.art.frames, slash: R.art.slash });
  ok('[3] one shot tick: three arrows from Lady Honk, three kunai from Taiger', R.volley.lady_honk === 3 && R.volley.taiger === 3, R.volley);
  ok('[4] 110 px off, Harea and Lady Honk back AWAY from the hero (> 20 px), facing him', ['harea', 'lady_honk'].every((k) => R.kd[k + '@110'].moved > 20 && R.kd[k + '@110'].facedHero > 60), R.kd);
  ok('[4] 330 px off they hold their ground (< 25 px of drift)', ['harea', 'lady_honk'].every((k) => Math.abs(R.kd[k + '@330'].moved) < 25), R.kd);
  ok('[5] Harea\'s crystal bolt bursts in her own explosion and splashes', R.burst && R.burst.fx === 'harea_burst' && R.burst.splash > 0, R.burst);
  ok('[6] each attack holds the frame its art strikes on (Taiger f2, Harea f3, Willeo f3, Lady Honk f4)', R.peak.taiger === 2 && R.peak.harea === 3 && R.peak.willeo === 3 && R.peak.lady_honk === 4, R.peak);
  ok('[7] Willeo\'s attack frames are wider than his still with the same height (the punch has room)', R.willeo.attack[0] > R.willeo.static[0] && R.willeo.attack[1] === R.willeo.static[1], R.willeo);
  ok('[8] no failed request and no page error', bad.length === 0 && errs.length === 0, { bad: bad.slice(0, 4), errs: errs.slice(0, 3) });
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
