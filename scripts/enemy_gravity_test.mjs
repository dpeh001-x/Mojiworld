// ENEMY SHOTS FALL AS DECLARED (v0.30.1425). An enemy projectile's fall came only from a per-tag list, so every shot that
// declared its own `gravity` was ignored: Stumpy's mortar (solved for 0.18) flew up and faded, King Krook's firebombs
// flew in straight lines, Sagittarius's Trajectory Shot flew over a target on its right. In the running game:
//   1. the rule: a declared fall is applied exactly; a homing or noGravity shot gets none; undeclared tags keep theirs;
//   2. Stumpy's mortar comes down on its marker and bursts there, and a player standing on the marker is hit;
//   3. Sagittarius's Trajectory Shot comes down on a player standing left, right or far away;
//   4. King Krook's eight firebombs leave his mouth centred and fall at their declared 0.10.
//   node scripts/enemy_gravity_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.argv[2] || process.env.PORT || 10253); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function' && typeof MONSTER_SKILL_FNS === 'object', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(600); player.level = 99; player.maxHp = 1e7;
    game.paused = false; { const tl = performance.now(); while (!player.onGround && performance.now() - tl < 4000) await sleep(30); } await sleep(200);
    const floor = player.y + player.h, px0 = player.x;
    const stand = (x) => { player.x = x; player.y = floor - player.h; player.vx = 0; player.vy = 0; player.onGround = true; player.hp = player.maxHp; };
    const aabb2 = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    // hook pushes so a shot spliced on its first frame is still seen
    const seen = []; let hooked = null; const hook = () => { const arr = game.projectiles; if (arr === hooked) return; hooked = arr;
      arr.push = function (...a) { for (const p of a) if (p && p.owner === 'enemy') { p._x0 = p.x + (p.w || 0) / 2; p._y0 = p.y + (p.h || 0) / 2; seen.push(p); } return Array.prototype.push.apply(this, a); }; };
    // ---- 1. the rule, on shots parked high over an empty stretch (steps counted on the game clock)
    game.monsters.length = 0; game.projectiles = []; game.hazards = []; stand(px0); player.invulnerable = 1e9;
    const mk = (o) => Object.assign({ x: px0 + 400, y: 60, vx: 0, vy: 0, w: 10, h: 10, life: 400, damage: 1, owner: 'enemy', color: '#fff' }, o);
    const shots = { declared: mk({ skill: 'mbolt', gravity: 0.2 }), declaredSpore: mk({ skill: 'spore', gravity: 0.05, x: px0 + 440 }), noGrav: mk({ skill: 'mbolt', gravity: 0.2, noGravity: true, x: px0 + 480 }),
      splinter: mk({ skill: 'msplinter', x: px0 + 520 }), spore: mk({ skill: 'spore', x: px0 + 560 }) };
    for (const p of Object.values(shots)) game.projectiles.push(p);
    const g0 = game.time; const v0 = Object.fromEntries(Object.entries(shots).map(([k, p]) => [k, p.vy]));
    while (game.time - g0 < 20) { stand(px0); await sleep(8); }
    const steps = game.time - g0; out.rule = Object.fromEntries(Object.entries(shots).map(([k, p]) => [k, +((p.vy - v0[k]) / steps).toFixed(3)])); out.rule.steps = steps;
    game.projectiles = []; player.invulnerable = 0;
    // ---- 2. Stumpy's mortar at a player standing still 260 px away
    game.monsters.length = 0; seen.length = 0; hooked = null; stand(px0);
    spawnMonster(px0 + 260, floor - 88, 'stump', false); const st = game.monsters.filter((x) => x && x.type === 'stump').pop();
    st.y = floor - st.h; const sx = st.x; hook(); let lost = 0, lostTo = null, minTop = 1e9, maxBottom = -1e9, burst = null;
    // the burst is a ONE-frame hazard: catch it as it is pushed
    const oHz = game.hazards; const hzPush = oHz.push; oHz.push = function (...a) { for (const h of a) if (h && h.type === 'mob_orbburst' && !burst) burst = { cx: Math.round(h.cx), cy: Math.round(h.cy), r: h.radius, direct: !!h.direct }; return hzPush.apply(this, a); };
    player._lastDamageSource = ''; stand(px0); const hpStart = player.hp;
    MONSTER_SKILL_FNS.mortarLob(st); const lob = seen.find((p) => p.skill === 'mlob'); const marker = game.hazards.find((h) => h._markerOnly);
    const t2 = game.time;
    while (game.time - t2 < 90) { hook(); st.x = sx; st.vx = 0; player.x = px0; player.vx = 0; player.invulnerable = Math.min(player.invulnerable, 0) ;
      if (lob && game.projectiles.includes(lob)) { minTop = Math.min(minTop, lob.y); maxBottom = Math.max(maxBottom, lob.y + lob.h); }
      if (player.hp < hpStart - lost - 0.5) { lost = hpStart - player.hp; lostTo = player._lastDamageSource || '(unlabelled)'; }
      await sleep(4); }
    delete oHz.push; player.hp = player.maxHp;
    out.mortar = { fired: !!lob, marker: marker ? { cx: Math.round(marker.cx), y: Math.round(marker.y) } : null, floor: Math.round(floor), lobTopAboveFloor: Math.round(floor - minTop), lobLowest: Math.round(floor - maxBottom), burst, lost: Math.round(lost), lostTo };
    game.monsters.length = 0; game.projectiles = []; game.hazards = [];
    // ---- 3. Sagittarius's Trajectory Shot at a player standing right, left and far right (the arrow may pass through: we look for overlap)
    out.sag = {};
    for (const dx of [260, -260, 480]) {
      game.monsters.length = 0; game.projectiles = []; seen.length = 0; hooked = null;
      spawnMonster(px0 + 700, floor - 387, 'zodiac_sagittarius', true); const sg = game.monsters.filter((x) => x && x.type === 'zodiac_sagittarius').pop();
      sg.y = floor - sg.h; const sgx = sg.x; const pxs = sgx + sg.w / 2 + dx - player.w / 2;
      hook(); stand(pxs); player.invulnerable = 1e9; sg._sagArcAt = game.time | 0; let arrow = null, over = false; const t3 = game.time;
      while (game.time - t3 < 100) { hook(); sg.x = sgx; sg.vx = 0; sg.patternState = 'idle'; sg.patternTimer = -1e9; sg.currentHp = sg.maxHp; stand(pxs);
        arrow = arrow || seen.find((p) => p._sourceLabel === 'a Trajectory Shot');
        if (arrow && game.projectiles.includes(arrow) && aabb2(arrow, player)) over = true; if (over) break; await sleep(8); }
      out.sag[dx] = { fired: !!arrow, hits: over };
    }
    game.monsters.length = 0; game.projectiles = []; player.invulnerable = 0;
    // ---- 4. King Krook's firebomb fan
    seen.length = 0; hooked = null; stand(px0 - 600 > 50 ? px0 - 600 : 60);
    spawnMonster(px0 + 300, floor - 284, 'kingKrook', true); const kk = game.monsters.filter((x) => x && x.type === 'kingKrook').pop();
    kk.y = floor - kk.h; const kx = kk.x; hook(); player.invulnerable = 1e9;
    const t4 = game.time; let bombs = [];
    while (game.time - t4 < 120 && bombs.length < 8) { hook(); kk.x = kx; kk.patternState = 'firebomb'; if (!kk._kFired) kk.patternTimer = Math.max(kk.patternTimer || 0, 650); kk._kAnnounced = true; kk.currentHp = kk.maxHp;
      bombs = seen.filter((p) => p.skill === 'firebomb'); await sleep(8); }
    const mouth = { x: kx + kk.w / 2, y: kk.y + kk.h * 0.4 };
    const cen = bombs.length ? { x: bombs.reduce((s, p) => s + p._x0, 0) / bombs.length, y: bombs.reduce((s, p) => s + p._y0, 0) / bombs.length } : null;
    out.krook = { n: bombs.length };
    if (bombs.length) {
      const v0b = bombs.map((p) => p.vy), g4 = game.time; while (game.time - g4 < 15) { kk.x = kx; await sleep(8); }
      const st4 = game.time - g4; out.krook.fall = +((bombs.reduce((s, p, i) => s + (p.vy - v0b[i]), 0) / bombs.length) / st4).toFixed(3);
    }
    out.krook.mouth = mouth; out.krook.fan = cen;
    game.paused = true; return out;
  });
  console.log('build ' + r.ver);
  const R = r.rule;
  ok('a declared fall is applied exactly (0.2 a step)', Math.abs(R.declared - 0.2) < 0.02, R);
  ok('...on a spore-tag shot too, instead of the tag\'s 0.3 (declared 0.05)', Math.abs(R.declaredSpore - 0.05) < 0.02, R);
  ok('a noGravity shot gets none, whatever it declares', Math.abs(R.noGrav) < 0.005, R);
  ok('undeclared tags keep their list fall (msplinter 0.22, spore 0.3)', Math.abs(R.splinter - 0.22) < 0.02 && Math.abs(R.spore - 0.3) < 0.02, R);
  const M = r.mortar;
  ok('Stumpy\'s mortar lob comes down to standing height (was: flew up and faded ~260 px over the floor)', M.fired && M.lobLowest <= 20, M);
  ok('...and bursts on its marker, over the marked circle', !!(M.burst && M.marker && Math.abs(M.burst.cx - M.marker.cx) <= 30 && M.burst.cy >= M.floor - 44 && M.burst.r >= 56), M);
  ok('...hitting a player who stood on the marker', M.lost > 0, M);
  for (const dx of ['260', '-260', '480']) ok(`Sagittarius's Trajectory Shot comes down on a player standing ${dx > 0 ? 'right' : 'left'} at ${Math.abs(dx)} px`, !!(r.sag[dx] && r.sag[dx].fired && r.sag[dx].hits), r.sag[dx]);
  const K = r.krook;
  ok('King Krook fires all eight firebombs', K.n === 8, K);
  ok('...from his mouth, centred (was: every bomb\'s top-left at his mouth, the fan leaning down-right)', !!(K.fan && Math.abs(K.fan.x - K.mouth.x) < 2 && Math.abs(K.fan.y - K.mouth.y) < 2), K);
  ok('...and they fall at their declared 0.10 a step', K.fall != null && Math.abs(K.fall - 0.10) < 0.02, K);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
