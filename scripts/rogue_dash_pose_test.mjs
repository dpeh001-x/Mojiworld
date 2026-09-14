// THE ROGUE DASH POSE IS THE AUTHORED ORIGINAL — PINNED ON PURPOSE
// ============================================================================
// v0.30.746 replaced this pose with a "ninjutsu lunge" (a shallower lean, the head riding the body
// instead of cancelling it, the blade arm swept back, and Catmull-Rom interpolation instead of a
// per-segment ease). The user looked at it and said: "the original one was better use it". It was
// reverted, and these numbers are the original ones.
//
// So this file is a GUARD, not a spec I am arguing for. The values below are pinned because they are
// the ones that were chosen after seeing both, and the point is that the next pass at this pose has
// to be a deliberate decision rather than an accident. Every check names the value it protects, so
// changing the pose on purpose means editing this file in the same commit and seeing exactly what
// moved.
//
// If you do revisit it: scripts/_tmp_rogue_pose.mjs films the pose frame by frame off its own
// 24-frame timeline (it draws _drawVectorHero with opts.animName to an offscreen canvas at nine
// phases), which is how the comparison that settled this was made. Looking at the strip is worth
// more than any number in here.
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
  out.smear = smear ? { spine: smear.spine, head: smear.head, armL: smear.armL, armR: smear.armR, legL: smear.legL, legR: smear.legR, x: smear.x, limbSy: smear.limbSy } : null;
  out.headCancelsSpine = keys.every((k) => Math.abs(k.head + k.spine) < 0.02);
  out.bodySquashFree = keys.every((k) => k.sx === 1 && k.sy === 1);
  // the hips must stay pinned to the lunging torso (the v0.29.x detached-leg fix)
  out.hipsTrackSpine = keys.every((k) => Math.abs(k.legLX - k.x) <= 1.0 && Math.abs(k.legRX - k.x) <= 1.0);
  // the pose resolves and is finite across its whole timeline
  let finite = true;
  for (let i = 0; i <= 60; i++) {
    const p = _heroVecRogueDashPose(i / 60);
    for (const v of Object.values(p)) if (!Number.isFinite(v)) finite = false;
  }
  out.finite = finite;
  return out;
});
await browser.close(); server.kill();
if (R.err) { console.log(R.err); process.exit(1); }
console.log(`keys at ${JSON.stringify(R.ps)}`);
console.log(`smear key ${JSON.stringify(R.smear)}\n`);

const S = R.smear || {};
const checks = [
  ['the five authored keys are intact', R.n === 5 && R.ps.join() === '0,0.24,0.58,0.78,1', R.ps.join()],
  ['the smear key keeps its 0.92 lean', S.spine === 0.92, String(S.spine)],
  ['the head still counter-rotates the spine exactly', R.headCancelsSpine === true],
  ['both arms still sweep forward together at the smear', S.armL === 2.05 && S.armR === 1.58, `armL ${S.armL} armR ${S.armR}`],
  ['the legs keep their split', S.legL === -0.45 && S.legR === 0.85, `legL ${S.legL} legR ${S.legR}`],
  ['the limb stretch is the authored 1.18', S.limbSy === 1.18, String(S.limbSy)],
  // these two are the fixes that predate the revert and must survive it
  ['the body carries NO squash (the v0.25.661 head-distortion fix)', R.bodySquashFree === true],
  ['the hips track the lunging torso (the v0.29.x detached-leg fix)', R.hipsTrackSpine === true],
  ['the pose resolves to finite values across its timeline', R.finite === true],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
