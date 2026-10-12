// THE SOVEREIGN LUNGES IN HIS OWN SPRITE AND NEVER TELEPORTS MID-ATTACK (per user, on a video of him sliding across the floor: "ensure the sovereign does not slide while
// attacking as seen in the video"). His hourglass lunge (460 px in 320 ms) drew his swing art while it snapped across the floor; it now plays towerSovereigndash and eases.
//   art      : the dash set is nine 2200x1314 frames with no ink on the left / right / top edge, standing on the floor row (1313) with nothing below it
//   tables   : calibrated (s / dx / dy present, the idle's hit region), frame index 9, offline list
//   live     : the picker gathers through dash frames 0-4 in the brace, plays 5-7 across the (eased) dash, settles 7 -> 8; the lunge stamps the set and travels 400+ px; none of the
//              swing set's own attack frames (towerSovereign_N) is drawn from the brace to the settle; his spire-step (a teleport) does not fire during the lunge or a live attack pose
//   node scripts/sovereign_dash_test.mjs [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { readFileSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json'));
const sharp = require('sharp'); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10341);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 380) : '')); };
const px = async (rel) => { const { data, info } = await sharp(path.join(ROOT, rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height }; };
const lowInk = (r) => { let y1 = -1; for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) if (r.d[(y * r.W + x) * 4 + 3] > 40) y1 = y; return y1; };
const edge = (r) => { let L = 0, R = 0, T = 0; for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) if (r.d[(y * r.W + x) * 4 + 3] > 60) { if (x < 3) L++; if (x >= r.W - 3) R++; if (y < 3) T++; } return { L, R, T }; };
// ---- art
const bad = { size: [], edge: [], floor: [] };
for (let i = 0; i < 9; i++) { const d = await px(`Sprites/bosses/attack/towerSovereigndash_${i}.webp`); if (d.W !== 2200 || d.H !== 1314) bad.size.push(i + ' ' + d.W + 'x' + d.H); const e = edge(d); if (e.L || e.R || e.T) bad.edge.push(i + ':' + JSON.stringify(e)); if (lowInk(d) !== 1313) bad.floor.push(i + ':' + lowInk(d)); }
ok('the dash set is nine 2200x1314 frames', !bad.size.length, bad.size);
ok('no dash frame has ink on the left, right or top edge (no cutoffs)', !bad.edge.length, bad.edge);
ok('every dash frame stands on the floor row, with nothing below it', !bad.floor.length, bad.floor);
// ---- tables
const cal = readFileSync(path.join(ROOT, 'data/anim_calib.js'), 'utf8'); const A = JSON.parse(cal.slice(cal.indexOf('window.LX_ANIM_CALIB = ') + 23, cal.indexOf('window.LX_ATK_HITBOX = ')).trim().replace(/;$/, '')), B = JSON.parse(cal.slice(cal.indexOf('window.LX_ATK_HITBOX = ') + 22).trim().replace(/;$/, ''));
const da = A.towerSovereigndash && A.towerSovereigndash.attack; ok('the dash is calibrated (s, dx, dy) and carries the idle\'s hit region', !!da && da.s > 0.3 && da.s < 2 && typeof da.dx === 'number' && typeof da.dy === 'number' && JSON.stringify(B.towerSovereigndash && B.towerSovereigndash.attack) === JSON.stringify(B.towerSovereign.idle), da);
const fi = readFileSync(path.join(ROOT, 'data/sprite_frame_index.js'), 'utf8'); const FI = JSON.parse(fi.slice(fi.indexOf('{'), fi.lastIndexOf('}') + 1)).frames;
ok('the frame index counts nine dash frames', FI['bosses/attack'].towerSovereigndash === 9, FI['bosses/attack'].towerSovereigndash);
const man = new Set(JSON.parse(readFileSync(path.join(ROOT, 'data/assets_manifest.json'), 'utf8')));
ok('the offline list carries every dash frame', Array.from({ length: 9 }, (_, i) => `Sprites/bosses/attack/towerSovereigndash_${i}.webp`).every((f) => man.has(f)));
// ---- live
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxDrawSoft === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'story-beat-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {};
    applyClass('warrior'); player.level = 60; player._god = true; player.invulnerable = 9e9; player.maxHp = player.hp = 9e9;
    Object.assign(LX_PERF, { lowFx: false, lowFxUntil: 0, slowFrames: 0, veryLowFx: false, veryLowFxUntil: 0 });
    loadMap('tower_b10', 200); await W8(1500); game.paused = false; game.monsters = [];
    for (let i = 0; i < 300 && !(BOSS_ATTACK_FRAMES.towerSovereigndash && _lxFtReadyN(BOSS_ATTACK_FRAMES.towerSovereigndash) >= 9); i++) { try { _lxBossArtWant('towerSovereign', true); } catch (e) {} await W8(100); }
    const m = spawnMonster(1200, game.mapData.worldHeight - 260, 'towerSovereign', true, false); m.currentHp = m.maxHp = 9e9; m._bigMeleeCd = 1e9; delete m.traits.columnStrike; m._hgCd = 1e9; m._expeditionFinalBoss = true;
    const o = window._lxDrawSoft; let cur = null;
    window._lxDrawSoft = function (c, img) { try { const s = String((img && (img.src || (img._lxSrc && (img._lxSrc.src || img._lxSrc)))) || ''), mm = s.match(/bosses\/(idle|walk|attack)\/(towerSovereign\w*)_(\d+)\.webp/); if (mm) cur = mm[1] + '/' + mm[2] + '_' + mm[3]; } catch (e) {} return o.apply(this, arguments); };
    const frame = () => new Promise((r) => requestAnimationFrame(r)), face = () => { player.x = Math.max(120, m.x - 380); player.vx = 0; player.y = m.y; player._god = true; m.aggroTarget = player; };
    for (let t = 0; t < 30; t++) { face(); await frame(); }
    // the picker, phase by phase (deterministic): brace progress, dash progress, the settle
    const fr = BOSS_ATTACK_FRAMES.towerSovereigndash, idx = (f) => fr.indexOf(f), fake = (q) => Object.assign({ type: 'towerSovereign', traits: { hourglassCharge: 1500, hourglassDashMs: 320 } }, q), now = performance.now();
    const pick = {
      brace: [0, 0.05, 0.1, 0.18, 0.26, 0.5, 1].map((p) => idx(_arbiterDashFrame(fake({ _hgCharging: true, _hgPhase: 'brace', _hgT: 1500 * (1 - p) })))),
      dash: [0, 0.2, 0.5, 0.8, 0.99].map((p) => idx(_arbiterDashFrame(fake({ _hgCharging: true, _hgPhase: 'dash', _hgEl: 320 * p })))),
      settle: [idx(_arbiterDashFrame(fake({ _hgCharging: false, _hgRecoverUntil: now + 170 }))), idx(_arbiterDashFrame(fake({ _hgCharging: false, _hgRecoverUntil: now + 40 })))],
    };
    // the real lunge, with his spire-step held ready (it must not fire while he lunges or holds an attack pose)
    m._hgCd = 0; const log = []; let started = false, done = false, steps0 = m._sovStepCount | 0, stepsDuring = 0;
    for (let t = 0; t < 900 && !done; t++) {
      cur = null; face(); m._sovStepAt = 0; const s0 = m._sovStepCount | 0; await frame(); if (!game.monsters.includes(m)) break;
      const hg = m._hgCharging ? m._hgPhase : '', live = !!(m._bossAtkKey && (game.time | 0) < (m._bossAtkUntil | 0)); if (hg) started = true; if ((m._sovStepCount | 0) > s0 && (hg || live)) stepsDuring++;
      log.push({ x: Math.round(m.x), hg, art: cur, key: m._bossAtkKey || '' }); if (started && !hg && (m._hgRecoverUntil || 0) < performance.now() - 400) done = true;
    }
    window._lxDrawSoft = o; return { log, pick, stepsDuring, ease: !!m.traits.hourglassEase };
  });
  const dashIdx = (a) => { const q = /towerSovereigndash_(\d)/.exec(a || ''); return q ? +q[1] : null; };
  const braceSeen = [...new Set(R.log.filter((r) => r.hg === 'brace').map((r) => dashIdx(r.art)).filter((f) => f != null))].sort((a, b) => a - b);
  const dashSeen = [...new Set(R.log.filter((r) => r.hg === 'dash').map((r) => dashIdx(r.art)).filter((f) => f != null))].sort((a, b) => a - b);
  const xs = R.log.filter((r) => r.hg === 'dash').map((r) => r.x), travel = xs.length ? Math.abs(xs[0] - xs[xs.length - 1]) : 0;
  ok('the frame picker gathers through dash frames 0-4 during the brace and holds the crouch', JSON.stringify(R.pick.brace) === JSON.stringify([0, 0, 1, 2, 3, 4, 4]), R.pick.brace);
  ok('it plays the charge frames 5, 6, 7 across the dash, and the settle 7 then 8', JSON.stringify(R.pick.dash) === JSON.stringify([5, 5, 6, 7, 7]) && JSON.stringify(R.pick.settle) === JSON.stringify([7, 8]), { dash: R.pick.dash, settle: R.pick.settle });
  ok('the lunge stamps the dash set live through the brace and the charge, and the frames seen on screen are the right ones', R.log.some((r) => r.hg === 'brace' && r.key === 'towerSovereigndash') && R.log.some((r) => r.hg === 'dash' && r.key === 'towerSovereigndash') && braceSeen.length >= 1 && braceSeen.every((f) => f <= 4) && dashSeen.every((f) => f >= 4 && f <= 7) && dashSeen.filter((f) => f >= 5).length >= 2, { braceSeen, dashSeen });   // the first dash tick can still show the last brace frame (the draw lags the clock by a frame)
  ok('he travels 400+ px on the charge, eased (the trait is on)', travel >= 400 && R.ease, { travel, ease: R.ease });
  ok('none of the swing set\'s attack frames is drawn from the brace to the end of the settle', !R.log.slice(R.log.findIndex((r) => r.hg === 'brace')).some((r) => /attack\/towerSovereign_\d/.test(r.art || '')), R.log.filter((r) => /attack\/towerSovereign_\d/.test(r.art || '')).length);
  ok('his spire-step (the teleport) does not fire during the lunge or a live attack pose', R.stepsDuring === 0, R.stepsDuring);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
