// Floors take their map's colour.
//
// Per user: "For some of the floors the colour does not quite match the overall colour of the map". The floor palettes
// were sampled from each backdrop's painted floor band, and where that band was grey rock the floor came out neutral grey
// under a vivid scene (Sauro Slope's magenta forest, Magma Foundry's lava, Hidden Pagoda's violet night). 31 of them now
// keep their lightness and take most of the scene's hue. This renders six of those maps with their floors hidden,
// measures the scene's mean colour, and checks the floor's body colour sits close to it in CIELAB's colour plane (a*, b*);
// the build before sat 12-31 away. Floors that already belonged (the town, Block-land, granite) must be untouched.
//   node scripts/floor_harmony_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11727), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lab = (h) => { const n = parseInt(h.slice(1), 16), [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
const MAPSET = ['sauroSlope', 'fieryHideout', 'magmaFoundry', 'krookThrone', 'hiddenPagoda', 'tower_b5'];
const KEEP = { town: ['#caaa9d', '#7c655b'], blockland_meadow: ['#138949', '#005723'], graniteBluffs: ['#404945', '#282f2c'] };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && typeof _MAP_FLOOR_PAL === 'object' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const res = await page.evaluate(async ({ MAPSET, KEEP }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 30; }
    player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    const out = { maps: {}, keep: {} };
    for (const [k, v] of Object.entries(KEEP)) out.keep[k] = _MAP_FLOOR_PAL[k] ? [_MAP_FLOOR_PAL[k].top, _MAP_FLOOR_PAL[k].body] : null;
    const cv = document.getElementById('game'), g = cv.getContext('2d'), od = window._drawCutePlatform;
    const mean = () => { const d = g.getImageData(0, 0, cv.width, cv.height).data; let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 16) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } return [r / n, gg / n, b / n]; };
    const calm = () => { try { game.monsters.length = 0; player.hp = 1e7; game.paused = false; } catch (e) {} };
    // the first map after boot fades in from black: spend that fade on a map we do not measure
    try { closeAllModals(); } catch (e) {} loadMap('town', 400);
    for (let i = 0; i < 20; i++) { calm(); await sleep(200); }
    for (const key of MAPSET) {
      const md = MAPS[key]; if (!md) { out.maps[key] = { err: 'no map' }; continue; }
      try { closeAllModals(); } catch (e) {} game.paused = false; player.hp = 1e7;
      loadMap(key, Math.min((md.width || md.worldWidth || 1600) * 0.35, 900));
      // its painted backdrop must be in: until it lands the game draws a fallback sky, a different scene altogether
      try { if (typeof _lxLazyWantMap === 'function') _lxLazyWantMap(key, true); } catch (e) {}
      if (typeof _lxBackdropSettled === 'function') await Promise.race([_lxBackdropSettled(key), sleep(20000)]);
      const bg = (md.bg && typeof BG_IMAGES !== 'undefined') ? BG_IMAGES[md.bg] : null, bgIn = !bg || bg._loaded || bg.naturalWidth > 0;
      for (let i = 0; i < 12; i++) { calm(); await sleep(170); }   // and the veil lifts
      window._drawCutePlatform = function () {};
      // measure once the scene has settled: three readings 200ms apart that agree within 2 levels
      let m0 = mean(), m = m0, settled = false;
      for (let i = 0; i < 30 && !settled; i++) { calm(); await sleep(200); m = mean(); settled = Math.abs(m[0] - m0[0]) + Math.abs(m[1] - m0[1]) + Math.abs(m[2] - m0[2]) < 2; m0 = m; }
      window._drawCutePlatform = od;
      const hx = (v) => Math.round(v).toString(16).padStart(2, '0');
      out.maps[key] = { scene: '#' + hx(m[0]) + hx(m[1]) + hx(m[2]), body: _MAP_FLOOR_PAL[key] && _MAP_FLOOR_PAL[key].body, settled, bgIn };
    }
    return out;
  }, { MAPSET, KEEP });
  for (const key of MAPSET) {
    const m = res.maps[key] || {};
    if (m.err || !m.body || !m.bgIn) { ok(`${key}: its floor sits in its scene's colour (backdrop loaded)`, false, m); continue; }
    const s = lab(m.scene), f = lab(m.body), dAB = Math.hypot(f[1] - s[1], f[2] - s[2]);
    ok(`${key}: its floor sits in its scene's colour (a*b* distance <= 10)`, dAB <= 10, { scene: m.scene, floorBody: m.body, dAB: +dAB.toFixed(1) });
  }
  for (const [k, want] of Object.entries(KEEP)) ok(`${k}: a floor that already belonged is untouched`, JSON.stringify(res.keep[k]) === JSON.stringify(want), { have: res.keep[k], want });
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
