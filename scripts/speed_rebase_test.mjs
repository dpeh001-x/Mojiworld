// A new mage or rogue keeps their speed across a reload - and the ones who already lost it get it back.
// Per the 2026-09-26 bug hunt: v0.29.472 rebased the mage (4.65 -> 3.74) and rogue (4.0 -> 3.8) class speed, with a
// one-time load migration that shifts an OLD save by the class delta and sets _spdRebase472. Nothing else set that latch,
// so every mage / rogue created since then had the old-save correction applied on their FIRST reload: 3.74 -> 2.83
// (-24% movement) for a mage, 3.8 -> 3.6 for a rogue, saved that way. applyClass now latches the base it writes, and
// load repairs exactly the fingerprint the mistake left (expected base + delta); a genuine pre-v0.29.472 save is still
// rebased once, and a character with invested Speed ranks is left alone.
//   node scripts/speed_rebase_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html', PORT = String(process.argv[3] || 9983);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/mojiworld_game.html?dev=1`;
const run = async (cls, mutate) => {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => typeof saveState === 'function' && document.getElementById('hero-name-input'), null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
  await page.fill('#hero-name-input', 'Speedy').catch(() => {});
  await page.evaluate((cls) => { const m = document.getElementById('class-select-modal'); if (!m) return; const re = new RegExp('^\\s*' + cls + '\\s*$', 'i'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (re.test((el.textContent || '').trim())) { el.click(); return; } } }, cls);
  await page.click('#cs-nav-next').catch(() => {});
  await page.waitForTimeout(2500);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  const made = await page.evaluate((src) => { const f = new Function(src); f(); saveState(); return { cls: player.cls, speed: player.baseSpeed, latch: player._spdRebase472 }; }, mutate || '');
  await page.waitForTimeout(400);
  await page.goto('about:blank');
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
  await page.waitForTimeout(11000);
  const after = await page.evaluate(() => ({ cls: player.cls, speed: +(player.baseSpeed || 0).toFixed(3), base: CLASSES[player.cls] && CLASSES[player.cls].stats.speed }));
  await ctx.close();
  return { made, after };
};
const R = {};
R.newMage = await run('mage');
R.newRogue = await run('rogue');
R.hitRanked = await run('mage', 'player._levelUpSpent = { speed: 4 }; player.baseSpeed = CLASSES.mage.stats.speed + 2 - 0.91; player._spdRebase472 = 1;');
R.hitFloored = await run('mage', 'player._levelUpSpent = { speed: 1 }; player.baseSpeed = CLASSES.mage.stats.speed; player._spdRebase472 = 1;');
R.oldSave = await run('mage', 'player.baseSpeed = 4.65; delete player._spdRebase472;');
R.invested = await run('mage', 'player._levelUpSpent = { speed: 4 }; player.baseSpeed = CLASSES.mage.stats.speed + 2; player._spdRebase472 = 1;');
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
const near = (a, b) => Math.abs(a - b) < 0.01;
ok(R.newMage.after.cls === 'mage' && near(R.newMage.after.speed, R.newMage.after.base), 'a new mage keeps the class base speed across a reload', R.newMage);
ok(R.newRogue.after.cls === 'rogue' && near(R.newRogue.after.speed, R.newRogue.after.base), 'a new rogue keeps it too', R.newRogue);
ok(near(R.hitRanked.after.speed, R.hitRanked.after.base + 2), 'a ranked mage it already hit (4 Speed ranks, 0.91 short) gets it back', R.hitRanked);
ok(near(R.hitFloored.after.speed, R.hitFloored.after.base + 0.5), 'one the load floor had lifted to the bare base gets its rank back', R.hitFloored);
ok(near(R.oldSave.after.speed, 4.65 - 0.91), 'CONTROL: a genuine pre-v0.29.472 save (4.65, no latch) is still rebased once', R.oldSave);
ok(near(R.invested.after.speed, R.invested.after.base + 2), 'CONTROL: invested Speed ranks are left alone', R.invested);
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
