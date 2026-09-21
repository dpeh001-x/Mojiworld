// FELINA TAKES A TYPED AMOUNT (v0.30.956).
//
// The two fixed buttons (1,000 / 10,000) are useful for the first hour and useless after it: a player
// with 20M in the wallet would be clicking "Deposit 10,000" two thousand times. The bank now has an
// amount field that accepts plain digits, thousands separators, k/m/b shorthand and "all"/"max".
//
// What this pins, beyond "it moves coins": the accounting must be exact in BOTH directions, every
// refusal must leave the balance untouched (a bank that eats a bad input is worse than one that
// refuses it), and "all" must mean all - the number a player types at this scale is never one they
// want rounded. Typing is checked too: the game's keydown handler returns early on INPUT targets, so
// a W or a Z typed into the field must not walk the hero or swing a sword.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/bank_typed_amount_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11348';
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
// open the banker and act on the amount field the way a player does
const openBank = () => page.evaluate(async () => {
  try { closeAllModals(); } catch (e) {}
  const f = (game.npcs || []).find((n) => n && n.role === 'banker');
  if (!f) return 'no banker on this map';
  openNPC(f); await new Promise((r) => setTimeout(r, 500));
  return !!document.getElementById('bank-amt');
});
const act = (value, which) => page.evaluate(async ({ value, which }) => {
  const inp = document.getElementById('bank-amt'); if (!inp) return { no: 'field' };
  inp.value = value;
  const btn = [...document.querySelectorAll('#dialog-options button')].find((b) => (b.textContent || '').trim() === which);
  if (!btn) return { no: which + ' button' };
  btn.click(); await new Promise((r) => setTimeout(r, 200));
  return { wallet: Math.floor(player.mojicoins || 0), bal: Math.floor(player.bankBalance),
    said: (document.getElementById('dialog-text').textContent || '').replace(/\s+/g, ' ').trim().slice(0, 110),
    cleared: inp.value === '' };
}, { value, which });
const setPurse = (wallet, bal) => page.evaluate(({ wallet, bal }) => {
  player.mojicoins = wallet; player.bankBalance = bal;
  return { wallet: Math.floor(player.mojicoins), bal: Math.floor(player.bankBalance) };
}, { wallet, bal });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40;
    // Felina banks in the Everdawn Megamall, not the town square - a probe that loads 'town'
    // finds no banker and reports the feature missing.
    loadMap('everdawn_megamall', 300); await new Promise((r) => setTimeout(r, 2200)); game.paused = false;
  });
  for (let i = 0; i < 14; i++) { const c = await page.evaluate(() => (document.body.className.match(/cinematic|sb-active/g) || []).join('+')); if (!c) break; await page.keyboard.press('Space'); await page.waitForTimeout(400); }
  check(await openBank() === true, 'the bank offers an amount field');
  await setPurse(20000000, 140000);

  let r = await act('25000', 'Deposit');
  check(r.wallet === 19975000 && r.bal === 165000, 'a plain number deposits exactly that much', J({ wallet: r.wallet, bal: r.bal }));
  check(r.cleared === true, 'and the field clears so the next amount starts fresh');
  r = await act('2.5m', 'Deposit');
  check(r.wallet === 17475000 && r.bal === 2665000, 'shorthand works: 2.5m is 2,500,000', J({ wallet: r.wallet, bal: r.bal }));
  r = await act('1,000,000', 'Withdraw');
  check(r.wallet === 18475000 && r.bal === 1665000, 'thousands separators are read, and withdrawal is exact', J({ wallet: r.wallet, bal: r.bal }));
  r = await act('all', 'Withdraw');
  check(r.wallet === 20140000 && r.bal === 0, '"all" empties the account to the coin', J({ wallet: r.wallet, bal: r.bal }));
  r = await act('all', 'Deposit');
  check(r.wallet === 0 && r.bal === 20140000, 'and banks the whole wallet the other way', J({ wallet: r.wallet, bal: r.bal }));

  // every refusal must leave the money exactly where it was
  await setPurse(5000, 7000);
  const before = { wallet: 5000, bal: 7000 };
  const refusals = [];
  for (const [v, w, why] of [['', 'Deposit', 'empty'], ['abc', 'Deposit', 'not a number'], ['-5', 'Deposit', 'negative'],
    ['0', 'Deposit', 'zero'], ['9999', 'Deposit', 'more than the wallet holds'], ['9999', 'Withdraw', 'more than the account holds']]) {
    const g = await act(v, w);
    if (g.wallet !== before.wallet || g.bal !== before.bal) refusals.push(why + ' -> ' + J({ wallet: g.wallet, bal: g.bal }));
    if (!g.said) refusals.push(why + ' -> said nothing');
  }
  check(refusals.length === 0, 'six bad inputs are refused with the money untouched', refusals.length ? J(refusals) : 'wallet 5,000 / balance 7,000 throughout');

  // the field must not be a keyboard trap for the game underneath
  const typed = await page.evaluate(async () => {
    const inp = document.getElementById('bank-amt'); inp.focus(); inp.value = '';
    window.__x0 = player.x;
    return { x0: window.__x0, focused: document.activeElement === inp };
  });
  await page.keyboard.type('1234');
  await page.keyboard.press('KeyW'); await page.keyboard.press('KeyZ');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ val: (document.getElementById('bank-amt') || {}).value,
    moved: Math.abs(player.x - window.__x0) > 2, attacking: !!player.attacking }));
  check(typed.focused === true, 'the amount field takes focus');
  check(String(after.val).startsWith('1234'), 'and typed digits land in it', J(after.val));
  check(after.attacking === false, 'a Z typed into the field does not swing the sword', 'attacking ' + after.attacking);

  // Enter is the obvious shortcut for the common case
  await setPurse(1000, 0);
  await page.evaluate(() => { const i = document.getElementById('bank-amt'); i.value = '250'; i.focus(); });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const ent = await page.evaluate(() => ({ wallet: Math.floor(player.mojicoins), bal: Math.floor(player.bankBalance) }));
  check(ent.wallet === 750 && ent.bal === 250, 'Enter deposits without reaching for the mouse', J(ent));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
