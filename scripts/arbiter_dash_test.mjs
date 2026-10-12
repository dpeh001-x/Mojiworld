// THE ARBITER LUNGES IN HIS OWN SPRITE AND WALKS ON HIS FEET (per user, on a video of him sliding across the floor in one frozen pose: "when walking the
// sprites does not play ... he slides across the map which is not what was intended, he needs to play the sprite"; "if there is a dash he needs a specific
// sprite for that"; "if you generate it ensure no cutoffs"; "not well feathered for the cutoff edges and not well calibrated").
//   art      : the dash set (9 frames, 2100x1300) and the walk set (9 frames, the idle's 1500x1300) have no ink on the left / right / top edge, none below the
//              floor row, and stand on it (lowest ink = row 1299); the swing's column / verdict frames carry no hard clip line (no straight run of solid
//              ink on their outermost column / row)
//   tables   : the walk shares the idle's calibration and hit region (it is the idle's canvas); the dash is calibrated to the idle's body (s x its 2100 px canvas's
//              1.6 size cap); frame index 9 / 9, animator manifest, resize manifest, offline list
//   live     : the lunge plays brace frames 0-4 (held to the release), the charge frames 5-7 while he travels 300+ px, then the settle 7 -> 8 and no
//              swing frame after it; no frame of his old held pose or swing loop is drawn during it. The dash's first frame draws at the idle's body height
//              and feet line (the set is calibrated to it). Moved on the walk path, he plays his walk frames (6+ distinct), one cycle per ~120 px, at the
//              idle's body height
//   node scripts/arbiter_dash_test.mjs [port]      (MOJI_SERVE_ROOT / MOJI_GAME_FILE override the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { readFileSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json'));
const sharp = require('sharp'); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10331);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 380) : '')); };
const px = async (rel) => { const { data, info } = await sharp(path.join(ROOT, rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height }; };
const inkRows = (r) => { let y0 = r.H, y1 = -1; for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) if (r.d[(y * r.W + x) * 4 + 3] > 40) { if (y < y0) y0 = y; y1 = y; } return { y0, y1 }; };
const edge = (r) => { let L = 0, R = 0, T = 0; for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) if (r.d[(y * r.W + x) * 4 + 3] > 60) { if (x < 3) L++; if (x >= r.W - 3) R++; if (y < 3) T++; } return { L, R, T }; };
const clipLines = (r) => {   // a straight run of solid ink on the outermost column / row of the ink box = a clip line ludo left on a burst
  let x0 = r.W, x1 = -1, y0 = r.H; for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) if (r.d[(y * r.W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
  const col = (x) => { let n = 0; for (let y = 0; y < r.H; y++) if (r.d[(y * r.W + x) * 4 + 3] > 150) n++; return n; }, row = (y) => { let n = 0; for (let x = 0; x < r.W; x++) if (r.d[(y * r.W + x) * 4 + 3] > 150) n++; return n; };
  return { L: col(x0) > 60, R: col(x1) > 60, T: row(y0) > 60 };
};
// ---- art
const bad = { dashEdge: [], dashFloor: [], walkEdge: [], walkFloor: [], size: [], clip: [] };
for (let i = 0; i < 9; i++) {
  const d = await px(`Sprites/bosses/attack/towerArbiterdash_${i}.webp`), w = await px(`Sprites/bosses/walk/towerArbiter_${i}.webp`);
  if (d.W !== 2100 || d.H !== 1300) bad.size.push('dash ' + i + ' ' + d.W + 'x' + d.H); if (w.W !== 1500 || w.H !== 1300) bad.size.push('walk ' + i + ' ' + w.W + 'x' + w.H);
  const de = edge(d), we = edge(w); if (de.L || de.R || de.T) bad.dashEdge.push(i + ':' + JSON.stringify(de)); if (we.L || we.R || we.T) bad.walkEdge.push(i + ':' + JSON.stringify(we));
  const dr = inkRows(d), wr = inkRows(w); if (dr.y1 !== 1299) bad.dashFloor.push(i + ':' + dr.y1); if (wr.y1 !== 1299) bad.walkFloor.push(i + ':' + wr.y1);
}
for (const f of ['attack/towerArbitercolumn_5', 'attack/towerArbitercolumn_6', 'attack/towerArbitercolumn_7', 'attack/towerArbiterverdict_5']) { const c = clipLines(await px(`Sprites/bosses/${f}.webp`)); if (c.L || c.R || c.T) bad.clip.push(f + ' ' + JSON.stringify(c)); }
ok('the dash set is nine 2100x1300 frames and the walk set nine on the idle\'s 1500x1300 canvas', !bad.size.length, bad.size);
ok('no dash frame and no walk frame has ink on the left, right or top edge (no cutoffs)', !bad.dashEdge.length && !bad.walkEdge.length, { dash: bad.dashEdge, walk: bad.walkEdge });
ok('every dash and walk frame stands on the floor row, with nothing below it', !bad.dashFloor.length && !bad.walkFloor.length, { dash: bad.dashFloor, walk: bad.walkFloor });
ok('the swing\'s column and verdict frames the burst clipped carry no hard clip line any more', !bad.clip.length, bad.clip);
// ---- tables
const cal = readFileSync(path.join(ROOT, 'data/anim_calib.js'), 'utf8'); const A = JSON.parse(cal.slice(cal.indexOf('window.LX_ANIM_CALIB = ') + 23, cal.indexOf('window.LX_ATK_HITBOX = ')).trim().replace(/;$/, '')), B = JSON.parse(cal.slice(cal.indexOf('window.LX_ATK_HITBOX = ') + 22).trim().replace(/;$/, ''));
ok('the walk shares the idle\'s hit region and is calibrated onto the idle\'s body (same canvas, size within 3%, centre within 0.03)', JSON.stringify(B.towerArbiter.walk) === JSON.stringify(B.towerArbiter.idle) && Math.abs(A.towerArbiter.walk.s / A.towerArbiter.idle.s - 1) < 0.03 && Math.abs(A.towerArbiter.walk.dx - A.towerArbiter.idle.dx) < 0.03 && Math.abs(A.towerArbiter.walk.dy - A.towerArbiter.idle.dy) < 0.02, [A.towerArbiter.walk, A.towerArbiter.idle]);
const da = A.towerArbiterdash && A.towerArbiterdash.attack; ok('the dash is calibrated to the idle\'s body: s = 469/512 (its canvas draws at the 1.6 size cap), the idle\'s x and a matching dy; the idle\'s hit region', !!da && Math.abs(da.s - 0.9155) < 0.003 && da.dx === A.towerArbiter.idle.dx && Math.abs(da.dy - 0.0137) < 0.002 && JSON.stringify(B.towerArbiterdash.attack) === JSON.stringify(B.towerArbiter.idle), da);
const fi = readFileSync(path.join(ROOT, 'data/sprite_frame_index.js'), 'utf8'); const FI = JSON.parse(fi.slice(fi.indexOf('{'), fi.lastIndexOf('}') + 1)).frames;
ok('the frame index counts nine dash frames and nine walk frames', FI['bosses/attack'].towerArbiterdash === 9 && FI['bosses/walk'].towerArbiter === 9, [FI['bosses/attack'].towerArbiterdash, FI['bosses/walk'].towerArbiter]);
const man = new Set(JSON.parse(readFileSync(path.join(ROOT, 'data/assets_manifest.json'), 'utf8')));
ok('the offline list carries every dash frame', Array.from({ length: 9 }, (_, i) => `Sprites/bosses/attack/towerArbiterdash_${i}.webp`).every((f) => man.has(f)));
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
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {};
    applyClass('warrior'); player.level = 60; player._god = true; player.invulnerable = 9e9; player.maxHp = player.hp = 9e9;
    Object.assign(LX_PERF, { lowFx: false, lowFxUntil: 0, slowFrames: 0, veryLowFx: false, veryLowFxUntil: 0 });
    loadMap('tower_b5', 200); await W8(1500); game.paused = false; game.monsters = [];
    // the lazy loader asks for his sets with the map; the picker needs every frame of the dash set decoded
    for (let i = 0; i < 300 && !(BOSS_ATTACK_FRAMES.towerArbiterdash && _lxFtReadyN(BOSS_ATTACK_FRAMES.towerArbiterdash) >= 9 && _lxFtReadyN(BOSS_WALK_FRAMES.towerArbiter) >= 9); i++) { try { _lxBossArtWant('towerArbiter', true); } catch (e) {} await W8(100); }
    const m = spawnMonster(1000, game.mapData.worldHeight - 260, 'towerArbiter', true, false); m.currentHp = m.maxHp = 9e9; m._bigMeleeCd = 1e9; delete m.traits.columnStrike; m._hgCd = 1e9;
    const o = window._lxDrawSoft, rects = {}; let cur = null;
    window._lxDrawSoft = function (c, img, dx, dy, dw, dh, opts) { try { const s = String((img && (img.src || (img._lxSrc && img._lxSrc.src))) || ''); const mm = s.match(/bosses\/(idle|walk|attack)\/(towerArbiter\w*)_(\d+)\.webp/);
      if (mm) { cur = mm[1] + '/' + mm[2] + '_' + mm[3]; const t = c.getTransform(); rects[cur] = rects[cur] || { n: 0, h: [], b: [] }; rects[cur].n++; rects[cur].h.push(dh * t.d); rects[cur].b.push(t.f + t.d * (dy + dh)); } } catch (e) {} return o.apply(this, arguments); };
    const frame = () => new Promise((r) => requestAnimationFrame(r)), face = () => { player.x = Math.max(120, m.x - 380); player.vx = 0; player.y = m.y; player._god = true; m.aggroTarget = player; };
    // 1. he stands still: his idle body, sampled
    for (let t = 0; t < 70; t++) { cur = null; face(); await frame(); }
    // 2. the picker, phase by phase (deterministic): brace progress, dash progress, the settle
    const fr = BOSS_ATTACK_FRAMES.towerArbiterdash, idx = (f) => fr.indexOf(f), fake = (q) => Object.assign({ type: 'towerArbiter', traits: { hourglassCharge: 2400, hourglassDashMs: 700 } }, q), now = performance.now();
    const pick = {
      brace: [0, 0.05, 0.1, 0.18, 0.26, 0.5, 1].map((p) => idx(_arbiterDashFrame(fake({ _hgCharging: true, _hgPhase: 'brace', _hgT: 2400 * (1 - p) })))),
      dash: [0, 0.2, 0.5, 0.8, 0.99].map((p) => idx(_arbiterDashFrame(fake({ _hgCharging: true, _hgPhase: 'dash', _hgEl: 700 * p })))),
      settle: [idx(_arbiterDashFrame(fake({ _hgCharging: false, _hgRecoverUntil: now + 170 }))), idx(_arbiterDashFrame(fake({ _hgCharging: false, _hgRecoverUntil: now + 40 })))],
    };
    // 3. the first brace frame held on screen: the dash set's calibration against the idle's body
    for (let t = 0; t < 40; t++) { cur = null; face(); m._hgCharging = true; m._hgPhase = 'brace'; m._hgT = 2400; m.vx = 0; await frame(); }
    m._hgCharging = false; m._hgT = 0; m._hgRecoverUntil = 0; m.atkAnimUntil = 0; m._bossAtkUntil = 0;
    // 4. the real lunge
    m._hgCd = 0; const log = []; let started = false, done = false;
    for (let t = 0; t < 700 && !done; t++) {
      cur = null; face(); await frame(); if (!game.monsters.includes(m)) break;
      const hg = m._hgCharging ? m._hgPhase : ''; if (hg) started = true;
      log.push({ x: Math.round(m.x), hg, art: cur, key: m._bossAtkKey || '' }); if (started && !hg && (m._hgRecoverUntil || 0) < performance.now() - 400) done = true;
    }
    // 5. the walk: drive him (he has no chase AI of his own), count the walk frames and the distance per cycle
    m._hgCd = 1e9; m.facing = -1; m.x = Math.min(game.mapData.worldWidth - 400, 2200); m.vx = 0; m._awD = 0; const walk = []; let px = m.x;
    for (let t = 0; t < 200; t++) { cur = null; player.x = 150; player.y = m.y; m.vx = -1.7; m.facing = -1; await frame(); walk.push({ x: m.x, art: cur, mv: Math.abs(m.x - px) > 0.3 }); px = m.x; }
    window._lxDrawSoft = o;
    // the pacing itself, deterministic: a stand-in boss walked 6 px per game step reads phase 4.5 of 9 at 60 px and wraps to 0 at 120 px (the live draws are not all caught by the hook once the bake cache takes over)
    const t0 = game.time, fm = { type: 'towerArbiter', x: 0 }, ph = []; for (let i = 0; i <= 40; i++) { game.time = 1e6 + i; fm.x = i * 6; ph.push(_arbWalkPos(fm, 9)); } game.time = t0;
    const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const stat = (k) => rects[k] ? { n: rects[k].n, h: med(rects[k].h), b: med(rects[k].b) } : null;
    const ik = Object.keys(rects).filter((k) => k.startsWith('idle/towerArbiter_')), ih = ik.flatMap((k) => rects[k].h), ib = ik.flatMap((k) => rects[k].b);
    return { ph, log, walk, pick, idle: ik.length ? { n: ih.length, h: med(ih), b: med(ib) } : null, dash0: stat('attack/towerArbiterdash_0') };
  });
  if (process.env.DBG) { console.log('LOG', JSON.stringify(R.log.filter((r,i)=>i%6===0).map((r)=>[r.x,r.hg,(r.art||'').replace(/.*towerArbiter/,'')]))); console.log('WALK', JSON.stringify(R.walk.map((r)=>(r.art||'-').replace(/towerArbiter/,'').replace('attack/','A').replace('walk/','W').replace('idle/','I')).join(' '))); }
  const dashIdx = (a) => { const q = /towerArbiterdash_(\d)/.exec(a || ''); return q ? +q[1] : null; };
  const braceSeen = [...new Set(R.log.filter((r) => r.hg === 'brace').map((r) => dashIdx(r.art)).filter((f) => f != null))].sort((a, b) => a - b);
  const dashSeen = [...new Set(R.log.filter((r) => r.hg === 'dash').map((r) => dashIdx(r.art)).filter((f) => f != null))].sort((a, b) => a - b);
  const xs = R.log.filter((r) => r.hg === 'dash').map((r) => r.x), travel = xs.length ? Math.abs(xs[0] - xs[xs.length - 1]) : 0;
  const afterDash = R.log.slice(Math.max(0, R.log.findIndex((r) => r.hg === 'dash'))).filter((r) => !r.hg);
  ok('the frame picker gathers through dash frames 0-4 during the brace and holds the crouch', JSON.stringify(R.pick.brace) === JSON.stringify([0, 0, 1, 2, 3, 4, 4]), R.pick.brace);
  ok('it plays the charge frames 5, 6, 7 across the dash, and the settle 7 then 8', JSON.stringify(R.pick.dash) === JSON.stringify([5, 5, 6, 7, 7]) && JSON.stringify(R.pick.settle) === JSON.stringify([7, 8]), { dash: R.pick.dash, settle: R.pick.settle });
  ok('the AI stamps the dash set live through the brace and the charge, and the frames seen on screen are the right ones', R.log.some((r) => r.hg === 'brace' && r.key === 'towerArbiterdash') && R.log.some((r) => r.hg === 'dash' && r.key === 'towerArbiterdash') && braceSeen.length >= 1 && braceSeen.every((f) => f <= 4) && dashSeen.every((f) => f >= 5 && f <= 7), { braceSeen, dashSeen });
  ok('he travels 300+ px on the charge', travel >= 300, travel);
  ok('none of his old attack art (the swing loop, the held pose) is drawn from the brace to the end of the settle', !R.log.slice(R.log.findIndex((r) => r.hg === 'brace')).some((r) => /attack\/towerArbiter_\d/.test(r.art || '')) && afterDash.some((r) => /towerArbiterdash_8|idle\//.test(r.art || '')), R.log.filter((r) => /attack\/towerArbiter_\d/.test(r.art || '')).length);
  const idleH = R.idle && R.idle.h, d0 = R.dash0;
  ok('the dash\'s first frame draws at the idle\'s body: the same drawn body height (within 2%) and feet line (within 3 px)', !!(idleH && d0 && R.idle.n >= 20 && d0.n >= 20 && Math.abs(d0.h / idleH - 1) < 0.02 && Math.abs(d0.b - R.idle.b) < 3), { idle: R.idle, dash0: d0 });
  const wf = [...new Set(R.walk.map((r) => r.art).filter((a) => /walk\/towerArbiter_/.test(a || '')))];
  ok('moved on the walk path he plays his walk frames: six or more distinct ones, and idle frames are not drawn while he moves', wf.length >= 6 && !R.walk.filter((r) => r.mv).some((r) => /idle\//.test(r.art || '')), { distinct: wf.length });
  const ph = R.ph, wraps = ph.map((p, i) => i && p < ph[i - 1] ? i * 6 : 0).filter(Boolean);
  ok('one nine-frame walk cycle per 120 px walked, paced by distance (his feet do not skate)', Math.abs(ph[10] - 4.5) < 0.2 && JSON.stringify(wraps) === JSON.stringify([120, 240]), { p60: ph[10], wraps });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
