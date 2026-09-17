// The art the launch checklist found missing is there and used: the quest journal's type tiles load (no emoji
// fallback), the eight potion icons and the verdantHaven world-map emblem answer 200, and a lost graphics context
// saves and asks for a reload.
//
//   [SERVE_ROOT=<dir with serve.js + data/ + art>] node scripts/launch_art_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11107';
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const notFound = []; page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url().replace(/^https?:\/\/[^/]+\//, '')); });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof toggleQuestJournal === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(1200); game.paused = false; player.level = 60;
    const head = async (u) => { try { const x = await fetch(u, { cache: 'no-store' }); return x.status; } catch (e) { return 0; } };
    const files = {}; for (const u of ['Sprites/world/regions/verdantHaven.webp', ...['hunt', 'boss', 'talk', 'explore', 'bounty'].map((t) => `Sprites/ui/quest/${t}.webp`), ...['hp_s', 'hp_m', 'hp_l', 'mp_s', 'mp_m', 'mp_l', 'full', 'cure'].map((t) => `Sprites/boons/${t}.webp`)]) files[u] = await head(u);
    toggleQuestJournal(); await sleep(1800);
    const tiles = [...document.querySelectorAll('img.qj-ico-art')];
    const loaded = tiles.filter((im) => im.complete && im.naturalWidth > 0).length, failed = tiles.filter((im) => im.classList.contains('qj-ico-fail')).length;
    const types = [...new Set(tiles.map((im) => im.dataset.qtype))];
    try { closeAllModals(); } catch (e) {} game.paused = false;
    // a lost context: the handler must flush the save and schedule one reload (the reload itself is stubbed out)
    let flushed = 0; const f0 = window._flushSaveStateNow; window._flushSaveStateNow = function () { flushed++; return f0 && f0.apply(this, arguments); };
    sessionStorage.removeItem('lx_ctxlost_reload');
    const ev = new Event('contextlost', { cancelable: true }); const cv = document.getElementById('game'); cv.dispatchEvent(ev);
    const stamp = sessionStorage.getItem('lx_ctxlost_reload');
    window.stop && 0;
    return { files, tiles: tiles.length, loaded, failed, types, ctx: { prevented: ev.defaultPrevented, flushed, stamped: !!stamp }, ver: GAME_VERSION };
  });
  console.log('build ' + r.ver);
  const missing = Object.entries(r.files).filter(([, s]) => s !== 200).map(([u, s]) => u + ' ' + s);
  check(!missing.length, 'all 14 new art files are served (1 world-map emblem, 5 quest tiles, 8 potions)', missing.join(', ') || '14 x 200');
  check(r.tiles > 0 && r.loaded === r.tiles && r.failed === 0, 'the quest journal shows its type tiles as art, none falling back to emoji', `${r.loaded}/${r.tiles} loaded, types ${r.types.join(' ')}`);
  check(r.ctx.prevented && r.ctx.flushed >= 1 && r.ctx.stamped, 'a lost graphics context saves the game and schedules one reload', JSON.stringify(r.ctx));
  const stray = notFound.filter((u) => /Sprites\/(ui\/quest|boons|world\/regions)/.test(u));
  check(!stray.length && !errs.length, 'no 404s from the quest / potion / region art and no page errors', stray.concat(errs).slice(0, 3).join(' | '));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
