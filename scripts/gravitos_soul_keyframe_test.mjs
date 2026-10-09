// Gravitos's soul casts land their key frame ON the cast (per user: "do the soul casts too"), hand-set timings kept. Stepping
// the real AI on a controlled clock, the soul set's frame (_gravitosSoulFrame):
//  D. Soul Drain, forms 1-3: the key frame (gravitossoul f5 / gravitos2soul f4 / gravitos3soul f5) on the step the pulse drains,
//     the step before still leading into it
//  S. form 1's Singularity and Collapse Rain: the key frame starts at the resolve (330 / 84 steps), not before
//  A. every frame still plays, from f0
//   node scripts/gravitos_soul_keyframe_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 12031);
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _gravitosSoulFrame === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), o = {};
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const e = document.getElementById(id); if (e) { e.style.display = 'none'; e.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.level = 99; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    try { if (window._lxBootHold && window._lxBootHold.release) window._lxBootHold.release('menu'); } catch (e) {}
    try { _lxWarmBossFrames('gravitos'); } catch (e) {}
    loadMap('stardustAtrium'); await sleep(3000); player._god = true; player.invulnerable = 1e9;
    const SETS = ['gravitossoul', 'gravitos2soul', 'gravitos3soul'];
    for (let i = 0; i < 900 && !SETS.every((k) => { const s = BOSS_ATTACK_FRAMES[k]; return s && s.length > 1 && s.every((f) => f && f.complete); }); i++) await sleep(100);
    o.decoded = Object.fromEntries(SETS.map((k) => [k, (BOSS_ATTACK_FRAMES[k] || []).filter((f) => f && f.naturalWidth > 0).length]));
    // bdfff6aee v0.30.1654 (per user) form 2's soul cast was remade: the chest-star burst is frame 6 now (was 4)
    const KEY = { gravitossoul: 5, gravitos2soul: 6, gravitos3soul: 5 };   // the blows, picked from the art
    o.keys = KEY;
    const hold = () => { game.paused = true; game.hitStop = 1e9; }; hold(); window.__skHold = setInterval(hold, 1);
    window._lxMobAnimHold = function () {};
    const P = performance, oNow = P.now; let tc = oNow.call(P); P.now = () => tc;
    const boss = (form) => { game.monsters.length = 0; const m = spawnMonster(player.x + 300, player.y - 40, 'gravitos', true, false) || game.monsters[game.monsters.length - 1];
      m.currentHp = m.maxHp; m.phase = 1; m._phaseSprite = form === 3 ? 'gravitos3' : form === 2 ? 'gravitos2' : null; m._gravCadenceMul = form === 3 ? 1.45 : form === 2 ? 1.2 : 1; return m; };
    const step = () => { tc += 1000 / 60; game.time++; game.paused = false; game.hitStop = 0; try { updateMonsters(1000 / 60); } finally { hold(); } };
    const at = (m) => { const k = _gravCastKey(m, 'soul'), f = _gravitosSoulFrame(m); return (BOSS_ATTACK_FRAMES[k] || []).indexOf(f); };
    try {
      for (const form of [1, 2, 3]) {   // D. Soul Drain
        const m = boss(form); m.patternState = 'soulDrain'; m.patternTimer = 0; m._drainFired = false; m._drainAnnounced = false;
        let prev = -1, fire = -1; const seen = new Set();
        for (let s = 0; s < 200 && m.patternState === 'soulDrain'; s++) { const was = !!m._drainFired; step(); const i = at(m); seen.add(i); if (!was && m._drainFired) { fire = i; break; } prev = i; }
        o['D' + form] = { set: _gravCastKey(m, 'soul'), atDrain: fire, before: prev, seen: [...seen].sort((a, b) => a - b).join(',') };
      }
      { const m = boss(1); const out = {};   // S. form 1 Singularity / Collapse Rain
        for (const [pat, steps] of [['singularity', 330], ['collapseRain', 84]]) { m.patternState = pat; const t = _gravTeleMs(m, steps * 1000 / 60);
          m.patternTimer = t + 1; const a = at(m); m.patternTimer = t - _gravTeleMs(m, 1000 / 60); const b = at(m); m.patternTimer = 0; const z = at(m); out[pat] = { atResolve: a, stepBefore: b, atCast: z }; }
        o.S = out; }
    } finally { P.now = oNow; clearInterval(window.__skHold); game.monsters.length = 0; }
    return o;
  });
  const K = R.keys;
  check(Object.values(R.decoded).every((v) => v >= 9), 'the soul sets decoded', R.decoded);
  for (const f of [1, 2, 3]) { const d = R['D' + f], k = K[d.set]; check(d.atDrain === k && d.before >= 0 && d.before < k, `D. form ${f} Soul Drain: ${d.set} f${k} on the step the pulse drains`, d); }
  check(['singularity', 'collapseRain'].every((p) => R.S[p].atResolve === K.gravitossoul && R.S[p].stepBefore < K.gravitossoul), 'S. form 1 Singularity and Collapse Rain: the pulse frame starts at the resolve', R.S);
  check(R.D1.seen.split(',')[0] === '0' && R.S.singularity.atCast === 0, 'A. every cast starts on f0 and plays up to its blow', { drain: R.D1.seen, singularityAtCast: R.S.singularity.atCast });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
