// DEAD OVERLAYS: #low-hp-vignette and #flash-overlay sat at z-index auto under the canvas's inline z-index 2 (since the
// 2026-06-10 DOM-snapshot restore) and duplicated what the canvas paints, so they were removed (per user).
//  1. neither element exists any more
//  2. the canvas still paints the white flash: flash(0.6) whitens a frozen frame
//  3. the canvas still paints the low-HP danger vignette: at 20% HP the screen edge darkens / reddens
//  4. updateUI runs clean at low HP and in Rage without the element (no page errors)
//   node scripts/dead_overlays_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11751);
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let bad = 0; const check = (ok, label, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && d !== undefined ? '  [' + JSON.stringify(d) + ']' : ''}`); if (!ok) bad++; };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof flash === 'function' && typeof updateUI === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 30; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await new Promise((res) => setTimeout(res, 4000)); game.paused = false; player.invulnerable = 9e9;
    const mf = document.getElementById('map-fade-overlay'); if (mf) mf.style.display = 'none';
    window.__fx = setInterval(() => { document.documentElement.classList.remove('lx-nobackdrop'); if (window.LX_PERF) LX_PERF.veryLowFx = false; game.monsters.length = 0; for (const t of document.querySelectorAll('.toast')) t.remove(); }, 30);
  });
  const frames = (n) => page.evaluate(async (k) => { for (let i = 0; i < k; i++) await new Promise((r) => requestAnimationFrame(r)); }, n);
  check(await page.evaluate(() => !document.getElementById('low-hp-vignette') && !document.getElementById('flash-overlay')), '1. the dead overlays are gone');
  const g = await page.evaluate(() => document.getElementById('game').getBoundingClientRect().toJSON());
  const mean = async (clip) => { const b = await page.screenshot({ clip }); return page.evaluate(async (s) => {
    const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, im.width, im.height).data;
    let r = 0, gg = 0, bb = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++; } return [r / n, gg / n, bb / n].map(Math.round); }, b.toString('base64')); };
  const edge = { x: Math.round(g.x) + 2, y: Math.round(g.y + g.height * 0.3), width: 50, height: Math.round(g.height * 0.4) };
  const centre = { x: Math.round(g.x + g.width / 2 - 60), y: Math.round(g.y + g.height / 2 - 60), width: 120, height: 120 };
  const freeze = async (fn) => { await page.evaluate(() => { game.paused = false; }); await page.evaluate(fn); await frames(30); await page.evaluate(() => { game.paused = true; }); await frames(3); };
  // 2. the canvas flash
  await freeze(() => { game.flashOverlay = 0; }); const c0 = await mean(centre);
  await freeze(() => { window.__fl = setInterval(() => { game.flashOverlay = 0.6; }, 5); }); const c1 = await mean(centre);
  await page.evaluate(() => { clearInterval(window.__fl); game.flashOverlay = 0; });
  check(c1[1] - c0[1] > 30 && c1[2] - c0[2] > 30, '2. flash() still whitens the frame (the canvas paints it)', { before: c0, flash: c1 });
  // 3 + 4. the canvas low-HP vignette, and updateUI in Rage without the element
  await freeze(() => { clearInterval(window.__hp); player.hp = getMaxHp(); }); const e0 = await mean(edge);
  await freeze(() => { window.__hp = setInterval(() => { player.hp = Math.floor(getMaxHp() * 0.2); }, 20); }); const e1 = await mean(edge);
  const st = await page.evaluate(() => ({ rage: !!player.inRage, low: !!game._lowHpActive, drawn: typeof _LOWHP_VIG_CACHE !== 'undefined' && !!_LOWHP_VIG_CACHE && !!_LOWHP_VIG_CACHE.g }));
  check(st.rage && st.low && st.drawn && (e0[1] - e1[1]) > 2, '3. at 20% HP the canvas still paints its danger vignette (gradient built, the edge darkens)', { full: e0, low: e1, st });
  check(errs.length === 0, '4. updateUI runs clean at low HP, in Rage, without the element (no page errors)', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
