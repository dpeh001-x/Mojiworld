// How long until the title menu? Boots a build like a player (no dev flag, cold profile) and reports the time to the
// menu, the loading-screen phases it passed through, and the "[boot] decode gate cleared" console line.
//
//   [SERVE_ROOT=<dir>] node scripts/boot_time_probe.mjs [candidate.html | https://...]  [--runs=2]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const target = process.argv.slice(2).find((a) => !a.startsWith('--')) || '';
const runs = Number(((process.argv.find((a) => a.startsWith('--runs=')) || '').split('=')[1]) || 1);
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11105';
let server = null, URL = target;
if (!/^https?:/.test(target)) {
  const env = { ...process.env }; if (target) env.MOJI_GAME_FILE = path.resolve(target); else delete env.MOJI_GAME_FILE;
  server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
  await new Promise((r) => setTimeout(r, 1800)); URL = `http://localhost:${PORT}/mojiworld_game.html`;
}
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
try {
  for (let i = 0; i < runs; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } }); const page = await ctx.newPage();
    const logs = []; page.on('console', (m) => { if (/\[boot\]/.test(m.text())) logs.push(m.text().slice(0, 120)); });
    const t0 = Date.now(); const phases = [];
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof GAME_VERSION === 'string', null, { timeout: 180000 });
    const tScripts = Date.now() - t0;
    let menuAt = null;
    for (let k = 0; k < 600 && menuAt == null; k++) {
      const s = await page.evaluate(() => { const m = document.getElementById('lo-menu'); const st = document.querySelector('#loading-overlay .status, #lo-status'); return { menu: !!m && getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0, status: st ? st.textContent.trim().slice(0, 60) : '' }; }).catch(() => ({ menu: false, status: '' }));
      if (s.status && (!phases.length || phases[phases.length - 1].s !== s.status)) phases.push({ t: Date.now() - t0, s: s.status });
      if (s.menu) menuAt = Date.now() - t0; else await page.waitForTimeout(250);
    }
    const ver = await page.evaluate(() => GAME_VERSION).catch(() => '?');
    console.log(`run ${i + 1}: ${ver}  scripts ready ${tScripts} ms  MENU AT ${menuAt == null ? '>150 s' : menuAt + ' ms'}  | ${logs.join(' | ') || 'no [boot] line'}`);
    const decoding = phases.find((p) => /Decoding world/.test(p.s)); const ready = phases.find((p) => /Ready/.test(p.s));
    console.log(`   phases: ${phases.slice(0, 4).map((p) => p.t + 'ms "' + p.s + '"').join(' -> ')}${phases.length > 4 ? ' -> …' : ''}${decoding ? ` | decoding from ${decoding.t} ms` : ''}${ready ? ` | ready at ${ready.t} ms` : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); if (server) server.kill(); }
