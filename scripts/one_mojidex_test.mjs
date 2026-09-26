// Live test: ONE MOJIDEX. The U panel's "MojiDex [Y]" button opened the old codex window (a second bestiary plus the
// Achievements list) while the Y key opens the MojiDex book. Now the button opens the book like Y, the old window is
// the Achievements list (titled so, no duplicate bestiary tab, opens on the list), and an Achievements button in the
// row reaches it.   node scripts/one_mojidex_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 18831; p <= 18929 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openLevelUpPanel === 'function' && typeof openCodex === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior';
  const shown = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
  const jump = async (k) => { try { closeAllModals(); } catch (e) {} openLevelUpPanel(); await sleep(500); const btn = document.querySelector(`#u-jump-row .u-jump[data-ujump="${k}"]`); if (!btn) return null; btn.click(); await sleep(600); return btn.textContent.trim(); };
  const out = {};
  out.dexLabel = await jump('codex'); out.dex = { book: shown('lore-modal'), old: shown('codex-modal') };
  out.achLabel = await jump('achv');
  const m = document.getElementById('codex-modal');
  out.ach = { old: shown('codex-modal'), book: shown('lore-modal'), title: m && m.querySelector('h2').textContent.trim(), tabbar: shown('codex-tabbar'),
    list: shown('codex-pane-achievements'), bestiary: shown('codex-pane-bestiary'), rows: document.querySelectorAll('#codex-list > div').length, total: ACHIEVEMENTS.length };
  try { closeAllModals(); } catch (e) {}
  out.row = [...document.querySelectorAll('#u-jump-row .u-jump')].map((x) => x.dataset.ujump);
  return out;
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x }); const J = (o) => JSON.stringify(o);
ok('the U panel MojiDex button opens the MojiDex book (as Y does), not the old window', /MojiDex/.test(R.dexLabel || '') && R.dex.book && !R.dex.old, R.dex);
ok('an Achievements button in the row opens the Achievements list', /Achievements/.test(R.achLabel || '') && R.ach.old && !R.ach.book, { label: R.achLabel });
ok('that window is titled Achievements, opens on the list, and has no duplicate bestiary tab', /Achievements/.test(R.ach.title) && !/MojiDex/.test(R.ach.title) && !R.ach.tabbar && R.ach.list && !R.ach.bestiary, R.ach);
ok('every achievement is listed', R.ach.rows === R.ach.total && R.ach.total > 0, { rows: R.ach.rows, total: R.ach.total });
ok('the row keeps its other buttons', J(R.row) === J(['map', 'quest', 'codex', 'mojidex', 'titles', 'achv']), R.row);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + J(q.x ?? '').slice(0, 220));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
