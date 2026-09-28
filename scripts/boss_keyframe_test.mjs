// A boss attack's KEY frame (its blow) is on screen when the attack fires, with the hand-set frame durations untouched (per
// user: "keep the hand set timings, but ensure to time the attack accurately to the key frames"). On a controlled clock:
//  L. Gravitos's laser, forms 1 and 2: stepping the real AI, the frame drawn on the step the bolts release is the key frame
//     (gravitoslaser f6, gravitos2laser f7), and the step before it is still the windup
//  W. Gravitos's wave and blackhole: the base set shows its punch lunge (f5) on the step each one fires
//  S. form 2's Singularity / Collapse Rain: the star burst (f6) starts at the hazard's resolve (330 / 84 steps)
//  C. a contact hit: the key frame is on screen 120 ms after it (the Arbiter's slam f6, Gravitos's f5, Mooma's strike)
//  D. Legosaurus's brace-dash restarts its set: f0 at the brace, f2 (the kick-off) as the launch comes 850 ms later
//  H. the hand-set timings themselves are unchanged
//   node scripts/boss_keyframe_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11921);
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _gravitosLaserFrame === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), o = {};
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const e = document.getElementById(id); if (e) { e.style.display = 'none'; e.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.level = 99; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    try { if (window._lxBootHold && window._lxBootHold.release) window._lxBootHold.release('menu'); } catch (e) {}
    for (const t of ['gravitos', 'towerArbiter', 'legosaurus', 'mooma']) try { _lxWarmBossFrames(t); } catch (e) {}
    loadMap('stardustAtrium'); await sleep(3000); player._god = true; player.invulnerable = 1e9;
    const KEYS = ['gravitos', 'gravitoslaser', 'gravitos2laser', 'gravitos2star', 'towerArbiter', 'legosaurusdash', 'mooma'];
    const ok9 = (k) => { const s = BOSS_ATTACK_FRAMES[k]; return !!s && s.length > 1 && s.every((f) => f && f.complete); };
    for (let i = 0; i < 900 && !KEYS.every(ok9); i++) await sleep(100);   // loaded or failed
    o.decoded = Object.fromEntries(KEYS.map((k) => [k, (BOSS_ATTACK_FRAMES[k] || []).filter((f) => f && f.naturalWidth > 0).length]));
    for (const k of KEYS) try { _lxFtReadyN(BOSS_ATTACK_FRAMES[k]); } catch (e) {}
    const hold = () => { game.paused = true; game.hitStop = 1e9; }; hold(); window.__kfHold = setInterval(hold, 1);
    window._lxMobAnimHold = function () {};   // a picker-only harness: the world's holds are not under test
    const P = performance, oNow = P.now; let tc = oNow.call(P); P.now = () => tc;
    const idx = (k, f) => (BOSS_ATTACK_FRAMES[k] || []).indexOf(f);
    const ft = (k) => _lxCalibFt(k, 'attack');
    o.ft = Object.fromEntries(KEYS.map((k) => [k, (ft(k) || []).join('/')]));
    const boss = (type) => { game.monsters.length = 0; const m = spawnMonster(player.x + 260, player.y - 40, type, true, false) || game.monsters[game.monsters.length - 1]; m.currentHp = m.maxHp; return m; };
    const step = () => { tc += 1000 / 60; game.time++; game.paused = false; game.hitStop = 0; try { updateMonsters(1000 / 60); } finally { hold(); } };
    try {
      // L. the laser, forms 1 and 2
      for (const [form, key] of [[1, 'gravitoslaser'], [2, 'gravitos2laser']]) {
        const m = boss('gravitos'); m.phase = 1; m._phaseSprite = form === 2 ? 'gravitos2' : null; m._gravCadenceMul = form === 2 ? 1.2 : 1;
        m.patternState = 'laser'; m.patternTimer = 0; m._laserRingUp = false; m._laserFired = false;
        const seq = []; let rel = -1;
        for (let s = 0; s < 90 && m.patternState === 'laser'; s++) { step(); const f = idx(key, _gravitosLaserFrame(m)); seq.push([Math.round(m.patternTimer), f]); if (rel < 0 && m.patternTimer >= (m._lxLaserChargeMs || 500)) rel = seq.length - 1; }   /* phase 1 (full HP): 500 */
        o['L' + form] = { key, charge: m._lxLaserChargeMs || 500, atRelease: rel >= 0 ? seq[rel][1] : -1, before: rel > 0 ? seq[rel - 1][1] : -1, seq: seq.filter((x, i) => i === 0 || x[1] !== seq[i - 1][1]).map((x) => x[0] + ':f' + x[1]).join(' ') };
      }
      // W. wave + blackhole on the base set (form 1)
      for (const [pat, flag] of [['wave', '_waveFired'], ['blackhole', '_bhFired']]) {
        const m = boss('gravitos'); m.phase = 1; m._phaseSprite = null; m._gravCadenceMul = 1; m.patternState = pat; m.patternTimer = 0; m[flag] = false;
        let at = -1, before = -1, pt = -1;
        for (let s = 0; s < 120 && m.patternState === pat; s++) { const was = !!m[flag]; step(); const f = idx('gravitos', _gravitosOnceFrame(m, 'gravitos')); if (!was && m[flag]) { at = f; pt = Math.round(m.patternTimer); break; } before = f; }
        o['W_' + pat] = { atFire: at, before, firedAtPT: pt };
      }
      // S. form 2 Singularity / Collapse Rain: the picker at the resolve (and one step before)
      { const m = boss('gravitos'); m._phaseSprite = 'gravitos2'; m._gravCadenceMul = 1.2; const out = {};
        for (const [pat, steps] of [['singularity', 330], ['collapseRain', 84]]) { m.patternState = pat; const at = _gravTeleMs(m, steps * 1000 / 60);
          m.patternTimer = at + 1; const fAt = idx('gravitos2star', _gravitosOnceFrame(m, 'gravitos2star')); m.patternTimer = at - _gravTeleMs(m, 1000 / 60); const fBefore = idx('gravitos2star', _gravitosOnceFrame(m, 'gravitos2star'));
          m.patternTimer = 0; const f0 = idx('gravitos2star', _gravitosOnceFrame(m, 'gravitos2star')); out[pat] = { atResolve: fAt, stepBefore: fBefore, atCast: f0 }; }
        o.S = out; }
      // C/D read poses on the controlled clock: a held world (the hit-stop this harness holds) freezes boss poses on purpose
      const oHN = window._lxHeldNow, oHS = window._lxHeldShift; window._lxHeldNow = () => performance.now(); window._lxHeldShift = () => 0;
      // C. a contact hit (the pose starts on the next draw)
      for (const [type, key, pick] of [['towerArbiter', 'towerArbiter', (m) => _bossAttackFrame('towerArbiter', m)], ['gravitos', 'gravitos', (m) => _gravitosContactFrame(m, 'gravitos')], ['mooma', 'mooma', (m) => _bossAttackFrame('mooma', m)]]) {
        const m = boss(type); m._animSt = null; m._phaseSprite = null; const t0 = tc; m.atkAnimUntil = t0 + 650; m._lxContactAt = t0;
        const seq = []; for (let e = 0; e <= 600; e += 4) { tc = t0 + e; seq.push([e, idx(key, pick(m))]); }
        const at120 = (seq.find((x) => x[0] >= 124) || [0, -1])[1], at112 = (seq.find((x) => x[0] >= 112) || [0, -1])[1], k = (typeof _lxBossKeyFrame === 'function') ? _lxBossKeyFrame(key, BOSS_ATTACK_FRAMES[key].length, ft(key)) : ({ towerArbiter: 6, gravitos: 5, mooma: 5 })[key];   /* the previous build has no resolver */
        o['C_' + type] = { key: k, at0: seq[0][1], at112, at120, seq: seq.filter((x, i) => i === 0 || x[1] !== seq[i - 1][1]).map((x) => x[0] + ':f' + x[1]).join(' ') };
      }
      // D. the brace-dash, begun while an earlier attack loop is mid-cycle
      { const m = boss('legosaurus'); m.x = player.x + 420; m.facing = -1; m._bdCd = 0; m._braceDashing = false; m._animSt = 'attack'; m._animStAt = tc - 600; m._bigMeleeCd = 1e9;
        step(); const started = !!m._braceDashing; const t0 = tc; const f0 = idx('legosaurusdash', _bossAttackFrame('legosaurusdash', m));
        tc = t0 + 860; const f860 = idx('legosaurusdash', _bossAttackFrame('legosaurusdash', m));
        o.D = { started, animSt: m._animSt, atBrace: f0, at860: f860 }; }
      window._lxHeldNow = oHN; window._lxHeldShift = oHS;
    } finally { P.now = oNow; clearInterval(window.__kfHold); game.monsters.length = 0; }
    return o;
  });
  const cal = fs.readFileSync(path.join(ROOT, 'data/anim_calib.js'), 'utf8').replace(/\r/g, '');
  const C = JSON.parse(cal.match(/window\.LX_ANIM_CALIB = ([\s\S]*?);\nwindow\.LX_ATK_HITBOX/)[1]);
  check(Object.values(R.decoded).every((v) => v >= 9), 'the sets under test decoded', R.decoded);
  check(R.L1.atRelease === 6 && R.L1.before >= 0 && R.L1.before < 6, `L. form 1 laser: the lightning (f6) is on screen the step the bolts release (${R.L1.charge} pattern-ms)`, R.L1);
  check(R.L2.atRelease === 7 && R.L2.before >= 0 && R.L2.before < 7, 'L. form 2 laser: the chest blast (f7) is on screen the step the bolts release', R.L2);
  check(R.W_wave.atFire === 5 && R.W_wave.before < 5, 'W. the wave fires on the punch lunge (f5)', R.W_wave);
  check(R.W_blackhole.atFire === 5 && R.W_blackhole.before < 5, 'W. the blackhole fires on the punch lunge (f5)', R.W_blackhole);
  check(R.S.singularity.atResolve === 6 && R.S.singularity.stepBefore < 6 && R.S.collapseRain.atResolve === 6 && R.S.collapseRain.stepBefore < 6, 'S. form 2 Singularity and Collapse Rain: the star burst (f6) starts at the resolve', R.S);
  for (const t of ['towerArbiter', 'gravitos', 'mooma']) { const c = R['C_' + t]; check(c.key >= 0 && c.at120 === c.key && c.at112 < c.key && c.at0 >= 0 && c.at0 < c.key, `C. ${t}: a contact hit shows its key frame (f${c.key}) 120 ms after (+-8), led into by its windup`, c); }
  check(R.D.started && R.D.atBrace === 0 && R.D.at860 === 2, "D. Legosaurus's dash set restarts at the brace: f0 then, f2 as the launch comes (850 ms)", R.D);
  const HAND = { gravitos: 1, gravitoslaser: 1, gravitos2laser: 1, gravitos2star: 1, legosaurusdash: 1, towerArbiter: 1 };
  check(Object.keys(HAND).every((k) => C[k] && C[k].attack && !C[k].attack.ftAuto && R.ft[k] === C[k].attack.ft.join('/')), 'H. the hand-set timings are unchanged and are what the game reads', R.ft);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
