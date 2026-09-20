// The five dev overlays are GONE (per user, 2026-09-20: "remove the T Ctrl 2 4 R dev panels").
// Gear Align (2), Monster Plant (T), NPC Plant (4), the Stage Editor (R) and the Ctrl Prop Editor - none of them had
// been reachable by key for some time, and every one of them edited data that is now committed in data/*.js and in
// the baked MAPS / MAP_PROPS. What this pins: the editors are gone, nothing dangles, and the game still READS the
// data they used to write - a monster's Y-offset and scale, an NPC's, a gear piece's attach point and erase mask,
// and a map's props - so the world looks exactly as it did.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/dev_panels_gone_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11241';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('LX_DEV', '1'); } catch (e) {} });   // fully unlocked dev
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxMobYOff === 'function' && typeof _lxNpcYOff === 'function', null, { timeout: 120000 });
  const gone = await page.evaluate(() => {
    const names = ['_lxMpToggle', '_lxGearAlignToggle', '_lxNpToggle', '_lxSeToggle', '_lxPeToggle',
      '_lxMpBuild', '_lxGaBuild', '_lxNpBuild', '_lxSeBuild', '_lxPeBuild', '_lxPeDrawOverlay', '_lxGaOpenErase'];
    const left = names.filter((n) => typeof window[n] !== 'undefined');
    const states = ['_LX_MP', '_LX_GA', '_LX_NP', '_LX_SE', '_LX_PE'].filter((n) => typeof window[n] !== 'undefined');
    return { left, states };
  });
  check(gone.left.length === 0 && gone.states.length === 0, 'every panel, its builder and its state are gone', J(gone));
  // the data those tools authored still reaches the game
  const data = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(1500); try { closeAllModals(); } catch (e) {}
    const someMob = Object.keys((typeof window.LX_MOB_OFFSET_DATA === 'object' && window.LX_MOB_OFFSET_DATA) || {})[0] || null;
    const someNpc = Object.keys((typeof window.LX_NPC_OFFSET_DATA === 'object' && window.LX_NPC_OFFSET_DATA) || {})[0] || null;
    return {
      mobOffsets: Object.keys(window.LX_MOB_OFFSET_DATA || {}).length,
      mobScales: Object.keys(window.LX_MOB_SCALE_DATA || {}).length,
      npcOffsets: Object.keys(window.LX_NPC_OFFSET_DATA || {}).length,
      gearCalib: Object.keys(window.LX_EQ_ATTACH_DATA || {}).length,
      gearErase: Object.keys(window.LX_EQ_ERASE_DATA || {}).length,
      props: Object.keys((typeof MAP_PROPS !== 'undefined' && MAP_PROPS) || {}).length,   // a top-level const, not a window property
      readsMob: someMob ? _lxMobYOff(someMob) : null, readsMobScale: someMob ? _lxMobScale(someMob) : null,
      readsNpc: someNpc ? _lxNpcYOff(someNpc) : null,
      mapProps: (((typeof MAP_PROPS !== 'undefined' && MAP_PROPS) || {})[game.currentMap] || []).length,
    };
  });
  check(data.mobOffsets > 0 && data.mobScales > 0, 'the monster offsets and scales that Monster Plant wrote are loaded', J({ off: data.mobOffsets, sc: data.mobScales }));
  check(data.npcOffsets > 0, 'the NPC offsets that NPC Plant wrote are loaded', J({ npc: data.npcOffsets }));
  check(data.gearCalib > 0 && data.gearErase > 0, 'the gear attach points and erase masks that Gear Align wrote are loaded', J({ calib: data.gearCalib, erase: data.gearErase }));
  check(data.props > 0, 'the props the Ctrl editor placed are loaded', J({ maps: data.props, onThisMap: data.mapProps }));
  check(typeof data.readsMob === 'number' && typeof data.readsMobScale === 'number' && typeof data.readsNpc === 'number',
    'the game still READS them per monster and per NPC', J({ mobY: data.readsMob, mobScale: data.readsMobScale, npcY: data.readsNpc }));
  // and the keys those panels used to own do nothing untoward
  const keys = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const before = document.querySelectorAll('div').length;
    for (const k of ['t', '2', '4', 'r']) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); await sleep(120);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true })); await sleep(80); }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', bubbles: true })); await sleep(120);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', bubbles: true })); await sleep(200);
    const panels = [...document.querySelectorAll('div')].filter((d) => d.offsetParent &&
      /Monster Plant|Gear Align|NPC Plant|Stage Editor|Prop Editor/.test(d.textContent || '')).length;
    return { panels, grew: document.querySelectorAll('div').length - before };
  });
  check(keys.panels === 0, 'T, 2, 4, R and Ctrl open no editor on a fully unlocked dev build', J(keys));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
