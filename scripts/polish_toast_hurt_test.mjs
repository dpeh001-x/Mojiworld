// FINAL POLISH, SECOND PASS - TOASTS AND GETTING HIT (audit F11, C7; per user "keep going to test and debug"). A level-up's
// burst of toasts no longer evicts itself in under a second: the same text never shows twice, a less important toast waits
// its turn, the Lv 20 advancement is said once; and a real hit on the player flashes a red edge scaled by the HP it took.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/polish_toast_hurt_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11218';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof showToast === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 30; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(2500); try { closeAllModals(); } catch (e) {}
    try { LX_PERF.lowFx = true; LX_PERF.lowFxUntil = performance.now() + 1e9; LX_PERF._announcedLowFx = true; LX_PERF._announcedVeryLowFx = true; } catch (e) {}   // no perf toasts mid-test
    const host = document.getElementById('toast-container');
    const texts = () => [...host.querySelectorAll('.toast')].map((t) => t.textContent);
    const clear = () => { host.querySelectorAll('.toast').forEach((t) => t.remove()); try { _lxToastWait.length = 0; } catch (e) {} };
    // the stack checks see only their own toasts (the game's own - map titles, story nudges - are held off until after)
    const _real = window.showToast, OWN = /^(▶ Next: the same line|epic [A-D]|a small tip|New skill learnt — Test|⚠ A warning)$/;
    window.showToast = function (t, r) { return OWN.test(String(t)) ? _real.apply(this, arguments) : undefined; };
    // dedupe
    clear(); showToast('▶ Next: the same line', 'epic'); showToast('▶ Next: the same line', 'epic');
    out.dup = texts().filter((t) => /the same line/.test(t)).length;
    // a full stack: a less important toast waits, a more important one takes the least important's place
    clear(); for (const k of ['A', 'B', 'C', 'D']) showToast('epic ' + k, 'epic');
    showToast('a small tip', 'rare'); out.tipNow = texts().includes('a small tip');
    showToast('New skill learnt — Test', 'legendary'); out.legendNow = texts().includes('New skill learnt — Test');
    showToast('⚠ A warning', 'danger'); out.afterDanger = texts();
    await sleep(3600); out.later = texts(); window.showToast = _real;
    // a Lv 20 level-up with the job pending: the advancement said once, the Lv 5 burst stays readable
    clear(); const seen = []; const t0 = performance.now();
    const mo = new MutationObserver((ms) => { for (const m of ms) { for (const n of m.addedNodes) if (n.classList && n.classList.contains('toast')) seen.push({ txt: n.textContent, in: performance.now() - t0 }); for (const n of m.removedNodes) if (n.classList && n.classList.contains('toast')) { const s = seen.find((x) => x.txt === n.textContent && x.out == null); if (s) s.out = performance.now() - t0; } } });
    const best = () => { const by = {}; for (const x of seen) { const d = x.out == null ? 1e9 : x.out - x.in; /* still up when the window closes: not cut short */ by[x.txt] = Math.max(by[x.txt] || 0, d); } return Object.entries(by).map(([txt, ms]) => ({ txt: txt.slice(0, 40), ms: Math.round(ms) })); };
    mo.observe(host, { childList: true });
    player.level = 19; player.job = null; player.master = null; player._advNudge20 = false; player.expToNext = 100; player.exp = 100; _maybeLevelUp(); await sleep(3500);
    out.adv = seen.filter((x) => /Advancement|slot unlocks/i.test(x.txt)).map((x) => x.txt.slice(0, 120));
    clear(); seen.length = 0; player.level = 4; player.expToNext = 100; player.exp = 100; _maybeLevelUp(); await sleep(9000); mo.disconnect();
    out.burst = best();
    // C7 - a real hit flashes the red edge; a 1% tick does not; Screen Flashes 0% silences it
    // the edge is drawn on the canvas; count the red radial fills the renderer makes while it is armed
    const hit = (frac) => { game._lxHurtA = 0; player.hp = getMaxHp(); updateUI(); player.hp = Math.floor(getMaxHp() * (1 - frac)); updateUI(); return { a: +(game._lxHurtA || 0).toFixed(2), hit: (game._lxHurtA || 0) > 0.3 }; };
    out.hasEdge = true;
    game._flashMul = 1; game._reduceMotion = false;
    out.big = hit(0.10); out.tick = hit(0.01); game._flashMul = 0; out.silenced = hit(0.10); game._flashMul = 1;
    out.big2 = hit(0.10); game.paused = false; await sleep(120); out.faded = +(game._lxHurtA || 0).toFixed(2); await sleep(900); out.gone = +(game._lxHurtA || 0).toFixed(2);
    return out;
  });
  check(r.dup === 1, 'the same toast twice shows once', J(r.dup));
  check(!r.tipNow && r.legendNow && r.afterDanger.includes('⚠ A warning') && r.afterDanger.includes('New skill learnt — Test') && r.afterDanger.length === 4, 'a full stack: a tip waits its turn, a legendary and a warning go up at once', J({ tipNow: r.tipNow, legendNow: r.legendNow, stack: r.afterDanger }));
  check(r.later.includes('a small tip') && r.later.filter((t) => /^epic /.test(t)).length >= 1, '...the tip appears once a slot frees, and the epics they displaced come back', J(r.later));
  check(r.adv.length === 1 && /Your job brings your F skill/.test(r.adv[0]), 'Lv 20 announces the class advancement once, not three times', J(r.adv));
  const early = r.burst.filter((x) => x.ms < 2000);
  check(r.burst.length >= 4 && early.length === 0, 'the Lv 5 burst: every toast gets at least 2 s on screen in one stretch', J(r.burst));
  check(r.hasEdge && r.big && r.big.hit && r.big.a > 0.5, 'a hit that takes 10% HP flashes the red edge', J(r.big));
  check(r.tick && !r.tick.hit, '...a 1% tick does not', J(r.tick));
  check(r.silenced && !r.silenced.hit, '...and Screen Flashes 0% silences it', J(r.silenced));
  check(r.faded < r.big2.a && r.gone < 0.03, '...and the edge fades away within a second', J({ at: r.big2.a, after120ms: r.faded, after1s: r.gone }));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
