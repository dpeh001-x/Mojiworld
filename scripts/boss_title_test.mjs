// The boss title, typeset: tier tag, engraved Cinzel name, Cormorant italic epithet, baked once.
// Per user: "The words font text can be more aesthetic and better improved".
//   node scripts/boss_title_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11293);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the title composer and its cache ship', /function _lxBossTitleParts\(/.test(html) && /function _lxBossTitleBake\(/.test(html)]);
const fs0 = html.indexOf('function drawSuperBossBar() {'); const fnBody = fs0 < 0 ? '' : html.slice(fs0, html.indexOf('\n}\n', fs0));
checks.push(['the boss bar no longer sets the old sans name face', fnBody.length > 1000 && !/LXBossName/.test(fnBody) && /_lxBossTitleBake\('bar', sb\.name, hyper\)/.test(fnBody) && /_lxBossTitleBake\('card', sb\.name, hyper\)/.test(fnBody)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
const clear = () => page.evaluate(() => { let n = 0; for (const id of ['plg-skip', 'plg-dagger-skip', 'plg-punch-skip', 'grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } } const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) { sb.click(); n++; } return n; });
try {   // the run; a throw anywhere below is reported as a failing check
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.waitForFunction(() => typeof drawSuperBossBar === 'function' && typeof _lxBossTitleBake === 'function', null, { timeout: 90000 });
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Title'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(2500);
await page.evaluate(() => { for (const el of document.querySelectorAll('#tutorial-modal')) el.style.display = 'none'; loadMap('gravitosArena'); });
let quiet = 0;
for (let i = 0; i < 60 && quiet < 5; i++) { const n = await clear(); quiet = n ? 0 : quiet + 1; await page.waitForTimeout(400); }
await page.evaluate(() => { game.paused = false; try { player.hp = getMaxHp(); } catch (e) {} });
await page.waitForTimeout(700);
// hold the fight still for the measurements: the render loop keeps drawing the bar while paused, and a
// level-one hero would otherwise be dead before the checks run (no fight, no bar, nothing measured)
await page.evaluate(() => { game.paused = true; try { player.hp = getMaxHp(); } catch (e) {} });
const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((x) => setTimeout(x, ms));
  const ev = (n) => (0, eval)(n);
  const out = {};
  out.parts = [_lxBossTitleParts('Gravitos, the Weight-Bearer', true), _lxBossTitleParts('King Slime', false)];
  for (let i = 0; i < 50 && ev('_LX_BT_FONTS') !== 2; i++) await wait(100);
  await wait(500);
  try { player.hp = getMaxHp(); } catch (e) {}
  const cache = ev('_LX_BT_CACHE');
  const keys = [...cache.keys()]; out.keys = keys;
  const barEntry = () => [...cache.entries()].filter(([k]) => k.startsWith('bar|') && k.endsWith('|2')).map(([, v]) => v)[0] || null;
  const bar = barEntry();
  out.bar = bar ? { w: Math.round(bar.w), h: Math.round(bar.h), parts: bar.parts } : null;
  if (bar) { const c = bar.cv.getContext('2d'); const d = c.getImageData(0, 0, bar.cv.width, bar.cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; out.ink = n; }
  const seen = []; const ft = ctx.fillText, st = ctx.strokeText, di = ctx.drawImage; let blitX = null;
  ctx.fillText = function (t) { seen.push(String(t)); return ft.apply(this, arguments); };
  ctx.strokeText = function (t) { seen.push(String(t)); return st.apply(this, arguments); };
  ctx.drawImage = function (img, dx) { if (bar && img === bar.cv) blitX = dx; return di.apply(this, arguments); };
  try { drawSuperBossBar(); } catch (e) { out.drawErr = String(e.message); } finally { ctx.fillText = ft; ctx.strokeText = st; ctx.drawImage = di; }
  out.titleRedrawn = seen.some((t) => /GRAVITOS|WEIGHT/i.test(t));
  out.barDrawn = seen.some((t) => /%/.test(t));   // the HP readout: proof the bar really drew in this call
  // does the blitted title start clear of the stats card that sits over the bar's left end?
  const sr = document.getElementById('stats').getBoundingClientRect(), gr = document.getElementById('game').getBoundingClientRect();
  out.clear = { blitX: blitX == null ? null : Math.round(blitX), statsRight: Math.round((sr.right - gr.left) * (W / gr.width)) };
  await wait(300);
  out.reused = !!bar && barEntry() === bar;
  out.card = keys.some((k) => k.startsWith('card|'));
  out.fonts = { cinzel: document.fonts.check('700 20px Cinzel'), corm: document.fonts.check('italic 500 20px "Cormorant Garamond"') };
  return out;
});
const [pg, pk] = r.parts;
checks.push(['the name splits into tier tag, name and epithet', pg.tag === 'HYPER BOSS' && pg.name === 'GRAVITOS' && pg.epithet === 'The Weight-Bearer' && pk.tag === '' && pk.name === 'KING SLIME' && pk.epithet === '', JSON.stringify(pg)]);
checks.push(['in the fight the bar title is baked once the faces land', !!r.bar, r.keys.join(' ; ').slice(0, 160)]);
checks.push(['the stacked name card is baked for the reveal', r.card]);
checks.push(['the bake carries ink and fits over the bar', !!r.bar && r.ink > 500 && r.bar.w < 900, r.bar ? `${r.bar.w}x${r.bar.h} logical, ${r.ink} inked px` : 'no bake']);
checks.push(['the bar no longer re-renders the title text every frame (and it did draw)', r.titleRedrawn === false && r.barDrawn === true && !r.drawErr, r.drawErr || (r.barDrawn ? '' : 'the bar did not draw')]);
checks.push(['the same bake is reused frame after frame', r.reused]);
checks.push(['the bar title starts clear of the stats card over the bar', r.clear.blitX !== null && r.clear.blitX >= r.clear.statsRight - 1, `title starts at x ${r.clear.blitX}, card ends at ${r.clear.statsRight}`]);
checks.push(['both title faces are loaded: Cinzel and Cormorant Garamond italic', r.fonts.cinzel && r.fonts.corm]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
