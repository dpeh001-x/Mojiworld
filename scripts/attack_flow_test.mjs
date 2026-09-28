// Live test: the basic attacks flow (per user: "can the attacking animations for each class be further improved").
// For warrior / mage / archer / rogue, rendered by the game's own rig:
//   * no snap into a swing or out of it: the change in pixels from the idle frame to the swing's first frame, and from
//     its last frame back to idle, is no bigger than an ordinary step inside the swing (it used to be several times it:
//     a 0.4 rad lean, a 90 deg weapon turn and a body squash all landed in one frame)
//   * the swing itself is untouched in the middle (the blend only works at the ends)
//   * the hair trails the head through the strike
//   * a second stab 330 ms after the first restarts the rogue's thrust (it used to finish the first stab's clock)
//   node scripts/attack_flow_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof loadMap === 'function', null, { timeout: 120000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    try { _lxBootGateDone = true; } catch (e) {} try { _lxBootHold.release('menu'); } catch (e) {}
    ['loading-overlay', 'lo-menu'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    const N = 25, out = {};
    const frame = (cls, an, t) => {
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 320; const c = cv.getContext('2d');
      c.fillStyle = '#2a1030'; c.fillRect(0, 0, 300, 320);
      c.save(); c.translate(140, 292); c.scale(2, 2);
      _drawVectorHero(-14, -44, c, { cls, lookCustom: player.lookCustom || {}, animName: an, animTime: t, forcedFacing: 1 });
      c.restore(); return c.getImageData(0, 0, 300, 320).data;
    };
    const diff = (a, b2) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b2[i]) + Math.abs(a[i + 1] - b2[i + 1]) + Math.abs(a[i + 2] - b2[i + 2]) > 60) n++; return n; };
    for (const cls of ['warrior', 'mage', 'archer', 'rogue']) {
      try { applyClass(cls); } catch (e) {}
      loadMap('town'); await wait(900); player.vx = 0; player.vy = 0; player.attacking = false;
      const an = 'attack_' + cls, idle = frame(cls, 'idle', 0), F = [];
      for (let i = 0; i < N; i++) F.push(frame(cls, an, i / (N - 1)));
      const steps = []; for (let i = 1; i < N; i++) steps.push(diff(F[i - 1], F[i]));
      const sorted = steps.slice().sort((x, y) => x - y), median = sorted[sorted.length >> 1];
      // the middle of the swing: the drawn pose against the raw tables
      const flow = (typeof _hvAttackFlow === 'function') ? _hvAttackFlow(an, 0.45, { animName: an }) : null, raw = _hvPoseOf(an, 0.45);
      let midDev = 0; if (flow) for (const bn of HV_BONES) midDev = Math.max(midDev, Math.abs(flow.rot[bn]() - raw.rot[bn]));
      // the hair offset at the fastest head swing (0 when the rig has no swing hair lag)
      let hair = 0; if (typeof _hvAttackHairLag === 'function') for (let i = 0; i < N; i++) { const h = _hvAttackHairLag(an, i / (N - 1), 1); if (h) hair = Math.max(hair, Math.abs(h.x)); }
      out[cls] = { enter: diff(idle, F[0]), leave: diff(F[N - 1], idle), median, max: sorted[sorted.length - 1], midDev, hair };
    }
    // a real double stab: the second cast 330 ms after the first must restart the swing clock
    try { applyClass('rogue'); } catch (e) {}
    loadMap('town'); await wait(1200); game.paused = false; player.skillCooldowns = {}; player.attacking = false; player._heroAtkAt = 0;
    const cast = () => { player.skillCooldowns = {}; player._castLockUntil = 0; try { castSkill('stab'); } catch (e) { return String(e); } return ''; };
    const e1 = cast(); await wait(60); const a1 = player._heroAtkAt, g1 = game.time;
    // the stab cadence is ~18 game frames (300 ms) and the swing ~25: cast the second one inside the first swing, by game time
    for (let i = 0; i < 400 && !(game.time - a1 >= 17); i++) { game.paused = false; await wait(5); }
    const gap = game.time - a1; const e2 = cast(); await wait(30);
    const a2 = player._heroAtkAt, g2 = game.time, tNow = (g2 - a2) / HERO_VEC_ATTACK_FRAMES;
    out.chain = { e1, e2, a1, a2, g1, g2, gap: Math.round(gap * 10) / 10, tNow: Math.round(tNow * 100) / 100 };
    return out;
  });
  for (const cls of ['warrior', 'mage', 'archer', 'rogue']) {
    const x = r[cls], lim = Math.max(1.3 * x.median, 400);
    ok(`${cls}: no snap into the swing (idle -> first frame no bigger than a normal step)`, x.enter <= lim, { enter: x.enter, median: x.median });
    ok(`${cls}: no snap out of the swing (last frame -> idle no bigger than a normal step)`, x.leave <= lim, { leave: x.leave, median: x.median });
    ok(`${cls}: the swing's middle is untouched (drawn pose = the swing's own at t 0.45)`, x.midDev < 1e-6 && x.max > 0, { midDev: x.midDev });
  }
  ok('warrior: the hair trails the head through the strike', r.warrior.hair >= 2, r.warrior.hair);
  ok('rogue: a second stab inside the first swing (~300 ms) restarts the thrust', !r.chain.e1 && !r.chain.e2 && r.chain.gap < 22 && r.chain.a2 > r.chain.a1 && r.chain.tNow < 0.4, r.chain);
  ok('no page errors', errs.length === 0, errs);
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== ATTACK FLOW ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
