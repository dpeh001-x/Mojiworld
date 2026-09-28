// Live test: the rogue's stab burst and trails that fade all the way out (per user: "add the rogue stab impact burst
// too" and "there is this weird stroke here"). Rendered by the game's own rig:
//   * the rogue's point bursts at full extension of the thrust, ahead of the rogue whichever way it faces, and not
//     before the thrust or after it; the other classes draw no burst
//   * the swing trails (warrior arc, rogue stab line) draw nothing before or after their swing - they used to keep a
//     floor alpha, leaving a faint arc by the feet / behind the head and a dot on the hand - and peak as bright as before
//   node scripts/rogue_burst_test.mjs [port]   (MOJI_GAME_FILE honored)
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
    const CX = 150;
    const draw = (cls, t, facing) => {
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 320; const c = cv.getContext('2d');
      c.fillStyle = '#2a1030'; c.fillRect(0, 0, 300, 320);
      c.save(); c.translate(CX, 292); c.scale(2, 2);
      _drawVectorHero(-14, -44, c, { cls, lookCustom: player.lookCustom || {}, animName: 'attack_' + cls, animTime: t, forcedFacing: facing });
      c.restore(); return c.getImageData(0, 0, 300, 320).data;
    };
    // the burst alone: the same frame with its draw stubbed out
    const real = window._hvRogueStabBurst;
    const burstOf = (cls, t, f) => {
      if (typeof real !== 'function') return { n: 0, x: null };
      const a = draw(cls, t, f); window._hvRogueStabBurst = function () {}; const b2 = draw(cls, t, f); window._hvRogueStabBurst = real;
      let n = 0, sx = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b2[i]) + Math.abs(a[i + 1] - b2[i + 1]) + Math.abs(a[i + 2] - b2[i + 2]) > 30) { n++; sx += (i / 4) % 300; }
      return { n, x: n ? Math.round(sx / n) : null };
    };
    // the trail strokes: every stroke() in the trail colours, with its alpha. The warrior's trail has been a faint red
    // crescent since the overhead chop (a filled gradient, rgba(255,96,96,a) at its head): its gradient alphas count too.
    const TRAIL = /^rgba\((255,255,255|255,240,180|210,170,255),([0-9.e-]+)\)$/, CRESCENT = /^rgba\((255,96,96),([0-9.e-]+)\)$/;
    const trailAlphas = (cls, t) => {
      const orig = CanvasRenderingContext2D.prototype.stroke, oStop = CanvasGradient.prototype.addColorStop, got = [];
      CanvasRenderingContext2D.prototype.stroke = function (...args) { const m = TRAIL.exec(String(this.strokeStyle).replace(/\s/g, '')); if (m) got.push(+m[2]); return orig.apply(this, args); };
      CanvasGradient.prototype.addColorStop = function (o, col) { const m = CRESCENT.exec(String(col).replace(/\s/g, '')); if (m) got.push(+m[2]); return oStop.call(this, o, col); };
      try { draw(cls, t, 1); } finally { CanvasRenderingContext2D.prototype.stroke = orig; CanvasGradient.prototype.addColorStop = oStop; }
      return got;
    };
    const out = {};
    for (const cls of ['rogue', 'warrior', 'archer', 'mage']) {
      try { applyClass(cls); } catch (e) {}
      loadMap('town'); await wait(700); player.vx = 0; player.attacking = false;
      if (cls === 'rogue') {
        for (const f of [1, -1]) out['rogue' + f] = { before: burstOf(cls, 0.20, f).n, at: burstOf(cls, 0.36, f), after: burstOf(cls, 0.60, f).n };
        out.rogueTrail = { t0: trailAlphas(cls, 0), t1: trailAlphas(cls, 1), peak: Math.max(0, ...trailAlphas(cls, 0.34)) };
      } else {
        out[cls] = burstOf(cls, 0.36, 1).n;
        if (cls === 'warrior') out.warTrail = { t0: trailAlphas(cls, 0), t1: trailAlphas(cls, 1), peak: Math.max(0, ...trailAlphas(cls, 0.41)) };
      }
    }
    return { out, CX };
  });
  const o = r.out;
  for (const f of [1, -1]) {
    const x = o['rogue' + f], tag = f > 0 ? 'facing right' : 'facing left';
    ok(`rogue ${tag}: no burst before the thrust lands`, x.before === 0, x.before);
    ok(`rogue ${tag}: the point bursts at full extension`, x.at.n >= 80, x.at);
    ok(`rogue ${tag}: the burst sits ahead of the rogue, toward the target`, x.at.x != null && (f > 0 ? x.at.x > r.CX + 8 : x.at.x < r.CX - 8), x.at);
    ok(`rogue ${tag}: the burst is gone before the recovery`, x.after === 0, x.after);
  }
  ok('the other classes draw no stab burst', o.warrior === 0 && o.archer === 0 && o.mage === 0, { warrior: o.warrior, archer: o.archer, mage: o.mage });
  const none = (arr) => arr.every((a) => a < 0.005);
  ok('warrior: the swing arc draws nothing before or after the swing (no faint arc by the feet / behind the head)', none(o.warTrail.t0) && none(o.warTrail.t1), o.warTrail);
  ok('warrior: the swing trail still shows mid-swing (the gold arc, since the chop a faint red crescent)', o.warTrail.peak >= 0.3, o.warTrail.peak);
  ok('rogue: the stab line draws nothing before or after the stab (no dot on the hand)', none(o.rogueTrail.t0) && none(o.rogueTrail.t1), o.rogueTrail);
  ok('rogue: the stab line still peaks as bright as before', o.rogueTrail.peak >= 0.6, o.rogueTrail.peak);
  ok('no page errors', errs.length === 0, errs);
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== ROGUE BURST + CLEAN TRAILS ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
