// Frame-spike profiler: what runs inside the frames that go long.
//   node scripts/perf_spike_profile.mjs [build.html]
// Steady-state medians stopped being the useful signal once the readback work
// was gone (p50 ~4 ms); what remains is a handful of long frames per run, and
// this attributes them to named operations so the next fix targets a cause
// rather than a guess. It is how the 517 ms / x127 edge-probe stampede was found.
//
// What happens inside the SLOW frames? Steady state is fine now (p50 9.4 ms);
// the remaining complaint is the tail (p99 38 ms, max 61 ms). Tag the expensive
// one-shot operations, then attribute them to the frames that ran long.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const PORT = process.env.PERF_PORT || '9503';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.argv[2] || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = 99999; player.maxHp = 99999;
  try { loadMap('blockland_apex'); } catch (e) { try { loadMap('boneGraveyard'); } catch (e2) {} }
  game.paused = false;
});
await page.waitForTimeout(6000);
await page.evaluate(() => {
  const types = Object.keys(monsterTypes).slice(0, 8);
  for (let i = 0; i < 28; i++) {
    try { spawnMonster(player.x + (i % 7 - 3) * 90, player.y - 40, types[i % types.length]); } catch (e) {}
  }
});
await page.waitForTimeout(1200);

const res = await page.evaluate(async () => {
  const cur = { ops: {} };
  const bump = (k, ms) => { const e = cur.ops[k] || (cur.ops[k] = { n: 0, ms: 0 }); e.n++; e.ms += ms; };
  const wrapGlobal = (name) => {
    const f = window[name];
    if (typeof f !== 'function') return;
    window[name] = function (...a) {
      const t = performance.now(); const r = f.apply(this, a); bump(name, performance.now() - t); return r;
    };
  };
  ['_lxEdgesTouched', '_lxBakeSeamlessTile', '_lxShrinkFrames', '_fxAnimFrames', '_projAnimFrame',
   '_lxBitmapToCanvas', '_summonAnimFrame', '_lxDrawSoft', '_lxTintBake', '_detectSpriteBboxBottom',
   'spawnSpriteBurst', 'drawBackground', 'drawMonster', 'updateMonsters', 'drawParticles'].forEach(wrapGlobal);
  const proto = CanvasRenderingContext2D.prototype;
  for (const op of ['getImageData', 'createPattern']) {
    const o = proto[op]; if (!o) continue;
    proto[op] = function (...a) { const t = performance.now(); const r = o.apply(this, a); bump('ctx.' + op, performance.now() - t); return r; };
  }
  const oCIB = window.createImageBitmap;
  if (oCIB) window.createImageBitmap = function (...a) { const t = performance.now(); const r = oCIB.apply(this, a); bump('createImageBitmap(sync part)', performance.now() - t); return r; };

  const slow = [];
  const t0 = performance.now();
  let last = performance.now(), frames = 0, total = 0;
  const allFrames = [];
  while (performance.now() - t0 < 10000) {
    cur.ops = {};
    game.paused = false;
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now(); const dt = now - last; last = now; frames++;
    allFrames.push(dt);
    if (dt > 28) {
      const ops = Object.entries(cur.ops).filter(([, v]) => v.ms > 0.6)
        .map(([k, v]) => `${k} x${v.n} ${v.ms.toFixed(1)}ms`).sort();
      slow.push({ dt: +dt.toFixed(1), ops });
      total += dt;
    }
  }
  allFrames.sort((a, b) => a - b);
  const q = (p) => allFrames[Math.min(allFrames.length - 1, Math.floor(allFrames.length * p))];
  // roll up which op appears most across slow frames
  const roll = {};
  for (const s of slow) for (const o of s.ops) {
    const k = o.split(' x')[0];
    const ms = parseFloat(o.split(' ').pop());
    const e = roll[k] || (roll[k] = { frames: 0, ms: 0 });
    e.frames++; e.ms += ms;
  }
  return { frames, slowCount: slow.length, p50: +q(0.5).toFixed(1), p99: +q(0.99).toFixed(1),
    worst: slow.sort((a, b) => b.dt - a.dt).slice(0, 6),
    roll: Object.entries(roll).map(([k, v]) => [k, v.frames, +v.ms.toFixed(0)]).sort((a, b) => b[2] - a[2]).slice(0, 10) };
});
console.log(`frames ${res.frames} | p50 ${res.p50} | p99 ${res.p99} | frames >28ms: ${res.slowCount}`);
console.log('op time summed across SLOW frames:');
for (const [k, f, ms] of res.roll) console.log(`  ${String(ms).padStart(6)} ms  in ${String(f).padStart(3)} slow frames  ${k}`);
console.log('worst frames:');
for (const w of res.worst) console.log(`  ${w.dt} ms :: ${w.ops.join(' | ') || '(nothing instrumented)'}`);
await browser.close(); srv.kill();
