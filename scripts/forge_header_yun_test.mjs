// THE BENCH HEADER TELLS THE TRUTH ABOUT GRAVITOS, AND YUN INSPECTS RATHER THAN SELLS (v0.30.962-963).
//
// Header: it said Gravitos pays "+6 shards per kill". A boss drops bossLevel^2 (capped 10,000) on the
// first kill and a diminishing ladder after; Gravitos is Lv 100. Three orders of magnitude out, since
// v0.25. The line now reads his level and the ladder constants, and this checks it against them.
//
// Yun: "Inspect my gear" opened openShop('weapon') - the buy/sell counter, titled "Brok's Forge" -
// which from a border sentinel reads as "go and sell your kit at Brok's". His greeting promises to
// show you what to sharpen; the option now reads your equipped weapon and armour and says so, in his
// voice, tier-aware. And the gear shop is the "Blacksmith Forge" whoever opens it, as the bench is.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/forge_header_yun_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11353';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const shown = (id) => `(() => { const e = document.getElementById(${JSON.stringify(id)}); return !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none'); })()`;
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openCraftingModal === 'function', null, { timeout: 180000 });
  // ---- header
  const h = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; loadMap('everdawn_megamall', 300); await new Promise((x) => setTimeout(x, 1800)); game.paused = false;
    openCraftingModal(); await new Promise((x) => setTimeout(x, 400));
    const txt = (document.getElementById('craft-source-line') || {}).textContent || '';
    const lv = monsterTypes.gravitos.level | 0, first = Math.min(10000, lv * lv), next = Math.round(first * LX_REFIGHT_SHARD_MUL);
    try { closeAllModals(); } catch (e) {}
    return { txt, lv, first, next, dis: CRAFT_DISASSEMBLE_REWARD };
  });
  check(h.lv === 100 && h.first === 10000, 'Gravitos is Lv 100, so his first drop is 10,000', J({ lv: h.lv, first: h.first }));
  check(h.txt.includes(h.first.toLocaleString() + '◈') && h.txt.includes(h.next.toLocaleString() + '◈'), 'the header quotes that drop and the refight figure from the data', J(h.txt).slice(0, 170));
  check(!/\+6 shards/.test(h.txt) && h.txt.includes('+' + h.dis + ' Setshards'), 'no more "+6 shards per kill"; the disassembly figure reads the constant too');

  // ---- Yun
  const y = await page.evaluate(async () => {
    try { closeAllModals(); } catch (e) {}
    loadMap('emeraldVillage', 300); await new Promise((x) => setTimeout(x, 1800)); game.paused = false;
    const yun = (game.npcs || []).find((n) => n && n.role === 'sentinel');
    if (!yun) return { no: 'no sentinel on emeraldVillage' };
    const run = async (weapon, armor) => {
      player.equipped = player.equipped || {};
      player.equipped.weapon = weapon; player.equipped.armor = armor;
      try { closeAllModals(); } catch (e) {}
      openNPC(yun); await new Promise((x) => setTimeout(x, 500));
      const b = [...document.querySelectorAll('#dialog-options button')].find((x) => /^Inspect my gear$/.test((x.textContent || '').trim()));
      if (!b) return { no: 'option' };
      b.click();
      let last = -1; for (let k = 0; k < 40; k++) { await new Promise((x) => setTimeout(x, 150)); const len = (document.getElementById('dialog-text').textContent || '').length; if (len === last && k > 2) break; last = len; }
      const shop = document.getElementById('shop-modal');
      return { said: (document.getElementById('dialog-text').textContent || '').replace(/\s+/g, ' ').trim(),
        shopOpen: !!(shop && shop.getClientRects().length && getComputedStyle(shop).display !== 'none'),
        dialogOpen: !!(document.getElementById('dialog').getClientRects().length && getComputedStyle(document.getElementById('dialog')).display !== 'none') };
    };
    const low = await run({ name: 'Whittled Stick', tier: 1, stars: 0 }, { name: 'Threadbare Rags', tier: 1, stars: 0 });
    const mid = await run({ name: 'Jade Spear', tier: 5, stars: 3 }, { name: 'Lamellar', tier: 5, stars: 0 });
    const gap = await run({ name: 'Doomforged Greatsword', tier: 8, stars: 0 }, { name: 'Threadbare Rags', tier: 1, stars: 0 });
    const top = await run({ name: 'Voidcaller Staff', tier: 10, stars: 5 }, { name: 'Voidcaller Robe', tier: 10, stars: 0 });
    try { closeAllModals(); } catch (e) {}
    return { low, mid, gap, top };
  });
  if (y.no) check(false, 'Yun: ' + y.no); else {
    check(!y.low.shopOpen && y.low.dialogOpen, '"Inspect my gear" no longer opens the shop - the conversation stays open', J({ shop: y.low.shopOpen, dialog: y.low.dialogOpen }));
    check(/Whittled Stick .* tier 1/.test(y.low.said) && /will not do for the border/.test(y.low.said), 'he reads a tier-1 stick for what it is', y.low.said.slice(0, 120));
    check(/Jade Spear .* tier 5, \+3/.test(y.mid.said) && /Honest steel/.test(y.mid.said) && /Lamellar will hold/.test(y.mid.said), 'a tier-5 +3 spear and matching plate get his approval', y.mid.said.slice(0, 140));
    check(/Better than mine/.test(y.gap.said) && /tier 1 under a tier-8 edge/.test(y.gap.said), 'a tier-8 blade over tier-1 rags: he flags the gap first', y.gap.said.slice(0, 160));
    check(/no advice for that blade/.test(y.top.said), 'tier 10 leaves him with nothing to teach', y.top.said.slice(0, 100));
    check(!/Brok/.test(y.low.said + y.mid.said + y.gap.said + y.top.said), "none of it names another smith's shop");
  }
  // ---- the gear shop's title, from any opener
  const t = await page.evaluate(async () => {
    try { closeAllModals(); } catch (e) {}
    openShop('weapon'); await new Promise((x) => setTimeout(x, 400));
    const title = (document.getElementById('shop-title') || {}).textContent || '';
    try { closeAllModals(); } catch (e) {}
    return title;
  });
  check(/^Blacksmith Forge/.test(t) && !/Brok/.test(t), 'the gear shop is the Blacksmith Forge, not one smith\'s', J(t));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
