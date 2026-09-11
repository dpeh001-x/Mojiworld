// The Mirror Stalker's lunge: slower, shorter, and announced.
// ============================================================================
// Per user: "mirror stalker ... very awkward fast movement / repositioning,
// slightly slow it down and slightly reduce the distance and have a warning
// sign prior to that fast movement".
//
// A real towerStalker is spawned at lunge range with its cooldown forced due,
// and its brace + lunge are observed frame by frame:
//
//   1. lunge speed: |vx| during the dash ~16.7 px/frame (380 px / 380 ms)
//      - baseline 24.0 (460 px / 320 ms) -> fails
//   2. lunge distance: total travel clamps at ~380 px (baseline 460) -> fails
//   3. the warning: while the Stalker braces, the main context receives "!"
//      text draws (the overhead sign); none once it is dashing
//      - baseline has no _drawHgWarn -> fails
//   4. CONTROL (override, not global): a second Stalker whose traits carry no
//      overrides lunges at the handler defaults, 24 px/frame over 460 px -
//      proving the four bosses sharing this handler are untouched
//   5. CONTROL (boss gate): the sign is not drawn for a bracing boss
// Run: node scripts/stalker_lunge_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/stalker_lunge_test.mjs   (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });

const PORT = Number(process.env.PORT || 11501);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
const click = async (sel, ms) => {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
};
await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) {
  const r = await page.evaluate(() => { const o = document.getElementById('class-options');
    return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
  if (r) break;
  if (!(await click('#cs-nav-next'))) break;
  await page.waitForTimeout(1000);
}
await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
for (let i = 0; i < 45; i++) {
  for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
  if (st.p === false && !st.pro) break;
}
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.classList.add('fade'); });
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { loadMap('forest'); game.paused = false; player._god = true; } catch (e) {}
  await sleep(1200);

  // Observe one full brace + lunge of a stalker whose traits are `traits`.
  const observe = async (traits, label) => {
    game.monsters.length = 0; game.projectiles.length = 0;
    const m = spawnMonster(player.x + 300, player.y, 'towerStalker', false);
    if (!m) return { err: label + ': no spawn' };
    if (traits) m.traits = traits;
    m._hgCd = 0; m.speed = 0;                     // lunge due now; no walking to pollute travel
    const P = CanvasRenderingContext2D.prototype;
    const oText = P.fillText;
    let bangBrace = 0, bangDash = 0;
    P.fillText = function (...a) { if (this === ctx && a[0] === '!') { if (m._hgPhase === 'brace') bangBrace++; else if (m._hgPhase === 'dash') bangDash++; } return oText.apply(this, a); };
    let sawBrace = false, maxVx = 0, x0 = null, travel = 0;
    for (let i = 0; i < 260; i++) {
      game.paused = false; player.x = m.x - 300; player.vx = 0;   // stay at range, never inside 130px
      await sleep(16);
      if (m._hgCharging && m._hgPhase === 'brace') { sawBrace = true; x0 = m.x; }
      if (m._hgCharging && m._hgPhase === 'dash') { maxVx = Math.max(maxVx, Math.abs(m._hgVx || 0)); travel = m._hgTravel || travel; }
      if (sawBrace && !m._hgCharging && maxVx > 0) break;
    }
    P.fillText = oText;
    game.monsters.length = 0;
    return { label, sawBrace, maxVx: +maxVx.toFixed(2), travel: Math.round(travel), bangBrace, bangDash, fn: typeof _drawHgWarn === 'function' };
  };

  const stalker = await observe(null, 'stalker');
  const plain = await observe({ hourglassCharge: 2200 }, 'no-override control');

  // boss gate: a fake bracing boss must draw no sign
  let bossBang = null;
  if (typeof _drawHgWarn === 'function') {
    const P = CanvasRenderingContext2D.prototype; const oText = P.fillText; let n = 0;
    P.fillText = function (...a) { if (this === ctx && a[0] === '!') n++; return oText.apply(this, a); };
    _drawHgWarn({ isBoss: true, _hgCharging: true, _hgPhase: 'brace', _hgT: 500, _hgDir: 1, x: game.camera.x + 200, y: 200, w: 60, h: 90, traits: { hourglassCharge: 2200 } });
    _drawHgWarn({ isBoss: false, _hgCharging: true, _hgPhase: 'brace', _hgT: 500, _hgDir: 1, x: game.camera.x + 200, y: 200, w: 60, h: 90, traits: { hourglassCharge: 2200 } });
    P.fillText = oText;
    bossBang = n;   // expect exactly 1: the non-boss call draws, the boss call does not
  }
  return { stalker, plain, bossBang };
});
await browser.close(); server.kill();

const S = R.stalker, C = R.plain;
if (S.err || C.err) ok('scenario set up', false, S.err || C.err);
else {
  console.log(`  stalker: brace ${S.sawBrace}, |vx| ${S.maxVx} px/f, travel ${S.travel} px, "!" draws during brace ${S.bangBrace} / during dash ${S.bangDash}`);
  console.log(`  control (no overrides): |vx| ${C.maxVx} px/f, travel ${C.travel} px    boss-gate probe: ${R.bossBang}`);
  ok('CONTROL: the stalker actually braced and lunged', S.sawBrace && S.maxVx > 0 && S.travel > 0);
  ok('lunge is slower: ~16.7 px/frame (380 px over 380 ms)', S.maxVx > 15.5 && S.maxVx < 18, `${S.maxVx} (baseline 24.0)`);
  // The dash ends on TIME or distance, and its velocity is sized per 60 fps
  // frame; a headless sim ticking at ~20 ms runs only ~19 ticks in 380 ms and
  // under-travels (measured 317). The no-override control shows the identical
  // 19-tick behaviour (455 of 460), so this is the handler's pre-existing
  // tick-rate sensitivity, not the override. Assert a tick-tolerant band that
  // still excludes the 460 px baseline.
  ok('lunge is shorter: travel clamps near 380 px (tick-tolerant band)', S.travel >= 300 && S.travel <= 400, `${S.travel} px (baseline 460; ideal 380 at 60 fps)`);
  ok('a warning "!" is drawn while it braces, and not while it dashes', S.fn && S.bangBrace > 0 && S.bangDash === 0,
     S.fn ? `${S.bangBrace} during brace, ${S.bangDash} during dash` : '_drawHgWarn absent (unpatched build)');
  ok('CONTROL: without the overrides the handler defaults are unchanged (24 px/f, 460 px)',
     C.maxVx > 23 && C.maxVx < 25 && C.travel >= 440 && C.travel <= 480, `${C.maxVx} px/f, ${C.travel} px — the four bosses sharing this handler are untouched`);
  ok('CONTROL: the sign is not drawn for a bracing boss', R.bossBang === 1, R.bossBang == null ? 'fn absent' : `${R.bossBang} draw(s) for one boss + one non-boss call (want 1)`);
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
