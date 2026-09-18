// MENUS POLISH (final polish audit U2, U3, U5; per user "Work on all the above"). Bulk "Select all" in the sell
// shop leaves out equipped, legendary and enhanced gear, and a sale that holds any asks first; disassembling a set
// piece asks first and names what is lost; the fullscreen button enters fullscreen on the first press after a
// relaunch (it keyed off a saved flag), and keeps its painted icon.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/menus_polish_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11201';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openShop === 'function' && typeof openCraftingModal === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 40; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('town', 400); await sleep(2500); try { closeAllModals(); } catch (e) {}
    const clk = (id) => { const el = document.getElementById(id); if (el) el.click(); return !!el; };
    const confirmUp = () => { const m = document.getElementById('confirm-modal'); return !!(m && m.style.display && m.style.display !== 'none'); };
    const mk = (tag) => { let it = null; for (let k = 0; k < 20 && !(it && typeof it.price === 'number'); k++) it = rollItemDrop(1, 20); it = Object.assign({}, it); it.name = tag; it.rarity = 'common'; it.stars = 0; delete it.setId; return it; };
    // U2 — the sell shop
    const worn = mk('WORN'), leg = Object.assign(mk('LEG'), { rarity: 'legendary' }), star = Object.assign(mk('STAR'), { stars: 4 }), a = mk('PLAIN-A'), b = mk('PLAIN-B');
    player.inventory = [worn, leg, star, a, b]; player.equipped = player.equipped || {}; player.equipped.weapon = worn;
    game._sellSelection = new Set(); openShop('sell'); await sleep(200);
    clk('sell-all'); await sleep(200);
    out.selectAll = Array.from(game._sellSelection).map((i) => player.inventory[i] && player.inventory[i].name).sort();
    game._sellSelection.add(0); openShop('sell'); await sleep(200);
    clk('sell-confirm-btn'); await sleep(300);
    out.sellAsked = confirmUp(); out.sellBody = (document.getElementById('confirm-body') || {}).textContent || '';
    if (out.sellAsked) { clk('confirm-no'); await sleep(200); }
    out.afterNo = player.inventory.map((it) => it.name);
    game._sellSelection = new Set([3]); openShop('sell'); await sleep(150); clk('sell-confirm-btn'); await sleep(300);
    out.plainAsked = confirmUp(); out.afterPlain = player.inventory.map((it) => it.name);
    try { closeAllModals(); } catch (e) {}
    // U3 — disassemble a starred, equipped set piece
    const setId = Object.keys(SETS)[0];
    const piece = Object.assign(mk('SETPIECE'), { setId, rarity: 'legendary', stars: 3 });
    player.inventory = [piece]; openCraftingModal(); await sleep(300);
    const btn = document.querySelector('#craft-disassemble-list button'); if (btn) btn.click(); await sleep(300);
    out.salvageAsked = confirmUp(); out.salvageBody = (document.getElementById('confirm-body') || {}).textContent || '';
    if (out.salvageAsked) { clk('confirm-no'); await sleep(200); }
    out.pieceKept = player.inventory.indexOf(piece) >= 0;
    try { closeAllModals(); } catch (e) {}
    // U5 — the fullscreen button after a relaunch (desktop layout restored, not in fullscreen)
    let req = 0; const root = document.documentElement; root.requestFullscreen = () => { req++; return Promise.resolve(); };
    document.body.classList.add('force-desktop'); toggleFullscreenDesktop(); await sleep(100);
    out.fsRequests = req;
    _syncFullscreenIcon(); out.iconKept = !!document.querySelector('#fullscreen-btn .lx-corner-ico');
    return out;
  });
  check(J(r.selectAll) === J(['PLAIN-A', 'PLAIN-B']), '"Select all" leaves out equipped, legendary and star-enhanced gear', J(r.selectAll));
  check(r.sellAsked && /1 equipped/.test(r.sellBody), 'selling a set that holds equipped gear asks first, and says so', r.sellBody.slice(0, 120));
  check(r.afterNo.length === 5, '"Keep them" sells nothing', J(r.afterNo));
  check(!r.plainAsked && r.afterPlain.length === 4, 'a plain sale still goes through in one click', J({ asked: r.plainAsked, left: r.afterPlain }));
  check(r.salvageAsked && /LOST/.test(r.salvageBody), 'disassembling a starred set piece asks first and says the stars are lost', r.salvageBody.slice(0, 120));
  check(r.pieceKept, '"Keep it" keeps the piece', J(r.pieceKept));
  check(r.fsRequests === 1, 'after a relaunch (desktop layout restored), one press enters fullscreen', J(r.fsRequests));
  check(r.iconKept, 'the fullscreen button keeps its painted icon when fullscreen changes', J(r.iconKept));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
