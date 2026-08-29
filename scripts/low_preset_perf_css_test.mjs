// Live test: THE LOW PRESET ENGAGES THE MEASURED PERF LEVERS IMMEDIATELY.
//
// Per user: "despite going on low graphics performance mode, there is way too
// much lag". The v0.30.274 in-game ablations measured the real cost as DOM
// compositing (+18% fps with box-shadows off, +15-19% with backdrop blurs
// off) — and both live under html.lx-nobackdrop, which only the frame
// watchdogs ever engaged. The Low preset gated only canvas systems the same
// ablations measured as noise.
//
// Pinned here: choosing Low adds the class (and with it box-shadow:none,
// backdrop-filter:none, the #game grade drop, and the paused infinite HUD
// pulses); leaving Low removes it; a watchdog trip stays sticky over the
// preset; custom-tweaked-from-Low keeps it.
//   node scripts/low_preset_perf_css_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _applySettings === 'function' && typeof _lxGetSettings === 'function', null, { timeout: 120000 });
await page.waitForTimeout(1500);   // let the boot _applySettings(100ms) pass finish

const r = await page.evaluate(() => {
  const de = document.documentElement;
  const cls = () => de.classList.contains('lx-nobackdrop');
  const out = { hasFn: typeof _lxApplyQualityCss === 'function' };
  // Headless Chrome can be SwiftShader, which legitimately trips the sticky
  // software-renderer path at boot. Neutralize it so the preset's own
  // reversible behaviour is what gets measured.
  try { _lxNoBackdropOn = false; } catch (e) { out.stickyResetFailed = true; }
  de.classList.remove('lx-nobackdrop');

  const s = _lxGetSettings();
  s.gfx = 'low'; _applySettings(s);
  out.lowEngages = cls();

  // the CSS the class carries, measured on live probes
  const probe = document.createElement('div');
  probe.style.cssText = 'box-shadow: 0 0 14px 2px rgba(255,170,80,0.7); backdrop-filter: blur(4px); position:absolute; left:-9999px;';
  document.body.appendChild(probe);
  const pc = getComputedStyle(probe);
  out.boxShadowKilled = pc.boxShadow === 'none';
  out.backdropKilled = (pc.backdropFilter || pc.webkitBackdropFilter || 'none') === 'none';
  const xp = document.getElementById('exp-bar');
  let xpHad = null;
  if (xp) { xpHad = xp.classList.contains('xp-near'); xp.classList.add('xp-near');
    out.xpPulsePaused = getComputedStyle(xp).animationName === 'none';
    if (!xpHad) xp.classList.remove('xp-near'); }
  const hp = document.querySelector('.hp-fill');
  let hpHad = null;
  if (hp) { hpHad = hp.classList.contains('hp-critical'); hp.classList.add('hp-critical');
    out.hpPulsePaused = getComputedStyle(hp).animationName === 'none';
    if (!hpHad) hp.classList.remove('hp-critical'); }
  probe.remove();

  // custom-tweaked-from-Low keeps the class (the resolved preset carries it)
  s.gfx = 'custom'; s.gfxBase = 'low'; _applySettings(s);
  out.customFromLowKeeps = cls();

  // leaving Low releases it (no watchdog has tripped)
  s.gfx = 'high'; s.gfxBase = 'high'; _applySettings(s);
  out.highReleases = !cls();

  // a watchdog trip is sticky over the preset
  if (typeof _lxSetNoBackdrop === 'function') _lxSetNoBackdrop('test trip');
  s.gfx = 'high'; _applySettings(s);
  out.watchdogSticky = cls();

  // restore the saved settings to what the page booted with
  try { const s0 = _lxGetSettings(); _applySettings(s0); } catch (e) {}
  return out;
});

ok('the preset->class wiring exists (_lxApplyQualityCss)', r.hasFn, r);
ok('choosing Low engages html.lx-nobackdrop immediately', r.lowEngages, r);
ok('under Low, box-shadows are gone (the +18% lever)', r.boxShadowKilled, r);
ok('under Low, backdrop blurs are gone (the +15-19% lever)', r.backdropKilled, r);
ok('under Low, the infinite XP-near pulse is paused', r.xpPulsePaused === true, r);
ok('under Low, the infinite HP-critical pulse is paused', r.hpPulsePaused === true, r);
ok('custom-tweaked-from-Low keeps the class', r.customFromLowKeeps, r);
ok('switching back to High releases the class', r.highReleases, r);
ok('a watchdog trip stays sticky over the preset', r.watchdogSticky, r);
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 300));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
