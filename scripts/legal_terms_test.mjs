#!/usr/bin/env node
// v0.30.1491 - TERMS OF USE & LICENSE IN THE GAME (per user: "protect my copyright and have a legal clause that usage of my game
// contents to privately monetise with a private server need to pay royalties to the owner and creator of this game").
//   STATIC - the in-game page's "Private servers and royalties" paragraphs are the LICENSE file's, word for word; the clause
//            says a private / unofficial server needs written permission and a monetised one owes royalties to Moji-studios
//            and DADPEH as owner and creator; the README and the source header point at it
//   TITLE  - the copyright line's "Terms & License" link opens the page ABOVE the title screen, and Esc closes it
//   TITLE SETTINGS - the Terms button in Settings' title line (last in the DOM, clear of the title) opens it above Settings;
//            Esc closes only the page
//   GAME   - the same button in game: the page sits over Settings and holds the pause, the pad router picks it and its B
//            closer is #legal-close; Esc closes only the page, Settings and its pause stay. Opened on its own, it pauses the
//            game, outlasts the stuck-pause watchdog (3 s), dims the toasts, and closing it gives the game back
//   CLOSE  - closeAllModals closes it with everything else
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/legal_terms_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11781);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const src = read(process.env.MOJI_GAME_FILE ? path.resolve(process.env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html'));
const lic = read(path.join(ROOT, 'LICENSE')), readme = read(path.join(ROOT, 'README.md'));
const norm = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/\s+/g, ' ').trim();
// the page's clause: the <p>s of #legal-private-servers
const ki = src.indexOf('id="legal-private-servers"'), kj = src.indexOf('</div>', ki);
const pagePs = ki > 0 ? [...src.slice(ki, kj).matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => norm(m[1])) : [];
// the LICENSE's clause: the paragraphs between its heading and "Licensing enquiries"
const li = lic.indexOf('PRIVATE SERVERS AND ROYALTIES'), lj = lic.indexOf('Licensing enquiries', li);
const licPs = li >= 0 && lj > li ? lic.slice(li + 'PRIVATE SERVERS AND ROYALTIES'.length, lj).split(/\n\s*\n/).map(norm).filter(Boolean) : [];
ok('the page carries the private-server clause (3 paragraphs)', pagePs.length === 3, pagePs.length);
ok('the LICENSE carries the same clause, word for word', licPs.length === 3 && licPs.every((p, i) => p === pagePs[i]), licPs.length + ' paragraphs');
const all = pagePs.join(' ');
ok('a private or unofficial server needs prior written permission', /private or unofficial server requires the prior written permission of Moji-studios and DADPEH/.test(all));
ok('monetising one needs a written licence, and royalties are payable to the owner and creator', /written licence agreement/.test(all) && /royalties are payable to Moji-studios and DADPEH, as the owner and creator of the Work/.test(all));
ok('monetising without a licence infringes, and the remedies are reserved', /infringes the rights of the copyright holders/.test(all) && /recovery of the royalties due, damages, and any profits/.test(all));
ok('the title screen links the page and Settings offers it', /id="lo-terms"[^>]*openLegalModal/.test(src) && /id="set-terms"[^>]*openLegalModal/.test(src));
ok('the README and the source header point at it', /Private servers and royalties/.test(readme) && /royalties are payable to Moji-studios and DADPEH/.test(readme) && /owes royalties to Moji-studios and DADPEH/.test(src.slice(0, 1200)));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.mojiworld_prologue_seen = '1'; } catch (e) {} });   // a fresh profile plays the prologue film over the game
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
const state = () => page.evaluate(() => {
  const bg = document.getElementById('legal-modal-bg'), m = document.getElementById('legal-modal');
  const open = !!(bg && bg.classList.contains('on'));
  let onTop = false;
  if (open && m) { const r = m.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(40, r.height / 2)); onTop = !!(el && m.contains(el)); }
  const sm = document.getElementById('settings-modal-bg');
  return { open, onTop, text: open ? (m.innerText || '').replace(/\s+/g, ' ') : '', settings: !!(sm && sm.classList.contains('on')), paused: typeof game === 'object' ? !!game.paused : null };
});
// what a pad would drive now, and what its B button would press there
const pad = () => page.evaluate(() => {
  const root = _lxPadModalRootScan();
  const closer = root && root.querySelector('.mc-modal-close, [id$="-close"], .modal-close, .close-x');
  return { listed: _LX_PAD_MODAL_IDS.includes('legal-modal-bg'), root: root ? root.id : null, closer: closer ? closer.id : null };
});
try {
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!(m && m.offsetParent !== null && m.getClientRects().length); }, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  await page.click('#lo-terms');
  await page.waitForTimeout(300);
  const t1 = await state();
  ok('TITLE: the copyright line\'s link opens the page, above the title screen', t1.open && t1.onTop, JSON.stringify({ open: t1.open, onTop: t1.onTop }));
  ok('TITLE: the page reads the private-server royalty clause', /royalties are payable to Moji-studios and DADPEH/.test(t1.text));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const t2 = await state(), menuUp = await page.evaluate(() => { const m = document.getElementById('lo-menu'); return !!(m && m.offsetParent !== null); });
  ok('TITLE: Esc closes it and the title menu is still there', !t2.open && menuUp, JSON.stringify({ open: t2.open, menuUp }));
  // the title menu's Settings (hoisted to z 10001), then its Terms button
  await page.click('#menu-settings'); await page.waitForTimeout(300);
  const geo = await page.evaluate(() => {
    const m = document.getElementById('settings-modal'), b = document.getElementById('set-terms'), h = m.querySelector('h2');
    const br = b.getBoundingClientRect(), hr = h.getBoundingClientRect(), mr = m.getBoundingClientRect(), all = [...m.querySelectorAll('button')];
    const hit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    return { last: all[all.length - 1] === b, clear: br.left > hr.right + 4, top: Math.round(br.top - mr.top), inside: br.right <= mr.right, shown: !!(hit && b.contains(hit)) };
  });
  ok('TITLE SETTINGS: the Terms button sits in the title line, clear of the title, last in the DOM (the pad still starts on the first setting)', geo.last && geo.clear && geo.top < 60 && geo.inside && geo.shown, JSON.stringify(geo));
  await page.click('#set-terms'); await page.waitForTimeout(300);
  const s1 = await state();
  ok('TITLE SETTINGS: the Terms button opens the page above Settings', s1.open && s1.onTop && s1.settings, JSON.stringify({ open: s1.open, onTop: s1.onTop, settings: s1.settings }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const s2 = await state();
  ok('TITLE SETTINGS: Esc closes only the page, Settings stays', !s2.open && s2.settings, JSON.stringify({ open: s2.open, settings: s2.settings }));
  await page.evaluate(() => closeSettingsModal());
  // in game
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1500)); game.paused = false;
    openSettingsModal();
  });
  await page.waitForTimeout(300);
  await page.click('#set-terms'); await page.waitForTimeout(300);
  const g1 = await state(), p1 = await pad();
  ok('GAME: the Terms button in Settings opens the page over Settings, game paused', g1.open && g1.onTop && g1.settings && g1.paused === true, JSON.stringify({ open: g1.open, onTop: g1.onTop, settings: g1.settings, paused: g1.paused }));
  ok('GAME: the pad drives the page, not Settings under it, and B presses its Close', p1.listed && p1.root === 'legal-modal-bg' && p1.closer === 'legal-close', JSON.stringify(p1));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const g2 = await state();
  ok('GAME: Esc closes only the page; Settings and its pause stay', !g2.open && g2.settings && g2.paused === true, JSON.stringify({ open: g2.open, settings: g2.settings, paused: g2.paused }));
  await page.evaluate(() => closeSettingsModal()); await page.waitForTimeout(100);
  const g3 = await state();
  // on its own: the page takes the pause, keeps it past the watchdog's 3 s, and gives it back
  await page.evaluate(() => openLegalModal()); await page.waitForTimeout(3600);
  const w1 = await state(), dim = await page.evaluate(() => document.body.classList.contains('lx-panel-up'));
  ok('GAME: opened on its own it pauses the game, past the stuck-pause watchdog, and dims the toasts', g3.paused === false && w1.open && w1.paused === true && dim, JSON.stringify({ before: g3.paused, open: w1.open, paused: w1.paused, dim }));
  await page.click('#legal-close'); await page.waitForTimeout(200);
  const w2 = await state();
  ok('GAME: its Close gives the game back', !w2.open && w2.paused === false, JSON.stringify({ open: w2.open, paused: w2.paused }));
  await page.evaluate(() => { openSettingsModal(); openLegalModal(); closeAllModals(); });
  const c1 = await state();
  ok('CLOSE: closeAllModals closes it with everything else', !c1.open && !c1.settings, JSON.stringify({ open: c1.open, settings: c1.settings }));
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
