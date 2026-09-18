// QUICK-SELL CONFIRM (v0.30.864, per user "quick-sell uses the browser's plain confirm box. fix this"): Instant sell by tier
// asks through the game's own dialog, on top of the shop, and sells only on Confirm; Cancel sells nothing.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/quick_sell_confirm_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11167';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  let nativeDialogs = 0; page.on('dialog', async (d) => { nativeDialogs++; try { await d.accept(); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openShop === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const stock = () => page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { player.cls = 'warrior'; player.level = 30; player._tutorialSeen = true; loadMap('glasswindSteppe', 900); await sleep(1200); }
    player.inventory = (player.inventory || []).filter((it) => !(it && it._qsProbe));
    const pool = [].concat(ITEM_POOL.weapons, ITEM_POOL.armors || [], ITEM_POOL.accessories || []).filter((it) => (it.tier | 0) === 1).slice(0, 3);
    for (const it of pool) player.inventory.push({ ...it, slot: (typeof _catToSlot === 'function' && ITEM_POOL.weapons.includes(it)) ? 'weapon' : (ITEM_POOL.armors || []).includes(it) ? 'armor' : ITEM_POOL.weapons.includes(it) ? 'weapon' : 'accessory', _qsProbe: true });
    game._sellInstant = true; game._sellSelection && game._sellSelection.clear(); openShop('sell'); await sleep(200);
    const sel = document.getElementById('sell-tier'); if (!sel) return { err: 'no #sell-tier' };
    const opt = [...sel.options].find((o) => o.value === '1'); if (!opt) return { err: 'no tier-1 option' };
    return { probes: player.inventory.filter((it) => it && it._qsProbe).length, coins: player.mojicoins || 0 }; });
  const pick = () => page.evaluate(() => { const sel = document.getElementById('sell-tier'); sel.value = '1'; sel.onchange(); });
  const state = () => page.evaluate(() => { const cm = document.getElementById('confirm-modal'); const yes = document.getElementById('confirm-yes');
    const vis = !!(cm && getComputedStyle(cm).display !== 'none'); let top = null;
    if (vis && yes) { const r = yes.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); top = !!(el && (el === yes || yes.contains(el))); }
    return { modal: vis, yesOnTop: top, title: vis ? document.getElementById('confirm-title').textContent : null, body: vis ? document.getElementById('confirm-body').textContent : null,
      probes: player.inventory.filter((it) => it && it._qsProbe).length, coins: player.mojicoins || 0 }; });

  const s0 = await stock(); if (s0.err) throw new Error(s0.err);
  await pick(); await page.waitForTimeout(400);
  const asked = await state();
  check(nativeDialogs === 0, 'choosing a tier in Instant mode opens no browser dialog (was: window.confirm)', J({ nativeDialogs }));
  check(asked.modal && asked.yesOnTop && /Tier 1/.test(asked.title || '') && (asked.body || '').indexOf('Sell ' + s0.probes + ' unequipped item') === 0 && s0.probes >= 2, 'the game\u2019s own dialog asks, on top of the shop, naming the count and tier', J(asked));
  check(asked.probes === s0.probes, 'nothing is sold while the question is open', J({ probes: asked.probes, stocked: s0.probes }));
  if (asked.modal) { await page.click('#confirm-yes'); await page.waitForTimeout(400); }
  const sold = await state();
  check(sold.probes === 0 && sold.coins > s0.coins, 'Confirm sells them and pays', J({ before: s0, after: sold }));

  const s1 = await stock(); await pick(); await page.waitForTimeout(400);
  const asked2 = await state(); if (asked2.modal) { await page.click('#confirm-no'); await page.waitForTimeout(400); }
  const kept = await state(); const selLeft = await page.evaluate(() => game._sellSelection ? game._sellSelection.size : -1);
  check(asked2.modal && kept.probes === s1.probes && kept.coins === s1.coins && selLeft === 0 && !kept.modal, 'Cancel sells nothing and clears the selection', J({ kept, selLeft }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
