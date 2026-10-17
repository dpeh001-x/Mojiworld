// The Tower Sovereign does not balloon while a new set bakes, and every set is calibrated to one body (v0.30.1761 sov-standin).
//   node scripts/sovereign_standin_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Per user (from a tester): "sometimes sovereign enlarges then goes back to normal, ensure the main head and body size is properly calibrated".
// Cause, measured through the real draw: while an attack set is still baking, the boss draws its LAST canvas (the idle's) as a stand-in (_lxBossStandIn) - and calibrated it with the
// stamped set's key. towerSovereignswing has no 'idle' entry, so the default {s:1} drew the idle pose at 1.0 against its own 0.59: 69% larger until the bake landed, then back.
// This proves (1) a held pose keeps the calibration it was drawn with, (2) the real swing frame afterwards still takes the swing's, (3) every draw of a forced attack in turn is scaled by the
// calibration of the art it actually draws, and (4) the nine sets' rest poses are one size (figure height x calibration s, within 4%): the head and body calibration the user asked about.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10598';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let R = null; const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 560 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.clock.install();
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {} if (!player.cls) applyClass('warrior'); player.level = 99; player._god = true; player.invulnerable = 1e9; player._gravitosCineSeen = true;
    try { for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true; } catch (e) {}
    game.paused = false; loadMap('tower_b10', 200); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    game.monsters = [];
    const m = spawnMonster(1200, game.mapData.worldHeight - 260, 'towerSovereign', true, false); window.__m = m; m.currentHp = m.maxHp = 9e9; m._bigMeleeCd = 1e9; try { delete m.traits.columnStrike; } catch (e) {} m._hgCd = 1e9; m._introDone = true; m.aggroTarget = null;
    Object.defineProperty(m, 'vx', { get: () => 0, set: () => {}, configurable: true });
    window.__rec = []; window.__on = false;
    const od = window._drawBossSprite; window._drawBossSprite = function (img, mm) { if (mm === m) { window.__on = true; try { return od.apply(this, arguments); } finally { window.__on = false; } } return od.apply(this, arguments); };
    const os = window._lxDrawSoft; window._lxDrawSoft = function (c, img, x, y, w, h) { if (window.__on) { try { const t = c.getTransform(); const s = String((img && (img._lxSrc && (img._lxSrc.src || img._lxSrc))) || (img && img.src) || '');
        const mm = s.match(/bosses\/(idle|walk|attack)\/(towerSovereign\w*)_(\d+)\.webp/); window.__rec.push({ n: window.__step | 0, state: mm ? mm[1] : null, key: mm ? mm[2] : null, i: mm ? +mm[3] : null, tag: img && img.tagName, sc: Math.abs(t.d), h }); } catch (e) {} } return os.apply(this, arguments); };
    window.__step = 0;
    window.__keep = () => { const m = window.__m; m.currentHp = m.maxHp; player.hp = getMaxHp(); player.invulnerable = 1e9; player.vx = 0; player.x = m.x - 260; m.x = 1200; m._hgCd = 1e9; m._bigMeleeCd = 1e9; m._sovSpireAt = 1e12; m.stunTimer = 0; window.__step++;
      for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el && el.style.display !== 'none') el.style.display = 'none'; } };
  });
  const SETS = ['towerSovereign', 'towerSovereignswing', 'towerSovereigncolumn', 'towerSovereigncollapse', 'towerSovereignvolley', 'towerSovereigndrain', 'towerSovereigndash'];
  for (let i = 0; i < 80; i++) { const ok = await page.evaluate((SETS) => { try { _lxBossArtWant('towerSovereign', true); } catch (e) {} return SETS.every((k) => BOSS_ATTACK_FRAMES[k] && _lxFtReadyN(BOSS_ATTACK_FRAMES[k]) >= 9) && BOSS_IDLE_FRAMES.towerSovereign && BOSS_WALK_FRAMES.towerSovereign && _lxFtReadyN(BOSS_IDLE_FRAMES.towerSovereign) >= 9; }, SETS); if (ok) break; await page.waitForTimeout(250); }
  for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__keep()); await page.waitForTimeout(250); }
  const now = await page.evaluate(() => Date.now()); await page.clock.pauseAt(now + 1500);
  const step = async () => { await page.evaluate(() => window.__keep()); await page.clock.runFor(33); };
  for (let i = 0; i < 40; i++) await step();   // idle: every set baked, the idle canvas is the boss's last drawn pose
  // (3) every attack in turn, drawn by the calibration of the art it draws
  const marks = [];
  for (const k of ['swing', 'column', 'collapse', 'volley', 'drain', 'dash']) {
    const m0 = await page.evaluate(() => window.__rec.length); marks.push(m0);
    for (let t = 0; t < 3; t++) {   // a stamp can be overwritten by the AI's own; stamp again until the set has been drawn
      await page.evaluate((k) => { _lxBossAtkPose(window.__m, k, 70); }, k); for (let i = 0; i < 50; i++) await step();
      if (await page.evaluate(([k, m0]) => window.__rec.slice(m0).some((d) => d.key === 'towerSovereign' + k), [k, m0])) break;
    }
  }
  const forced = await page.evaluate(() => window.__rec.slice());
  // (1)+(2) the held pose: a swing frame that is still raw (nothing of its set baked) while the idle canvas was the last pose drawn
  const U = await page.evaluate(async () => {
    const m = window.__m, out = {};
    const idleCv = BOSS_IDLE_FRAMES.towerSovereign[0]; out.idleTag = idleCv && idleCv.tagName;
    window.__rec.length = 0; window.__on = false;
    const sx = m.x - game.camera.x, sy = m.y - game.camera.y;
    m._bossAtkKey = null; m._bossAtkUntil = 0; _drawBossSprite(idleCv, m, sx, sy, false, true);   // the last pose drawn: the idle, under its own calibration
    out.idleScale = window.__rec.length ? window.__rec[window.__rec.length - 1].sc : null;
    const raw = new Image(); raw.decoding = 'sync'; raw.src = 'Sprites/bosses/attack/towerSovereignswing_0.webp'; try { await raw.decode(); } catch (e) {}
    raw._lxSet = [raw]; raw._lxSet._lxBaseMin = 1235; raw._lxFi = 0; raw._lxSt = 'attack';
    out.rawW = raw.naturalWidth; out.rawH = raw.naturalHeight;   // v0.30.x esrgan-bosses - the swing is stored at x1.667, cut to its ink: the stand-in cap reads its LONG side
    m._bossAtkKey = 'towerSovereignswing'; m._bossAtkUntil = (game.time | 0) + 200;
    window.__rec.length = 0;
    const stood = _lxBossStandIn(raw, m); out.stoodIn = stood === m._lxStandInCv && stood.tagName === 'CANVAS';
    window.__rec.length = 0; _drawBossSprite(raw, m, sx, sy, true, true);
    out.standScale = window.__rec.length ? window.__rec[window.__rec.length - 1].sc : null;
    // and the real swing frame afterwards takes the swing's own calibration
    m._lxSIcv = false; const swing0 = BOSS_ATTACK_FRAMES.towerSovereignswing[0];
    window.__rec.length = 0; _drawBossSprite(swing0, m, sx, sy, true, true);
    out.swingScale = window.__rec.length ? window.__rec[window.__rec.length - 1].sc : null;
    out.calIdle = _lxAnimCalib('towerSovereign', 'idle').s; out.calSwing = _lxAnimCalib('towerSovereignswing', 'attack').s; out.calSwingIdle = _lxAnimCalib('towerSovereignswing', 'idle').s;
    m._bossAtkKey = null; m._bossAtkUntil = 0;
    return out;
  });
  // (4) the rest poses: figure height (alpha > 128, fraction of the canvas) x the set's calibration s
  const C = await page.evaluate(() => {
    const sets = [['idle', BOSS_IDLE_FRAMES.towerSovereign, 'towerSovereign', 'idle'], ['walk', BOSS_WALK_FRAMES.towerSovereign, 'towerSovereign', 'walk'], ['attack', BOSS_ATTACK_FRAMES.towerSovereign, 'towerSovereign', 'attack'],
      ['swing', BOSS_ATTACK_FRAMES.towerSovereignswing, 'towerSovereignswing', 'attack'], ['column', BOSS_ATTACK_FRAMES.towerSovereigncolumn, 'towerSovereigncolumn', 'attack'], ['collapse', BOSS_ATTACK_FRAMES.towerSovereigncollapse, 'towerSovereigncollapse', 'attack'],
      ['volley', BOSS_ATTACK_FRAMES.towerSovereignvolley, 'towerSovereignvolley', 'attack'], ['drain', BOSS_ATTACK_FRAMES.towerSovereigndrain, 'towerSovereigndrain', 'attack'], ['dash', BOSS_ATTACK_FRAMES.towerSovereigndash, 'towerSovereigndash', 'attack']];
    const rows = {};
    for (const [name, fr, key, st] of sets) {
      const im = fr[0], w = im.naturalWidth || im.width, h = im.naturalHeight || im.height; const cv = document.createElement('canvas'); cv.width = 220; cv.height = Math.round(220 * h / w); const g = cv.getContext('2d'); g.drawImage(im, 0, 0, cv.width, cv.height);
      const d = g.getImageData(0, 0, cv.width, cv.height).data; let y0 = -1, y1 = -1;
      for (let y = 0; y < cv.height; y++) { let any = false; for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 128) { any = true; break; } if (any) { if (y0 < 0) y0 = y; y1 = y; } }
      rows[name] = { frac: (y1 - y0 + 1) / cv.height, s: _lxAnimCalib(key, st).s };
    }
    return rows; });
  R = { forced, marks, U, C };
  await page.clock.resume();
} finally { await browser.close(); srv.kill(); }
if (!R) { check(false, 'the harness produced results', errs.slice(0, 3)); process.exit(1); }
const U = R.U;
check(U.idleTag === 'CANVAS' && Math.max(U.rawW, U.rawH || 0) > 1400, 'harness: the idle frame is a baked canvas and the raw swing frame is over the stand-in cap', { idleTag: U.idleTag, rawW: U.rawW, rawH: U.rawH });
check(U.stoodIn === true, 'a raw swing frame with nothing baked is stood in for by the last pose drawn (the idle canvas)', U);
check(U.calSwingIdle === 1 && U.calIdle < 0.7 && U.calSwing > 0.8, 'the trap exists: the swing key has no idle entry (default 1) while the idle is 0.59', { calIdle: U.calIdle, calSwing: U.calSwing, calSwingIdle: U.calSwingIdle });
check(Math.abs(U.standScale - U.idleScale) < 0.002, 'the held idle pose is drawn at ITS OWN size under a live swing stamp (was 1.0 against 0.59: 69% larger until the bake landed)', { idleScale: U.idleScale, standScale: U.standScale });
check(Math.abs(U.swingScale - U.calSwing) < 0.002, 'the real swing frame afterwards takes the swing\'s own calibration', { swingScale: U.swingScale, calSwing: U.calSwing });
// every forced-attack draw is scaled by the calibration of the art it draws
const cal = Object.fromEntries(Object.entries(R.C).map(([k, v]) => [k, v.s]));   // the baked calibration, read from the page
const own = (d) => d.key === 'towerSovereign' ? { idle: 'idle', walk: 'walk', attack: 'attack' }[d.state] : (d.key || '').replace('towerSovereign', '');
const mism = R.forced.filter((d) => d.key && cal[own(d)] != null && Math.abs(d.sc - cal[own(d)]) > 0.004);
check(R.forced.length > 250 && mism.length === 0, 'six forced attacks in turn: every draw is scaled by the calibration of the art it draws', { draws: R.forced.length, mismatches: mism.slice(0, 4) });
const seen = new Set(R.forced.map((d) => own(d))); if (process.env.DBG) { const c = {}; for (const d of R.forced) { const k = own(d) + '/' + d.tag; c[k] = (c[k] || 0) + 1; } console.log('DBG', JSON.stringify(c), JSON.stringify(R.marks)); } check(['idle', 'swing', 'column', 'collapse', 'volley', 'drain', 'dash'].every((k) => seen.has(k)), 'all six attack sets and the idle were drawn', [...seen]);
// rest poses: one body size
const base = R.C.idle.frac * R.C.idle.s; const off = Object.entries(R.C).map(([k, v]) => [k, +(v.frac * v.s / base).toFixed(3)]).filter(([, r]) => Math.abs(r - 1) > 0.04);
check(off.length === 0, 'the nine sets\' rest poses are one size: figure height x calibration s within 4% of the idle\'s', { off, all: Object.fromEntries(Object.entries(R.C).map(([k, v]) => [k, +(v.frac * v.s / base).toFixed(3)])) });
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
