// The HUD Size slider, driven the way a player drives it: the gear button, a mouse drag on the
// thumb, the keyboard, and a reload. Per user: "HUD Size option does nothing, fix it". The older
// ui_scale_test sets the value through _applySettings, so it could not see a dead slider.
//   node scripts/hud_size_slider_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11274);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['Settings wires the HUD Size slider when it opens', /_uiEl\.oninput = function\(\) \{\s*const _v = document\.getElementById\('set-uiscale-val'\)[\s\S]{0,120}applySettingsLive\(\);/.test(html)]);
checks.push(['the zoom rule covers the Taxi and Multi buttons too', /#taxi-btn, #mp-btn \{\s*zoom: var\(--lx-ui-scale, 1\);/.test(html)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
// a real boot, not a fixed delay: the settings API is up and the saved HUD scale has been applied
const bootReady = () => page.waitForFunction(() => typeof _lxGetSettings === 'function' && typeof openSettingsModal === 'function'
  && getComputedStyle(document.documentElement).getPropertyValue('--lx-ui-scale').trim() !== '', null, { timeout: 90000 });
try {   // the run; a throw anywhere below is reported as a failing check
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await bootReady();
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Hud'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(2500);
for (let i = 0; i < 12; i++) {
  const hit = await page.evaluate(() => { let n = 0; for (const id of ['plg-skip', 'plg-dagger-skip', 'plg-punch-skip', 'grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } } const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) { sb.click(); n++; } return n; });
  if (!hit) break; await page.waitForTimeout(700);
}
const IDS = ['top-ui', 'skill-bar', 'minimap', 'taxi-btn', 'mp-btn', 'version-tag'];
const state = () => page.evaluate((IDS) => {
  const o = { value: document.getElementById('set-uiscale').value, label: document.getElementById('set-uiscale-val').textContent.trim(),
    root: getComputedStyle(document.documentElement).getPropertyValue('--lx-ui-scale').trim(), saved: _lxGetSettings().uiScale, r: {} };
  for (const id of IDS) { const e = document.getElementById(id); if (!e || getComputedStyle(e).display === 'none') continue; const b = e.getBoundingClientRect(); o.r[id] = { l: b.left, t: b.top, rt: b.right, bt: b.bottom, w: b.width }; }
  return o;
}, IDS);
const hit = (a, b) => !!(a && b && a.l < b.rt - 1 && b.l < a.rt - 1 && a.t < b.bt - 1 && b.t < a.bt - 1);
const openSettings = async () => { try { await page.click('#settings-btn', { timeout: 3000 }); } catch (e) { await page.evaluate(() => openSettingsModal()); } await page.waitForTimeout(600); };

await openSettings();
const s100 = await state();
checks.push(['Settings opens from the gear button with HUD Size at 100%', s100.value === '100' && s100.label === '100%', `${s100.value} / ${s100.label}`]);
const box = await page.locator('#set-uiscale').boundingBox();
const y = box.y + box.height / 2;
await page.mouse.move(box.x + 3, y); await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.5, y, { steps: 8 }); await page.waitForTimeout(250);
const mid = await state();
checks.push(['mid-drag, the label and the HUD follow the thumb live', +mid.value > 85 && +mid.value < 145 && mid.label === mid.value + '%' && Math.abs(+mid.root - mid.value / 100) < 0.001, `${mid.value} / ${mid.label} / ${mid.root}`]);
await page.mouse.move(box.x + box.width - 1, y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
const s150 = await state();
checks.push(['dragged to the right end it reads 150% and the HUD is at 150%', s150.value === '150' && s150.label === '150%' && s150.root === '1.5' && s150.saved === 150, `${s150.label} / ${s150.root} / saved ${s150.saved}`]);
const grew = (id) => s100.r[id] && s150.r[id] && s150.r[id].w >= s100.r[id].w * 1.4;
checks.push(['the stats panel, skill bar and minimap grow with it', ['top-ui', 'skill-bar', 'minimap'].every(grew), ['top-ui', 'skill-bar', 'minimap'].map((id) => id + ' ' + (s150.r[id] ? (s150.r[id].w / s100.r[id].w).toFixed(2) : '?')).join(', ')]);
checks.push(['the Taxi and Multi buttons grow with the rest', ['taxi-btn', 'mp-btn'].every(grew), ['taxi-btn', 'mp-btn'].map((id) => id + ' ' + (s150.r[id] && s100.r[id] ? (s150.r[id].w / s100.r[id].w).toFixed(2) : 'hidden')).join(', ')]);
checks.push(['at 150% Taxi stays clear of the minimap and Multi of the version tag', !hit(s150.r['taxi-btn'], s150.r.minimap) && !hit(s150.r['mp-btn'], s150.r['version-tag'])]);
await page.mouse.move(box.x + box.width - 2, y); await page.mouse.down(); await page.mouse.move(box.x + 1, y, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(300);
const s80 = await state();
checks.push(['dragged to the left end it reads 80% and the HUD shrinks', s80.label === '80%' && s80.root === '0.8' && s80.r['top-ui'].w <= s100.r['top-ui'].w * 0.85, `${s80.label} / ${s80.root}`]);
await page.focus('#set-uiscale'); await page.keyboard.press('Home');
for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
const kb = await state();
checks.push(['the keyboard moves it too (Home, then eight steps right)', kb.label === '120%' && kb.root === '1.2' && kb.saved === 120, `${kb.label} / ${kb.root}`]);
await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(9000);
await bootReady();
const re = await page.evaluate(() => ({ root: getComputedStyle(document.documentElement).getPropertyValue('--lx-ui-scale').trim(), saved: _lxGetSettings().uiScale }));
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); try { openSettingsModal(); } catch (e) {} });
await page.waitForTimeout(500);
const reLabel = await page.evaluate(() => document.getElementById('set-uiscale-val').textContent.trim());
checks.push(['the choice survives a reload', re.root === '1.2' && re.saved === 120 && reLabel === '120%', `${re.root} / saved ${re.saved} / label ${reLabel}`]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
