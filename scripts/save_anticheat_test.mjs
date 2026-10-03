// SAVE ANTI-CHEAT (per user: "Ensure that there are anticheat measures the prevent the save file from being edited or
// corrupted"). v0.30.414 signed the save, but an edited save still LOADED its edited progress and lost only its money, a stripped
// signature passed as a "legacy" save once the marker was gone, and an edited file could be imported "anyway". One page:
//   1. a flush stores a verified copy of every signed field (with that save's signature) in the marker, and it verifies;
//   2. an EDITED save (level, Setshards, an extra item) is rolled back to the verified copy: level, money and items as last
//      saved, the save verifies again, and the player is told;
//   3. a STRIPPED signature (with the same edits) is rolled back the same way;
//   4. a stripped modern save whose marker was deleted too is not loaded at all: kept in Save Backups as "edited, not verified";
//   5. a legacy save (older than signing: no signature, no marker, no _cdCarry) is NOT loaded any more (bughunt D2 closed the
//      allowance: it could not be told from an edited save): kept in Save Backups as "edited, not verified";
//   6. a CORRUPTED signed field (one value flipped) is repaired from the copy; unreadable JSON is kept as "could not load";
//   7. import: an edited .mojisave and an unsigned .json are REFUSED with a one-button notice, nothing stored, no reload; the
//      game's own .mojisave and a plain .json of a signed save are offered for import; an older secure export (outer signature
//      good, inner save older than signing) imports in full;
//   8. no page errors.
// The build before fails 1-4 and 7.   node scripts/save_anticheat_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11799), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadState === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; player._tutorialSeen = true; player.setshards = 1234; player.mojicoins = 55555; player.bankBalance = 777;
    window.saveState = () => {};   // only the explicit flushes below write
    const notes = []; window._lxSaveNotice = (msg) => { notes.push(String(msg)); };   // what the title menu would show
    _flushSaveStateNow();
    const KEY = SAVE_KEY, MK = SAVE_KEY + '_verified', raw = localStorage.getItem(KEY), base = JSON.parse(raw), mark0 = localStorage.getItem(MK);
    const nInv = (base.player.inventory || []).length;
    const reset = () => { localStorage.setItem(KEY, raw); localStorage.setItem(MK, mark0); };
    const load = (obj, opt) => { if (obj) localStorage.setItem(KEY, typeof obj === 'string' ? obj : JSON.stringify(obj)); if (opt === 'nomark') localStorage.removeItem(MK);
      player.level = 1; player.setshards = -1; player.mojicoins = -1; player.inventory = []; game._saveVerdict = null; let r; try { r = loadState(); } catch (e) { r = 'threw ' + e.message; }
      return { loaded: r, lv: player.level, shards: player.setshards, coins: player.mojicoins, bank: player.bankBalance, inv: (player.inventory || []).length, verdict: game._saveVerdict }; };
    // 1. the verified copy
    const m = JSON.parse(mark0);
    out.copy = { has: typeof m.p === 'string' && typeof m.g === 'string' && typeof m.sig === 'string' && m.sig === base.sig && m.v === base.v,
      verifies: _lxSigEqual(_lxHmacSaveHex('ls3\n' + m.v + '\n' + m.t + '\n' + m.p + '\n' + m.g), m.sig), money: [m.setshards, m.mojicoins, m.bankBalance] };
    // 2. edited
    const ed = JSON.parse(raw); ed.player.level = 200; ed.player.setshards = 999999; ed.player.mojicoins = 5e9;
    ed.player.inventory = (ed.player.inventory || []).concat([{ id: 'cheat', name: 'Cheat Blade', tier: 9, slot: 'weapon' }]);
    out.edited = load(ed); out.nInv = nInv; await sleep(2100); out.noteEd = notes.some((n) => /changed outside the game/.test(n));
    reset();
    // 3. stripped
    const st = JSON.parse(JSON.stringify(ed)); delete st.sig; out.stripped = load(st); reset();
    // 4. stripped AND the marker deleted
    const bk0 = (_lxGetBackups() || []).length;
    out.nomark = load(st, 'nomark');
    out.nomarkBk = (_lxGetBackups() || []).slice(0, 1).map((b) => b.label || '').join('');
    out.nomarkBkN = (_lxGetBackups() || []).length - bk0; await sleep(3200); out.noteNomark = notes.some((n) => /could not be verified, so it was not loaded/.test(n));
    reset();
    // 5. a genuine legacy save (older than signing)
    const lg = JSON.parse(raw); delete lg.sig; delete lg.player._cdCarry; lg.player.setshards = 4321;
    const bk5 = (_lxGetBackups() || []).length; out.legacy = load(lg, 'nomark'); out.legacyBkN = (_lxGetBackups() || []).length - bk5; out.legacyBk = ((_lxGetBackups() || [])[0] || {}).label || ''; reset();
    // 6. corruption: one flipped value in a signed field; unreadable JSON
    const fl = JSON.parse(raw); fl.player.level = 61; out.flip = load(fl); reset();
    out.junk = load(raw.slice(0, Math.floor(raw.length / 2))); out.junkBk = ((_lxGetBackups() || [])[0] || {}).label || ''; reset();
    // 7. import
    const mkFile = (text, name) => ({ files: [new File([text], name || 'save.mojisave')], value: '' });
    const dlg = () => { const mm = document.getElementById('confirm-modal'); return { shown: !!mm && getComputedStyle(mm).display !== 'none', title: (document.getElementById('confirm-title') || {}).textContent || '',
      body: (document.getElementById('confirm-body') || {}).textContent || '', noShown: getComputedStyle(document.getElementById('confirm-no')).display !== 'none' }; };
    const tryImport = async (text, name) => { localStorage.setItem(KEY, raw); window.__lxStay = 1; importSave(mkFile(text, name)); await sleep(700);
      const d = dlg(); const stored = localStorage.getItem(KEY) === raw; try { document.getElementById('confirm-no').click(); } catch (e) {} await sleep(150);
      try { if (d.shown && !d.noShown) document.getElementById('confirm-yes').click(); } catch (e) {} await sleep(150); return Object.assign(d, { stored, stay: window.__lxStay === 1 }); };
    out.impEdited = await tryImport(_lxSecureSavePayload(JSON.stringify(ed), Date.now()));
    out.impUnsigned = await tryImport(JSON.stringify(st), 'save.json');
    out.impOwn = await tryImport(_lxSecureSavePayload(raw, Date.now()));
    out.impPlainSigned = await tryImport(raw, 'save.json');
    const old = JSON.parse(raw); delete old.sig; delete old.player._cdCarry;
    out.impOldSecure = await tryImport(_lxSecureSavePayload(JSON.stringify(old), Date.now()));
    return out;
  });
  ok('[1] a flush stores a verified copy of the signed fields (with the save\'s own signature) in the marker', R.copy.has && R.copy.verifies && JSON.stringify(R.copy.money) === '[1234,55555,777]', R.copy);
  ok('[2] an edited save is rolled back: level 60, the money (plus the daily login bonus) and the items as last saved, verdict "restored", and the player is told', R.edited.loaded === true && R.edited.verdict === 'restored' && R.edited.lv === 60 && R.edited.shards === 1234 && R.edited.coins >= 55555 && R.edited.coins < 60000 && R.edited.inv === R.nInv && R.noteEd, Object.assign({ nInv: R.nInv, note: R.noteEd }, R.edited));
  ok('[3] a stripped signature is rolled back the same way', R.stripped.loaded === true && R.stripped.verdict === 'restored' && R.stripped.lv === 60 && R.stripped.shards === 1234 && R.stripped.coins >= 55555 && R.stripped.coins < 60000, R.stripped);
  ok('[4] stripped AND marker deleted: not loaded, kept in Save Backups as "edited, not verified"', R.nomark.loaded === false && /edited, not verified/.test(R.nomarkBk) && R.nomarkBkN >= 1 && R.noteNomark, { r: R.nomark, bk: R.nomarkBk, note: R.noteNomark });
  ok('[5] a legacy save (no signature, no marker, older than signing) is not loaded: kept in Save Backups as "edited, not verified" (bughunt D2)', R.legacy.loaded === false && R.legacyBkN >= 1 && /edited, not verified/.test(R.legacyBk), { r: R.legacy, n: R.legacyBkN, label: R.legacyBk });
  ok('[6] a corrupted signed field is repaired from the copy; unreadable JSON is kept as "could not load"', R.flip.loaded === true && R.flip.verdict === 'restored' && R.flip.lv === 60 && R.junk.loaded === false && /could not load/.test(R.junkBk), { flip: R.flip, junk: R.junk.loaded, bk: R.junkBk });
  const refused = (d) => d.shown && /Save file refused/.test(d.title) && !d.noShown && d.stored && d.stay;
  ok('[7] an edited .mojisave is refused with a one-button notice; nothing stored, no reload', refused(R.impEdited) && /changed after the game wrote it/.test(R.impEdited.body), R.impEdited);
  ok('[7] an unsigned .json is refused too', refused(R.impUnsigned) && /no signature/.test(R.impUnsigned.body), R.impUnsigned);
  ok('[7] the game\'s own .mojisave and a plain .json of a signed save are offered for import (two-button confirm)', R.impOwn.shown && /Import this save/.test(R.impOwn.title) && R.impOwn.noShown && R.impPlainSigned.shown && /Import this save/.test(R.impPlainSigned.title), { own: R.impOwn.title, plain: R.impPlainSigned.title });
  ok('[7] an older secure export (outer signature good, inner older than signing) is offered, with no currency warning', R.impOldSecure.shown && /Import this save/.test(R.impOldSecure.title) && !/reset to 0/.test(R.impOldSecure.body), R.impOldSecure);
  ok('[8] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
