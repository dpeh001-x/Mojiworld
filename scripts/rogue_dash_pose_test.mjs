// THE ROGUE DASH POSE — the authored original, with its legs joined to the torso
// ============================================================================
// v0.30.746 replaced this pose with a "ninjutsu lunge". The user looked at both and said "the
// original one was better use it", so it was reverted and the keyframe table below is pinned: those
// values are the ones chosen after seeing the alternative, and the next pass at them should be a
// decision rather than an accident.
//
// Then, on a zoom of the lower body: "the legs can be improved such that they dont cross so much"
// and "it looks disjointed from the main torso ... it should always be joined to the main torso".
// Both are faults in how the pose is APPLIED, not in the keys, so the keys are untouched and the
// correction lives in _heroVecRogueDashJoin:
//   the legs are ROOT-parented while the torso is a SPINE child, and this pose leans to 0.92 rad -
//   at 53 degrees the torso's base swings clear of the hips and a hole opens. HIP_FOLLOW shifts both
//   hips in proportion to the lean (so it is zero when upright), and LEG_SPLIT compresses the
//   symmetric scissor into a stride.
//
// The joined-ness is MEASURED, not asserted from the numbers: the pose is rendered across its nine
// frames and the check counts background pixels trapped inside the figure's own silhouette. Before
// the fix that was 12,071 px with 2,342 on the worst frame.
//
// scripts/_tmp_rogue_pose.mjs films the same frames as a strip if you want to look rather than count.
// Run: node scripts/rogue_dash_pose_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9782);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Taiga');
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/^\s*rogue\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 40; player.cls = 'rogue'; loadMap('forest', 300); });
await page.waitForTimeout(4000);

const R = await page.evaluate(() => {
  const keys = (typeof HERO_VEC_ROGUE_DASH_KEYS !== 'undefined') ? HERO_VEC_ROGUE_DASH_KEYS : null;
  if (!keys) return { err: 'HERO_VEC_ROGUE_DASH_KEYS is gone' };
  const out = { ps: keys.map((k) => k.p), n: keys.length };
  const smear = keys.find((k) => Math.abs(k.p - 0.58) < 1e-6) || null;
  out.smear = smear ? { spine: smear.spine, head: smear.head, armL: smear.armL, armR: smear.armR, legL: smear.legL, legR: smear.legR, limbSy: smear.limbSy } : null;
  out.headCancelsSpine = keys.every((k) => Math.abs(k.head + k.spine) < 0.02);
  out.bodySquashFree = keys.every((k) => k.sx === 1 && k.sy === 1);
  out.hipFollow = (typeof HERO_VEC_ROGUE_DASH_HIP_FOLLOW !== 'undefined') ? HERO_VEC_ROGUE_DASH_HIP_FOLLOW : null;
  out.legSplit = (typeof HERO_VEC_ROGUE_DASH_LEG_SPLIT !== 'undefined') ? HERO_VEC_ROGUE_DASH_LEG_SPLIT : null;
  let finite = true;
  for (let i = 0; i <= 60; i++) {
    const p = _heroVecRogueDashPose(i / 60);
    for (const v of Object.values(p)) if (!Number.isFinite(v)) finite = false;
  }
  out.finite = finite;
  // the hips must end up under the leaning torso, not behind it
  const mid = _heroVecRogueDashPose(0.58);
  out.hipLag = +(mid.legLX - mid.x).toFixed(2);

  // MEASURED joined-ness
  game.paused = true; player.cls = 'rogue'; player.facing = 1;
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 300;
  const c2 = cv.getContext('2d', { willReadFrequently: true });
  let gap = 0, worst = 0;
  for (let i = 0; i < 9; i++) {
    player._rogueDashPoseAt = (game.time | 0) - Math.round((i / 8) * 24);
    player._rogueDashPoseUntil = (game.time | 0) + 9999;
    c2.clearRect(0, 0, cv.width, cv.height);
    c2.save(); c2.scale(3.4, 3.4);
    try { _drawVectorHero(24, 6, c2, { animName: 'dash_rogue_ninja' }); } catch (e) {}
    c2.restore();
    const d = c2.getImageData(0, 0, cv.width, cv.height).data;
    const W = cv.width, H = cv.height;
    const on = (x, y) => d[(y * W + x) * 4 + 3] > 24;
    let f = 0;
    for (let x = 0; x < W; x++) {
      let top = -1, bot = -1;
      for (let y = 0; y < H; y++) if (on(x, y)) { if (top < 0) top = y; bot = y; }
      if (top < 0) continue;
      for (let y = top + 1; y < bot; y++) if (!on(x, y)) f++;
    }
    gap += f; if (f > worst) worst = f;
  }
  player._rogueDashPoseUntil = 0; game.paused = false;
  out.gap = gap; out.gapWorst = worst;
  return out;
});
await browser.close(); server.kill();
if (R.err) { console.log(R.err); process.exit(1); }
console.log(`keys at ${JSON.stringify(R.ps)}`);
console.log(`smear key ${JSON.stringify(R.smear)}`);
console.log(`hip follow ${R.hipFollow}, leg split ${R.legSplit}, hip lag behind the torso at the smear ${R.hipLag}px`);
console.log(`gap pixels trapped in the silhouette: ${R.gap} total, ${R.gapWorst} worst frame (before the fix: 12071 / 2342)\n`);

const S = R.smear || {};
const checks = [
  // the pose the user chose, pinned
  ['the five authored keys are intact', R.n === 5 && R.ps.join() === '0,0.24,0.58,0.78,1', R.ps.join()],
  ['the smear key keeps its 0.92 lean', S.spine === 0.92, String(S.spine)],
  ['the head still counter-rotates the spine exactly', R.headCancelsSpine === true],
  ['both arms still sweep forward together at the smear', S.armL === 2.05 && S.armR === 1.58, `armL ${S.armL} armR ${S.armR}`],
  ['the authored leg keys are untouched', S.legL === -0.45 && S.legR === 0.85, `legL ${S.legL} legR ${S.legR}`],
  ['the limb stretch is the authored 1.18', S.limbSy === 1.18, String(S.limbSy)],
  ['the body carries NO squash (the v0.25.661 head-distortion fix)', R.bodySquashFree === true],
  // per user: "it should always be joined to the main torso"
  ['the hips follow the leaning torso', R.hipFollow === 13, String(R.hipFollow)],
  ['the leg scissor is compressed into a stride', R.legSplit === 0.75, String(R.legSplit)],
  ['the hips sit under the lean, not behind it', R.hipLag >= 8, R.hipLag + 'px ahead of the body translate'],
  ['the legs stay joined to the torso', R.gap <= 6000, R.gap + ' gap px (was 12071)'],
  ['...on every frame, not just on average', R.gapWorst <= 1200, R.gapWorst + ' px on the worst frame (was 2342)'],
  ['the pose resolves to finite values across its timeline', R.finite === true],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
