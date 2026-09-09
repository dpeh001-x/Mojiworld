// Live test: THE ARBITER'S TWO SWORD FORMS ARE WIRED, AND DRAW AT HIS OWN SIZE.
// ============================================================================
// Per user: "generate 2 new attack sprite animation sequences to show profound
// swordsmanship for towerarbiter ensure no cut offs, same in game scale, wire it
// to unique attacks of the towerarbiter".
//
// The art is animated FROM towerArbiter_0.webp and baked back onto his exact
// 1500x1300 canvas at his own content box, so "same in game scale" holds only if
// the sets ALSO carry his attack calibration — the boss draw looks calib up by the
// ART key, and a missing entry silently means s:1 against his authored s:1.77,
// i.e. a knight who shrinks by a third the instant he swings. That is the check
// that matters here, so it is measured on the game's own _visW/_visH rather than
// inferred from the files.
//   node scripts/arbiter_attack_sets_test.mjs [build.html]
import { chromium } from 'playwright-core'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn as _spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const _PORT = process.env.PERF_PORT || '9475';
const _srv = _spawn(process.execPath, [path.join(ROOT, 'serve.js'), _PORT], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1400));
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto('http://localhost:' + _PORT + '/' + (process.argv[2] || 'mojiworld_game.html') + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxBossAtkPose === 'function', { timeout: 60000 });
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none'; window._lxBootGateDone = true; const c = document.querySelector('#class-select-modal .cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} } const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none'; try { _prologueActive = false; } catch (e) {} });
await page.waitForTimeout(6000);
const r = await page.evaluate(async () => {
  player.level = 85; player.invulnerable = 9e9; player.hp = player.maxHp = 99999;
  try { loadMap('tower_b5', 300); } catch (e) {}
  await new Promise((res) => setTimeout(res, 900));
  game.paused = false; game.monsters.length = 0; game._superBossRef = null;
  { const o = document.getElementById('boss-intro-overlay'); if (o) o.classList.remove('on'); }
  spawnMonster(player.x + 300, player.y, 'towerArbiter', true);
  const m = game.monsters[game.monsters.length - 1];
  if (!m) return { err: 'no Arbiter' };
  m.evasion = 0; m._wardUntil = 0; m.invulnerable = true;
  const out = { frames: {}, sizes: {}, calib: {} };
  for (const k of ['towerArbiterverdict', 'towerArbitercolumn', 'towerArbiter']) {
    const set = (typeof BOSS_ATTACK_FRAMES !== 'undefined') ? BOSS_ATTACK_FRAMES[k] : null;
    out.frames[k] = set ? set.length : 0;
    out.calib[k] = _lxAnimCalib(k, 'attack');
  }
  // Two things make a fixed sleep wrong here, and both cost a red run before they
  // were pinned. (1) _visW/_visH are written by the boss DRAW, so a throttled frame
  // leaves the previous pose's numbers in place. (2) the Arbiter's own AI is live:
  // parked next to the player he fires his real bigMelee mid-measure and overwrites
  // the forced pose, so the column read back as the verdict. So: keep him on camera with his
  // own range, re-assert the pose every poll, and wait for a frame that actually drew
  // the key under test.
  const measure = async (poseKey, want) => {
    m._visW = 0; m._visH = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 4000) {
      // keep him ON CAMERA (off-screen he is culled and never writes _visW) and stop his
      // own attacks instead: a boss out of view cannot be measured, a boss on cooldown cannot
      // overwrite the pose under test.
      m.x = player.x + 300;
      m._bigMeleeCd = 99999; m._columnCd = 99999; m._bigMeleeFiring = false; m._columnFiring = false;
      if (poseKey) _lxBossAtkPose(m, poseKey, 240); else { m._bossAtkKey = null; m._bossAtkUntil = 0; }
      m._frameIsAttack = true; m.patternState = 'attack';
      await new Promise((res) => setTimeout(res, 60));
      if (m._visW > 0 && m._visH > 0 && (m._bossAtkKey || m.type) === want) break;
    }
    return { key: m._bossAtkKey || m.type, w: Math.round(m._visW || 0), h: Math.round(m._visH || 0) };
  };
  out.sizes.base = await measure(null, 'towerArbiter');
  out.sizes.verdict = await measure('swing', 'towerArbiterverdict');
  out.sizes.column = await measure('column', 'towerArbitercolumn');
  // a boss with no per-attack art must be untouched by the generalised resolver
  game.monsters.length = 0;
  spawnMonster(player.x + 300, player.y, 'echoKnight', true);
  const e = game.monsters[game.monsters.length - 1];
  if (e) { _lxBossAtkPose(e, 'swing', 60); out.other = { type: e.type, key: e._bossAtkKey || null }; }
  game.monsters.length = 0;
  return out;
});
await browser.close(); try { _srv.kill(); } catch (e) {}
if (r.err) { console.log('FAIL harness: ' + r.err); process.exit(1); }
console.log(JSON.stringify(r));
const b = r.sizes.base, v = r.sizes.verdict, c = r.sizes.column;
const near = (x, y) => x && y && y.h > 0 && Math.abs(x.h - y.h) / y.h < 0.08 && Math.abs(x.w - y.w) / y.w < 0.12;
ok('both sword sets load their nine frames', r.frames.towerArbiterverdict === 9 && r.frames.towerArbitercolumn === 9, r.frames);
ok('the big swing draws the VERDICT set', v.key === 'towerArbiterverdict', v);
ok('the column strike draws the COLUMN set', c.key === 'towerArbitercolumn', c);
ok('both carry the Arbiter\'s own attack calibration — without it the knight shrinks by a third mid-swing',
  r.calib.towerArbiterverdict && r.calib.towerArbitercolumn
  && r.calib.towerArbiterverdict.s === r.calib.towerArbiter.s
  && r.calib.towerArbitercolumn.s === r.calib.towerArbiter.s,
  { base: r.calib.towerArbiter && r.calib.towerArbiter.s, verdict: r.calib.towerArbiterverdict && r.calib.towerArbiterverdict.s, column: r.calib.towerArbitercolumn && r.calib.towerArbitercolumn.s });
ok('...so both render at the same in-game size as his base attack', near(v, b) && near(c, b), { base: b, verdict: v, column: c });
ok('each form has its own frame timing (they are different gestures, not one set twice)',
  r.calib.towerArbiterverdict && r.calib.towerArbitercolumn
  && JSON.stringify(r.calib.towerArbiterverdict.ft) !== JSON.stringify(r.calib.towerArbitercolumn.ft),
  { verdict: r.calib.towerArbiterverdict && r.calib.towerArbiterverdict.ft, column: r.calib.towerArbitercolumn && r.calib.towerArbitercolumn.ft });
ok('a boss with no per-attack art is untouched by the shared resolver', r.other && r.other.key === null, r.other);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
