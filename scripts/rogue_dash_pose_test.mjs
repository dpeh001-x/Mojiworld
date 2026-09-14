// THE ROGUE DASH IS A NINJUTSU LUNGE, AND IT DOESN'T STUTTER
// ============================================================================
// Per user: make the rogue dash "look smoother, like a ninjutsu dash", with a reference of a ninja
// mid-leap — torso pitched forward but still upright, lead hand out, blade arm swept BACK, a long
// split stride.
//
// Two separate faults, and only one of them was the pose:
//   POSE      the spine pitched to 0.92 rad (53 degrees, most of the way to horizontal), the head
//             was counter-rotated by EXACTLY -spine at every key so it read as bolted on, and BOTH
//             arms swung forward together — no blade arm, no silhouette, a face-down curl.
//   SMOOTHNESS every segment was eased in AND out, which drives the pose's velocity to ZERO at each
//             of the five keyframes: accelerate, stop, accelerate, five times in 24 frames. That
//             stutter is what "not smooth" actually was, and no individual key was wrong.
//
// The smoothness check is the interesting one: it samples the pose densely and measures how fast the
// spine is turning AT the interior keys. On the old build that is ~0 by construction; a Catmull-Rom
// spline carries momentum through them.
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
  const out = {};
  const keys = (typeof HERO_VEC_ROGUE_DASH_KEYS !== 'undefined') ? HERO_VEC_ROGUE_DASH_KEYS : null;
  if (!keys) return { err: 'no keys' };
  out.keyPs = keys.map((k) => k.p);
  out.apexSpine = Math.max(...keys.map((k) => Math.abs(k.spine)));
  // head must not simply cancel the spine at every key
  out.headIsNegSpine = keys.every((k) => Math.abs(k.head + k.spine) < 0.02);
  // at the glide key (the widest lean), the two arms must be on opposite sides
  const glide = keys.reduce((a, b) => (Math.abs(b.spine) > Math.abs(a.spine) ? b : a), keys[0]);
  out.glide = { spine: glide.spine, armL: glide.armL, armR: glide.armR, legL: glide.legL, legR: glide.legR };
  out.armsSplit = (glide.armL * glide.armR) < 0 || (glide.armR < -0.6);
  out.strideSplit = (glide.legL * glide.legR) < 0;

  // sample the pose densely and measure |d spine / dp| around each interior key
  const N = 400, sp = [];
  for (let i = 0; i <= N; i++) sp.push(_heroVecRogueDashPose(i / N).spine);
  const speedAt = (p) => {
    const i = Math.round(p * N);
    const a = sp[Math.max(0, i - 2)], b = sp[Math.min(N, i + 2)];
    return Math.abs(b - a) / (4 / N);
  };
  const interior = out.keyPs.slice(1, -1);
  out.keySpeeds = interior.map((p) => +speedAt(p).toFixed(3));
  // the fastest the spine ever turns, for scale
  let peak = 0;
  for (let i = 1; i < sp.length; i++) peak = Math.max(peak, Math.abs(sp[i] - sp[i - 1]) * N);
  out.peakSpeed = +peak.toFixed(3);
  // MEDIAN, not minimum. The glide key is the apex of the lean - a genuine turning point, where the
  // spine's speed SHOULD pass through zero on any scheme. Taking the minimum therefore always finds
  // that key and says nothing about stutter. The fault being measured is EVERY key stopping, so the
  // median is the honest statistic: on the eased-per-segment build all three are ~2% of peak.
  const _sorted = out.keySpeeds.slice().sort((a, b) => a - b);
  out.medKeySpeedFrac = +(_sorted[_sorted.length >> 1] / Math.max(0.001, peak)).toFixed(3);
  out.minKeySpeedFrac = +(Math.min(...out.keySpeeds) / Math.max(0.001, peak)).toFixed(3);
  // and it must stay sane: no wild spline overshoot beyond the authored range
  const lo = Math.min(...keys.map((k) => k.spine)), hi = Math.max(...keys.map((k) => k.spine));
  out.overshoot = +(Math.max(0, Math.max(...sp) - hi, lo - Math.min(...sp))).toFixed(3);
  return out;
});
await browser.close(); server.kill();
if (R.err) { console.log(R.err); process.exit(1); }

console.log(`apex spine lean       ${R.apexSpine.toFixed(2)} rad (${(R.apexSpine * 57.3).toFixed(0)} deg)`);
console.log(`glide key             ${JSON.stringify(R.glide)}`);
console.log(`spine turn speed at the interior keys ${JSON.stringify(R.keySpeeds)}  (peak ${R.peakSpeed})`);
console.log(`as a fraction of peak — median ${R.medKeySpeedFrac}, slowest ${R.minKeySpeedFrac} (the slowest is the glide apex, where the lean genuinely reverses)`);
console.log(`spline overshoot past the authored range: ${R.overshoot} rad\n`);

const checks = [
  ['the lunge leans, it does not dive', R.apexSpine <= 0.62, R.apexSpine.toFixed(2) + ' rad'],
  ['the head rides the body instead of cancelling it', R.headIsNegSpine === false],
  ['the blade arm trails while the lead arm reaches', R.armsSplit === true, `armL ${R.glide.armL} armR ${R.glide.armR}`],
  ['the legs split into a stride', R.strideSplit === true, `legL ${R.glide.legL} legR ${R.glide.legR}`],
  // the smoothness itself: the pose must not come to a stop at its own keyframes
  ['the pose keeps moving through its keyframes', R.medKeySpeedFrac >= 0.15,
    `median key moves at ${(R.medKeySpeedFrac * 100).toFixed(0)}% of peak speed`],
  ['and the smoothing does not overshoot into a broken pose', R.overshoot <= 0.08, R.overshoot + ' rad'],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
