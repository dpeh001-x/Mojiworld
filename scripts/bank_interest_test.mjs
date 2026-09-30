// Mojibank interest on the play clock (v0.30.380): 0.1% of the whole balance per
// hour of game time, paid on the hour, compounding; nothing while paused, closed
// or in the expedition tower; the clock is saved; small balances round to nothing.
// v0.30.1467 (per user: "ensure that felina interest rates work"): what she TELLS you about it holds too - each payment is tallied,
// she reads the tally out once as "since your last visit" (it could never show: the play clock pays each hour as it passes)
// and it is saved; the tower riddle asks the true rate (it wanted the old 50,000 cap); her rules quote death's real 10 %.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9919); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof player === 'object' && player, null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(() => {
    const out = { ver: typeof GAME_VERSION === 'string' ? GAME_VERSION : '?', has: typeof _lxBankAccrue === 'function' && typeof _lxBankInterestLine === 'function' };
    if (!out.has) return out;
    player.bankBalance = 1000000; player.bankAccrueMs = 0;
    out.p1 = _lxBankAccrue(3600000); out.b1 = player.bankBalance; out.a1 = player.bankAccrueMs;
    _lxBankAccrue(1800000); out.mid = player.bankBalance; _lxBankAccrue(1800000); out.b2 = player.bankBalance;
    out.p3 = _lxBankAccrue(3600000 * 3); out.b3 = player.bankBalance;
    player.bankBalance = 0; player.bankAccrueMs = 500000; _lxBankAccrue(1000); out.a0 = player.bankAccrueMs;
    player.bankBalance = 500; player.bankAccrueMs = 0; out.p5 = _lxBankAccrue(3600000); out.b5 = player.bankBalance;
    player.bankBalance = 1000000; player.bankAccrueMs = 3000000; out.line = _lxBankInterestLine();
    game.expedition = game.expedition || {}; const was = game.expedition.active; game.expedition.active = true; player.bankAccrueMs = 0; _lxBankAccrue(3600000); out.bExp = player.bankBalance; out.aExp = player.bankAccrueMs; game.expedition.active = was;
    return out;
  });
  // the save: saveState is debounced and gated on a chosen class + no prologue, so flush it and look for the key
  const sv = await page.evaluate(async () => {
    try { window._prologueActive = false; window._prologuePending = false; window._lxAwaitingCreation = false; } catch (e) {}
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) player.cls = 'warrior';
    player.bankBalance = 1000000; player.bankAccrueMs = 123456; player.bankInterestSince = 777;
    try { if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow(); else saveState(); } catch (e) { return { err: String(e && e.message) }; }
    await new Promise((r) => setTimeout(r, 1500));
    for (let i = 0; i < localStorage.length; i++) { const v = localStorage.getItem(localStorage.key(i)); const m = v && v.match(/"bankAccrueMs":([0-9.]+)/); if (m) { const m2 = v.match(/"bankInterestSince":([0-9.]+)/); return { key: localStorage.key(i), val: +m[1], since: m2 ? +m2[1] : null }; } }
    return { none: true };
  });
  r.saved = !!(sv && sv.val >= 123456 && sv.val < 123456 + 60000); r.saveErr = JSON.stringify(sv);
  r.savedSince = !!(sv && sv.since === 777);
  console.log('build ' + r.ver);
  ok('_lxBankAccrue + _lxBankInterestLine exist', r.has);
  if (r.has) {
    ok('one hour on 1,000,000 pays 1,000 and clears the clock', r.p1 === 1000 && r.b1 === 1001000 && r.a1 === 0, r.p1 + ' ' + r.b1 + ' ' + r.a1);
    ok('two half-hours pay once, compounded (1,002,001)', r.mid === 1001000 && r.b2 === 1002001, r.mid + ' ' + r.b2);
    ok('three hours in one call pay three times, compounding', r.p3 === 3009 && r.b3 === 1005010, r.p3 + ' ' + r.b3);
    ok('an empty vault resets the clock', r.a0 === 0, String(r.a0));
    ok('under 1,000 on deposit rounds to nothing', r.p5 === 0 && r.b5 === 500, r.p5 + ' ' + r.b5);
    ok('Felina names the next payment and the minutes left', /1,000 mojicoins in 10 min/i.test(r.line), r.line);
    ok('the expedition tower does not count', r.bExp === 1000000 && r.aExp === 0, r.bExp + ' ' + r.aExp);
    ok('the clock is saved with the player', r.saved === true, r.saveErr || '');
    ok('so is the interest paid since your last visit to Felina', r.savedSince === true, r.saveErr || '');
    // the live loop: the clock runs with the simulation and stops when paused
    await page.evaluate(() => { try { _lxBootGateDone = true; } catch (e) {} try { _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } player.bankBalance = 1000000; player.bankAccrueMs = 0; game.paused = false; });
    const s0 = await page.evaluate(() => ({ t: game.time, a: player.bankAccrueMs }));
    await page.waitForTimeout(1500);
    const s1 = await page.evaluate(() => ({ t: game.time, a: player.bankAccrueMs }));
    if (s1.t > s0.t) { const exp = (s1.t - s0.t) * 1000 / 60; ok('the clock advances one sim step per frame while running', s1.a - s0.a > exp * 0.8 && s1.a - s0.a < exp * 1.2, (s1.a - s0.a) + ' ms over ' + (s1.t - s0.t) + ' frames'); }
    else console.log('SKIP live loop (simulation idle in the harness)');
    await page.evaluate(() => { game.paused = true; });
    const s2 = await page.evaluate(() => ({ t: game.time, a: player.bankAccrueMs }));
    await page.waitForTimeout(800);
    const s3 = await page.evaluate(() => ({ t: game.time, a: player.bankAccrueMs }));
    ok('paused: the clock stands still', s3.a === s2.a, s2.a + ' -> ' + s3.a + ' (frames ' + (s3.t - s2.t) + ')');
    await page.evaluate(() => { game.paused = false; });
  }
  // what she tells you: the tally since your last visit, read out once at her counter in the Megamall
  const fz = await page.evaluate(async () => {
    const out = { tally: null, felina: false };
    player.bankBalance = 1000000; player.bankAccrueMs = 0; player.bankInterestSince = 0;
    _lxBankAccrue(3600000); out.tally = player.bankInterestSince;
    try { closeAllModals(); } catch (e) {}
    loadMap('everdawn_megamall', 300); await new Promise((r) => setTimeout(r, 2000)); game.paused = false;
    const f = (game.npcs || []).find((x) => x && x.role === 'banker'); out.felina = !!f;
    const read = async () => { try { closeAllModals(); } catch (e) {} openNPC(f); let t = ''; for (let i = 0; i < 80; i++) { await new Promise((r) => setTimeout(r, 100)); const el = document.getElementById('dialog-text'); t = el ? el.textContent : ''; if (t.indexOf('Current balance') >= 0) break; } return t; };   // her greeting types itself out: wait for the line after it
    if (f) { out.first = await read(); out.after = player.bankInterestSince; out.second = await read(); }
    try { closeAllModals(); } catch (e) {}
    const P = (typeof EXPEDITION_PUZZLES !== 'undefined') ? EXPEDITION_PUZZLES : [];
    const q = P.find((p) => /Mojibank/.test(p.q)); out.riddle = q ? { q: q.q, right: q.opts[q.a] } : null;
    out.capRiddle = P.some((p) => /cap interest/i.test(p.q)); out.rate = LX_BANK_RATE_PER_HOUR;
    return out;
  });
  ok('every payment is tallied for her "since your last visit"', fz.tally === 1000, String(fz.tally));
  ok('Felina reads out what the account earned since your last visit, once', fz.felina && /earned 1,000 Mojicoins since your last visit/.test(fz.first || '') && fz.after === 0 && !/since your last visit/.test(fz.second || ''),
    JSON.stringify({ felina: fz.felina, first: (fz.first || '').slice(0, 170), after: fz.after, second: (fz.second || '').slice(0, 90) }));
  ok('the tower riddle asks the true rate: 0.1% an hour of play, and nothing asks for a cap', !!fz.riddle && fz.riddle.right === '0.1% an hour of play' && fz.rate === 0.001 && !fz.capRiddle, JSON.stringify(fz.riddle));
  const src = await page.evaluate(async () => { const t = await (await fetch(location.pathname)).text(); return { old: t.indexOf('earns 1.5 % each day') >= 0, neu: t.indexOf('every hour of play') >= 0,
    death10: t.indexOf('s 10 % and the unlearning fee') >= 0 && t.indexOf('s 35 % and the unlearning fee') < 0, charge10: t.indexOf('Math.floor(_netWorth * 0.10)') >= 0 }; });
  ok('Felina no longer promises 1.5 % a day of wall-clock', !src.old && src.neu, JSON.stringify(src));
  ok('her rules quote the death charge the game makes (10 % of net worth, not 35 %)', src.death10 && src.charge10, JSON.stringify(src));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
