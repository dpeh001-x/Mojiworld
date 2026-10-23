// Save Backups keep the player's own slots (fix-backup-evict) and a restore keeps the save it replaces (fix-restore-keeps-current).
//   node scripts/backup_slots_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// An automatic copy ('auto - before New Game / Erase / cloud sync') used to push the oldest slot the player made on purpose out of the five; and Restore replaced the
// current save without keeping it, so restoring the wrong slot discarded newer progress for good.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10632';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = []; const URL = `http://localhost:${PORT}/${FILE}`;
const MD = String.fromCharCode(183);   // the middle dot the automatic labels use
const ready = (p) => p.waitForFunction(() => typeof loadMap === 'function' && typeof _lxRestoreBackup === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(p); await p.waitForTimeout(3000);
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._prologueAfterCreation = false; window._lxAwaitingCreation = false; window._lxInWorld = true;
    player._tutorialSeen = true; applyClass('warrior'); player.level = 20; player.hp = getMaxHp();
    for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true;
    loadMap('town'); await new Promise((s) => setTimeout(s, 2000)); document.getElementById('everdawn-welcome-overlay')?.remove();
  });
  const R = await p.evaluate(async (MD) => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms)), out = {};
    const coins = () => _lxGetBackups().map((b) => JSON.parse(b.data).player.mojicoins), labels = () => _lxGetBackups().map((b) => b.label || '');
    const make = async (label, c) => { player.mojicoins = c; _lxCreateBackup(label); await sleep(30); };
    for (let i = 1; i <= 5; i++) await make('', 1000 * i);
    out.five = coins().slice().sort();
    await make('auto ' + MD + ' before New Game', 6000);   // the first safety copy, with the player's five slots full
    out.afterAuto1 = { coins: coins().slice().sort(), n: labels().length, first: labels()[0] };
    await make('auto ' + MD + ' before Erase', 7000);        // the next one replaces the older automatic copy, not a slot of the player's
    out.afterAuto2 = { coins: coins().slice().sort(), n: labels().length, autos: labels().filter((l) => /^auto/.test(l)).length };
    await make('', 8000);                                      // a manual slot: the automatic copy goes first, then the oldest of the player's own
    out.afterManual = { coins: coins().slice().sort(), n: labels().length, autos: labels().filter((l) => /^auto/.test(l)).length };
    return out;
  }, MD);
  const arr = (a) => JSON.stringify(a);
  check(arr(R.five) === arr([1000, 2000, 3000, 4000, 5000]), 'five manual slots', R.five);
  check(R.afterAuto1.first === 'auto ' + MD + ' before New Game' && arr(R.afterAuto1.coins) === arr([1000, 2000, 3000, 4000, 5000, 6000]), 'an automatic copy with five slots full takes its own slot: all five of the player\'s stay', R.afterAuto1);
  check(R.afterAuto2.autos === 1 && R.afterAuto2.n === 6 && arr(R.afterAuto2.coins) === arr([1000, 2000, 3000, 4000, 5000, 7000]), 'the next automatic copy replaces the older automatic one, never a manual slot', R.afterAuto2);
  check(R.afterManual.autos === 0 && R.afterManual.n === 5 && arr(R.afterManual.coins) === arr([2000, 3000, 4000, 5000, 8000]), 'a manual slot over the cap drops the automatic copy first, then the oldest manual', R.afterManual);
  // ---- Restore keeps the save it replaces
  const S3 = await p.evaluate(async () => {
    player.mojicoins = 424242; _flushSaveStateNow(); await new Promise((s) => setTimeout(s, 300));
    const oldest = _lxGetBackups().slice(-1)[0]; const want = JSON.parse(oldest.data).player.mojicoins;
    _lxRestoreBackup(oldest.id); return { want };
  });
  await p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}); await ready(p); await p.waitForTimeout(1500);
  const A = await p.evaluate(() => ({ stored: JSON.parse(localStorage.getItem(SAVE_KEY)).player.mojicoins, kept: _lxGetBackups().filter((b) => /before restore/.test(b.label || '')).map((b) => JSON.parse(b.data).player.mojicoins), n: _lxGetBackups().length }));
  check(A.stored === S3.want && A.kept.length === 1 && A.kept[0] === 424242, 'Restore replaces the save and keeps the one it replaced in a slot', { A, want: S3.want });
  check(A.n <= 6, 'the safety copy does not grow the list past one extra slot', A);
  // undo: restoring the safety copy brings the newer progress back
  await p.evaluate(() => { const b = _lxGetBackups().find((x) => /before restore/.test(x.label || '')); _lxRestoreBackup(b.id); });
  await p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}); await ready(p); await p.waitForTimeout(1500);
  const B = await p.evaluate(() => JSON.parse(localStorage.getItem(SAVE_KEY)).player.mojicoins);
  check(B === 424242, 'restoring that safety copy undoes the mistaken restore', B);
  console.log('errors:', errs.slice(0, 4));
} catch (e) { console.log('ERROR', String(e && e.stack || e).slice(0, 600)); bad++; total++; }
await browser.close().catch(() => {}); try { srv.kill(); } catch (e) {}
console.log(`${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
