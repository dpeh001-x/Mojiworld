// The boot image hold (v0.30.806). On a web deploy, sprite and background loads the title menu does not need are
// held until the menu is up. One build, one throttled link (48 Mbps, 20 ms), booted three ways:
//   A  a made-up public hostname with ?lxhold=0  - the old behaviour, as the control
//   B  the same hostname, default                - the hold
//   C  localhost                                 - the hold must not exist (local art, harnesses, the packaged app)
// B must start far fewer requests before the menu and reach it no later than A; then everything held must still
// arrive, the world must be enterable, and nothing may throw.
//
//   [SERVE_ROOT=<dir with serve.js + data/ + art>] node scripts/boot_hold_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11112';
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const THROTTLE = { offline: false, latency: 20, downloadThroughput: 6 * 1024 * 1024, uploadThroughput: 1024 * 1024 };
const boot = async (url, keep) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } }); const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', THROTTLE);
  const errs = [], logs = []; let reqs = 0, art = 0; let counting = true;
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (/\[boot\] image hold/.test(m.text())) logs.push(m.text()); });
  cdp.on('Network.requestWillBeSent', (e) => { if (!counting) return; reqs++; if (/\/(Sprites|backgrounds)\//.test(e.request.url)) art++; });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => typeof GAME_VERSION === 'string', null, { timeout: 240000 });
  const early = await page.evaluate(() => { const h = window._lxBootHold; if (!h) return null; const st = h.stats();
    let sample = null; try { const im = h.peek(); if (im) sample = { src: im.src, complete: im.complete, w: im.naturalWidth }; } catch (e) {} return { st, sample }; });
  const menu = await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0; }, null, { timeout: 240000 }).then(() => true).catch(() => false);
  const menuMs = Date.now() - t0; counting = false;
  const r = { menu, menuMs, reqs, art, early, errs, logs, ver: await page.evaluate(() => GAME_VERSION) };
  if (keep) return { r, page, ctx, cdp }; await ctx.close(); return { r };
};
try {
  const base = `http://play.mojiworld.test:${PORT}/mojiworld_game.html`;
  const A = (await boot(base + '?lxhold=0')).r;
  const Bk = await boot(base, true); const B = Bk.r;
  console.log('build ' + B.ver);
  console.log(`  A hold off: menu ${A.menuMs} ms, ${A.reqs} requests (${A.art} art) started before it`);
  console.log(`  B hold on : menu ${B.menuMs} ms, ${B.reqs} requests (${B.art} art) started before it`);
  check(A.menu && B.menu, 'both boots reach the title menu');
  check(A.early === null, 'A: ?lxhold=0 switches the hold off');
  check(!!B.early && B.early.st.held > 800, 'B: on a public hostname the parse-time loaders are held', B.early ? JSON.stringify(B.early.st) : 'no hold');
  check(!!B.early && !!B.early.sample && /\/Sprites\//.test(B.early.sample.src) && B.early.sample.complete === false && B.early.sample.w === 0, 'a held image reads as still loading: src answers, complete is false', B.early ? JSON.stringify(B.early.sample) : '');
  check(B.art < A.art * 0.4, 'B starts far fewer art requests before the menu', `${B.art} vs ${A.art}`);
  check(B.menuMs <= A.menuMs + 1500, 'B reaches the menu no later than A', `${B.menuMs} vs ${A.menuMs} ms`);
  check(B.logs.some((l) => /released \(menu\)/.test(l)), 'the hold is released by the menu, not the failsafe', B.logs.join(' | '));
  // everything held still arrives (full speed from here), and the world is enterable
  await Bk.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const drained = await Bk.page.waitForFunction(() => window._lxBootHold.stats().held === 0, null, { timeout: 180000 }).then(() => true).catch(() => false);
  const st = await Bk.page.evaluate(() => window._lxBootHold.stats());
  check(drained, 'the queue drains completely after the menu', JSON.stringify(st));
  const world = await Bk.page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(4000);
    const types = [...new Set(game.monsters.map((m) => m.type))]; let ok = 0, n = 0;
    for (const t of types) { const im = MONSTER_SPRITES[t]; if (!im) continue; n++; if (im.complete && im.naturalWidth > 0) ok++; }
    const reg = (window._lxRegistryImages || []); const regOk = reg.filter((im) => im && im.complete && im.naturalWidth > 0).length;
    return { types: n, loaded: ok, reg: reg.length, regOk };
  });
  check(world.types > 0 && world.loaded === world.types, 'in the world, every monster type on the map has its sprite', JSON.stringify(world));
  check(world.reg === 0 || world.regOk / world.reg > 0.9, 'and the registries filled in behind the menu', `${world.regOk}/${world.reg}`);
  check(!A.errs.length && !B.errs.length, 'no page errors in either boot', A.errs.concat(B.errs).slice(0, 2).join(' | '));
  await Bk.ctx.close();
  const C = await browser.newPage(); await C.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await C.waitForFunction(() => typeof GAME_VERSION === 'string', null, { timeout: 240000 });
  check(await C.evaluate(() => typeof window._lxBootHold === 'undefined'), 'C: on localhost the hold does not exist');
} catch (e) { check(false, 'harness error', String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
