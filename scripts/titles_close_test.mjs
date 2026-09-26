// The Titles panel closes with every other panel (v0.30.x titles-close).
//   node scripts/titles_close_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Bug hunt: with Titles open, U or J opened the Level Up panel / the Journal underneath it (closeAllModals never
// took Titles down), so nothing seemed to happen until Esc. Titles is also removed, not hidden, and carries its own
// Escape listener, which must go with it.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10913';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof openTitlesPanel === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
  });
  const st = () => p.evaluate(() => {
    const on = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const h = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    const inside = (id) => { const e = document.getElementById(id); return !!e && !!h && e.contains(h); };
    return { titles: on('titles-modal'), lp: on('attributes-modal'), journal: on('quest-modal'), lpOnTop: inside('attributes-modal'), journalOnTop: inside('quest-modal'), paused: !!game.paused };
  });
  const openTitles = async () => { await p.keyboard.press('u'); await p.waitForTimeout(500); await p.evaluate(() => document.querySelector('#u-jump-row .u-jump[data-ujump="titles"]').click()); await p.waitForTimeout(500); };
  const reset = async () => { await p.evaluate(() => { try { closeAllModals(); } catch (e) {} }); await p.waitForTimeout(300); };

  await openTitles();
  const a0 = await st();
  await p.keyboard.press('u'); await p.waitForTimeout(600);
  const a1 = await st();
  check(a0.titles && !a1.titles && a1.lp && a1.lpOnTop, 'with Titles open, U brings the Level Up panel up on top (Titles closes)', [a0, a1]);
  await reset();

  await openTitles();
  await p.keyboard.press('j'); await p.waitForTimeout(600);
  const b1 = await st();
  check(!b1.titles && b1.journal && b1.journalOnTop, 'with Titles open, J brings the Journal up on top', b1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  const b2 = await st();
  check(!b2.journal && !b2.titles, 'one Esc then closes the Journal - no leftover Titles listener eats it', b2);
  await reset();

  await openTitles(); await openTitles();   // reopening must not stack a second Escape listener
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const c1 = await st();
  await p.keyboard.press('j'); await p.waitForTimeout(600);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const c2 = await st();
  check(!c1.titles && !c2.journal, 'Titles reopened twice: one Esc closes it, and the next panel still closes on one Esc', [c1, c2]);
  await reset();

  await openTitles();
  await p.evaluate(() => closeAllModals()); await p.waitForTimeout(300);
  const d1 = await st();
  check(!d1.titles && !d1.paused, 'closeAllModals() takes Titles down and unpauses the game', d1);

  await openTitles();
  await p.click('#tt-close'); await p.waitForTimeout(300);
  const e1 = await st();
  await openTitles();
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const e2 = await st();
  check(!e1.titles && !e2.titles && !e2.paused, "Titles still closes with its own Close button and with Esc", [e1, e2]);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
