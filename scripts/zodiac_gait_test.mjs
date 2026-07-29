// Zodiac signature-gait harness (v0.29.340). Drives every House's gait for a
// simulated 60 s fight and characterises the motion, so a gait can never
// silently regress into standing still, freezing in a dead zone, or flipping
// facing every frame — the three bugs this harness caught on first run.
//   node scripts/zodiac_gait_test.mjs
// Env: PW_EXE (browser path) or PW_CHANNEL (default msedge), PORT (default 8883)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8883;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, headless: true } : { channel: process.env.PW_CHANNEL || "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const out = await page.evaluate(() => {
  const rows = [];
  if (typeof _zodiacGaitTick !== 'function') return { fatal: 'gait tick missing' };
  player.hp = Math.max(player.hp, 1);
  player.x = 1000; player.y = 400; player.w = 30; player.h = 50;
  for (const z of ZODIAC_SIGNS) {
    const t = monsterTypes['zodiac_' + z.id];
    const m = { type: 'zodiac_' + z.id, zodiacSign: z.id, zodiacBoss: true, boss: true,
                x: 1400, y: 400, w: t.w, h: t.h, vx: 0, vy: 0, onGround: true,
                speed: 0.8, facing: -1, patternState: 'idle', patternTimer: 0,
                maxHp: t.hp, currentHp: t.hp, atk: t.atk };
    const g = _ZODIAC_GAIT[z.id];
    let minD = 1e9, maxD = 0, dirFlips = 0, lastSign = 0, maxSpd = 0, hops = 0, blinks = 0, bad = 0;
    let prevX = m.x;
    for (let i = 0; i < 3600; i++) {          // ~60 s at 60fps
      game.time = (game.time | 0) + 1;
      const dist = Math.abs((player.x + player.w / 2) - (m.x + m.w / 2));
      try { _zodiacGaitTick(m, 16.667, dist, 2, z); } catch (e) { bad++; break; }
      if (!Number.isFinite(m.vx) || !Number.isFinite(m.x)) { bad++; break; }
      if (m.vy < -1) hops++;
      m.vy = 0;                                // stand in for gravity resolving the hop
      if (Math.abs(m.x - prevX) > 90) blinks++; // teleport detection
      prevX = m.x;
      m.x += m.vx;                             // integrate like the physics loop
      m.x = Math.max(20, Math.min(2180, m.x));
      const d = Math.abs((player.x + player.w / 2) - (m.x + m.w / 2));
      minD = Math.min(minD, d); maxD = Math.max(maxD, d);
      maxSpd = Math.max(maxSpd, Math.abs(m.vx));
      const s = Math.sign(m.vx);
      if (s && lastSign && s !== lastSign) dirFlips++;
      if (s) lastSign = s;
    }
    rows.push({ id: z.id, noLunge: !!(g && g.noLunge), minD: Math.round(minD), maxD: Math.round(maxD),
                span: Math.round(maxD - minD), flips: dirFlips, maxSpd: +maxSpd.toFixed(1),
                hops, blinks, kbResist: m._kbResist || 0, bad });
  }
  return { rows };
});

if (out.fatal) { console.log('FATAL:', out.fatal); }
else {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('SIGN', 13) + pad('lunge', 7) + pad('minD', 6) + pad('maxD', 6) + pad('span', 6) +
              pad('flips', 7) + pad('maxSpd', 8) + pad('hops', 6) + pad('blinks', 8) + pad('kbRes', 7) + 'err');
  console.log('-'.repeat(92));
  for (const r of out.rows) {
    console.log(pad(r.id, 13) + pad(r.noLunge ? 'off' : 'on', 7) + pad(r.minD, 6) + pad(r.maxD, 6) + pad(r.span, 6) +
                pad(r.flips, 7) + pad(r.maxSpd, 8) + pad(r.hops, 6) + pad(r.blinks, 8) + pad(r.kbResist, 7) + (r.bad || 0));
  }
  // Fail conditions are the three regressions this harness was written for:
  //   threw / NaN            — a gait that crashes or poisons position
  //   never moves            — a blink-only or velocity-less gait (Gemini)
  //   never changes distance — frozen in a dead zone (Sagitta, span 0)
  const fails = [];
  for (const r of out.rows) {
    if (r.bad) fails.push(`${r.id}: threw or produced NaN`);
    else if (r.maxSpd === 0 && !r.blinks) fails.push(`${r.id}: never moves`);
    else if (r.span < 20) fails.push(`${r.id}: frozen (distance span ${r.span}px over 60s)`);
  }
  console.log(`\n${out.rows.length} gaits driven 60s each`);
  if (fails.length) { console.log('FAIL:'); fails.forEach(f => console.log('  ' + f)); }
  else console.log('PASS — every gait moves, varies its range, and never throws');
  console.log('pageerrors:', errs.length, errs.slice(0, 3));
  await browser.close(); server.kill();
  process.exit(fails.length || errs.length ? 1 : 0);
}
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(1);
