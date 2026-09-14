// Live test: the EVADE BURST back-flip. Per user: "Make the evade burst skill character roll smooth
// and natural more natural than the archer dash".
//
// Graded by MEASUREMENT, one sample per SIM STEP. The flip is held to its own absolute properties
// (nothing teleports, the turn eases at both ends, it completes, it lands upright, the ~120 px
// escape survives) AND to a head-to-head against the archer dash roll measured in the SAME build,
// which is the comparison the request was about and needs no second build to be meaningful.
// The sim is a fixed 60 Hz step behind an accumulator gate, and headless rAF does not line up with
// it in either direction - so the sampler wraps updatePlayer, which runs exactly once per step.
// Sampling per rAF silently drops or duplicates steps and every rate metric is then noise.
//   node scripts/evade_flip_test.mjs [file.html] [port]        (default: mojiworld_game.html)
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const FILE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT_ARG = process.argv[3];

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = PORT_ARG;
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });

const PROBE = async (file) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${file}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof quickDash === 'function'
    && typeof updatePlayer === 'function', null, { timeout: 120000 });
  await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
  const out = await page.evaluate(async () => {
    const raf = () => new Promise(r => requestAnimationFrame(r));
    const res = { ver: (typeof GAME_VERSION !== 'undefined') ? GAME_VERSION : '?' };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    try { loadMap('boss'); } catch (e) { res.err = 'loadMap ' + e.message; return res; }
    for (let i = 0; i < 90; i++) await raf();
    game.paused = false;
    player.cls = 'archer'; player.level = 60; player.invulnerable = 9e9;
    player.hp = player.maxHp = 99999; player.mp = player.maxMp = 9999;
    if (game.monsters) game.monsters.length = 0;
    res.gravMul = (typeof gravMul === 'function') ? gravMul() : null;

    let REC = null;
    const _origUP = window.updatePlayer;
    window.updatePlayer = function () {
      const r = _origUP.apply(this, arguments);
      if (REC) REC.push({ x: player.x, y: player.y, vx: +(player.vx || 0).toFixed(4),
        g: !!player.onGround, s: player.somersault, d: player.somersaultDuration,
        f: player._evadeFlip === 1, r: player._archerRoll === 1 });
      return r;
    };

    const angOf = (s) => {
      const t = Math.max(0, Math.min(1, 1 - s.s / Math.max(1, s.d)));
      let te;
      if (s.r && typeof LX_ROLL !== 'undefined') te = LX_ROLL.ease * (1 - Math.pow(1 - t, LX_ROLL.pow)) + (1 - LX_ROLL.ease) * t;
      else if (s.f && typeof LX_FLIP !== 'undefined') te = t * t * t * (t * (t * 6 - 15) + 10);
      else te = t;
      return te * 360;
    };
    const run = async (label, fire, steps) => {
      player.vx = 0; player.vy = 0; player.somersault = 0; player.somersaultDuration = 0;
      player._archerRoll = 0; if ('_evadeFlip' in player) player._evadeFlip = 0;
      player.facing = 1; player.quickDashTimer = 0;
      REC = null;
      for (let i = 0; i < 40; i++) await raf();
      const x0 = player.x, y0 = player.y;
      const rec = []; REC = rec;
      try { fire(); } catch (e) { REC = null; return { label, err: String(e).slice(0, 140) }; }
      const xAfterCast = player.x;                   // synchronous: a teleport lands here
      let guard = 0;
      while (rec.length < steps && guard < 9000) { await raf(); guard++; }
      REC = null;
      let maxDx = Math.abs(xAfterCast - x0), prev = xAfterCast;
      for (const s of rec) { const d = Math.abs(s.x - prev); if (d > maxDx) maxDx = d; prev = s.x; }
      let air = 0; for (let i = 0; i < rec.length; i++) { if (!rec[i].g) air++; else if (i > 3) break; }
      const landIdx = rec.findIndex((s, i) => i > 3 && s.g);
      const travelAir = landIdx > 0 ? Math.abs(rec[landIdx].x - x0) : null;
      const act = rec.filter(s => s.s > 0 && s.d > 0);
      const A = act.map(angOf);
      const w = []; for (let i = 1; i < A.length; i++) w.push(A[i] - A[i - 1]);
      const peak = w.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
      let afterLand = 0;
      for (let i = 4; i < rec.length; i++) if (rec[i].g && rec[i].s > 0) afterLand++;
      return { label, steps: rec.length, spinSteps: act.length,
        teleportPx: +Math.abs(xAfterCast - x0).toFixed(1),
        maxStepPx: +maxDx.toFixed(1),
        airSteps: air,
        travelAtLand: travelAir == null ? null : +travelAir.toFixed(1),
        travelTotal: +Math.abs(rec[rec.length - 1].x - x0).toFixed(1),
        risePx: +Math.abs(Math.min(...rec.slice(0, 40).map(s => s.y)) - y0).toFixed(0),
        w0pct: w.length ? +(Math.abs(w[0]) / peak * 100).toFixed(1) : null,
        w1pct: w.length ? +(Math.abs(w[w.length - 1]) / peak * 100).toFixed(1) : null,
        peakStepDeg: +peak.toFixed(1),
        finalDeg: A.length ? +A[A.length - 1].toFixed(1) : null,
        monotonic: A.every((a, i) => i === 0 || a >= A[i - 1] - 0.001),
        spinAfterLandSteps: afterLand, landedAtStep: landIdx,
        degAtLand: (landIdx >= 0 && rec[landIdx].s > 0) ? +angOf(rec[landIdx]).toFixed(1) : 'done',
        xArc: rec.slice(0, 40).filter((_, i) => i % 4 === 0).map(s => Math.round(s.x)),
      };
    };
    res.flip = await run('evade flip', () => SKILL_FNS.evadeRoll(), 60);
    res.roll = await run('archer roll', () => quickDash(1), 60);
    window.updatePlayer = _origUP;
    return res;
  });
  out.errs = errs.slice(0, 3);
  await ctx.close();
  return out;
};

const R = await PROBE(FILE);

const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const src = readFileSync(FILE, 'utf8');

// ── the shape of the move, in the source ─────────────────────────────────────
ok('LX_FLIP declares the flip in one place',
  /const LX_FLIP = \{ ms: \d+, vx: [\d.]+, drag: [\d.]+, tuck: [\d.]+, settle: \d+ \};/.test(src), '');
ok('the turn is smootherstep, and only the flip gets it',
  src.includes('const _flip = player._evadeFlip === 1;')
  && src.includes('_flip ? (t * t * t * (t * (t * 6 - 15) + 10))'), '');
// Scoped to THIS cast: `player.x = tx` is a legitimate line in another skill (the shadow dash),
// so the evade's own dust colour is the anchor that says which teleport is the one that is gone.
ok('the cast does not teleport the body any more',
  !/#ccffcc[\s\S]{0,160}player\.x = tx;/.test(src), '');
ok('the flip carries through the air instead of braking',
  src.includes('const _flipping = player._evadeFlip === 1 && !player.onGround;')
  && src.includes('player.vx *= (_padFlinging || _flipping) ? LX_FLIP.drag : fric;'), '');
ok('an early landing FINISHES the turn rather than cutting it dead',
  src.includes('player._evadeFlipSettled = 1;')
  && src.includes('const _k = LX_FLIP.settle / player.somersault;'), '');
ok('the flip flag is cleared wherever a pose must not survive',
  (src.match(/player\._evadeFlip = 0;/g) || []).length >= 3, (src.match(/player\._evadeFlip = 0;/g) || []).length);
ok('the archer dash roll is left exactly as it was',
  src.includes('const LX_ROLL = { ms: 340, ease: 0.8, pow: 2.3, arc: 17, tuck: 0.09 };'), '');

// ── what the move actually does, measured ────────────────────────────────────
const F = R.flip || {}, L = R.roll || {};
ok('no page errors', (R.errs || []).length === 0, R.errs);
ok('both moves are measurable', F.steps > 40 && L.steps > 40 && !F.err && !L.err, { flip: F.err, roll: L.err });

// The old cast moved the body 120 px in ONE frame and 0 px across the rest of the flip.
ok('NOTHING TELEPORTS: the cast displaces the body 0 px instantly', F.teleportPx === 0, F.teleportPx);
ok('...and no single frame of the flip moves it more than 8 px', F.maxStepPx <= 8, F.maxStepPx);
// The escape distance is a gameplay contract, so it is flown, not lost.
ok('the ~120 px of escape survives, flown instead of snapped',
  F.travelAtLand >= 100 && F.travelAtLand <= 135, F.travelAtLand);
// Eased at BOTH ends - which is the difference from the roll, not a bigger number.
ok('SMOOTH START: angular speed at the launch is under 15% of peak', F.w0pct <= 15, F.w0pct);
ok('SMOOTH FINISH: and under 15% at the finish, so it glides to a stop', F.w1pct <= 15, F.w1pct);
ok('the turn completes a full rotation and never runs backwards',
  F.finalDeg >= 355 && F.monotonic === true, { finalDeg: F.finalDeg, monotonic: F.monotonic });
ok('LANDS UPRIGHT: nothing is still turning once the feet are down', F.spinAfterLandSteps === 0, F.spinAfterLandSteps);
ok('it is still the same leap (it rises, and it is airborne for it)',
  F.risePx > 10 && F.airSteps > 10, { risePx: F.risePx, airSteps: F.airSteps });

// ── more natural than the archer dash: the request, as a comparison ──────────
ok('vs the archer dash: the flip eases IN; the roll starts at full speed',
  F.w0pct < L.w0pct - 20, { roll: L.w0pct, flip: F.w0pct });
ok('vs the archer dash: the flip has finished turning when it lands; the roll has not',
  F.spinAfterLandSteps < L.spinAfterLandSteps, { roll: L.spinAfterLandSteps, rollDegAtLand: L.degAtLand, flip: F.spinAfterLandSteps });
ok('vs the archer dash: no larger position step than the roll', F.maxStepPx <= L.maxStepPx, { roll: L.maxStepPx, flip: F.maxStepPx });

console.log(`\n${FILE}  ${R.ver}   gravMul ${R.gravMul}`);
const row = (k, a, b) => console.log('  ' + k.padEnd(20) + String(a).padStart(14) + String(b).padStart(14));
console.log('  ' + 'metric'.padEnd(20) + 'evade flip'.padStart(14) + 'dash roll'.padStart(14));
for (const k of Object.keys(F)) if (k !== 'label' && k !== 'xArc') row(k, F[k], L[k]);
console.log('  flip xArc', JSON.stringify(F.xArc));
console.log('');
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
