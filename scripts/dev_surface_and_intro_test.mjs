// (1) Dev tools exist only on developer surfaces. The same build is opened three ways: on localhost (a developer
// surface), on a made-up public hostname mapped to the same server, and on localhost posing as the packaged Steam
// app (MOJI_PACKAGED). Only the first may have ?dev=1, the lock icon, the passphrase, the backtick prompt.
// (2) Every boss a boss arena spawns, and every boss in the spawn banner's lore table, has an intro card.
//
//   [SERVE_ROOT=<dir with serve.js + data/ + art>] node scripts/dev_surface_and_intro_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
// v0.30.924 — the passphrase is no longer written in this file: CHANGELOG.html published it, the public site
// serves the changelog, and the lock icon works there, so the word was the whole gate. Set LX_DEV_PW to run these.
const DEV_PW = process.env.LX_DEV_PW || '';
if (!DEV_PW) { console.log('SKIP dev_surface_and_intro_test — set LX_DEV_PW to the dev passphrase to run it'); process.exit(0); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11106';
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const probe = async (host, packaged) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } }); const page = await ctx.newPage();
  let prompts = 0, answer = null;   // answer !== null: the lock icon's own prompt is being driven on purpose
  page.on('dialog', async (d) => { prompts++; try { if (d.type() === 'prompt' && answer != null) await d.accept(answer); else await d.dismiss(); } catch (e) {} });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  if (packaged) await page.addInitScript(() => { window.MOJI_PACKAGED = true; });
  await page.goto(`http://${host}:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openDevConsole === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } loadMap('forest', 300); game.paused = false; });
  await page.waitForTimeout(800);
  // v0.30.894 put the lock icon back on the public link for testers, and unlocking it — by the icon's prompt or by
  // typing the passphrase — sets LX_DEV, which makes any host a developer surface. So a public host has two states
  // and they have to be read separately: BEFORE the passphrase (?dev=1 on its own must do nothing) and after it
  // (the passphrase is the gate). The packaged app stays shut in both, because MOJI_PACKAGED wins over the flag.
  const shot = () => page.evaluate(() => {
    const dm = document.getElementById('dev-modal'); const before = dm ? getComputedStyle(dm).display : 'none';
    try { if (dm) dm.style.display = 'none'; openDevConsole(); } catch (e) {}
    const after = dm ? getComputedStyle(dm).display : 'none'; if (dm) dm.style.display = 'none'; game.paused = false;
    const btn = document.getElementById('mobile-dev-btn');
    return { surface: typeof _lxDevSurface === 'function' ? _lxDevSurface() : null, icon: !!document.getElementById('lx-dev-lock'), bodyDev: document.body.classList.contains('lx-dev'),
      stored: localStorage.getItem('LX_DEV'), consoleOpenedByKeys: before !== 'none', consoleOpens: after !== 'none', scaleDebugRow: (() => { const el = document.querySelector('.lx-dev-only'); return el ? getComputedStyle(el).display !== 'none' : null; })(),
      mobileBtnRule: btn ? getComputedStyle(btn).display : 'absent', ver: GAME_VERSION };
  });
  const pre = await shot();                                          // ?dev=1 only, nothing typed yet
  await page.keyboard.type(DEV_PW, { delay: 40 });                   // the typed passphrase
  await page.waitForTimeout(300);
  await page.keyboard.press('Backquote');                            // the backtick prompt / console
  await page.waitForTimeout(500);
  const typed = await shot();
  // the tester path on a public link: click the lock icon and answer its prompt (the TYPED sequence is a
  // developer-surface convenience and is not what v0.30.894 opened up).
  answer = DEV_PW;
  await page.evaluate(() => { const el = document.getElementById('lx-dev-lock'); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await page.waitForTimeout(700);
  const r = await shot();
  r.pre = pre; r.typed = typed; r.prompts = prompts; r.errs = errs; await ctx.close(); return r;
};
try {
  const dev = await probe('localhost', false), pub = await probe('play.mojiworld.test', false), steam = await probe('localhost', true);
  console.log('build ' + dev.ver);
  check(dev.surface === true && dev.icon && dev.consoleOpens && dev.bodyDev && dev.scaleDebugRow === true, 'localhost is a developer surface: ?dev=1 works, the lock icon is there, the console opens, dev-only rows show', JSON.stringify({ surface: dev.surface, icon: dev.icon, console: dev.consoleOpens, stored: dev.stored }));
  check(pub.pre.surface === false && !pub.pre.consoleOpens && !pub.pre.consoleOpenedByKeys && !pub.pre.bodyDev && pub.pre.stored !== '1' && pub.pre.scaleDebugRow === false,
    'a public hostname is shut until the passphrase: ?dev=1 is ignored and the console stays closed', JSON.stringify({ surface: pub.pre.surface, console: pub.pre.consoleOpens, byKeys: pub.pre.consoleOpenedByKeys, stored: pub.pre.stored }));
  check(pub.pre.icon === true, 'the lock icon IS on the public link for testers (v0.30.894) — it is the gate, not the absence of one', JSON.stringify({ icon: pub.pre.icon }));
  check(pub.typed.surface === false && pub.typed.stored !== '1',
    'typing the passphrase on a public host does nothing — the typed sequence is a developer-surface convenience', JSON.stringify({ surface: pub.typed.surface, stored: pub.typed.stored }));
  check(pub.surface === true && pub.stored === '1' && pub.consoleOpens,
    'the lock icon plus the right password opens it there, and only then (v0.30.894 / v0.30.925)', JSON.stringify({ surface: pub.surface, stored: pub.stored, console: pub.consoleOpens }));
  check(steam.pre.surface === false && !steam.pre.icon && !steam.pre.consoleOpens && steam.surface === false && !steam.icon && !steam.consoleOpens && steam.stored !== '1' && steam.prompts === 0, 'the packaged Steam app (127.0.0.1 + MOJI_PACKAGED) has no dev tools either, passphrase or not', JSON.stringify({ surface: steam.surface, icon: steam.icon, console: steam.consoleOpens, stored: steam.stored }));
  check(!dev.errs.length && !pub.errs.length && !steam.errs.length, 'no page errors on any surface', dev.errs.concat(pub.errs, steam.errs).slice(0, 2).join(' | '));
  // ---- intro cards ----
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _resolveBossIntro === 'function' && typeof MAPS === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const bi = await page.evaluate(() => {
    const arena = []; for (const [id, m] of Object.entries(MAPS)) { if (!m || !m.isBossArena || !Array.isArray(m.spawns)) continue; const s = m.spawns.find((x) => x && x.boss); if (s) arena.push({ map: id, type: s.type, ok: !!_resolveBossIntro(s.type) }); }
    const named = ['young_confused_barnaby', 'sundered_smith', 'mirrorSelf', 'legosaurus', 'pqConductor', 'brinekraken', 'towerArbiter', 'towerSovereign'].map((t) => { const i = _resolveBossIntro(t); return { t, ok: !!(i && i.name && i.title && i.lore && i.glyph && i.color), known: !!monsterTypes[t] }; });
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    _playBossIntro('legosaurus');
    const o = document.getElementById('boss-intro-overlay');
    const shown = { on: !!o && o.classList.contains('on'), name: (document.getElementById('boss-intro-name') || {}).textContent, title: (document.getElementById('boss-intro-title') || {}).textContent, lore: (document.getElementById('boss-intro-lore') || {}).textContent, loreShown: (() => { const l = document.getElementById('boss-intro-lore'); return !!(l && l.textContent && getComputedStyle(l).display !== 'none'); })() };
    if (o) o.classList.remove('on'); game.paused = false;
    return { arena, named, shown };
  });
  const noCard = bi.arena.filter((a) => !a.ok);
  check(bi.arena.length >= 9 && !noCard.length, 'every boss a boss arena spawns has an intro card', noCard.map((a) => a.map + ':' + a.type).join(', ') || bi.arena.length + ' arenas');
  check(bi.named.every((n) => n.ok && n.known), 'the eight named bosses that only had a spawn banner now have a full card (name, title, lore, glyph, colour)', bi.named.filter((n) => !n.ok || !n.known).map((n) => n.t).join(', '));
  check(bi.shown.on && /LEGOSAURUS/.test(bi.shown.name || '') && /Warped Tyrant/.test(bi.shown.title || '') && !bi.shown.loreShown, 'the card renders: LEGOSAURUS, The Warped Tyrant on its tape, and no lore paragraph (v0.30.1068, per user: "less wordy")', JSON.stringify(bi.shown).slice(0, 160));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
