// ZODIAC SIGILS TRADE IN ONE SHOT (v0.30.960).
//
// A sigil is currency - one price, no other use anywhere in the game - and the trade consumed ONE per
// confirm, so a player holding twelve clicked Trade and Yes twelve times for twelve identical toasts
// (per user: "trading the constell shards is 1 by 1 and not all in 1 shot"). Now one confirm names the
// count and the total, and one Yes clears the lot.
//
// What this pins beyond "it trades them all": the accounting is exact (n x 200), a cancelled confirm
// leaves every sigil in the bag, a single sigil still reads as a single sigil, and - because the removal
// is an in-place splice over the live inventory - the non-sigil items around them are untouched and
// the array is still the same object the panel holds.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/sigil_trade_all_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11351';
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
// seed n sigils (the drop site's exact shape) around a non-sigil item, stub the confirm, run the trade once
const trade = (n, answer) => page.evaluate(async ({ n, answer }) => {
  const signs = (typeof ZODIAC_SIGNS !== 'undefined' ? ZODIAC_SIGNS : [{ id: 'aries', glyph: '♈' }]);
  player.inventory = player.inventory || [];
  for (let k = player.inventory.length - 1; k >= 0; k--) if (player.inventory[k] && player.inventory[k].zodiacSigil) player.inventory.splice(k, 1);
  const invRef = player.inventory;
  const keeper = { name: 'Whittled Stick', type: 'weapon', slot: 'weapon', stars: 0 };
  player.inventory.push(keeper);
  for (let k = 0; k < n; k++) { const s = signs[k % signs.length]; player.inventory.push({ name: (s.id || 'aries') + ' Sigil', icon: s.glyph || '✨', type: 'etc', zodiacSigil: s.id || 'aries', rarity: 'epic', desc: 'test' }); }
  player.inventory.push({ name: 'HP Potion (S)', type: 'consumable', id: 'hp_s' });
  const shards0 = player.setshards | 0;
  const confirms = []; const realConfirm = window.uiConfirm;
  window.uiConfirm = async (o) => { confirms.push({ title: o.title, body: o.body, yes: o.yesLabel, no: o.noLabel }); return answer; };
  window.__toasts = []; const f = window.showToast; if (f && !f.__w) { window.showToast = function (m) { try { window.__toasts.push(String(m).slice(0, 100)); } catch (e) {} return f.apply(this, arguments); }; window.showToast.__w = true; } else { window.__toasts = []; }
  await _lxTradeZodiacSigil();
  await new Promise((r) => setTimeout(r, 200));
  window.uiConfirm = realConfirm;
  return { confirms, toasts: window.__toasts.slice(), shardsGained: (player.setshards | 0) - shards0,
    sigilsLeft: player.inventory.filter((x) => x && x.zodiacSigil).length,
    keeperStill: player.inventory.includes(keeper), potionStill: player.inventory.some((x) => x && x.id === 'hp_s'),
    sameArray: player.inventory === invRef };
}, { n, answer });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxTradeZodiacSigil === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40; loadMap('everdawn_megamall', 300); await new Promise((r) => setTimeout(r, 2000)); game.paused = false;
  });
  for (let i = 0; i < 14; i++) { const c = await page.evaluate(() => (document.body.className.match(/cinematic|sb-active/g) || []).join('+')); if (!c) break; await page.keyboard.press('Space'); await page.waitForTimeout(400); }
  const per = await page.evaluate(() => SIGIL_TRADE_SHARDS);

  let r = await trade(12, true);
  check(r.confirms.length === 1, 'twelve sigils: ONE confirm, not twelve', r.confirms.length + ' shown');
  check(r.sigilsLeft === 0, 'and one Yes clears the lot', r.sigilsLeft + ' left');
  check(r.shardsGained === 12 * per, 'paid exactly 12 x ' + per, '+' + r.shardsGained);
  check(/all 12/.test(r.confirms[0]?.body || '') && (r.confirms[0]?.body || '').includes((12 * per).toLocaleString()), 'the confirm names the count and the total', J(r.confirms[0]?.body).slice(0, 120));
  check(r.toasts.length === 1 && /12 Zodiac Sigils/.test(r.toasts[0]), 'one toast, with the count', J(r.toasts));
  check(r.keeperStill && r.potionStill && r.sameArray, 'the items around them are untouched and the inventory is still the same array', J({ keeper: r.keeperStill, potion: r.potionStill, sameArray: r.sameArray }));

  r = await trade(3, false);
  check(r.sigilsLeft === 3 && r.shardsGained === 0 && r.toasts.length === 0, 'Keep them: nothing moves', J({ left: r.sigilsLeft, gained: r.shardsGained }));

  r = await trade(1, true);
  check(r.sigilsLeft === 0 && r.shardsGained === per && /your Zodiac Sigil/.test(r.confirms[0]?.body || '') && r.confirms[0]?.yes === 'Trade (+' + per + '◈)',
    'a single sigil still reads as one', J({ body: (r.confirms[0]?.body || '').slice(0, 50), yes: r.confirms[0]?.yes }));

  // the button on Brok's craft menu says what it does
  const label = await page.evaluate(async () => {
    for (let k = 0; k < 5; k++) player.inventory.push({ name: 'aries Sigil', type: 'etc', zodiacSigil: 'aries', rarity: 'epic' });
    const brok = (game.npcs || []).find((x) => x && x.role === 'weapon');
    if (!brok) return 'no smith here';
    game._brokMenu = 'craft'; openNPC(brok); await new Promise((r) => setTimeout(r, 500));
    const b = [...document.querySelectorAll('#dialog-options button')].map((x) => (x.textContent || '').trim()).find((t) => /Sigil/.test(t));
    try { closeAllModals(); } catch (e) {}
    return b || 'no sigil button';
  });
  check(/^Trade all Zodiac Sigils/.test(label) && /5 held/.test(label) && label.includes((5 * per).toLocaleString()), "Brok's button reads 'Trade all' with the count and the total", J(label));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
