// The Amnesiac's memory wipe erases the character with no undo and no backup. Before v0.30.537
// the "I wish to forget" option called _amnesiacReset() directly: one click and the save was gone.
// This pins the gate that now stands in front of it.
//
// The property that matters: the save survives EVERY path except typing FORGET and clicking
// Erase. Cancel, Escape, the backdrop, a wrong word, an empty box — none of them may wipe.
//
//   node scripts/amnesiac_wipe_gate_test.mjs      MOJI_SERVE_ROOT / PORT override
//
// Negative control: on v0.30.536 the button wipes immediately and there is no gate at all.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11021); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _amnesiacReset === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);

  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(700);
    // A boot leaves #story-beat-overlay up with `mode-epilogue on`, and it is a legitimate pause
    // owner — so the gate's own "unpause unless something else is open" would correctly decline,
    // and an earlier draft read that as the gate failing to unpause. Clear the baseline first.
    for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'game-complete-overlay',
                      'jukebox-modal-bg', 'settings-modal-bg', 'char-studio-overlay']) {
      const el = document.getElementById(id); if (el && el.classList) el.classList.remove('on', 'open');
    }
    game.paused = false;
    const o = {};
    o.hasGate = typeof _amnesiacWipeGate === 'function';
    if (!o.hasGate) return o;

    // Never let a test actually reload the page or clear real storage.
    let wiped = 0;
    const _reload = window.location.reload;
    try { Object.defineProperty(window.location, 'reload', { value: () => {}, configurable: true }); } catch (e) {}
    const fakeReset = () => { wiped++; };

    applyClass('rogue');
    player.name = 'Testwalker'; player.level = 47; player.mojicoins = 12345; player.bankBalance = 500;
    game._playMs = 95 * 60 * 1000;

    const open = async () => { _amnesiacWipeGate(fakeReset); await sleep(160); return document.getElementById('amnesiac-wipe-modal'); };
    const el = (id) => document.getElementById(id);
    const type = (v) => { const i = el('amnesiac-wipe-input'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };

    // --- it opens, names the character, and pauses the world
    let ov = await open();
    o.opened = !!ov;
    o.text = (ov ? ov.textContent : '').replace(/\s+/g, ' ');
    o.namesCharacter = /Testwalker/.test(o.text) && /Lv 47/.test(o.text) && /1h 35m/.test(o.text);
    o.saysNoUndo = /no undo/i.test(o.text);
    o.listsCoins = /12,845/.test(o.text);
    o.pausedWhileOpen = !!game.paused;
    o.isPauseOwner = (typeof _lxPauseOwners === 'function')
      && _lxPauseOwners().some((e) => e && e.id === 'amnesiac-wipe-modal')
      && (typeof _anyOtherModalOpen === 'function') && _anyOtherModalOpen();

    // --- the destructive button starts disabled
    o.startsDisabled = !!el('amnesiac-wipe-go').disabled;
    // --- a wrong word keeps it disabled
    type('forgot'); o.wrongWordDisabled = !!el('amnesiac-wipe-go').disabled;
    type(''); o.emptyDisabled = !!el('amnesiac-wipe-go').disabled;
    // --- clicking it while disabled does nothing
    el('amnesiac-wipe-go').click(); await sleep(80);
    o.wipedWhileDisabled = wiped;
    // --- the right word, any case, enables it
    type('forget'); o.lowercaseEnables = !el('amnesiac-wipe-go').disabled;
    type('  FORGET  '); o.paddedEnables = !el('amnesiac-wipe-go').disabled;

    // --- Cancel does not wipe, and unpauses
    el('amnesiac-wipe-cancel').click(); await sleep(150);
    o.afterCancel = { wiped, stillOpen: !!document.getElementById('amnesiac-wipe-modal'), paused: !!game.paused };

    // --- Escape does not wipe
    ov = await open(); type('FORGET');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await sleep(150);
    o.afterEscape = { wiped, stillOpen: !!document.getElementById('amnesiac-wipe-modal') };

    // --- the backdrop does not wipe
    ov = await open(); type('FORGET');
    ov.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(150);
    o.afterBackdrop = { wiped, stillOpen: !!document.getElementById('amnesiac-wipe-modal') };

    // --- and the deliberate path DOES wipe, exactly once
    ov = await open(); type('FORGET');
    el('amnesiac-wipe-go').click(); await sleep(150);
    o.afterConfirm = { wiped, stillOpen: !!document.getElementById('amnesiac-wipe-modal'), paused: !!game.paused };

    try { Object.defineProperty(window.location, 'reload', { value: _reload, configurable: true }); } catch (e) {}
    return o;
  });

  const src = await (await fetch(`http://localhost:${PORT}/mojiworld_game.html`)).text();
  const routed = /_amnesiacWipeGate\(_amnesiacReset\)/.test(src);
  const noDirect = !/closeDialog\(\); _amnesiacReset\(\); \}/.test(src);

  console.log(JSON.stringify(r, null, 1).slice(0, 1400));
  console.log(`static: buttonRoutedThroughGate=${routed} noDirectCall=${noDirect}\n`);

  ok('the gate exists', r.hasGate === true);
  ok('it opens', r.opened === true);
  ok('it names the character being erased', r.namesCharacter === true, (r.text || '').slice(0, 110));
  ok('it says there is no undo', r.saysNoUndo === true);
  ok('it counts the money being destroyed', r.listsCoins === true);
  ok('it pauses the world', r.pausedWhileOpen === true);
  ok('it is a registered pause owner in BOTH registries', r.isPauseOwner === true);
  ok('Erase starts disabled', r.startsDisabled === true);
  ok('a wrong word keeps it disabled', r.wrongWordDisabled === true && r.emptyDisabled === true);
  ok('clicking it while disabled erases nothing', r.wipedWhileDisabled === 0, 'wipes=' + r.wipedWhileDisabled);
  ok('the word is case- and space-insensitive', r.lowercaseEnables === true && r.paddedEnables === true);
  ok('Cancel erases nothing, closes, and unpauses', r.afterCancel.wiped === 0 && !r.afterCancel.stillOpen && !r.afterCancel.paused, JSON.stringify(r.afterCancel));
  ok('Escape erases nothing even with FORGET typed', r.afterEscape.wiped === 0 && !r.afterEscape.stillOpen, JSON.stringify(r.afterEscape));
  ok('the backdrop erases nothing even with FORGET typed', r.afterBackdrop.wiped === 0 && !r.afterBackdrop.stillOpen, JSON.stringify(r.afterBackdrop));
  ok('typing FORGET and clicking Erase wipes exactly once', r.afterConfirm.wiped === 1 && !r.afterConfirm.stillOpen, JSON.stringify(r.afterConfirm));
  ok('the dialogue option routes through the gate', routed === true && noDirect === true, `routed=${routed} noDirect=${noDirect}`);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
