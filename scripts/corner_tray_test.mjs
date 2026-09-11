// The top-right corner tray: Multi, the build number, touch controls, fullscreen and settings in one
// window-pinned row on the desktop layout, dissolved back to their homes on the phone layout.
// Per user: "can organise and compact this part to make it look neater and cleaner".
//   node scripts/corner_tray_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11281);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the tray is built at boot and styled', /\(function _lxCornerTray\(\) \{/.test(html) && /#lx-corner \{\s*position: fixed;/.test(html)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try {
  localStorage.setItem('mojiworld_prologue_seen', '1');
  localStorage.setItem('mojiHudPos:mp-btn', JSON.stringify({ left: 40, top: 400 }));   // dragged in an older session
} catch (e) {} });
const ORDER = ['mp-btn', 'version-tag', 'mobile-mode-btn', 'fullscreen-btn', 'settings-btn'];
const measure = () => page.evaluate((ORDER) => {
  const R = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const tray = document.getElementById('lx-corner');
  const o = { vw: innerWidth, vh: innerHeight, tray: tray && !tray.hidden ? R(tray) : null,
    kids: tray ? [...tray.children].map((c) => c.id || c.className) : [], items: {}, others: {} };
  for (const id of ORDER) { const e = document.getElementById(id); if (e) o.items[id] = R(e); }
  for (const id of ['save-indicator', 'map-label', 'stats']) { const e = document.getElementById(id); if (e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0) o.others[id] = R(e); }
  const vt = document.getElementById('version-tag'); const vr = vt.getBoundingClientRect();
  const hitEl = document.elementFromPoint((vr.left + vr.right) / 2, (vr.top + vr.bottom) / 2);
  o.version = { text: vt.textContent.trim(), expect: GAME_VERSION, uncovered: !!hitEl && (hitEl === vt || vt.contains(hitEl)), unclipped: vt.scrollWidth <= vt.clientWidth + 1 };
  return o;
}, ORDER);
const hit = (a, b) => !!(a && b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5);
const pairsHit = (m) => { const out = []; for (let i = 0; i < ORDER.length; i++) for (let j = i + 1; j < ORDER.length; j++) if (hit(m.items[ORDER[i]], m.items[ORDER[j]])) out.push(ORDER[i] + '/' + ORDER[j]); return out; };
const oneRow = (m) => { const cs = ORDER.map((id) => m.items[id] && (m.items[id].t + m.items[id].b) / 2).filter((v) => v != null); return Math.max(...cs) - Math.min(...cs) <= 2; };
const inCorner = (m) => !!m.tray && m.vw - m.tray.r >= 3 && m.vw - m.tray.r <= 18 && m.tray.t >= 2 && m.tray.t <= 14;
try {   // the run; a throw anywhere below is reported as a failing check
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.waitForFunction(() => typeof openSettingsModal === 'function' && typeof GAME_VERSION === 'string', null, { timeout: 90000 });
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Tray'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(2500);
for (let i = 0; i < 12; i++) {
  const h = await page.evaluate(() => { let n = 0; for (const id of ['plg-skip', 'plg-dagger-skip', 'plg-punch-skip', 'grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } } const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) { sb.click(); n++; } return n; });
  if (!h) break; await page.waitForTimeout(700);
}
await page.evaluate(() => { for (const el of document.querySelectorAll('#tutorial-modal')) el.style.display = 'none'; });
await page.waitForTimeout(400);
const m1 = await measure();
checks.push(['at 1280x800 all five live in the tray, in order', JSON.stringify(m1.kids) === JSON.stringify(['mp-btn', 'version-tag', 'lx-corner-sep', 'mobile-mode-btn', 'fullscreen-btn', 'settings-btn']), m1.kids.join(' ')]);
checks.push(['they sit in one row', oneRow(m1)]);
checks.push(['nothing in the tray overlaps anything else in it', pairsHit(m1).length === 0, pairsHit(m1).join(', ')]);
checks.push(['the build number is whole and uncovered, and reads the running build', m1.version.uncovered && m1.version.unclipped && m1.version.text === m1.version.expect, m1.version.text]);
const clash1 = Object.keys(m1.others).filter((id) => hit(m1.tray, m1.others[id]));
checks.push(['the tray clears the save note, the map title and the stats card', !!m1.tray && clash1.length === 0, clash1.join(', ')]);
checks.push(['the tray is tucked into the window\'s top-right corner', inCorner(m1), m1.tray ? `right gap ${Math.round(m1.vw - m1.tray.r)}, top ${Math.round(m1.tray.t)}` : 'no tray']);
checks.push(['a Multi button dragged in an older session still sits in the tray', m1.kids[0] === 'mp-btn' && oneRow(m1)]);
await page.setViewportSize({ width: 1600, height: 900 }); await page.waitForTimeout(700);
const m2 = await measure();
checks.push(['at 1600x900: one row, no overlaps, in the corner', oneRow(m2) && pairsHit(m2).length === 0 && inCorner(m2), pairsHit(m2).join(', ')]);
await page.evaluate(() => document.documentElement.style.setProperty('--lx-ui-scale', '1.25')); await page.waitForTimeout(400);
const m3 = await measure();
checks.push(['at HUD Size 125% the tray scales as one piece and still fits', !!m3.tray && m3.tray.w / m2.tray.w > 1.2 && m3.tray.w / m2.tray.w < 1.3 && pairsHit(m3).length === 0 && oneRow(m3) && m3.tray.l > 0, m3.tray ? (m3.tray.w / m2.tray.w).toFixed(3) : 'no tray']);
await page.evaluate(() => document.documentElement.style.setProperty('--lx-ui-scale', '1')); await page.waitForTimeout(300);
await page.click('#settings-btn', { timeout: 5000 }); await page.waitForTimeout(500);
const btn = await page.evaluate(() => { const on = document.getElementById('settings-modal-bg').classList.contains('on'); try { closeSettingsModal(); } catch (e) {}
  return { on, handlers: ['mp-btn', 'fullscreen-btn', 'mobile-mode-btn'].every((id) => typeof document.getElementById(id).onclick === 'function') }; });
checks.push(['the buttons still work: settings opens, and the others keep their handlers', btn.on && btn.handlers]);
await page.setViewportSize({ width: 820, height: 620 }); await page.waitForTimeout(800);
const ph = await page.evaluate(() => ({ trayHidden: !document.getElementById('lx-corner') || document.getElementById('lx-corner').hidden,
  mpHome: !!document.getElementById('mp-btn').closest('.game-wrapper'), vtHome: !!document.getElementById('version-tag').closest('.game-wrapper'),
  setHome: document.getElementById('settings-btn').parentElement === document.body, fsHome: document.getElementById('fullscreen-btn').parentElement === document.body }));
checks.push(['on the phone layout the tray dissolves and everything goes home', ph.trayHidden && ph.mpHome && ph.vtHome && ph.setHome && ph.fsHome, JSON.stringify(ph)]);
await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(800);
const m4 = await measure();
checks.push(['widen the window again and the tray re-forms, in order', JSON.stringify(m4.kids) === JSON.stringify(m1.kids) && oneRow(m4) && pairsHit(m4).length === 0]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
