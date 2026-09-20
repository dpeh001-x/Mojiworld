// The dev lock icon on the public web, for a tester (v0.30.x dev-lock-web).
//   node scripts/dev_lock_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "can we put back the dev mode with the lock icon for my tester to test".
// The public web is simulated with a host name that is not local (Chrome maps it to this machine's server), so the
// game's developer-surface check sees exactly what it sees on the real public link.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
// v0.30.924 — the passphrase is no longer written in this file: CHANGELOG.html published it, the public site
// serves the changelog, and the lock icon works there, so the word was the whole gate. Set LX_DEV_PW to run these.
const DEV_PW = process.env.LX_DEV_PW || '';
if (!DEV_PW) { console.log('SKIP dev_lock_test — set LX_DEV_PW to the dev passphrase to run it'); process.exit(0); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10481';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PUBLIC = 'tester.mojiworld.example';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', `--host-resolver-rules=MAP ${PUBLIC} 127.0.0.1`] });
const errs = [];
const open = async (host, query = '', init = null) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 747 }, serviceWorkers: 'block' });
  const page = await ctxPage(ctx, host, query, init);
  return { ctx, page };
};
async function ctxPage(ctx, host, query, init) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  page._dialogs = []; page._answer = null;
  page.on('dialog', async (d) => { page._dialogs.push(d.message()); if (d.type() === 'prompt' && page._answer != null) await d.accept(page._answer); else await d.dismiss(); });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  if (init) await page.addInitScript(init);
  await page.goto(`http://${host}:${PORT}/${FILE}${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof openDevConsole === 'function' && typeof _lxDevSurface === 'function' && document.body, null, { timeout: 120000 });
  await page.waitForTimeout(600);
  return page;
}
const state = (page) => page.evaluate(() => {
  const lock = document.getElementById('lx-dev-lock'), modal = document.getElementById('dev-modal');
  let flag = null; try { flag = localStorage.getItem('LX_DEV'); } catch (e) {}
  return { lock: lock ? lock.textContent : null, surface: _lxDevSurface(), flag, devClass: document.body.classList.contains('lx-dev'), console: !!(modal && getComputedStyle(modal).display !== 'none') };
});
const clickLock = (page) => page.evaluate(() => { const el = document.getElementById('lx-dev-lock'); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
try {
  // ---- the public web, a fresh browser
  { const { ctx, page } = await open(PUBLIC, '?dev=1');
    const s0 = await state(page);
    await page.evaluate(() => { try { openDevConsole(); } catch (e) {} });
    const s1 = await state(page);
    await page.keyboard.press('Backquote'); await page.waitForTimeout(300);
    const s2 = await state(page);
    console.log('public, fresh, ?dev=1:', JSON.stringify({ s0, s1, backtickDialogs: page._dialogs.length, s2 }));
    check(s0.lock === '🔒', 'on the public web the lock icon is back (locked)', s0);
    check(!s0.surface && !s1.console && !s1.devClass, '...but ?dev=1 alone unlocks nothing there: no console, no dev settings', { s0, s1 });
    check(page._dialogs.length === 0 && !s2.console, '...and the backtick asks for nothing and opens nothing', { dialogs: page._dialogs, s2 });
    // a wrong password
    page._answer = 'not-the-password'; await clickLock(page); await page.waitForTimeout(300);
    const s3 = await state(page);
    check(page._dialogs.length === 1 && s3.flag !== '1' && s3.lock === '🔒' && !s3.console, 'a wrong password at the lock leaves it locked', { dialogs: page._dialogs, s3 });
    // the password
    page._answer = DEV_PW; await clickLock(page); await page.waitForTimeout(500);
    const s4 = await state(page);
    console.log('after the password:', JSON.stringify(s4));
    check(s4.flag === '1' && s4.lock === '🔓' && s4.console && s4.devClass && s4.surface, 'the lock\'s password unlocks it: 🔓, the dev console opens, the dev settings show', s4);
    // the same browser, next visit (no ?dev=1)
    await page.goto(`http://${PUBLIC}:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof openDevConsole === 'function' && typeof _lxDevSurface === 'function', null, { timeout: 120000 });
    await page.waitForTimeout(600);
    const s5 = await state(page);
    await page.evaluate(() => { const m = document.getElementById('dev-modal'); if (m) m.style.display = 'none'; });
    await page.keyboard.press('Backquote'); await page.waitForTimeout(400);
    const s6 = await state(page);
    console.log('next visit:', JSON.stringify({ s5, s6 }));
    check(s5.surface && s5.lock === '🔓' && s5.devClass, 'the tester\'s browser stays unlocked on the next visit', s5);
    check(s6.console, '...and the backtick opens the dev console there, as on a developer machine', s6);
    await ctx.close(); }
  // ---- the Steam app: never, even with the flag
  { const { ctx, page } = await open(PUBLIC, '?dev=1', () => { window.MOJI_PACKAGED = true; try { localStorage.setItem('LX_DEV', '1'); } catch (e) {} });
    const s = await state(page);
    await page.evaluate(() => { try { openDevConsole(); } catch (e) {} });
    const s1 = await state(page);
    console.log('packaged:', JSON.stringify({ s, s1 }));
    check(s.lock === null && !s.surface && !s1.console, 'the packaged Steam app still shows no lock and opens no dev console, even with the flag set', { s, s1 });
    await ctx.close(); }
  // ---- a developer machine: unchanged
  { const { ctx, page } = await open('localhost');
    const s = await state(page);
    check(s.lock === '🔒' && s.surface, 'on localhost the lock is there as before', s);
    await ctx.close(); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
