// Live test: BOSS BAR DYNAMICS — the intro sweep (acquisition fills 0→HP%
// over 700ms) and the ghost damage chip (a pale ember strip lingers where the
// HP just was: held 350ms, then drained exponentially). Driven through the
// real drawSuperBossBar on a virtual clock; observed via a fillRect spy —
// the fill tint, the bg and the ember chip are all fillRects with known
// geometry is read off the draw itself (the trough rect), never hardcoded — v0.30.462
// moved the plate to a centred 660x22 and stale literals took six checks down with it.
//   node scripts/boss_bar_chip_test.mjs [port]
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
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof drawSuperBossBar === 'function' && typeof monsterTypes === 'object',
  null, { timeout: 120000 });
await page.waitForFunction(() => typeof LX_FX !== 'undefined'
  && LX_FX.ui_bossbar_frame && LX_FX.ui_bossbar_frame.complete && LX_FX.ui_bossbar_frame.naturalWidth > 0
  && LX_FX.ui_bossbar_fill && LX_FX.ui_bossbar_fill.complete && LX_FX.ui_bossbar_fill.naturalWidth > 0,
  null, { timeout: 30000 }).catch(() => {});

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  let simNow = 5000;                    // virtual clock — every timing window below is driven by it
  performance.now = () => simNow;

  const mk = (key, over) => {
    const t = monsterTypes[key] || {};
    return Object.assign({
      type: key, name: t.name || key, w: t.w || 60, h: t.h || 60,
      x: 900, y: 400, currentHp: t.hp || 1000, maxHp: t.hp || 1000,
      isBoss: !!t.boss, boss: !!t.boss, superBoss: !!t.superBoss, hyperBoss: !!t.hyperBoss,
      level: t.level || 50, traits: t.traits,
    }, over || {});
  };
  // one draw, spied: every fillRect on the bar strip (y=20, h=18) bucketed
  const draw = (mon, blockArt) => {
    game.monsters.length = 0; game._superBossRef = null; game.monsters.push(mon);
    let sF, sR;
    if (blockArt && typeof LX_FX !== 'undefined') {
      sF = LX_FX.ui_bossbar_frame; sR = LX_FX.ui_bossbar_fill;
      LX_FX.ui_bossbar_frame = null; LX_FX.ui_bossbar_fill = null;
    }
    const rects = []; let card = null;
    const _fr = ctx.fillRect;
    const _ft = ctx.fillText;
    // v0.30.462 — the plate paints several of its layers with gradients now (the chip
    // among them), and a CanvasGradient stringifies to "[object CanvasGradient]", which
    // told this spy nothing. Resolve each one back to its colour stops so the colour
    // probes below keep describing what was actually painted.
    const stops = new Map();
    const _clg = ctx.createLinearGradient;
    ctx.createLinearGradient = function (...a) {
      const g = _clg.apply(this, a); const list = []; const _add = g.addColorStop.bind(g);
      g.addColorStop = (o, c) => { list.push(c); return _add(o, c); };
      stops.set(g, list); return g;
    };
    const styleOf = (fs) => (fs && stops.has(fs)) ? stops.get(fs).join(' ') : String(fs);
    ctx.fillText = function (t, tx, ty) {
      if (String(this.font).indexOf('46px') >= 0) card = { a: +this.globalAlpha.toFixed(3), y: ty };
      return _ft.apply(this, arguments);
    };
    ctx.fillRect = function (x, y, w, h) { rects.push({ s: styleOf(this.fillStyle), grad: stops.has(this.fillStyle), x, y, w, h }); return _fr.apply(this, arguments); };
    // the plate's gradients are cached on (geometry, phase) and so are built on the first
    // draw only; drop the key so this draw rebuilds them where the spy above can read them
    try { _SBB_G.key = ''; } catch (e) {}
    try { drawSuperBossBar(); } catch (e) { rects.push({ s: 'THREW:' + e }); }
    ctx.fillRect = _fr; ctx.fillText = _ft; ctx.createLinearGradient = _clg;
    if (blockArt && typeof LX_FX !== 'undefined') { LX_FX.ui_bossbar_frame = sF; LX_FX.ui_bossbar_fill = sR; }
    // v0.30.462 — locate the strip from the trough the plate paints (its gradient runs
    // #04010a -> #170b28 -> #08030f) instead of hardcoding a y/h. The geometry moved
    // once already and took six checks with it; now it cannot go stale.
    const bar = rects.find(q => /#04010a/.test(q.s));
    const strip = bar ? rects.filter(q => q.y === bar.y && q.h === bar.h) : [];
    const ember = strip.find(q => /255,\s*206,\s*140|255,\s*225,\s*170/.test(q.s));
    const tint = strip.find(q => /150,\s*100,\s*255|255,\s*110,\s*205|255,\s*80,\s*88|140,\s*90,\s*255/.test(q.s));
    const pulse = strip.find(q => !q.grad && /255,\s*255,\s*255/.test(q.s) && q.w > 10);
    return { barX: bar ? Math.round(bar.x) : -1, barW: bar ? Math.round(bar.w) : 0,
             emberX: ember ? Math.round(ember.x) : -1, emberW: ember ? Math.round(ember.w) : 0,
             tintW: tint ? Math.round(tint.w) : 0, card,
             pulseW: pulse ? Math.round(pulse.w) : 0,
             pulseA: pulse ? +((pulse.s.match(/([\d.]+)\)\s*$/) || [0, 0])[1]) : 0,
             threw: rects.find(q => /THREW/.test(q.s)) };
  };

  // ---- intro sweep: 0 → full over 700ms, monotonic ----
  const m = mk('legosaurus');           // a plain boss: no 33/66 super ticks on the strip
  const sweep = [];
  for (const dt of [0, 100, 250, 450, 800]) { simNow = 5000 + dt; sweep.push(draw(m).tintW); }
  out.sweep = sweep;
  // ---- damage → ember chip spans exactly the lost HP ----
  simNow = 6000;                        // intro long settled
  draw(m);
  m.currentHp = Math.floor(m.maxHp * 0.5);
  simNow += 16; out.hit1 = draw(m);     // ghost still ~100%: chip from 50% edge, ~440 wide
  simNow += 200; out.held = draw(m);    // inside the 350ms hold: undrained
  let last = null;
  for (let i = 0; i < 30; i++) { simNow += 100; last = draw(m); }
  out.drained = last;                    // 3s later: chip gone
  // ---- second hit re-arms the hold at the new edge ----
  m.currentHp = Math.floor(m.maxHp * 0.3);
  simNow += 16; out.hit2 = draw(m);
  simNow += 200; out.held2 = draw(m);
  // ---- heal snaps the ghost up — the chip never lies about a heal ----
  m.currentHp = Math.floor(m.maxHp * 0.8);
  simNow += 16; out.healed = draw(m);
  // ---- procedural fallback branch draws the chip too ----
  const p = mk('young_confused_barnaby');
  simNow += 2000; draw(p, true);
  simNow += 800; draw(p, true);         // settle its intro
  p.currentHp = Math.floor(p.maxHp * 0.4);
  simNow += 16; out.procHit = draw(p, true);
  // ---- title card: the name reveal rides the acquisition stamp ----
  const c = mk('gravitos');
  simNow = 20000; draw(c);              // first draw stamps _bbSeen
  const cardAt = (dt) => { simNow = 20000 + dt; return draw(c).card; };
  out.card100 = cardAt(100); out.card800 = cardAt(800);
  out.card1700 = cardAt(1700); out.card2500 = cardAt(2500);
  // ---- phase flip: one-shot white pulse over the fill ----
  const pz = mk('gravitos', { phase: 1 });
  simNow += 5000; draw(pz);             // stamps seen + phase
  simNow += 2500; draw(pz);             // card window over
  pz.phase = 2;
  simNow += 16; out.pulse = draw(pz);
  simNow += 600; out.pulseGone = draw(pz);
  game.monsters.length = 0; game._superBossRef = null;
  return out;
});

const sw = r.sweep || [];
ok('intro sweep: the fill starts near zero on acquisition', sw[0] <= 8, sw);
ok('intro sweep: grows monotonically through the 700ms window',
  sw.every((w, i) => i === 0 || w >= sw[i - 1]) && sw[2] > sw[1], sw);
// v0.30.462 — stated as fractions of the strip the spy located, not as the pixel
// literals of one particular layout
ok('intro sweep: lands on the full bar by 800ms', r.hit1 && sw[4] >= r.hit1.barW - 10, { sw, barW: r.hit1 && r.hit1.barW });
ok('damage chip: a hit paints the ember strip over the lost HP (from the 50% edge, half the bar wide)',
  r.hit1 && r.hit1.emberW >= r.hit1.barW * 0.47 && Math.abs(r.hit1.emberX - (r.hit1.barX + r.hit1.barW * 0.5)) <= 8, r.hit1);
ok('damage chip: holds through the first 350ms — no drain yet',
  r.held && r.held.emberW >= r.hit1.emberW - 10, r.held);
ok('damage chip: fully drained ~3s after the hit', r.drained && r.drained.emberW <= 2, r.drained);
ok('second hit re-arms the chip at the new HP edge (from 30%, spans the fresh loss)',
  r.hit2 && r.hit2.emberW >= r.hit2.barW * 0.17 && Math.abs(r.hit2.emberX - (r.hit2.barX + r.hit2.barW * 0.3)) <= 8, r.hit2);
ok('...and holds again', r.held2 && r.held2.emberW >= r.hit2.emberW - 10, r.held2);
ok('a heal snaps the ghost up — no ember painted', r.healed && r.healed.emberW === 0, r.healed);
ok('procedural fallback branch paints the chip too', r.procHit && r.procHit.emberW >= 100, r.procHit);
ok('title card: easing in at 100ms (alpha ~0.3, still settling)', r.card100 && r.card100.a > 0.1 && r.card100.a < 0.7, r.card100);
ok('title card: full presence by 800ms', r.card800 && r.card800.a > 0.95, r.card800);
ok('title card: fading out at 1700ms', r.card1700 && r.card1700.a > 0.1 && r.card1700.a < 0.6, r.card1700);
ok('title card: gone after 1.9s', !r.card2500, r.card2500);
ok('phase flip: a white pulse flushes the fill', r.pulse && r.pulse.pulseW > 10 && r.pulse.pulseA > 0.25, r.pulse);
ok('phase flip: the pulse decays away', r.pulseGone && !r.pulseGone.pulseW, r.pulseGone);
ok('no draw threw', !r.hit1?.threw && !r.drained?.threw && !r.procHit?.threw, '');
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + (q.pass ? '  ' + JSON.stringify(q.x ?? '') : '  ' + JSON.stringify(q.x ?? '')));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
