// Ascension is locked for players (per user: "Do not make ascension/ reincarnation available for now, block it for now, but
// keep the feature locked"). One page, the real game:
//   1. the switch (LX_ASCENSION_LOCKED) is on
//   2. at the cap Guguma's chip still shows, as a locked pill; opened, her card says so - no heirloom pick, no Ascend
//   3. levelling 99 -> 100 for real: Guguma raises the locked card herself, and "Got it" folds it back to the pill
//   4. offerPrestige refuses: no confirm, level / prestige / bag untouched, a toast says it is locked
//   5. the pause menu keeps its Ascend row, marked locked; pressing it resets nothing
//   6. a hero who already ascended keeps every bonus (crit, max HP, the Edict their ascension opened); the next Edict names
//      the lock beside the ascension it waits for
//   7. Relics & Legends says it is locked where it describes the prestige
//   8. the feature is whole: with the lock open, Guguma's real offer (heirloom + Ascend) and its confirm come back
//   9. no page errors
//   node scripts/ascension_locked_test.mjs      PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11861), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 320) + ']' : '')); };
const LOCK = String.fromCodePoint(0x1F512);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof offerPrestige === 'function' && typeof _gugumaAscendChip === 'function' && typeof _lxPauseOpen === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    game.paused = false; window._god = true; player.invulnerable = 1e9; loadMap('town');
    window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // what the page says and what it asks: every toast, and every confirm (answered "Not yet")
    window.__toasts = []; const st = showToast; window.showToast = function (t) { window.__toasts.push(String(t)); return st.apply(this, arguments); };
    window.__confirms = 0; window.uiConfirm = function (o) { window.__confirms++; window.__lastConfirm = o && o.title; return Promise.resolve(false); };
  });
  // ---- 1 ----
  ok('1. the switch is on: LX_ASCENSION_LOCKED is true', (await page.evaluate(() => LX_ASCENSION_LOCKED)) === true);
  // ---- 2 ----
  const c2 = await page.evaluate(async () => {
    player.level = PRESTIGE_LEVEL; game.prestige = { count: 0, xpMult: 1, dmgMult: 1, bonusAP: 0 }; game._prestigeOffered = false;
    _gugumaAscendChip(false); _gugumaAscendPrompt(true); await __sleep(300);
    const el = document.getElementById('guguma-ascend'), pill = el && el.querySelector('#guguma-ascend-pill');
    const out = { chip: !!el, pill: !!pill, text: pill ? pill.textContent : '', go: !!document.getElementById('guguma-ascend-go'), heir: !!document.getElementById('guguma-heirloom') };
    if (pill) pill.click(); await __sleep(250);
    const card = document.getElementById('guguma-ascend');
    out.open = { text: card ? card.textContent.slice(0, 200) : '', gotIt: !!document.getElementById('guguma-ascend-later'), go: !!document.getElementById('guguma-ascend-go'), heir: !!document.getElementById('guguma-heirloom') };
    return out; });
  ok('2. at the cap Guguma\'s chip still shows - as a locked pill, with no Ascend on it', c2.chip && c2.pill && c2.text.includes(LOCK) && /locked/i.test(c2.text) && !c2.go && !c2.heir, c2);
  ok('2. opened, her card says ascension is locked for now - no heirloom pick, no Ascend button', /locked for now/i.test(c2.open.text) && c2.open.gotIt && !c2.open.go && !c2.open.heir, c2.open);
  // ---- 3 ----
  const c3 = await page.evaluate(async () => {
    _gugumaAscendChip(false); game._prestigeOffered = false; player.level = PRESTIGE_LEVEL - 1; player.exp = player.expToNext;
    _maybeLevelUp(); const lvl = player.level; await __sleep(1600);   // Guguma speaks 900 ms after the level-up
    try { if (typeof closeLevelUpPanel === 'function') closeLevelUpPanel(); } catch (e) {}
    const card = document.getElementById('guguma-ascend'), text = card ? card.textContent : '';
    const out = { lvl, raised: /locked for now/i.test(text), go: !!document.getElementById('guguma-ascend-go') };
    const got = document.getElementById('guguma-ascend-later'); if (got) got.click(); await __sleep(250);
    const pill = document.getElementById('guguma-ascend-pill'); out.folded = !!pill && pill.textContent.includes(String.fromCodePoint(0x1F512));
    return out; });
  ok('3. levelling 99 -> 100: Guguma raises the locked card herself, and Got it folds it back to the locked pill', c3.lvl === 100 && c3.raised && !c3.go && c3.folded, c3);
  // ---- 4 ----
  const c4 = await page.evaluate(async () => {
    window.__confirms = 0; window.__toasts = []; game._prestigeOffered = false;
    const before = { lvl: player.level, pc: JSON.stringify(game.prestige), bag: JSON.stringify(player.inventory || []), cls: player.cls };
    offerPrestige(true); offerPrestige(false); await __sleep(400);
    return { confirms: window.__confirms, toasts: window.__toasts.slice(0, 3), same: player.level === before.lvl && JSON.stringify(game.prestige) === before.pc && JSON.stringify(player.inventory || []) === before.bag && player.cls === before.cls }; });
  ok('4. offerPrestige refuses: no confirm opens, level / prestige / bag untouched, and a toast says ascension is locked', c4.confirms === 0 && c4.same && c4.toasts.some((t) => /locked/i.test(t)), c4);
  // ---- 5 ----
  const c5 = await page.evaluate(async () => {
    window.__confirms = 0; window.__toasts = []; game._prestigeOffered = false;
    _lxPauseOpen(); await __sleep(200);
    const row = document.querySelector('#lx-pause [data-a="ascend"]'), txt = row ? row.textContent : '';
    if (row) row.click(); await __sleep(400);
    try { if (document.getElementById('lx-pause')) _lxPauseClose(); } catch (e) {}
    return { row: !!row, txt, confirms: window.__confirms, lvl: player.level, toasts: window.__toasts.slice(0, 3) }; });
  ok('5. the pause menu keeps its Ascend row, marked locked; pressing it resets nothing', c5.row && c5.txt.includes(LOCK) && /locked/i.test(c5.txt) && c5.confirms === 0 && c5.lvl === 100 && c5.toasts.some((t) => /locked/i.test(t)), c5);
  // ---- 6 ----
  const c6 = await page.evaluate(async () => {
    game.prestige = { count: 0, xpMult: 1, dmgMult: 1, bonusAP: 0, critBonus: 0, hpBonus: 0 }; const crit0 = getCrit(), hp0 = getMaxHp();
    game.prestige = { count: 1, xpMult: 1.3, dmgMult: 1.3, bonusAP: 1, critBonus: 1, hpBonus: 12 }; const crit1 = getCrit(), hp1 = getMaxHp();
    const e1 = EDICTS.find((e) => e.asc === 1), e2 = EDICTS.find((e) => e.asc === 2);
    openEdictsPanel(); await __sleep(250);
    const row2 = e2 && document.querySelector('.edict-row[data-id="' + e2.id + '"]'), title2 = row2 ? row2.getAttribute('title') : '';
    window.__toasts = []; if (row2) row2.click(); await __sleep(150);
    try { closeAllModals(); } catch (e) {}
    return { crit: [crit0, crit1], hp: [hp0, hp1], e1: e1 && { id: e1.id, locked: _edictLocked(e1) }, e2: e2 && { id: e2.id, locked: _edictLocked(e2), title2 }, toasts: window.__toasts.slice(0, 2) }; });
  ok('6. a hero who already ascended keeps every bonus: more crit, more max HP, and the Edict ascension 1 opened', c6.crit[1] > c6.crit[0] && c6.hp[1] > c6.hp[0] && c6.e1 && c6.e1.locked === false, c6);
  ok('6. the next Ascendant Edict still says what it waits for - and that ascension is locked for now', !!c6.e2 && c6.e2.locked && /locked for now/.test(c6.e2.title2) && c6.toasts.some((t) => /locked for now/.test(t)), c6);
  // ---- 7 ----
  const c7 = await page.evaluate(() => { let body = document.getElementById('lore-body'), made = false;
    if (!body) { body = document.createElement('div'); body.id = 'lore-body'; document.body.appendChild(body); made = true; }
    _renderLoreTab('relics'); const t = body.textContent; if (made) body.remove();
    return { prestige: /The Prestige/.test(t), locked: /Locked for now/.test(t), lock: t.includes(String.fromCodePoint(0x1F512)) }; });
  ok('7. Relics & Legends says the prestige is locked for now, where it describes it', c7.prestige && c7.locked && c7.lock, c7);
  // ---- 8 ----
  const c8 = await page.evaluate(async () => {
    LX_ASCENSION_LOCKED = false; window.__confirms = 0;
    player.level = PRESTIGE_LEVEL; game.prestige = { count: 0, xpMult: 1, dmgMult: 1, bonusAP: 0 }; game._prestigeOffered = false;
    _gugumaAscendChip(false); _gugumaAscendPrompt(false); await __sleep(300);
    const go = document.getElementById('guguma-ascend-go'), out = { go: !!go, heir: !!document.getElementById('guguma-heirloom') };
    if (go) go.click(); await __sleep(300);   // the confirm is answered "Not yet": nothing resets
    Object.assign(out, { confirms: window.__confirms, title: window.__lastConfirm || '', lvl: player.level });
    LX_ASCENSION_LOCKED = true; _gugumaAscendChip(false);
    return out; });
  ok('8. the feature is whole: with the lock open, Guguma\'s real offer (heirloom + Ascend) and its confirm come back', c8.go && c8.heir && c8.confirms === 1 && /ASCEND/.test(c8.title) && c8.lvl === 100, c8);
  ok('9. no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log((fail ? 'FAIL(' + fail + ')' : 'PASS(0)') + ' - ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
