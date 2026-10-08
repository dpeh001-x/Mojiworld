#!/usr/bin/env node
// The zodiac shots' loops play smoothly (per user: "make the zodiac projectile animations smoother too").
// =============================================================================
// Frame by frame (clock stubbed, so it is exact):
//   1. each re-ordered loop plays its _LX_ZOD_ANIM_SEQ order and never shows a frame it leaves out - Gemini's shard never
//      the near-invisible outlines (1-5), the bubble never its dark frames (5-7), the ice shard never its cloud (3-5)
//   2. the same key thrown by an ordinary monster still plays its plain loop (the orders are zodiac-only)
//   3. two shots of one volley do not flash in lockstep
//   4. a zodiac shot's spin is by the clock: the same turn per second at 60 and 144 Hz, and never past 0.2 rad per 60 Hz frame
//   node scripts/zodiac_anim_smooth_test.mjs [port]   (MOJI_GAME_FILE honoured by serve.js)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2] || process.env.PORT;
for (let p = 8841; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2000));
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof drawProjectiles === 'function' && typeof _projAnimFrame === 'function', null, { timeout: 150000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const out = { seqs: {}, plain: null, lock: null, spin: null, has: typeof _LX_ZOD_ANIM_SEQ !== 'undefined' && typeof _lxZodAnimFrame === 'function' };
    if (!out.has) return out;
    const shot = (skill, zod) => ({ x: game.camera.x + 400, y: (game.camera.y || 0) + 250, vx: 4, vy: 0, w: 20, h: 20, life: 100, damage: 1, owner: 'enemy', skill, noGravity: true, ...(zod ? { _zodiacSign: 'gemini', _zodiacAttacker: true } : {}) });
    // load + bake every loop first (the order is only used once the whole loop is ready)
    const keys = Object.keys(_LX_ZOD_ANIM_SEQ);
    for (const k of keys) _projAnimFrame(k);
    const t0 = Date.now();
    const ready = (k) => { const a = PROJ_ANIM_FRAMES[k]; _projAnimFrame(k); return a && (a._readyN || 0) === a.length && a.every((f) => f && (f.tagName === 'CANVAS' || f._lxNoShrink)); };
    while (Date.now() - t0 < 40000 && !keys.every(ready)) await new Promise((z) => setTimeout(z, 250));
    const realNow = performance.now.bind(performance); let T = 0;
    performance.now = () => T;
    try {
      for (const k of keys) {
        const p = shot(k, true), arr = PROJ_ANIM_FRAMES[k], seq = _LX_ZOD_ANIM_SEQ[k], seen = [];
        _lxZodAnimFrame(p); T = 1e6 - (p._zAnimOff % _PROJ_ANIM_FRAME_MS) + _PROJ_ANIM_FRAME_MS / 2;   // mid-frame, phase-aligned
        for (let i = 0; i < seq.length * 2; i++) { seen.push(arr.indexOf(_lxZodAnimFrame(p))); T += _PROJ_ANIM_FRAME_MS; }
        out.seqs[k] = { seq, seen, ready: ready(k) };
      }
      // an ordinary (non-zodiac) ice shard: every frame of the plain loop. v0.30.1657: was venom, whose zodiac order is gone
      const pv = shot('ice', false), seenPlain = new Set(); T = 2e6;
      for (let i = 0; i < 18; i++) { const f = _projAnimFrame('ice'); seenPlain.add(PROJ_ANIM_FRAMES.ice.indexOf(f)); T += _PROJ_ANIM_FRAME_MS; }
      out.plain = [...seenPlain].sort((a, b) => a - b);
      // two shots of one volley
      const a1 = shot('gemini_shard', true), a2 = shot('gemini_shard', true); let same = 0; T = 3e6;
      for (let i = 0; i < 12; i++) { if (_lxZodAnimFrame(a1) === _lxZodAnimFrame(a2)) same++; T += _PROJ_ANIM_FRAME_MS; }
      out.lock = { same, of: 12, offs: [a1._zAnimOff, a2._zAnimOff] };
      // spin by the clock: one second at 144 Hz and at 60 Hz
      const spinFor = (stepMs) => { game.projectiles.length = 0; const p = shot('gemini_shard', true); game.projectiles.push(p); T = 4e6; drawProjectiles(); const s0 = p._spin || 0; const n = Math.round(1000 / stepMs); for (let i = 0; i < n; i++) { T += stepMs; drawProjectiles(); } return (p._spin || 0) - s0; };
      out.spin = { hz144: spinFor(1000 / 144), hz60: spinFor(1000 / 60) };
      game.projectiles.length = 0;
    } finally { performance.now = realNow; }
    return out;
  });
  ok('the smoothing is in the build (_LX_ZOD_ANIM_SEQ, _lxZodAnimFrame)', r.has, '');
  if (r.has) {
    for (const [k, v] of Object.entries(r.seqs)) {
      const n = v.seq.length, start = v.seen.findIndex((x, i) => i < n && v.seq.every((f, j) => v.seen[i + j] === f));
      ok(`${k}: plays its order [${v.seq}]`, v.ready && start >= 0, v);
      ok(`${k}: never shows a frame it leaves out`, v.seen.every((f) => v.seq.includes(f)), v);
    }
    ok("an ordinary monster's ice shard still plays its whole loop (the orders are zodiac-only)", r.plain && r.plain.length === 9, r.plain);
    ok('two shots of one volley are not in lockstep', r.lock && r.lock.same < 12, r.lock);
    const rate = r.spin && r.spin.hz60;
    ok('a zodiac spin turns the same per second at 144 Hz as at 60 Hz (by the clock)', r.spin && Math.abs(r.spin.hz144 - r.spin.hz60) <= 0.05 * Math.abs(r.spin.hz60), r.spin);
    ok('and never past 0.2 rad per 60 Hz frame (12 rad/s - no strobing)', rate != null && rate <= 12.05, r.spin);
  }
  ok('no page errors', errs.length === 0, errs);
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== ZODIAC ANIMATIONS SMOOTH ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
