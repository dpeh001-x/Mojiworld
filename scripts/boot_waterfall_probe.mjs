// Where does the time to the title menu go? Cold profile, no dev flag; every network request is timed (CDP), and
// the boot milestones are stamped: HTML downloaded, scripts executed, each loading-screen phase, menu visible.
//
//   [SERVE_ROOT=<dir>] node scripts/boot_waterfall_probe.mjs [candidate.html | https://...] [--json=out.json]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const target = process.argv.slice(2).find((a) => !a.startsWith('--')) || '';
const jsonOut = ((process.argv.find((a) => a.startsWith('--json=')) || '').split('=')[1]) || '';
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11111';
let server = null, URL_ = target;
if (!/^https?:/.test(target)) {
  const env = { ...process.env }; if (target) env.MOJI_GAME_FILE = path.resolve(target); else delete env.MOJI_GAME_FILE;
  server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
  await new Promise((r) => setTimeout(r, 1800)); URL_ = `http://localhost:${PORT}/mojiworld_game.html`;
}
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } }); const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable');
const req = new Map(); let t0 = 0;
cdp.on('Network.requestWillBeSent', (e) => { if (!req.has(e.requestId)) req.set(e.requestId, { url: e.request.url, start: Date.now(), prio: e.request.initialPriority }); });
cdp.on('Network.responseReceived', (e) => { const r = req.get(e.requestId); if (r) { r.status = e.response.status; r.ttfb = Date.now(); r.fromCache = !!e.response.fromDiskCache; } });
cdp.on('Network.loadingFinished', (e) => { const r = req.get(e.requestId); if (r) { r.end = Date.now(); r.bytes = e.encodedDataLength; } });
cdp.on('Network.loadingFailed', (e) => { const r = req.get(e.requestId); if (r) { r.end = Date.now(); r.failed = e.errorText; } });
t0 = Date.now(); const marks = {}; const phases = [];
await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 240000 });
if (/External Content Notice/.test(await page.title())) {   // githack's "Open the page" interstitial: the clock starts at the click
  req.clear(); t0 = Date.now();
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 240000 }), page.click('button.url-action-button')]);
}
marks.domContentLoaded = Date.now() - t0;
await page.waitForFunction(() => typeof GAME_VERSION === 'string', null, { timeout: 240000 }); marks.scriptsRan = Date.now() - t0;
let last = '';
for (let i = 0; i < 1500; i++) {
  const s = await page.evaluate(() => { const m = document.getElementById('lo-menu'); const t = document.getElementById('loading-status');
    return { menu: !!(m && getComputedStyle(m).display !== 'none' && m.offsetParent !== null), txt: t ? t.textContent.trim().slice(0, 60) : '' }; }).catch(() => ({ menu: false, txt: '' }));
  const key = s.txt.replace(/\d+/g, '#'); if (key && key !== last) { phases.push({ t: Date.now() - t0, txt: s.txt }); last = key; }
  if (s.menu) { marks.menu = Date.now() - t0; break; }
  await page.waitForTimeout(100);
}
const ver = await page.evaluate(() => GAME_VERSION).catch(() => '?');
const all = [...req.values()].map((r) => ({ ...r, s: r.start - t0, e: (r.end || Date.now()) - t0 }));
const before = all.filter((r) => r.s <= (marks.menu || 9e9));
const group = (u) => /mojiworld_game\.html|\/Mojiworld\/?$/.test(u) ? 'page' : /\/data\/[^/]+\.js/.test(u) ? 'data tables' : /\/Sprites\//.test(u) ? 'sprites' : /\/backgrounds\//.test(u) ? 'backgrounds'
  : /\/audio\//.test(u) ? 'audio' : /fonts\.g|\.woff/.test(u) ? 'fonts' : /\.mp4|\.webm/.test(u) ? 'video' : 'other';
const G = {}; for (const r of before) { const g = G[group(r.url)] || (G[group(r.url)] = { n: 0, kb: 0, firstStart: 9e9, lastEnd: 0, failed: 0 }); g.n++; g.kb += (r.bytes || 0) / 1024; g.firstStart = Math.min(g.firstStart, r.s); g.lastEnd = Math.max(g.lastEnd, r.e); if (r.failed || r.status >= 400) g.failed++; }
console.log(`build ${ver}   ${URL_}`);
console.log('milestones (ms):', JSON.stringify(marks));
console.log('phases:', phases.map((p) => `${(p.t / 1000).toFixed(1)}s ${p.txt}`).join('  |  '));
console.log('requests started before the menu: ' + before.length + ', ' + (before.reduce((a, r) => a + (r.bytes || 0), 0) / 1048576).toFixed(1) + ' MB');
for (const [k, g] of Object.entries(G).sort((a, b) => b[1].kb - a[1].kb)) console.log(`  ${k.padEnd(12)} ${String(g.n).padStart(4)} req  ${(g.kb / 1024).toFixed(2).padStart(6)} MB   ${(g.firstStart / 1000).toFixed(1)}s -> ${(g.lastEnd / 1000).toFixed(1)}s${g.failed ? '   failed ' + g.failed : ''}`);
const page0 = before.find((r) => group(r.url) === 'page'); if (page0) console.log(`page: ttfb ${(page0.ttfb - t0)} ms, done ${page0.e} ms, ${((page0.bytes || 0) / 1048576).toFixed(2)} MB on the wire`);
console.log('slowest 8 before the menu:'); for (const r of before.slice().sort((a, b) => (b.e - b.s) - (a.e - a.s)).slice(0, 8)) console.log(`  ${String(r.e - r.s).padStart(6)} ms  ${((r.bytes || 0) / 1024).toFixed(0).padStart(6)} KB  ${r.s}..${r.e}  ${r.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 90)}`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ ver, url: URL_, marks, phases, requests: all }, null, 0));
await browser.close(); if (server) server.kill();
