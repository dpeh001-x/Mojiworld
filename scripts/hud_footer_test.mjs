// The stat ribbons: the two rows under the HP / MP / EXP bars, compacted into inset ribbons of equal
// cells. Per user: "compact the bottom 2 rows displayed, beautify it a little more".
// Sizes are LAYOUT px (offsetWidth / offsetHeight): the game frame is transform-scaled to the window.
//   node scripts/hud_footer_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11285);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the ribbon styles ship', /STAT RIBBONS/.test(html) && /\.stats-footer \.stats-footer-row, \.stats-footer \.stats-footer-row \+ \.stats-footer-row \{\s*display: grid;/.test(html)]);
checks.push(['kills are shortened like coins and shards', /_uiSetText\(d\['hud-kills'\], _fmtBig\(game\.kills \| 0\)\)/.test(html)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
try {   // the run; a throw anywhere below is reported as a failing check
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.waitForFunction(() => typeof updateUI === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 90000 });
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Ribbon'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(2500);
for (let i = 0; i < 12; i++) {
  const h = await page.evaluate(() => { let n = 0; for (const id of ['plg-skip', 'plg-dagger-skip', 'plg-punch-skip', 'grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } } const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) { sb.click(); n++; } return n; });
  if (!h) break; await page.waitForTimeout(700);
}
await page.evaluate(() => { for (const el of document.querySelectorAll('#tutorial-modal')) el.style.display = 'none'; });
const measure = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll('.stats-footer .stats-footer-row')];
  return { footerH: document.querySelector('.stats-footer').offsetHeight, cardW: document.getElementById('stats').offsetWidth,
    rows: rows.map((r) => ({ h: r.offsetHeight, dashed: getComputedStyle(r).borderTopStyle === 'dashed',
      cells: [...r.querySelectorAll('.stat-item')].map((c) => ({ w: c.offsetWidth, clip: c.scrollWidth > c.clientWidth + 1 })) })),
    icons: [...document.querySelectorAll('.stats-footer .stat-icon')].map((i) => i.offsetWidth + 'x' + i.offsetHeight),
    coin: getComputedStyle(document.getElementById('hud-mojicoins')).color, shard: getComputedStyle(document.getElementById('hud-setshards')).color,
    kills: document.getElementById('hud-kills').textContent.trim() };
});
const a = await measure();
const eq = (arr) => Math.max(...arr) - Math.min(...arr) <= 1;
checks.push(['two ribbons of equal cells: four combat stats, three resources', a.rows.length === 2 && a.rows[0].cells.length === 4 && a.rows[1].cells.length === 3 && eq(a.rows[0].cells.map((c) => c.w)) && eq(a.rows[1].cells.map((c) => c.w)), a.rows.map((r) => r.cells.map((c) => c.w).join('/')).join(' | ')]);
checks.push(['one icon size for every stat', a.icons.length === 7 && a.icons.every((x) => x === '11x11'), a.icons.join(' ')]);
checks.push(['both rows are the same slim height and the footer is compact', a.rows.every((r) => r.h === 15) && a.footerH <= 34, `rows ${a.rows.map((r) => r.h).join('/')} · footer ${a.footerH} layout px (was 49)`]);
checks.push(['no dashed rule between the rows', a.rows.every((r) => !r.dashed)]);
checks.push(['coins read gold, setshards violet', /255, 223, 142/.test(a.coin) && /232, 216, 255/.test(a.shard), `${a.coin} / ${a.shard}`]);
await page.evaluate(() => { player.mojicoins = 1234567; game.kills = 12345; player.setshards = 45678; player.baseAcc = 245; updateUI(); });
await page.waitForTimeout(300);
const b = await measure();
const clipped = b.rows.flatMap((r, i) => r.cells.map((c, j) => c.clip ? `${i}:${j}` : null)).filter(Boolean);
checks.push(['late-game values fit their cells without clipping', clipped.length === 0, clipped.join(', ') || 'all fit']);
checks.push(['kills shorten past ten thousand, like coins and shards', b.kills === '12.3K', b.kills]);
checks.push(['the card keeps its width however big the numbers get', b.cardW === a.cardW, `${a.cardW} -> ${b.cardW}`]);
const tip = await page.evaluate(() => (document.getElementById('hud-atk-item').getAttribute('title') || '').includes('Current:'));
checks.push(['the ATK tooltip still carries the live numbers', tip]);
await page.click('#hud-atk-item', { timeout: 5000 }); await page.waitForTimeout(700);
const opened = await page.evaluate(() => { const m = document.getElementById('attributes-modal'); if (!m) return false; const cs = getComputedStyle(m); return cs.display !== 'none' && cs.visibility !== 'hidden' && m.getBoundingClientRect().width > 0; });
checks.push(['clicking a stat still opens the Level Up panel', opened]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
