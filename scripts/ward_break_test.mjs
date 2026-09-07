// Break gauge (v0.30.395): warded hits fill a gauge by what they would have done
// (6%..34% a hit), the hit that fills it shatters the ward on the spot and opens a
// 3 s window at 1.5x, a fresh ward starts empty, the shield draws the gauge, the
// shatter flies four quarters apart, the HUD pill and co-op carry the gauge.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10067); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof hitMonster === 'function' && typeof spawnMonster === 'function' && typeof drawMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, has: typeof _lxWardFeed === 'function' && typeof _drawBossWardBreak === 'function' }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (typeof LX_FX !== 'undefined' && LX_FX.boss_shield) { const im = LX_FX.boss_shield; const t0 = performance.now(); while (!(im.complete && im.naturalWidth > 0) && performance.now() - t0 < 15000) await sleep(50); }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true; player.level = 70; player.hp = player.maxHp || 1000; player.cls = 'warrior';
    spawnMonster(player.x + 260, player.y, 'kingKrook', true); const m = game.monsters.filter((x) => x && x.type === 'kingKrook').pop(); if (!m) return Object.assign(o, { err: 'no boss' });
    m.maxHp = 100000; m.currentHp = m.maxHp; m.evasion = 0; m.invulnerable = 0; m._dying = false; game.camera.x = Math.max(0, m.x + m.w / 2 - W / 2);
    const now = () => game.time | 0;
    const hit = (dmg) => { m.invulnerable = 0; m._lastHitAt = 0; game.time += 120; game.comboMult = 1; game.combo = 0; game.hitStop = 0; game.damageNumbers.length = 0; const h0 = m.currentHp; try { hitMonster(m, dmg, false, 'melee'); } catch (e) { return { err: String(e && e.message) }; } const loss = h0 - m.currentHp; m.currentHp = m.maxHp; return { loss, gauge: +(m._wardGauge || 0).toFixed(3), warded: (m._wardUntil | 0) > now(), open: _lxWardBreakActive(m), stop: game.hitStop, nums: game.damageNumbers.map((d) => d.text) }; };
    // calibrate: the boss mitigates a raw 1,000 to `base`; size max HP so that a 1,000 hit is exactly 1% of it
    m._wardUntil = 0; m._wardBreakUntil = 0; const base = hit(1000).loss; m.maxHp = base * 100; m.currentHp = m.maxHp; o.base = base;
    // 1. six 1%-of-max-HP hits fill it (1/6 each); the sixth shatters. The ward is re-armed before each hit (the sim clock jumps 120 steps a hit).
    m._wardGauge = 0; o.fill = []; for (let i = 0; i < 6; i++) { if (!_lxWardBreakActive(m)) m._wardUntil = now() + 180; o.fill.push(hit(1000)); }
    // 2. the open window: 1.5x; after it, 1x
    o.open = hit(1000); m._wardBreakUntil = now(); o.closed = hit(1000);
    // 3. clamps: a 50% hit fills 34%, a 0.1% hit fills 6%
    m._wardUntil = now() + 180; m._wardGauge = 0; o.bigFill = hit(50000).gauge; m._wardUntil = now() + 180; m._wardGauge = 0; o.tinyFill = hit(100).gauge; m._wardUntil = 0; m._wardGauge = 0;
    // 4. a fresh ward starts empty
    m._wardGauge = 0.5; m._wardUntil = 0; m._wardNextAt = now() - 1; m._sovShielded = false; _lxBossWardTick(m); o.fresh = { warded: (m._wardUntil | 0) > now(), gauge: m._wardGauge };
    // 5. drawing: the gauge bar under the shield (labelled from 85%), the shatter quarters, then the ring alone
    const img = LX_FX.boss_shield;
    const capture = () => { const c = { shield: 0, quarters: 0, rects: 0, labels: [], err: null }; const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage, oR = P.fillRect, oT = P.fillText;
      P.drawImage = function (im, ...a) { if (im === img) { if (a.length >= 8) c.quarters++; else c.shield++; } return oI.apply(this, [im, ...a]); };
      P.fillRect = function (...a) { c.rects++; return oR.apply(this, a); }; P.fillText = function (t, ...a) { c.labels.push(String(t)); return oT.apply(this, [t, ...a]); };
      try { drawMonster(m); } catch (e) { c.err = String(e && e.message); } finally { P.drawImage = oI; P.fillRect = oR; P.fillText = oT; } return c; };
    m._wardUntil = now() + 90; m._wardGauge = 0.9; const dWard = capture(); o.drawWard = { shield: dWard.shield, quarters: dWard.quarters, label: dWard.labels.includes('BREAK'), err: dWard.err };
    m._wardGauge = 0.3; o.drawWardLow = { label: capture().labels.includes('BREAK') };
    m._wardUntil = 0; m._wardBreakAt = now() - 5; m._wardBreakUntil = now() + 170; const dBreak = capture(); o.drawBreak = { shield: dBreak.shield, quarters: dBreak.quarters, err: dBreak.err };
    m._wardBreakAt = now() - 40; const dRing = capture(); o.drawRing = { shield: dRing.shield, quarters: dRing.quarters };
    m._wardBreakUntil = 0; const dNone = capture(); o.drawNone = { shield: dNone.shield, quarters: dNone.quarters };
    // 6. the HUD pill and co-op carry the gauge (static)
    const src = await (await fetch(location.pathname)).text();
    o.src = { hud: src.indexOf("(_ww - 4) * Math.max(0, Math.min(1, sb._wardGauge || 0)), 2);") >= 0, send: src.indexOf('_e.wg = Math.round(Math.min(1, m._wardGauge) * 100);') >= 0, recv: src.indexOf("m._wardGauge = (e.wg > 0) ? Math.min(1, (+e.wg | 0) / 100) : 0;") >= 0, window: src.indexOf('if (e.wb > 0) {') >= 0 };
    return o;
  });
  console.log('build ' + r.ver + (r.err ? '  ' + r.err : '') + '  fill ' + JSON.stringify(r.fill.map((f) => [f.loss, f.gauge, f.warded ? 'W' : '-', f.open ? 'O' : '-'])));
  ok('the feed and the break draw exist', r.has === true);
  ok('five 1%-of-max-HP warded hits each land for 1 and fill a sixth of the gauge', r.fill.slice(0, 5).every((f, i) => f.loss === 1 && f.warded && !f.open && Math.abs(f.gauge - (i + 1) / 6) < 0.01), JSON.stringify(r.fill.slice(0, 5).map((f) => [f.loss, f.gauge])));
  ok('the sixth shatters: the ward ends on the spot, the window opens, the gauge resets, BREAK! prints, 120 ms freeze', r.fill[5] && r.fill[5].loss === 1 && !r.fill[5].warded && r.fill[5].open && r.fill[5].gauge === 0 && r.fill[5].nums.includes('BREAK!') && r.fill[5].stop >= 120, JSON.stringify(r.fill[5]));
  ok('inside the window the same hit lands for 1.5x; after it, 1x', r.open && r.open.loss === Math.floor(r.base * 1.5) && r.closed && r.closed.loss === r.base, JSON.stringify([r.base, r.open && r.open.loss, r.closed && r.closed.loss]));
  ok('the fill is clamped: a 50% hit adds 34%, a 0.1% hit adds 6%', Math.abs(r.bigFill - 0.34) < 0.001 && Math.abs(r.tinyFill - 0.06) < 0.001, JSON.stringify([r.bigFill, r.tinyFill]));
  ok('a fresh ward starts with an empty gauge', r.fresh && r.fresh.warded && r.fresh.gauge === 0, JSON.stringify(r.fresh));
  ok('warded at 90%: the whole shield, no quarters, the gauge bar and a BREAK label; at 30% no label', r.drawWard && r.drawWard.shield === 1 && r.drawWard.quarters === 0 && r.drawWard.label && !r.drawWard.err && r.drawWardLow && !r.drawWardLow.label, JSON.stringify([r.drawWard, r.drawWardLow]));
  ok('five steps after the shatter: four quarters fly, no whole shield', r.drawBreak && r.drawBreak.quarters === 4 && r.drawBreak.shield === 0 && !r.drawBreak.err, JSON.stringify(r.drawBreak));
  ok('forty steps in: the ring alone; after the window: nothing', r.drawRing && r.drawRing.quarters === 0 && r.drawRing.shield === 0 && r.drawNone && r.drawNone.quarters === 0 && r.drawNone.shield === 0, JSON.stringify([r.drawRing, r.drawNone]));
  ok('the HUD pill carries the gauge; co-op sends gauge and window and a guest mirrors them', r.src && r.src.hud && r.src.send && r.src.recv && r.src.window, JSON.stringify(r.src));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
