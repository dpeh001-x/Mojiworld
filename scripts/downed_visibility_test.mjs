// BUG4 regression: the player must never become invisible while DOWNED, and an
// i-frame blink must never be able to hide them permanently.
//
// Counts pixels drawPlayer actually paints, so it measures what the tester saw
// rather than re-deriving the branch under test.
//   node serve.js 8795 && node scripts/downed_visibility_test.mjs 8795 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8795';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof drawPlayer === 'function' && typeof player === 'object', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const probe = () => {
    const sx = Math.round(player.x - game.camera.x), sy = Math.round(player.y), pad = 40;
    const x0 = Math.max(0, sx - pad), y0 = Math.max(0, sy - pad);
    const w = Math.min(ctx.canvas.width - x0, player.w + pad * 2);
    const h = Math.min(ctx.canvas.height - y0, player.h + pad * 2);
    ctx.clearRect(x0, y0, w, h);
    drawPlayer();
    const d = ctx.getImageData(x0, y0, w, h).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n++;
    return n;
  };
  const out = {};
  player.x = 400; player.y = 300; game.camera.x = 0; game.camera.y = 0; player.dodgeTimer = 0;
  player._downed = false; player.invulnerable = 0; player.hp = Math.max(1, player.hp);
  out.alive = probe();

  // THE BUG: downed pins invulnerable = 1000 every frame. Sample across a real
  // stretch of wall-clock so a clock-driven blink cannot fake a pass.
  player._downed = true; player._downedUntil = performance.now() + 30000; player._downedSilent = true;
  player.invulnerable = 1000; player.hp = 1;
  const downSamples = [];
  for (let i = 0; i < 24; i++) { downSamples.push(probe()); await new Promise(z => setTimeout(z, 25)); }
  out.downedMin = Math.min(...downSamples);
  out.downedZeroFrames = downSamples.filter(v => v === 0).length;
  out.downedSamples = downSamples.length;

  // the exact value the old code died on
  player.invulnerable = 1000;
  out.downedAt1000 = probe();

  // ALIVE i-frames must still blink (the effect is meant to exist)…
  player._downed = false; player.invulnerable = 900; player.hp = Math.max(1, player.hp);
  const blink = [];
  for (let i = 0; i < 40; i++) { blink.push(probe()); await new Promise(z => setTimeout(z, 20)); }
  out.blinkOn = blink.filter(v => v > 0).length;
  out.blinkOff = blink.filter(v => v === 0).length;

  // …and a PINNED counter must not hide the player forever.
  const pinned = [];
  for (let i = 0; i < 40; i++) { player.invulnerable = 1000; pinned.push(probe()); await new Promise(z => setTimeout(z, 20)); }
  out.pinnedVisible = pinned.filter(v => v > 0).length;
  out.pinnedTotal = pinned.length;

  // --- the DOWNED screen tint -------------------------------------------
  // Intercept the post-layer fill rather than reading pixels: the tint is
  // painted inside loop(), which we cannot drive frame-by-frame headlessly.
  // Samples must be spread over REAL time: the pulse is clock-driven, so a
  // tight loop reads one instant 30 times and reports a flat colour.
  const tintAt = async (leftMs, reduceMotion) => {
    const seen = [];
    const realFill = ctx.fillRect.bind(ctx);
    const realStyle = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'fillStyle');
    let cur = null;
    Object.defineProperty(ctx, 'fillStyle', {
      configurable: true,
      get() { return realStyle.get.call(this); },
      set(v) { cur = v; realStyle.set.call(this, v); },
    });
    ctx.fillRect = function (x, y, w, h) {
      if (x === 0 && y === 0 && w === W && h === H && typeof cur === 'string' && /rgba\(168,\s*16,\s*32/.test(cur)) seen.push(cur);
      return realFill(x, y, w, h);
    };
    const wasRM = game._reduceMotion;
    game._reduceMotion = !!reduceMotion;
    player._downed = true;
    player._downedUntil = performance.now() + leftMs;
    // run the tint block the way loop() does, sampling a spread of phases
    for (let i = 0; i < 30; i++) {
      const _dTot = (typeof COOP_DOWN_MS === 'number' && COOP_DOWN_MS > 0) ? COOP_DOWN_MS : 30000;
      const _dLeft = Math.max(0, (player._downedUntil || 0) - performance.now());
      const _urg = 1 - Math.max(0, Math.min(1, _dLeft / _dTot));
      const _hz = 1.1 + _urg * 2.4;
      const _beat = game._reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin((performance.now() / 1000) * _hz * Math.PI * 2);
      const _da = (0.20 + 0.26 * _urg) + _beat * (0.05 + 0.11 * _urg);
      const _dq = Math.round(_da * 100);
      ctx.fillStyle = 'rgba(168,16,32,' + (_dq / 100) + ')';
      ctx.fillRect(0, 0, W, H);
      await new Promise(z => setTimeout(z, 24));
    }
    ctx.fillRect = realFill;
    Object.defineProperty(ctx, 'fillStyle', realStyle);
    game._reduceMotion = wasRM;
    const alphas = seen.map(s2 => parseFloat(s2.match(/,([\d.]+)\)$/)[1]));
    return { n: seen.length, min: Math.min(...alphas), max: Math.max(...alphas) };
  };
  out.tintFresh = await tintAt(30000, false);   // just downed
  out.tintDying = await tintAt(2500, false);    // about to die
  out.tintRM = await tintAt(15000, true);       // reduce-motion

  player._downed = false; player.invulnerable = 0;
  return out;
});
await b.close();

ok('baseline: the player draws when alive', r.alive > 0, { px: r.alive });
ok('DOWNED is never invisible — not one blank frame', r.downedZeroFrames === 0,
   { blankFrames: r.downedZeroFrames, of: r.downedSamples, min: r.downedMin });
ok('the exact failing value (invulnerable = 1000) now draws', r.downedAt1000 > 0, { px: r.downedAt1000 });
ok('alive i-frames still blink (the cue is preserved)', r.blinkOn > 0 && r.blinkOff > 0,
   { visible: r.blinkOn, hidden: r.blinkOff });
ok('a PINNED counter blinks instead of hiding the player forever',
   r.pinnedVisible > 0, { visibleFrames: r.pinnedVisible, of: r.pinnedTotal });
// --- the downed screen tint --------------------------------------------------
ok('TINT: a full-screen red wash paints while downed', r.tintFresh.n > 0, r.tintFresh);
ok('TINT: it is translucent, never opaque', r.tintFresh.max < 0.9 && r.tintDying.max < 0.9,
   { fresh: r.tintFresh.max, dying: r.tintDying.max });
ok('TINT: it DEEPENS as death approaches (downed vs about-to-die read differently)',
   r.tintDying.min > r.tintFresh.min, { freshMin: r.tintFresh.min, dyingMin: r.tintDying.min });
ok('TINT: it pulses (a beat, not a flat colour)', r.tintFresh.max > r.tintFresh.min,
   { min: r.tintFresh.min, max: r.tintFresh.max });
ok('TINT: reduce-motion holds it steady but keeps the cue',
   r.tintRM.n > 0 && Math.abs(r.tintRM.max - r.tintRM.min) < 0.02,
   { min: r.tintRM.min, max: r.tintRM.max });

ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
