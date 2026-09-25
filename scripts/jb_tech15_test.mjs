// DJ Vinyl's console: every circuit line and node at 15% opacity (v0.30.x jb-tech15).
//   node scripts/jb_tech15_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "Make the opacity of the nodes and circuitry 15%".
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10521';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
try {
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openJukebox === 'function' && typeof _bgmEl !== 'undefined', null, { timeout: 120000 });
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 30;
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500));
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game._jukeboxHeard = {}; for (const g of JUKEBOX_TRACKS) for (const t of g.tracks) game._jukeboxHeard[t.id] = true;
    openJukebox();
  });
  await page.waitForTimeout(600);
  // every line and node in the network tiles, read back from the live computed backgrounds
  const tiles = await page.evaluate(() => {
    const out = {}, cs = (el, pe) => getComputedStyle(el, pe || null).backgroundImage;
    const m = document.getElementById('jukebox-modal');
    const src = { faceplate: cs(m), deck: cs(m.querySelector('.jb-deck')), pads: cs(document.getElementById('jukebox-list')), backdrop: cs(document.getElementById('jukebox-modal-bg'), '::before') };
    for (const [k, v] of Object.entries(src)) {
      const u = v.match(/url\("data:image\/svg\+xml,([^"]+)"\)/); if (!u) { out[k] = null; continue; }
      const svg = decodeURIComponent(u[1].replace(/\\/g, ''));
      out[k] = { vals: [...new Set([...svg.matchAll(/(?:stroke|fill)-opacity='([\d.]+)'/g)].map((x) => +x[1]))], paths: (svg.match(/<path/g) || []).length, nodes: (svg.match(/<circle/g) || []).length };
    }
    return out;
  });
  console.log('tiles', JSON.stringify(tiles));
  check(Object.values(tiles).every((t) => t && t.paths >= 5 && t.nodes >= 8 && t.vals.length && t.vals.every((v) => v === 0.15)),
    'faceplate, deck, pad plate and backdrop: every circuit line and node is drawn at 15% opacity', tiles);
  const bus = await page.evaluate(() => [...getComputedStyle(document.querySelector('#jukebox-modal .jb-grow')).backgroundImage.matchAll(/rgba\(62, 232, 255, ([\d.]+)\)/g)].map((x) => +x[1]));
  console.log('bus alphas', JSON.stringify(bus));
  check(bus.length >= 4 && bus.every((a) => a === 0.15), 'the top-bar data bus: its trace, ticks and end nodes at 15%', bus);
  // the deck's lit nodes: dark at rest, pulsing up to 15% (never past it) while a track plays
  const sample = async (ms) => page.evaluate(async (ms) => {
    const d = document.querySelector('#jukebox-modal .jb-deck'), a = [];
    const t0 = performance.now(); while (performance.now() - t0 < ms) { a.push(+getComputedStyle(d, '::before').opacity, +getComputedStyle(d, '::after').opacity); await new Promise((r) => setTimeout(r, 40)); }
    return { min: Math.min(...a), max: Math.max(...a), anim: getComputedStyle(d, '::before').animationName };
  }, ms);
  const rest = await sample(400);
  await page.evaluate(() => document.querySelector('#jukebox-list .jb-track[data-track-id="lavaCavern"]').click());
  await page.waitForTimeout(200);
  const live = await sample(2200);
  const pulse = await page.evaluate(() => getComputedStyle(document.querySelector('#jukebox-modal .jb-grow'), '::after').animationName);
  console.log('rest', JSON.stringify(rest), '| live', JSON.stringify(live), '| bus pulse', pulse);
  check(rest.max === 0 && rest.anim === 'none', 'at rest the lit nodes are dark (the network nodes show at 15%)', rest);
  check(live.anim === 'jb-node' && live.max <= 0.1501 && live.max >= 0.1 && live.min < 0.05, 'while a track plays the lit nodes pulse up to 15% and never past it', live);
  check(pulse === 'jb-bus', 'the pulse of light still runs along the bus while music plays', pulse);
  await ctx.close();
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
