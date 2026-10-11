// RELEASE 9b stays fixed:
//   A the Compendium hides its Zodiac tab and labels until the Twelve are known   B the Titles panel says ??? for the three Twelve titles
//   C pad Start (index 9) cannot be remapped away from Pause / Close   D the shackle card names the live movement keys when rebound
//   E pad B / Start send the Escape key-up too   F the title ring reaches the links + Terms, and the pad's K hints say Start > Hotkeys
//   node scripts/release9b_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11983), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const PAD = () => {
  try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
  window.__pad = { id: 'probe-pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__padOn = false; navigator.getGamepads = () => (window.__padOn ? [window.__pad, null, null, null] : [null, null, null, null]);
  window.__btn = (i, v) => { window.__pad.buttons[i] = { pressed: !!v, touched: !!v, value: v ? 1 : 0 }; window.__pad.timestamp = performance.now(); };
};
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(PAD);
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const el = document.getElementById('lo-auth'); return !!(el && el.classList.contains('shown') && el.offsetParent) && typeof loadMap === 'function'; }, null, { timeout: 180000 });
  await page.waitForTimeout(1500);   // the menu's entrance
  // ---- F1: the title ring, walked with the D-pad
  const F1 = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__padOn = true; window.dispatchEvent(new Event('gamepadconnected'));
    const ids = [];
    const press = async (b) => { window.__btn(b, 1); await wait(110); window.__btn(b, 0); await wait(110); const f = document.querySelector('.pad-focus'); ids.push(f ? (f.id || f.className || f.tagName) : null); return f; };
    let walked = false;
    for (let i = 0; i < 24; i++) {
      const f = await press(13);   // down hops by rows; the row of links is walked once with left, then right back
      if (!walked && f && f.classList.contains('lo-link')) { walked = true; for (let j = 0; j < 3; j++) await press(14); for (let j = 0; j < 3; j++) await press(15); }
    }
    window.__padOn = false;
    return { ids: [...new Set(ids)] };
  });
  ok('F. the title ring reaches the social links and Terms & License', ['lo-support', 'lo-discord', 'lo-instagram', 'lo-website', 'lo-terms'].every((id) => F1.ids.includes(id)), F1.ids);
  const R = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
    applyClass('warrior'); player.level = 30; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._gravitosCineSeen = true;
    loadMap('forest', 300); await wait(1500); try { closeAllModals(); } catch (e) {} game.paused = false;
    game.bestiary = game.bestiary || {}; delete game.bestiary.aetherion; if (game.achievements) delete game.achievements.aetherionDown;
    out.known0 = _lxTwelveKnown();
    // A - the Compendium
    const dex = () => { const z = document.querySelector('#mojidex-modal .mjx-tab[data-f="zodiac"]'); const txt = (document.getElementById('mjx-list') || {}).textContent || '';
      return { tab: !!(z && z.getClientRects().length && getComputedStyle(z).display !== 'none'), zodiacLabels: (txt.match(/ZODIAC/g) || []).length }; };
    openMojidex(); await wait(300); out.a0 = dex(); _mjxSetFilter('zodiac'); await wait(100); out.a0.filter = _MJX.filter; out.a0.rows = document.querySelectorAll('#mjx-list .mjx-row').length; try { closeAllModals(); } catch (e) {}
    game.bestiary.aetherion = 1; out.known1 = _lxTwelveKnown();
    openMojidex(); await wait(300); out.a1 = dex(); _mjxSetFilter('zodiac'); await wait(100); out.a1.filter = _MJX.filter; _mjxSetFilter('all'); try { closeAllModals(); } catch (e) {}
    // B - Titles
    const TW = ['Twelvefold', 'Zodiac Cracked', 'Constellation-Slayer'];
    const tt = () => { const m = document.getElementById('titles-modal'); const txt = m ? m.textContent : ''; return { named: TW.filter((t) => txt.includes(t)), q: [...document.querySelectorAll('#titles-modal .tt-row.locked .tt-name')].filter((e) => e.textContent === '???').length, other: txt.includes('Echo Walker') }; };
    delete game.bestiary.aetherion; game.paused = false;
    openTitlesPanel(); await wait(200); out.b0 = tt(); try { closeAllModals(); } catch (e) {}
    game.bestiary.aetherion = 1; openTitlesPanel(); await wait(200); out.b1 = tt(); try { closeAllModals(); } catch (e) {}
    delete game.bestiary.aetherion; game.paused = false;
    // C - Start stays Start
    try { localStorage.setItem('lx_pad_map_v1', JSON.stringify({ 9: { a: 'jump' }, 2: { a: 'jump' } })); } catch (e) {}
    _lxPadOv = null;
    out.c = { eff9: _lxPadMapEff(9), eff9s: _lxPadMapEff('9'), eff2: _lxPadMapEff(2) };
    if (!document.getElementById('kbm-tab-pad')) { try { toggleKeybindModal(); } catch (e) {} await wait(250); }
    _kbPadPick = null; _kbRenderPad();
    const host = document.getElementById('kbm-tab-pad');
    out.c.rows = host ? host.querySelectorAll('.kbm-pad-row').length : -1; out.c.row9 = !!(host && host.querySelector('.kbm-pad-row[data-padbtn="9"]'));
    try { closeAllModals(); } catch (e) {} game.paused = false;
    try { localStorage.removeItem('lx_pad_map_v1'); } catch (e) {} _lxPadOv = null;
    // D - the shackle line
    _lxNoteInput('kb'); const god = player._god; player._god = false; player.invulnerable = 1e12;
    const qte = async () => { player.stunTimer = 0; _qteShackleStart({ type: 'slime', x: player.x, y: player.y }); await wait(120);
      const t = ((document.querySelector('#lx-qte .lxq-sub') || {}).textContent) || ''; try { _qteEnd(true); } catch (e) {} try { _qteHide(0); } catch (e) {} player.stunTimer = 0; await wait(300); return t; };
    out.d = { dflt: await qte() };
    _lxBindStore('moveLeft', 'j'); try { applyKeybinds(); } catch (e) {}
    out.d.fnKey = _lxFnKey('moveLeft'); out.d.moved = await qte();
    _lxBindStore('moveLeft', 'arrowleft'); try { applyKeybinds(); } catch (e) {}
    out.d.back = await qte(); player._god = god;
    // E - B in a surface with no controls sends the key-up too
    const ups = []; const onUp = (e) => { if (e.key === 'Escape') ups.push(1); }; document.addEventListener('keyup', onUp, true);
    const root = document.createElement('div'); root.style.cssText = 'position:fixed;left:0;top:0;width:50px;height:50px;'; document.body.appendChild(root);
    const fake = { id: 'fake', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    game.paused = true; _lxPadNavPrev = {};
    _lxPadMenuNav(root, fake); fake.buttons[1] = { pressed: true, touched: true, value: 1 }; _lxPadMenuNav(root, fake);
    await wait(100); out.e = { keyups: ups.length, held: !!game.keys.escape };
    document.removeEventListener('keyup', onUp, true); root.remove(); _lxPadNavPrev = {}; try { closeAllModals(); } catch (e) {} game.keys.escape = false; game.paused = false;
    // F2 - pad mode: the strip and the hint say the pad's way to the K panel
    const kb = () => ({ hint: [...document.querySelectorAll('#hotkey-hint kbd')].map((k) => k.textContent), strip: [...document.querySelectorAll('#controls kbd')].map((k) => k.textContent) });
    _lxNoteInput('pad'); _lxRefreshPrompts(); out.f2pad = kb();
    _lxNoteInput('kb'); _lxRefreshPrompts(); out.f2kb = kb();
    return out;
  });
  ok('A. fresh save: the Twelve are not known yet (precondition)', R.known0 === false && R.known1 === true, { k0: R.known0, k1: R.known1 });
  ok('A. the Compendium hides its Zodiac tab and every ZODIAC label, and refuses the zodiac filter, before Aetherion falls', !R.a0.tab && R.a0.zodiacLabels === 0 && R.a0.filter === 'all' && R.a0.rows > 0, R.a0);
  ok('A. ...and shows them once she has fallen', R.a1.tab && R.a1.zodiacLabels >= 12 && R.a1.filter === 'zodiac', R.a1);
  ok('B. Titles: the three Twelve titles are ??? (no name) before Aetherion falls; other titles still named', R.b0.named.length === 0 && R.b0.q >= 3 && R.b0.other, R.b0);
  ok('B. ...and named once she has fallen', R.b1.named.length === 3, R.b1);
  ok('C. a stored override on Start (9) is ignored; other buttons still remap', R.c.eff9 && R.c.eff9.k === 'escape' && R.c.eff9s && R.c.eff9s.k === 'escape' && R.c.eff2 && R.c.eff2.a === 'jump', R.c);
  ok('C. the Controller tab does not offer Start as a remappable row', R.c.rows === 15 && !R.c.row9, R.c);
  ok('D. the shackle line says arrow keys on the defaults', /arrow keys/.test(R.d.dflt) && /arrow keys/.test(R.d.back), R.d);
  ok('D. ...and names the live movement keys when moved off the arrows', R.d.fnKey === 'j' && !/arrow keys/.test(R.d.moved) && /movement keys/.test(R.d.moved) && /\bJ\b/.test(R.d.moved), R.d);
  ok('E. pad B in a surface with no controls sends Escape up as well as down', R.e.keyups >= 1 && !R.e.held, R.e);
  ok('F. pad mode: #hotkey-hint and #controls name Start > Hotkeys, not K', !R.f2pad.hint.includes('K') && !R.f2pad.strip.includes('K') && R.f2pad.hint.some((t) => /Start/.test(t)) && R.f2pad.strip.some((t) => /Start/.test(t)), R.f2pad);
  ok('F. ...keyboard mode keeps K', R.f2kb.hint.includes('K') && R.f2kb.strip.includes('K'), R.f2kb);
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
