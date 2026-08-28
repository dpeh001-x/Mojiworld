// Measure real gameplay in both engines — town and forest, with proof.
// ============================================================================
// The first version of this probe landed inside the PROLOGUE — a 30s scripted
// cinematic in the 'void' map — and its A/B/A baselines disagreed with each
// other because the scene itself was non-stationary. Nothing measured in a
// cutscene is usable.
//
// This version is state-driven instead of click-driven:
//   1. class pick as before (the card's own onclick),
//   2. then a loop that advances the prologue (Enter + every skip button)
//      until game.paused === false and window._prologueActive is falsy,
//   3. then loadMap('town') / loadMap('forest') DIRECTLY — the same top-level
//      function the game's own portals call — so the measurement happens in a
//      normal, stationary map: town = HUD + NPCs idle, forest = monsters.
//
// Ablations run A/B/A per row (baseline, effect, baseline) and a row whose
// baselines disagree by >18% is reported UNUSABLE, not summarised.
// Run: node scripts/ingame_perf_probe.mjs   (headed; LX_FFONLY=1 for Firefox only)
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
const PORT = Number(process.env.PORT || 11017);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const measure = () => new Promise((done) => {
  // A measurement that waits on rAF can hang FOREVER if the engine stops
  // presenting (occluded window, wedged compositor) - which is exactly the
  // failure being investigated. The 9s timer makes starvation a RESULT
  // (stalled:true) instead of a hang.
  const deltas = [];
  let last = performance.now();
  const t0 = last;
  let fin = false;
  const finish = (stalled) => {
    if (fin) return; fin = true;
    deltas.sort((a, b) => a - b);
    done({ fps: +(deltas.length / ((performance.now() - t0) / 1000)).toFixed(1),
           median: deltas.length ? +deltas[deltas.length >> 1].toFixed(1) : null,
           p95: deltas.length ? +deltas[Math.floor(deltas.length * 0.95)].toFixed(1) : null,
           stalled: !!stalled });
  };
  setTimeout(() => finish(true), 9000);
  const tick = (t) => {
    deltas.push(t - last); last = t;
    if (t - t0 < 3000) requestAnimationFrame(tick); else finish(false);
  };
  requestAnimationFrame(tick);
});

const WHERE = () => {
  const g = (typeof game !== 'undefined') ? game : null;
  return {
    paused: g ? g.paused : null,
    map: g ? String(g.currentMap).slice(0, 20) : null,
    monsters: g && g.monsters ? g.monsters.length : null,
    prologue: !!window._prologueActive,
    nobackdrop: document.documentElement.classList.contains('lx-nobackdrop'),
    lowFx: (typeof LX_PERF !== 'undefined') ? `${LX_PERF.lowFx}/${LX_PERF.veryLowFx}` : null,
    avgFrame: (typeof LX_PERF !== 'undefined') ? +LX_PERF.avgFrame.toFixed(1) : null,
  };
};

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
      if (!o || !o.firstElementChild) return false;
      const r = o.firstElementChild.getBoundingClientRect();
      return r.width > 40 && r.height > 40;
    });
    if (ready) break;
    if (!(await click('#cs-nav-next'))) break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => {
    const o = document.getElementById('class-options');
    if (o && o.firstElementChild) o.firstElementChild.click();
  });
  log.push('class picked');
  // Prologue: advance until the game is genuinely unpaused and the prologue
  // flag is down. Enter advances dialogue; the skip buttons end each stage.
  for (let i = 0; i < 45; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) {
      if (await click(sel, 1200)) log.push('clicked ' + sel + ' @' + i);
    }
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => ({
      p: (typeof game !== 'undefined') ? game.paused : null,
      pro: !!window._prologueActive,
    }));
    if (st.p === false && !st.pro) { log.push(`prologue cleared @${i * 2}s`); return true; }
  }
  log.push('prologue NEVER cleared');
  return false;
};

const ABA = async (page, label, on, off) => {
  const run = async (fn) => { await page.evaluate(fn); await page.waitForTimeout(700); return (await page.evaluate(measure)).fps; };
  const a = await run(off);
  const b = await run(on);
  const a2 = await run(off);
  const mean = (a + a2) / 2;
  const drift = Math.abs(a2 - a) > Math.max(2, a * 0.18);
  const verdict = drift ? 'UNUSABLE (baselines disagree)'
    : Math.abs(b - mean) <= Math.max(1.5, mean * 0.12) ? 'no effect'
    : `${b > mean ? '+' : ''}${((b / mean - 1) * 100).toFixed(0)}%`;
  console.log(`      ${String(a).padStart(6)} ${String(b).padStart(6)} ${String(a2).padStart(6)}    ${label} — ${verdict}`);
};

const CSS_ON = (css) => new Function(`
  let el = document.getElementById('__lx_ab');
  if (!el) { el = document.createElement('style'); el.id = '__lx_ab'; document.head.appendChild(el); }
  el.textContent = ${JSON.stringify(css)};`);
const CSS_OFF = CSS_ON('');

const inMap = async (page, map) => {
  await page.evaluate((m) => { try { loadMap(m); game.paused = false; } catch (e) {} }, map);
  await page.waitForTimeout(7000);   // let the map's sprite bakes settle
  return page.evaluate(WHERE);
};

const drive = async (name, launch) => {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const perf = [];
  page.on('console', (m) => { const t = m.text(); if (t.includes('[perf]')) perf.push(t.slice(0, 90)); });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(12000);
  const log = [];
  const ok = await reach(page, log);
  console.log(`\n### ${name}`);
  for (const l of log) console.log('    ' + l);
  if (perf.length) console.log('    ' + perf.join(' | '));
  if (!ok) { console.log('    ABORT: never got control'); await b.close(); return; }

  for (const map of ['town', 'forest']) {
    const w = await inMap(page, map);
    const usable = w.paused === false && w.map === map;
    const base = await page.evaluate(measure);
    console.log(`  -- ${map}:  ${base.fps} fps  median ${base.median}ms  p95 ${base.p95}ms   monsters=${w.monsters}  lowFx=${w.lowFx} avg=${w.avgFrame}  nobackdrop=${w.nobackdrop}${usable ? '' : '   NOT USABLE (paused=' + w.paused + ' map=' + w.map + ')'}`);
    if (!usable) continue;
    await ABA(page, 'lx-nobackdrop forced ON', new Function("document.documentElement.classList.add('lx-nobackdrop')"),
                                               new Function("document.documentElement.classList.remove('lx-nobackdrop')"));
    await ABA(page, 'HUD hidden entirely', CSS_ON('#top-ui,#stats,#skill-bar,#minimap-wrap,#minimap-canvas,#hotkey-hint,#mastery-bar{display:none !important}'), CSS_OFF);
    await ABA(page, 'all box-shadow off', CSS_ON('*{box-shadow:none !important}'), CSS_OFF);
    await ABA(page, 'weather off (LX_GFX)', new Function('LX_GFX.weather=false'), new Function('LX_GFX.weather=true'));
    await ABA(page, 'ambient off (LX_GFX)', new Function('LX_GFX.ambient=false'), new Function('LX_GFX.ambient=true'));
    await ABA(page, 'shadows off (LX_GFX)', new Function('LX_GFX.shadows=false'), new Function('LX_GFX.shadows=true'));
    await ABA(page, 'FX tiers forced', new Function('LX_PERF.lowFx=true;LX_PERF.veryLowFx=true;LX_PERF.lowFxUntil=1e9;LX_PERF.veryLowFxUntil=1e9'),
                                       new Function('LX_PERF.lowFx=false;LX_PERF.veryLowFx=false;LX_PERF.lowFxUntil=0;LX_PERF.veryLowFxUntil=0'));
  }
  await b.close();
};

const list = [];
if (existsSync(FF)) list.push(['FIREFOX', () => firefox.launch({ executablePath: FF, headless: false })]);
if (!process.env.LX_FFONLY) list.push(['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: false })]);
for (const [nm, launch] of list) {
  // A wedged engine forfeits ITS phase only - it cannot eat the whole run.
  await Promise.race([
    drive(nm, launch).catch((e) => console.log(`${nm}: ${String(e.message).slice(0, 180)}`)),
    new Promise((r) => setTimeout(() => { console.log(`${nm}: WATCHDOG - phase exceeded 7 min, abandoning`); r(); }, 420000)),
  ]);
}
server.kill();
