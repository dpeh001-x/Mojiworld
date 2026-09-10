// v0.30.x — Magic Bolt flies dead straight (no gravity, no launch kick) and shorter.
//   node scripts/bolt_flight_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11307);
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
await page.fill('#hero-name-input', 'Bolt');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {};
  { const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; } }
  game.paused = false;
  player.mp = 999; player.facing = 1;
  const n0 = game.projectiles.length;
  performBolt();
  const p = game.projectiles[game.projectiles.length - 1];
  out.spawned = game.projectiles.length === n0 + 1 && p && p.skill === 'bolt';
  out.x0 = p.x; out.y0 = p.y; out.vy0 = p.vy; out.maxLife = p.maxLife; out.noGravity = !!p.noGravity;
  await wait(250);   // ~15 frames; still alive at either life
  out.alive = game.projectiles.includes(p);
  out.x1 = p.x; out.y1 = p.y; out.vy1 = p.vy;
  return out;
});
console.log(JSON.stringify(r));
const checks = [
  ['a bolt was fired', r.spawned === true],
  ['it is still in flight after 250 ms', r.alive === true],
  ['it travelled forward', r.x1 > r.x0 + 40, `${r.x0} -> ${r.x1}`],
  ['it never left its line (no gravity, no launch kick)', r.y1 === r.y0 && r.vy1 === 0 && r.vy0 === 0, `y ${r.y0} -> ${r.y1}, vy ${r.vy0} -> ${r.vy1}`],
  ['it is flagged gravity-free', r.noGravity === true],
  ['its reach is the shorter one', r.maxLife > 0 && r.maxLife <= 40, `maxLife ${r.maxLife}`],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
