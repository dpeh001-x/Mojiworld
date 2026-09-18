// CONTROLLER ITEM STATS (final polish audit U6; per user "Work on all the above"). Moving the pad's focus ring onto an
// inventory item opens that item's tooltip (stats and comparison) the way a mouse hover does; moving on swaps it; closing
// the panel hides it.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/pad_item_tip_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11215';
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxPadMenuNav === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 30; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('town', 400); await sleep(2000); try { closeAllModals(); } catch (e) {}
    const names = [];
    for (let i = 0; i < 4; i++) { const it = Object.assign({}, rollItemDrop(1, 20)); it.name = 'TIPITEM' + i; names.push(it.name); player.inventory.push(it); }
    _lxOpenUPanelTab('items'); await sleep(500);
    const root = _lxPadModalRoot(); out.root = root && (root.id || root.className);
    const P = (btn) => ({ buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === btn, value: i === btn ? 1 : 0 })), axes: [0, 0, 0, 0] });
    const tt = () => { const t = document.getElementById('item-tooltip'); return { shown: !!(t && t.style.display === 'block'), text: t ? (t.textContent || '').slice(0, 60) : '' }; };
    out.steps = [];
    for (let k = 0; k < 40; k++) {
      _lxPadMenuNav(root, P(15)); _lxPadMenuNav(root, P(-1)); await sleep(30);   // D-pad right, released
      const f = document.querySelector('.pad-focus'); const t = tt();
      out.steps.push({ item: !!(f && f._lxItemTip), shown: t.shown, name: (t.text.match(/TIPITEM\d/) || [null])[0] });
      if (out.steps.filter((x) => x.item && x.shown).length >= 2) break;
    }
    out.onItem = out.steps.filter((x) => x.item);
    closeAllModals(); await sleep(150); out.afterClose = tt().shown;
    return out;
  });
  const hits = r.onItem.filter((x) => x.shown && x.name);
  check(r.onItem.length > 0 && hits.length === r.onItem.length, 'the focus ring landing on an item opens that item\'s tooltip', J({ root: r.root, onItem: r.onItem.slice(0, 3) }));
  check(new Set(hits.map((x) => x.name)).size >= 2, 'moving to the next item swaps the tooltip to it', J(hits.map((x) => x.name)));
  check(r.afterClose === false, 'closing the panel hides the tooltip', J(r.afterClose));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
