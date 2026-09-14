// The quest board reads at a glance: full titles, no dead blurb, one compact reward strip.
//
// Per user, with a screenshot of the board: "The Q quest UI HUD is too wordy and cramped, very hard
// to read, do something to make it less words and much more readible", then of the three reward
// chips: "these can be made much smaller".
//
// What this pins, beyond taste:
//   - a card whose location row says what to do does not ALSO print an ellipsised blurb;
//   - a card with no walkable destination still does, because then it is the only context it has;
//   - long titles keep their characters instead of losing to the badges beside them;
//   - the three separately-bordered reward pills are one strip.
//   node scripts/quest_card_density_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 29360);
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS  ' + m); }
  else { fail++; console.log('  FAIL  ' + m + (extra !== undefined ? '  <- ' + extra : '')); } };
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));

await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
const clickText = (src) => page.evaluate((s) => { const rx = new RegExp(s, 'i');
  for (const b of document.querySelectorAll('button')) {
    if (getComputedStyle(b).display === 'none' || !b.offsetParent) continue;
    if (rx.test((b.textContent || '').trim())) { b.click(); return true; } } return false; }, src);
const waitFor = async (l, fn, cap = 180000) => { const t0 = Date.now();
  while (Date.now() - t0 < cap) { try { if (await fn()) return true; } catch (e) {} await page.waitForTimeout(400); }
  console.log('  (timeout: ' + l + ')'); return false; };
await waitFor('form', () => page.evaluate(() => !!document.querySelector('#hero-name-input')));
await page.fill('#hero-name-input', 'Quests').catch(() => {});
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await clickText('^Next');
await waitFor('menu', async () => await clickText('New Game'));
await waitFor('reveal', async () => { await clickText('Skip prologue'); await page.keyboard.press('Enter').catch(() => {});
  return page.evaluate(() => { const o = document.getElementById('loading-overlay');
    return !o || o.classList.contains('fade') || getComputedStyle(o).display === 'none'; }); });
await page.evaluate(() => { const o = document.getElementById('story-beat-overlay');
  if (o) { o.classList.remove('on'); o.style.display = 'none'; }
  // high level so the Lv 40+/60+/70+ boss quests are all on the board
  try { game.paused = false; window._lxBootGateDone = true; player.level = 80; } catch (e) {} });
await page.waitForTimeout(1400);
await page.keyboard.press('q');
await waitFor('the board', () => page.evaluate(() => {
  const m = document.getElementById('quest-modal');
  return !!m && getComputedStyle(m).display !== 'none' && m.querySelectorAll('.qj-card').length > 3;
}));
await page.waitForTimeout(700);

const data = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#quest-modal .qj-card')].slice(0, 40);
  return cards.map((c) => {
    const nm = c.querySelector('.qj-name');
    return {
      name: nm ? nm.textContent : '',
      clipped: nm ? (nm.scrollWidth > nm.clientWidth + 1) : false,
      h: Math.round(c.getBoundingClientRect().height),
      nav: !!c.querySelector('.qj-line3'),
      desc: !!c.querySelector('.qj-desc'),
      strip: !!c.querySelector('.qj-rw'),
      oldPills: c.querySelectorAll('.qj-pill.mojicoins, .qj-pill.exp, .qj-pill.gear').length,
    };
  });
});
const withNav = data.filter((d) => d.nav), noNav = data.filter((d) => !d.nav);
const med = (a) => { const v = a.slice().sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
console.log(`\n  ${data.length} cards · ${withNav.length} with a location row · median height ${med(data.map((d) => d.h))}px`);
console.log(`  titles clipped: ${data.filter((d) => d.clipped).length}\n`);

ok(data.length > 3, 'the board rendered cards', data.length);
ok(withNav.length > 0 && withNav.every((d) => !d.desc),
  'a card whose location row says what to do does not also print the blurb',
  withNav.filter((d) => d.desc).map((d) => d.name).slice(0, 3).join(' | '));
ok(noNav.length === 0 || noNav.every((d) => d.desc),
  'a card with no walkable destination keeps its blurb',
  noNav.filter((d) => !d.desc).map((d) => d.name).slice(0, 3).join(' | '));
ok(data.every((d) => d.oldPills === 0), 'the three separate reward pills are gone',
  data.filter((d) => d.oldPills).length + ' cards still have them');
ok(data.some((d) => d.strip), 'the compact reward strip is drawn');
ok(med(data.map((d) => d.h)) <= 95, 'the median card is under 95px tall', med(data.map((d) => d.h)) + 'px');
ok(data.filter((d) => d.clipped).length === 0, 'no quest title is cut off by the badges beside it',
  data.filter((d) => d.clipped).map((d) => d.name).slice(0, 3).join(' | '));
ok(errs.length === 0, 'no page errors', errs.join(' | '));

await browser.close().catch(() => {}); server.kill();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
