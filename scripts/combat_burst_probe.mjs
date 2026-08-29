// Measure the lag the user actually reported: multikill bursts and boss fights.
// ============================================================================
// The idle-map probe proved DOM compositing dominates IDLE cost, but the
// complaint is "laggy when i multikill, boss fights and late game" — burst
// load: many deaths in one frame (loot, EXP, FX, kill hooks), and sustained
// boss AI + projectiles. This drives exactly those two scenarios through the
// game's REAL code paths:
//
//   multikill  spawnMonster() x N around the player in forest, settle, then
//              killMonster(m) for every wild mob in ONE evaluate — the same
//              synchronous death pipeline a screen-clear skill triggers.
//   boss       spawnMonster(kingKrook, isBoss) + octobaby next to the player,
//              measured over 8s of live AI, projectiles and tentacle arms.
//
// Per phase it records fps / median / p95 / WORST frame, and samples the
// combat arrays (particles, damageNumbers, drops, projectiles, hazards,
// floatingTexts, afterImages) every 500ms so whatever balloons is named, not
// guessed. The worst frame is the number that IS the felt lag spike.
// Run: node scripts/combat_burst_probe.mjs   (Chromium headed; LX_FF=1 adds Firefox)
import { createRequire } from 'node:module';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 11031);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

// Window-length measurement with array sampling; resolves even if rAF starves.
const measureLong = (ms) => new Promise((done) => {
  const deltas = [], samples = [];
  const g = (typeof game !== "undefined") ? game : { monsters: [], particles: [], damageNumbers: [], drops: [], projectiles: [], hazards: [], floatingTexts: [], afterImages: [] };
  const snap = () => samples.push({
    t: +(performance.now() - t0).toFixed(0),
    mon: g.monsters.length, part: g.particles.length, dmg: g.damageNumbers.length,
    drops: g.drops.length, proj: g.projectiles.length, haz: g.hazards.length,
    float: g.floatingTexts.length, after: g.afterImages.length,
  });
  const t0 = performance.now();
  let last = t0, fin = false;
  const iv = setInterval(snap, 500);
  const finish = (stalled) => {
    if (fin) return; fin = true; clearInterval(iv);
    const sorted = [...deltas].sort((a, b) => a - b);
    const peak = (k) => Math.max(0, ...samples.map((s) => s[k]));
    done({
      stalled: !!stalled,
      fps: +(deltas.length / ((performance.now() - t0) / 1000)).toFixed(1),
      median: sorted.length ? +sorted[sorted.length >> 1].toFixed(1) : null,
      p95: sorted.length ? +sorted[Math.floor(sorted.length * 0.95)].toFixed(1) : null,
      worst: sorted.length ? +sorted[sorted.length - 1].toFixed(1) : null,
      peaks: { part: peak('part'), dmg: peak('dmg'), drops: peak('drops'),
               proj: peak('proj'), haz: peak('haz'), float: peak('float'),
               after: peak('after'), mon: peak('mon') },
    });
  };
  setTimeout(() => finish(true), ms + 9000);
  const tick = (t) => { deltas.push(t - last); last = t;
    if (t - t0 < ms) requestAnimationFrame(tick); else finish(false); };
  requestAnimationFrame(tick);
});

const reach = async (page, log) => {
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
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip'])
      await click(sel, 1200);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => ({
      p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) { log.push(`in control @${i * 2}s`); return true; }
  }
  log.push('never got control');
  return false;
};

const fmt = (r) => `${String(r.fps).padStart(6)} fps  med ${String(r.median).padStart(5)}ms  p95 ${String(r.p95).padStart(6)}ms  WORST ${String(r.worst).padStart(7)}ms${r.stalled ? '  [STALLED]' : ''}`
  + `\n           peaks: particles ${r.peaks.part}  dmgNums ${r.peaks.dmg}  drops ${r.peaks.drops}  proj ${r.peaks.proj}  haz ${r.peaks.haz}  float ${r.peaks.float}  after ${r.peaks.after}  monsters ${r.peaks.mon}`;

const drive = async (name, launch) => {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(12000);
  const log = [];
  const ok = await reach(page, log);
  console.log(`\n### ${name}`);
  for (const l of log) console.log('    ' + l);
  if (!ok) { await b.close(); return; }
  await page.bringToFront().catch(() => {});

  // Forest, then a quiet baseline.
  await page.evaluate(() => { try { loadMap('forest'); game.paused = false; } catch (e) {} });
  await page.waitForTimeout(7000);
  await page.bringToFront().catch(() => {});
  const quiet = await page.evaluate(measureLong, 4000);
  console.log('  quiet forest   ' + fmt(quiet));

  // MULTIKILL: spawn N, settle, then kill every wild mob in one frame.
  for (const N of [40, 80]) {
    const spawned = await page.evaluate((n) => {
      let okN = 0;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, r = 140 + (i % 5) * 60;
        const _ty = ['snail', 'slime', 'petalfly'][i % 3];
        const m = spawnMonster(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r, _ty, false);
        if (m && !m._suppressed) okN++;
      }
      return { okN, alive: game.monsters.length };
    }, N);
    await page.waitForTimeout(1500);
    const burst = page.evaluate(measureLong, 6000);          // start sampling FIRST
    await page.waitForTimeout(300);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 100 });   // 100us
    await cdp.send("Profiler.start");
    const attr = await page.evaluate(() => {
      // The wipe loop is ONE synchronous task: its wall time IS the frame
      // stall the player feels. Wrap the heavyweight suspects for the
      // duration and attribute.
      const T = {};
      const wrap = (name) => {
        const fn = window[name];
        if (typeof fn !== "function") return () => {};
        window[name] = function (...a) {
          const t = performance.now();
          try { return fn.apply(this, a); }
          finally { const e = performance.now() - t; const o = T[name] || (T[name] = { n: 0, ms: 0 }); o.n++; o.ms += e; }
        };
        return () => { window[name] = fn; };
      };
      const undo = ["saveState", "_lxQuestKill", "checkDaily", "showToast", "_beginMonsterFade"].map(wrap);
      const t0 = performance.now();
      for (const m of [...game.monsters]) if (!m.isBoss) killMonster(m);
      const wipeMs = performance.now() - t0;
      for (const u of undo) u();
      const rows = Object.entries(T).map(([k, v]) => k + " " + v.n + "x " + v.ms.toFixed(1) + "ms").join("  |  ");
      return { wipeMs: +wipeMs.toFixed(1), rows };
    });
    console.log('    wipe loop itself: ' + attr.wipeMs + 'ms synchronous   [' + attr.rows + ']');
    const prof = await cdp.send("Profiler.stop");
    await cdp.detach().catch(() => {});
    // Self-time per function across the whole capture; the wipe dominates it.
    const nodes = prof.profile.nodes, dt = prof.profile.timeDeltas || [], sm = prof.profile.samples || [];
    const selfUs = new Map();
    for (let i = 0; i < sm.length; i++) selfUs.set(sm[i], (selfUs.get(sm[i]) || 0) + (dt[i] || 0));
    const byFn = new Map();
    for (const n of nodes) {
      const us = selfUs.get(n.id) || 0;
      if (!us) continue;
      const k = (n.callFrame.functionName || "(anon)") + ":" + n.callFrame.lineNumber;
      byFn.set(k, (byFn.get(k) || 0) + us);
    }
    const top = [...byFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    console.log("    top self-time during wipe capture:");
    for (const [k, us] of top) console.log("      " + (us / 1000).toFixed(1) + "ms  " + k);
    const r = await burst;
    console.log(`  multikill x${String(spawned.okN).padEnd(3)} ${fmt(r)}`);
    await page.waitForTimeout(4000);                          // let FX decay fully
  }

  // BOSS FIGHT: Krook + Octobaby live next to the player for 8s.
  await page.evaluate(() => {
    spawnMonster(player.x + 260, player.y, 'kingKrook', true);
    spawnMonster(player.x - 300, player.y, 'octobaby', true);
  });
  await page.waitForTimeout(2500);
  const boss = await page.evaluate(measureLong, 8000);
  console.log('  boss fight     ' + fmt(boss));

  await b.close();
};

const list = [['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: true })]];
if (process.env.LX_FF && existsSync(FF)) list.push(['FIREFOX', () => firefox.launch({ executablePath: FF, headless: false })]);
for (const [nm, launch] of list) {
  await Promise.race([
    drive(nm, launch).catch((e) => console.log(`${nm}: ${String(e.message).slice(0, 180)}`)),
    new Promise((r) => setTimeout(() => { console.log(`${nm}: WATCHDOG 7min`); r(); }, 420000)),
  ]);
}
server.kill();
