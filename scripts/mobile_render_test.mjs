// v0.30.x — Mobile / rendering findings from the audit backlog.
//   node scripts/mobile_render_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11299);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Mob');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {};
  { const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; } }
  await wait(400);
  out.cineIdle = document.body.classList.contains('cinematic');
  // E1: the death overlay's own show class drives body.cinematic
  const dov = document.getElementById('death-overlay');
  dov.classList.add('on'); await wait(600);
  out.cineOn = document.body.classList.contains('cinematic');
  dov.classList.remove('on'); await wait(600);
  out.cineOff = document.body.classList.contains('cinematic');
  // E2: the nag and the potion stack are no longer inside the transformed wrapper
  const ctl = document.getElementById('mobile-ctrl'), nag = document.getElementById('rotate-nag');
  out.ctlOutside = !!ctl && !ctl.closest('.game-wrapper');
  out.nagOutside = !!nag && !nag.closest('.game-wrapper');
  return out;
});
const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const safeArea = html.includes('body { padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }');
const zoomClamp = html.includes('var maxL = Math.max(0, p.clientWidth / z - el.offsetWidth);');
const uiScaleStamp = html.includes('game._uiScale = _uk;');
const bossPlate = html.includes('const barW = Math.min(660 * _uiK, W - 120)');
const dnScale = html.includes('const baseSize = ((d.size || 14) + 4) * _dnUiK;');
const dnTrim = html.includes('game.damageNumbers.splice(0, game.damageNumbers.length - MAX_DN);');
const dnEdge = html.includes('ctx.translate(Math.max(28, Math.min(W - 28, sx)), d.y);');
console.log(JSON.stringify({ ...r, safeArea, zoomClamp, uiScaleStamp, bossPlate, dnScale, dnTrim, dnEdge }));
const checks = [
  ['body.cinematic follows the death overlay', r.cineIdle === false && r.cineOn === true && r.cineOff === false, `${r.cineIdle}/${r.cineOn}/${r.cineOff}`],
  ['#mobile-ctrl lives outside the transformed wrapper', r.ctlOutside === true],
  ['#rotate-nag lives outside the transformed wrapper', r.nagOutside === true],
  ['the mobile branch keeps the safe-area insets on body', safeArea],
  ['the HUD drag clamp is zoom-aware', zoomClamp],
  ['the HUD size setting is stamped for the canvas readouts', uiScaleStamp],
  ['the boss plate follows the HUD size', bossPlate],
  ['damage numbers follow the HUD size', dnScale],
  ['damage-number overflow trims the oldest without reordering', dnTrim],
  ['a damage number at the screen edge is pulled inside it', dnEdge],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
