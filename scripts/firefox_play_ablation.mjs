// The ablation, finally IN GAME.
// ============================================================================
// Every earlier number was the title / character-select screen, whose heavy
// layers (a 1.18Mpx2 ken-burns backdrop, a 758kpx2 spinning ray field) do not
// exist during play. The user's complaint is about playing, so a fix tuned to
// those numbers could miss entirely.
//
// The flow the hit-test mapping revealed:
//   New Game -> "Name your hero" (#auth-submit) -> character select -> world.
//
// Reaching the world is asserted, not assumed: if #loading-overlay is still
// hit-testable at the centre of the screen, this reports NOT-IN-GAME and the
// numbers are labelled as such rather than being quietly presented as
// gameplay.
// Run: LX_HEADED=1 node scripts/firefox_play_ablation.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10925);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const centre = () => {
  const e = document.elementFromPoint(640, 400);
  return e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).trim().split(/\s+/)[0]) : 'null';
};
const measure = () => new Promise((done) => {
  const t0 = performance.now(); let n = 0;
  const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
    else done(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(tick);
});
// What is actually costing paint on THIS screen, ranked by area.
const HEAVY = () => {
  const rows = [];
  for (const e of document.querySelectorAll('*')) {
    const r = e.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.03) continue;
    const bf = cs.backdropFilter || cs.webkitBackdropFilter;
    const hasBf = bf && bf !== 'none';
    const hasAnim = cs.animationName && cs.animationName !== 'none';
    if (!hasBf && !hasAnim) continue;
    rows.push({ id: e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).trim().split(/\s+/)[0],
                area: Math.round(r.width * r.height), bf: hasBf ? bf.slice(0, 24) : '', anim: hasAnim ? cs.animationName : '' });
  }
  return rows.sort((a, b) => b.area - a.area).slice(0, 10);
};

const drive = async (name, browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(16000);
  const trail = [];
  const go = async (label, fn) => { try { await fn(); } catch (e) { trail.push(`${label}: ${String(e.message).slice(0, 50)}`); return; }
    await page.waitForTimeout(1800); trail.push(`${label} -> centre ${await page.evaluate(centre)}`); };

  await go('New Game', () => page.click('#menu-newgame', { timeout: 6000 }));
  await go('type name', async () => {
    const inp = await page.$('#menu-name-panel input, #auth-name, input[type=text]:visible');
    if (inp) { await inp.fill('FoxTest'); } else { await page.keyboard.type('FoxTest'); }
  });
  await go('Enter Mojiworld', () => page.click('#auth-submit', { timeout: 6000 }));
  // Character select: pick the first class card, then advance.
  for (let i = 0; i < 6; i++) {
    const c = await page.$('.cs-class-card, .cs-class, #cs-page-class button');
    if (c && await c.isVisible().catch(() => false)) { await c.click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(700); }
    const nx = await page.$('#cs-nav-next');
    if (!nx || !(await nx.isVisible().catch(() => false))) break;
    await nx.click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(1100);
  }
  trail.push('after class select -> centre ' + await page.evaluate(centre));
  for (const sel of ['#cs-confirm', '#cs-start', '.cs-confirm-btn', '#plg-skip', '#tut-skip']) {
    const el = await page.$(sel);
    if (el && await el.isVisible().catch(() => false)) { await el.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2500); trail.push(`clicked ${sel} -> centre ${await page.evaluate(centre)}`); }
  }
  await page.waitForTimeout(3000);
  const where = await page.evaluate(centre);
  const inGame = !where.startsWith('#loading') && !where.startsWith('div.lo');

  console.log(`\n### ${name}   centre element: ${where}   IN GAME: ${inGame}`);
  for (const t of trail) console.log('    ' + t);
  console.log('  heaviest animated / backdrop-filtered layers on this screen:');
  for (const h of await page.evaluate(HEAVY)) console.log(`    ${String(h.area).padStart(8)}px2  ${h.id.padEnd(26)} ${h.bf} ${h.anim}`);

  const inject = (css) => page.evaluate((c) => {
    let el = document.getElementById('__lx_ab'); if (!el) { el = document.createElement('style'); el.id = '__lx_ab'; document.head.appendChild(el); }
    el.textContent = c;
  }, css);
  const STEPS = [
    ['baseline', ''],
    ['-backdrop-filter', '*{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}'],
    ['-CSS animations', '*{animation:none !important}'],
    ['-box-shadow', '*{box-shadow:none !important}'],
  ];
  let css = '', prev = null;
  for (const [label, rule] of STEPS) {
    css += rule; await inject(css); await page.waitForTimeout(600);
    const fps = await page.evaluate(measure);
    console.log(`  ${String(fps).padStart(7)} fps   ${label}${prev == null ? '' : '   ' + (fps > prev ? '+' : '') + (fps - prev).toFixed(1)}`);
    prev = fps;
  }
  await page.close();
};

const list = [['FIREFOX', () => firefox.launch({ executablePath: FF, headless: !process.env.LX_HEADED })]];
if (!process.env.LX_FFONLY) list.push(['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: !process.env.LX_HEADED })]);
for (const [nm, launch] of list) {
  let b; try { b = await launch(); } catch (e) { console.log(`${nm}: launch failed`); continue; }
  try { await drive(nm, b); } catch (e) { console.log(`${nm}: ${String(e.message).slice(0, 200)}`); }
  await b.close();
}
server.kill();
