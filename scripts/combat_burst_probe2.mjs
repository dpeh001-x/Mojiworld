// Phase 2: the multikill residual, and a boss fight that actually fights.
// ============================================================================
// v0.30.277 cut the wipe task 55 -> 11.4ms, but the worst FRAME in the wipe
// window stayed ~84ms in both runs — unattributed, and possibly an artifact
// of the CDP profiler serializing inside the window. And the boss phase never
// attacked: no damage numbers, no hit flash, no player FX — not a fight.
//
// This probe fixes both:
//   A. wipe with NO profiler attached; every frame delta in a +/-3s window is
//      kept WITH its position, so the worst frame is located (the wipe frame
//      itself? the frame after? seconds later = decay/GC?). Then a separate
//      600ms profiler capture starts AFTER the wipe returns, attributing the
//      post-wipe frames (drops + particles + HUD, not the wipe task).
//   B. boss fight with the player genuinely attacking through the same call
//      chain as the keyboard handler (castSkill(skillBySlot('d'))), 10s next
//      to Krook + Octobaby, profiled for a 5s slice.
// Run: node scripts/combat_burst_probe2.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11061);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const reach = async (page) => {
  const click = async (sel, ms) => {
    const el = await page.$(sel);
    if (!el || !(await el.isVisible().catch(() => false))) return false;
    try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
  };
  await click('#menu-newgame', 6000); await page.waitForTimeout(1500);
  await click('#auth-submit', 6000);  await page.waitForTimeout(2500);
  for (let i = 0; i < 8; i++) {
    const ready = await page.evaluate(() => {
      const o = document.getElementById('class-options');
      return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40);
    });
    if (ready) break;
    if (!(await click('#cs-nav-next'))) break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => {
    const o = document.getElementById('class-options');
    if (o && o.firstElementChild) o.firstElementChild.click();
  });
  for (let i = 0; i < 45; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) return true;
  }
  return false;
};

const topProfile = (prof, n) => {
  const nodes = prof.profile.nodes, dt = prof.profile.timeDeltas || [], sm = prof.profile.samples || [];
  const selfUs = new Map();
  for (let i = 0; i < sm.length; i++) selfUs.set(sm[i], (selfUs.get(sm[i]) || 0) + (dt[i] || 0));
  const byFn = new Map();
  for (const nd of nodes) {
    const us = selfUs.get(nd.id) || 0;
    if (!us) continue;
    const k = (nd.callFrame.functionName || '(anon)') + ':' + nd.callFrame.lineNumber;
    byFn.set(k, (byFn.get(k) || 0) + us);
  }
  return [...byFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, us]) => `${(us / 1000).toFixed(1)}ms ${k}`);
};

const b = await chromium.launch({ channel: 'msedge', headless: true });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
if (!(await reach(page))) { console.log('never got control'); await b.close(); server.kill(); process.exit(1); }
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });

// ---------------- A. multikill: locate the worst frame -----------------------
await page.evaluate(() => { try { loadMap('forest'); game.paused = false; } catch (e) {} });
await page.waitForTimeout(6000);
const A = await page.evaluate(() => new Promise((done) => {
  let spawned = 0;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, r = 130 + (i % 5) * 55;
    const m = spawnMonster(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r,
      ['snail', 'slime', 'petalfly'][i % 3], false);
    if (m && !m._suppressed) spawned++;
  }
  setTimeout(() => {
    const deltas = [];
    let last = performance.now(), wipeAt = -1, wipeMs = 0;
    const t0 = last;
    const tick = (t) => {
      deltas.push(+(t - last).toFixed(1)); last = t;
      if (t - t0 < 5500) requestAnimationFrame(tick);
      else {
        let wi = -1, wv = 0;
        deltas.forEach((d, i) => { if (d > wv) { wv = d; wi = i; } });
        done({ spawned, wipeMs: +wipeMs.toFixed(1), wipeAtFrame: wipeAt,
               worst: wv, worstAtFrame: wi, frames: deltas.length,
               around: deltas.slice(Math.max(0, wi - 3), wi + 4).join(','),
               aroundWipe: deltas.slice(Math.max(0, wipeAt - 1), wipeAt + 6).join(',') });
      }
    };
    requestAnimationFrame(tick);
    setTimeout(() => {
      wipeAt = deltas.length;
      const w0 = performance.now();
      for (const m of [...game.monsters]) if (!m.isBoss) killMonster(m);
      wipeMs = performance.now() - w0;
    }, 900);
  }, 1200);
}));
console.log(`A. multikill x${A.spawned}: wipe task ${A.wipeMs}ms at frame ${A.wipeAtFrame}`);
console.log(`   frames around wipe:  [${A.aroundWipe}]`);
console.log(`   WORST ${A.worst}ms at frame ${A.worstAtFrame} (of ${A.frames})  around: [${A.around}]`);

// Post-wipe attribution: what do the frames AFTER a wipe spend time on?
await page.evaluate(() => {
  let spawned = 0;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, r = 130 + (i % 5) * 55;
    spawnMonster(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r,
      ['snail', 'slime', 'petalfly'][i % 3], false);
  }
  return spawned;
});
await page.waitForTimeout(1200);
await page.evaluate(() => { for (const m of [...game.monsters]) if (!m.isBoss) killMonster(m); });
await cdp.send('Profiler.start');
await page.waitForTimeout(700);
const postProf = await cdp.send('Profiler.stop');
console.log('   post-wipe 700ms (drops+particles decaying):');
for (const l of topProfile(postProf, 10)) console.log('     ' + l);
await page.waitForTimeout(3000);

// ---------------- A2. what does a big loot pile cost per frame? -------------
const D = await page.evaluate(async () => {
  const mk = (n, offx) => { for (let i = 0; i < n; i++) {
    game.drops.push({ type: "mojicoin", value: 5, x: player.x + offx + (i % 30) * 22,
      y: player.y - 40 - Math.floor(i / 30) * 26, vy: 0, life: 999999, noMagnet: true });
  } };
  const wrap = (name) => {
    const fn = window[name]; if (typeof fn !== "function") return null;
    const st = { n: 0, ms: 0, restore: null };
    window[name] = function (...a) { const t = performance.now(); try { return fn.apply(this, a); } finally { st.ms += performance.now() - t; st.n++; } };
    st.restore = () => { window[name] = fn; };
    return st;
  };
  const run = (secs) => new Promise((done) => {
    const dd = wrap("drawDrops");
    const t0 = performance.now(); let frames = 0;
    const tick = () => { frames++; if (performance.now() - t0 < secs * 1000) requestAnimationFrame(tick);
      else { const r = { frames, calls: dd ? dd.n : -1, msPerFrame: dd && dd.n ? +(dd.ms / frames).toFixed(3) : 0 };
        if (dd) dd.restore(); done(r); } };
    requestAnimationFrame(tick);
  });
  const unstick = () => { try { document.querySelectorAll(".modal, .modal-overlay").forEach((m) => { if (m.id !== "class-select-modal") m.style.display = "none"; }); game.paused = false; } catch (e) {} };
  unstick();
  const t0clock = game.time;
  const empty = await run(2);
  unstick(); mk(300, 260);
  const on300 = await run(2);
  for (const d of game.drops) d.x += 4000; unstick();
  const off300 = await run(2);
  game.drops.length = 0;
  return { empty, on300, off300, timeMoves: game.time - t0clock };
});
console.log('A2. drawDrops ms/frame  empty ' + D.empty.msPerFrame + '  300 on-screen ' + D.on300.msPerFrame
  + '  300 off-screen ' + D.off300.msPerFrame + '   (calls/2s: ' + D.on300.calls + ', game.time ' + D.timeMoves + ')');

// ---------------- A3. the wipe again, with level-ups impossible --------------
// Phase A conflates the wipe with the LEVEL-UP MODAL: 40 kills at Lv~1 level
// the player mid-wipe, and the modal open (big DOM mutation) lands exactly in
// the aftermath frames being measured. At Lv 70 the same wipe grants no
// level, so whatever spike remains is FX/GC, not the modal.
const A3 = await page.evaluate(() => new Promise((done) => {
  try { document.querySelectorAll(".modal, .modal-overlay").forEach((m) => { if (m.id !== "class-select-modal") m.style.display = "none"; }); } catch (e) {}
  player.level = 70; player.exp = 0; game.paused = false;
  let spawned = 0;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, r = 130 + (i % 5) * 55;
    const m = spawnMonster(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r,
      ["snail", "slime", "petalfly"][i % 3], false);
    if (m && !m._suppressed) spawned++;
  }
  setTimeout(() => {
    const deltas = [];
    let last = performance.now(), wipeAt = -1, wipeMs = 0;
    const t0 = last;
    const tick = (t) => {
      deltas.push(+(t - last).toFixed(1)); last = t;
      if (t - t0 < 4500) requestAnimationFrame(tick);
      else {
        let wi = -1, wv = 0;
        deltas.forEach((d, i) => { if (d > wv) { wv = d; wi = i; } });
        done({ spawned, wipeMs: +wipeMs.toFixed(1), worst: wv,
               rel: wi - wipeAt, lvl: player.level,
               around: deltas.slice(Math.max(0, wi - 3), wi + 4).join(String.fromCharCode(44)) });
      }
    };
    requestAnimationFrame(tick);
    setTimeout(() => {
      wipeAt = deltas.length;
      const w0 = performance.now();
      for (const m of [...game.monsters]) if (!m.isBoss) killMonster(m);
      wipeMs = performance.now() - w0;
    }, 900);
  }, 1200);
}));
console.log("A3. wipe at Lv" + A3.lvl + " (no level-ups): task " + A3.wipeMs + "ms  WORST " + A3.worst + "ms at wipe+" + A3.rel + " frames  around [" + A3.around + "]");

// ---------------- B. boss fight, genuinely fighting --------------------------
const bossPrep = await page.evaluate(() => {
  spawnMonster(player.x + 240, player.y, 'kingKrook', true);
  spawnMonster(player.x - 280, player.y, 'octobaby', true);
  // Attack through the same chain as the keyboard handler, every 120ms.
  window.__atk = setInterval(() => {
    try {
      if (game.paused || player.hp <= 0) return;
      const found = skillBySlot('d');
      if (found && player.attackCooldown <= 0 && (typeof isReady !== 'function' || isReady(found.id))) {
        castSkill(found.id);
        player.attackCooldown = _basicAttackGateMs();
      }
      player._god = true; player.hp = getMaxHp();   // survive the measurement
    } catch (e) {}
  }, 120);
  return { bosses: game.monsters.filter((m) => m.isBoss).length, cls: player.cls };
});
await page.waitForTimeout(3000);
const B = await page.evaluate(() => new Promise((done) => {
  const deltas = [];
  let last = performance.now(); const t0 = last;
  const tick = (t) => {
    deltas.push(t - last); last = t;
    if (t - t0 < 8000) requestAnimationFrame(tick);
    else {
      deltas.sort((a, b) => a - b);
      done({ fps: +(deltas.length / 8).toFixed(1),
             median: +deltas[deltas.length >> 1].toFixed(1),
             p95: +deltas[Math.floor(deltas.length * 0.95)].toFixed(1),
             worst: +deltas[deltas.length - 1].toFixed(1),
             dmgN: game.damageNumbers.length, parts: game.particles.length,
             projs: game.projectiles.length, hazards: game.hazards.length });
    }
  };
  requestAnimationFrame(tick);
}));
await cdp.send('Profiler.start');
await page.waitForTimeout(5000);
const bossProf = await cdp.send('Profiler.stop');
const hits = await page.evaluate(() => {
  clearInterval(window.__atk);
  const k = game.monsters.filter((m) => m.isBoss).map((m) => m.type + ' hp ' + Math.round((m.currentHp / m.hp) * 100) + '%');
  return k.join(', ');
});
console.log(`\nB. boss fight (${bossPrep.cls} attacking, ${bossPrep.bosses} bosses; after: ${hits})`);
console.log(`   ${B.fps} fps  med ${B.median}ms  p95 ${B.p95}ms  WORST ${B.worst}ms   dmgNums ${B.dmgN} particles ${B.parts} projs ${B.projs} hazards ${B.hazards}`);
console.log('   top self-time during 5s of fighting:');
for (const l of topProfile(bossProf, 14)) console.log('     ' + l);

await b.close(); server.kill();
