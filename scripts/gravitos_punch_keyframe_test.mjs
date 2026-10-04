// Gravitos's punches land their key frame ON the punch (per user: "do the punches too"), hand-set timings kept. Stepping the
// real AI on a controlled clock, the punch set's frame (_gravitosPunchPair) on the step each punch lands:
//  C. Gravity Crush, forms 1-3: the fist into the floor (the columns rise) on the key frame (f5 / f4 / f6), the step before
//     still the wind-up
//  S. Body Slam: the impact on the key frame
//  Z. the Zip: the key frame as the charge launches, HELD through the charge, the follow-through after it
//  A. every frame of the set still plays (from f0)
//   node scripts/gravitos_punch_keyframe_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11991);
let bad = 0, total = 0; const check = (ok, label, d) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d !== undefined ? '  ' + JSON.stringify(d) : ''}`); if (!ok) bad++; };
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _gravitosPunchPair === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), o = {};
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const e = document.getElementById(id); if (e) { e.style.display = 'none'; e.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.level = 99; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    try { if (window._lxBootHold && window._lxBootHold.release) window._lxBootHold.release('menu'); } catch (e) {}
    try { _lxWarmBossFrames('gravitos'); } catch (e) {}
    loadMap('stardustAtrium'); await sleep(3000); player._god = true; player.invulnerable = 1e9;
    const SETS = ['gravitospunch', 'gravitos2punch', 'gravitos3punch'];
    for (let i = 0; i < 900 && !SETS.every((k) => { const s = BOSS_ATTACK_FRAMES[k]; return s && s.length > 1 && s.every((f) => f && f.complete); }); i++) await sleep(100);
    o.decoded = Object.fromEntries(SETS.map((k) => [k, (BOSS_ATTACK_FRAMES[k] || []).filter((f) => f && f.naturalWidth > 0).length + '/' + (BOSS_ATTACK_FRAMES[k] || []).length]));
    const KEY = { gravitospunch: 5, gravitos2punch: 4, gravitos3punch: 6 };   // the blows, picked from the art
    o.keys = Object.fromEntries(SETS.map((k) => { const f = _lxCalibFt(k, 'attack'), n = (BOSS_ATTACK_FRAMES[k] || []).length; return [k, (typeof _lxBossKeyFrame === 'function' && f) ? _lxBossKeyFrame(k, n, f) : KEY[k]]; }));
    const hold = () => { game.paused = true; game.hitStop = 1e9; }; hold(); window.__pkHold = setInterval(hold, 1);
    window._lxMobAnimHold = function () {};
    const P = performance, oNow = P.now; let tc = oNow.call(P); P.now = () => tc;
    const boss = (form) => { game.monsters.length = 0; const m = spawnMonster(player.x + 300, player.y - 40, 'gravitos', true, false) || game.monsters[game.monsters.length - 1];
      m.currentHp = m.maxHp; m.phase = 1; m._phaseSprite = form === 3 ? 'gravitos3' : form === 2 ? 'gravitos2' : null; m._gravCadenceMul = form === 3 ? 1.45 : form === 2 ? 1.2 : 1; return m; };
    const step = () => { tc += 1000 / 60; game.time++; game.paused = false; game.hitStop = 0; try { updateMonsters(1000 / 60); } finally { hold(); } };
    const start = (m, pat) => { m.patternState = pat; m.patternTimer = 0; m._crushFired = false; m._slamHit = false; m._zipPrep = false; m._tpWarn = null; m._tpWindMs = 0; };
    const at = (m) => { const p = _gravitosPunchPair(m); return p ? p.i : -1; };
    try {
      for (const form of [1, 2, 3]) {   // C. crush
        const m = boss(form); start(m, 'crush'); let prev = -1, fire = -1, seen = new Set();
        for (let s = 0; s < 150 && m.patternState === 'crush'; s++) { const was = !!m._crushFired; step(); const i = at(m); seen.add(i); if (!was && m._crushFired) { fire = i; break; } prev = i; }
        o['C' + form] = { set: _gravCastKey(m, 'punch'), atFire: fire, before: prev, seen: [...seen].sort((a, b) => a - b).join(',') };
      }
      { const m = boss(1); start(m, 'slam'); let prev = -1, fire = -1;   // S. slam
        for (let s = 0; s < 240 && m.patternState === 'slam'; s++) { const was = !!m._slamHit; step(); const i = at(m); if (!was && m._slamHit) { fire = i; break; } prev = i; }
        o.S = { atHit: fire, before: prev }; }
      { const m = boss(1); start(m, 'zip'); let prev = -1, launch = -1, mid = -1, after = -1, seen = new Set(), stL = -1;   // Z. zip
        const _kd = ((_lxCalibFt(_gravCastKey(m, 'punch'), 'attack') || [])[LX_BOSS_KEY_FRAME.gravitospunch] || 48) * (_gravTeleMs(m, 1) || 1);   // v0.30.1633 the key frame's own authored length, played after the hold
        for (let s = 0; s < 260 && m.patternState === 'zip'; s++) { step(); const zt = m.patternTimer - (m._tpWindMs || 0), i = at(m); seen.add(i);
          if (launch < 0 && zt >= 260) { launch = i; stL = s; } else if (launch < 0) prev = i;
          if (stL >= 0 && mid < 0 && zt >= 260 + 360) mid = i;
          if (stL >= 0 && after < 0 && zt >= 260 + 720 + _kd + 30) after = i; }
        o.Z = { atLaunch: launch, before: prev, midCharge: mid, afterCharge: after, seen: [...seen].sort((a, b) => a - b).join(',') }; }
    } finally { P.now = oNow; clearInterval(window.__pkHold); game.monsters.length = 0; }
    return o;
  });
  const K = R.keys;
  check(Object.values(R.decoded).every((v) => /^(\d+)\/\1$/.test(v) && +v.split('/')[0] >= 9), 'the punch sets decoded', R.decoded);
  for (const f of [1, 2, 3]) { const c = R['C' + f], k = K[c.set]; check(c.atFire === k && c.before >= 0 && c.before < k, `C. form ${f} Gravity Crush: the fist lands on ${c.set} f${k} the step the columns rise`, c); }
  check(R.S.atHit === K.gravitospunch && R.S.before < K.gravitospunch, `S. Body Slam: the impact on f${K.gravitospunch}`, R.S);
  check(R.Z.atLaunch === K.gravitospunch && R.Z.before < K.gravitospunch && R.Z.midCharge === K.gravitospunch && R.Z.afterCharge > K.gravitospunch, `Z. the Zip: f${K.gravitospunch} as the charge launches, held through it, the follow-through after`, R.Z);
  check(R.C1.seen.split(',')[0] === '0' && R.C1.seen.split(',').length >= K.gravitospunch + 1, 'A. the wind-up plays from f0, every frame up to the blow', R.C1.seen);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
