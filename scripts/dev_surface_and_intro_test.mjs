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
  let prompts = 0; page.on('dialog', async (d) => { prompts++; try { await d.dismiss(); } catch (e) {} });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  if (packaged) await page.addInitScript(() => { window.MOJI_PACKAGED = true; });
  await page.goto(`http://${host}:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openDevConsole === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } loadMap('forest', 300); game.paused = false; });
  await page.waitForTimeout(800);
  await page.keyboard.type(DEV_PW, { delay: 40 });          // the typed passphrase
  await page.waitForTimeout(300);
  await page.keyboard.press('Backquote');                            // the backtick prompt / console
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const dm = document.getElementById('dev-modal'); const before = dm ? getComputedStyle(dm).display : 'none';
    try { if (dm) dm.style.display = 'none'; openDevConsole(); } catch (e) {}
    const after = dm ? getComputedStyle(dm).display : 'none'; if (dm) dm.style.display = 'none'; game.paused = false;
    const btn = document.getElementById('mobile-dev-btn');
    return { surface: typeof _lxDevSurface === 'function' ? _lxDevSurface() : null, icon: !!document.getElementById('lx-dev-lock'), bodyDev: document.body.classList.contains('lx-dev'),
      stored: localStorage.getItem('LX_DEV'), consoleOpenedByKeys: before !== 'none', consoleOpens: after !== 'none', scaleDebugRow: (() => { const el = document.querySelector('.lx-dev-only'); return el ? getComputedStyle(el).display !== 'none' : null; })(),
      mobileBtnRule: btn ? getComputedStyle(btn).display : 'absent', ver: GAME_VERSION };
  });
  r.prompts = prompts; r.errs = errs; await ctx.close(); return r;
};
try {
  const dev = await probe('localhost', false), pub = await probe('play.mojiworld.test', false), steam = await probe('localhost', true);
  console.log('build ' + dev.ver);
  check(dev.surface === true && dev.icon && dev.consoleOpens && dev.bodyDev && dev.scaleDebugRow === true, 'localhost is a developer surface: ?dev=1 works, the lock icon is there, the console opens, dev-only rows show', JSON.stringify({ surface: dev.surface, icon: dev.icon, console: dev.consoleOpens, stored: dev.stored }));
  check(pub.surface === false && !pub.icon && !pub.consoleOpens && !pub.consoleOpenedByKeys && !pub.bodyDev && pub.stored !== '1' && pub.prompts === 0 && pub.scaleDebugRow === false,
    'a public hostname has no dev tools: ?dev=1 ignored, no icon, passphrase and backtick do nothing, no prompt, console stays shut', JSON.stringify({ surface: pub.surface, icon: pub.icon, console: pub.consoleOpens, byKeys: pub.consoleOpenedByKeys, stored: pub.stored, prompts: pub.prompts }));
  check(steam.surface === false && !steam.icon && !steam.consoleOpens && steam.stored !== '1' && steam.prompts === 0, 'the packaged Steam app (127.0.0.1 + MOJI_PACKAGED) has no dev tools either', JSON.stringify({ surface: steam.surface, icon: steam.icon, console: steam.consoleOpens, stored: steam.stored }));
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
    const shown = { on: !!o && o.classList.contains('on'), name: (document.getElementById('boss-intro-name') || {}).textContent, title: (document.getElementById('boss-intro-title') || {}).textContent, lore: (document.getElementById('boss-intro-lore') || {}).textContent };
    if (o) o.classList.remove('on'); game.paused = false;
    return { arena, named, shown };
  });
  const noCard = bi.arena.filter((a) => !a.ok);
  check(bi.arena.length >= 9 && !noCard.length, 'every boss a boss arena spawns has an intro card', noCard.map((a) => a.map + ':' + a.type).join(', ') || bi.arena.length + ' arenas');
  check(bi.named.every((n) => n.ok && n.known), 'the eight named bosses that only had a spawn banner now have a full card (name, title, lore, glyph, colour)', bi.named.filter((n) => !n.ok || !n.known).map((n) => n.t).join(', '));
  check(bi.shown.on && /LEGOSAURUS/.test(bi.shown.name || '') && /Warped Tyrant/.test(bi.shown.title || '') && /fear wearing armour/.test(bi.shown.lore || ''), 'the card renders: LEGOSAURUS — The Warped Tyrant — with its lore', JSON.stringify(bi.shown).slice(0, 160));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
