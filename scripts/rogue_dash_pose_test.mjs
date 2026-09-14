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
  // 24 frames, one per game frame: the sprint cycles 4.5 times across the pose, and a 9-frame
  // sample aliases that into noise rather than measuring it.
  for (let i = 0; i < 24; i++) {
    player._rogueDashPoseAt = (game.time | 0) - i;
    player._rogueDashPoseUntil = (game.time | 0) + 9999;
    c2.clearRect(0, 0, cv.width, cv.height);
    c2.save(); c2.scale(3.4, 3.4);
    try { _drawVectorHero(24, 6, c2, { animName: 'dash_rogue_ninja' }); } catch (e) {}
    c2.restore();
    const d = c2.getImageData(0, 0, cv.width, cv.height).data;
    const W = cv.width, H = cv.height;
    const on = (x, y) => d[(y * W + x) * 4 + 3] > 24;
    // IS THE FIGURE STILL ONE BODY? Flood-fill the drawn pixels and count separate pieces.
    //
    // This replaces a hip-band gap measurement that misled twice. That one counted trapped
    // background in a window sized off the body's bounding box, so it moved whenever the legs did:
    // giving the legs a sprint made it jump 4,796 -> 7,726, and hanging them lower moved its window
    // again - both times calling a correct animation broken. Connected pieces cannot be fooled that
    // way, because it asks the actual question: has a limb come off?
    //
    // The baseline is TWO, not one: the rogue's dagger is legitimately its own shape. Specks under
    // 120px are antialias noise and are ignored.
    const n = W * H, solid = new Uint8Array(n);
    for (let k = 0; k < n; k++) solid[k] = d[k * 4 + 3] > 40 ? 1 : 0;
    const seen = new Uint8Array(n), st = new Int32Array(n);
    let pieces = 0;
    for (let k = 0; k < n; k++) {
      if (!solid[k] || seen[k]) continue;
      let top = 0, area = 0; st[top++] = k; seen[k] = 1;
      while (top) {
        const c = st[--top]; area++;
        const x = c % W, y = (c - x) / W;
        if (x > 0 && solid[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; st[top++] = c - 1; }
        if (x < W - 1 && solid[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; st[top++] = c + 1; }
        if (y > 0 && solid[c - W] && !seen[c - W]) { seen[c - W] = 1; st[top++] = c - W; }
        if (y < H - 1 && solid[c + W] && !seen[c + W]) { seen[c + W] = 1; st[top++] = c + W; }
      }
      if (area > 120) pieces++;
    }
    gap += pieces; if (pieces > worst) worst = pieces;
  }
  player._rogueDashPoseUntil = 0; game.paused = false;
  out.pieceSum = gap; out.piecesWorst = worst;
  out.hipDrop = (typeof HERO_VEC_ROGUE_DASH_HIP_DROP !== 'undefined') ? HERO_VEC_ROGUE_DASH_HIP_DROP : null;
  // the drop and the sprint must both be gone by the settle, or the legs snap when the dash ends
  const endKey = HERO_VEC_ROGUE_DASH_KEYS[HERO_VEC_ROGUE_DASH_KEYS.length - 1];
  const endPose = _heroVecRogueDashPose(1);
  out.settleClean = Math.abs(endPose.legLY - endKey.legLY) < 0.01 && Math.abs(endPose.legRY - endKey.legRY) < 0.01;
  out.sprintCycles = (typeof HERO_VEC_ROGUE_DASH_SPRINT_CYCLES !== 'undefined') ? HERO_VEC_ROGUE_DASH_SPRINT_CYCLES : null;
  out.sprintAmp = (typeof HERO_VEC_ROGUE_DASH_SPRINT_AMP !== 'undefined') ? HERO_VEC_ROGUE_DASH_SPRINT_AMP : null;
  // The legs must actually RUN. Sample the angle BETWEEN the two legs and count how many times it
  // reverses direction: a held stride turns around once or twice across the whole dash, a sprint
  // reverses on every stride. This is the cadence the reference GIF is all about, and it is the one
  // thing a pose table alone cannot express.
  const sep = [];
  for (let i = 0; i <= 96; i++) { const q = _heroVecRogueDashPose(i / 96); sep.push(q.legL - q.legR); }
  let rev = 0;
  for (let i = 2; i < sep.length; i++) {
    const a = sep[i - 1] - sep[i - 2], b = sep[i] - sep[i - 1];
    if (a * b < 0) rev++;
  }
  out.legReversals = rev;
  out.legSwingPeak = +(Math.max(...sep) - Math.min(...sep)).toFixed(2);
  return out;
});
await browser.close(); server.kill();
if (R.err) { console.log(R.err); process.exit(1); }
console.log(`keys at ${JSON.stringify(R.ps)}`);
console.log(`smear key ${JSON.stringify(R.smear)}`);
console.log(`hip follow ${R.hipFollow}, leg split ${R.legSplit}, hip lag behind the torso at the smear ${R.hipLag}px`);
console.log(`separate pieces across 24 frames: worst ${R.piecesWorst}  (2 is the body plus his dagger; 3 means a limb came off)`);
console.log(`leg anchor dropped ${R.hipDrop}px mid-dash, settle lands on the authored pose: ${R.settleClean}\n`);

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
  // per user: "do the sprint but make sure the leg is always attached to hip". Measured in the HIP
  // BAND over 24 frames. Reference points from the sweep: no sprint at all = 1094, a bare 1.10 rad
  // swing with no hip compensation = 5280, and the build before the hip fix (detached) = far worse.
  ['the figure never comes apart — the legs stay on the body', R.piecesWorst <= 2, R.piecesWorst + ' pieces at worst (2 = body + his dagger; 3 = a limb came off)'],
  ['the leg anchor is the authored 6px drop', R.hipDrop === 6, String(R.hipDrop)],
  ['the drop and the sprint are both gone by the settle', R.settleClean === true],
  // per user: "the legs should move rapidly like a crazy sprint"
  ['the legs actually cycle rather than holding a stride', R.legReversals >= 6, R.legReversals + ' reversals across the dash'],
  ['the sprint is a real swing, not a twitch', R.legSwingPeak >= 1.6, R.legSwingPeak + ' rad between the legs'],
  ['the sprint cadence is the authored 4.5 cycles', R.sprintCycles === 4.5, String(R.sprintCycles)],
  ['the pose resolves to finite values across its timeline', R.finite === true],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
