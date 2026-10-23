// RELEASE17 PART B - PHONE TAPS (the v0.30.1746 phone hunt, touch only). Real taps on Android-class phones (isMobile, hasTouch,
// DPR 3) at 844x390 and 932x430, a 1180x820 tablet, and a 1280x720 desktop that must not change.
//   1. a tap on a bag tile's corner (where the hover-only trash button sat) equips the piece - no "Discard item?"; no trash on touch;
//      a desktop still shows it on hover
//   2. every hunted control has a hit area of at least 36 x 36 screen px (measured by hit-testing), and no two share a point
//   3. notch insets (47 px left / right, before boot and after it): settings / Multi / tracker / combo out of the insets, the stats
//      plate clear of Block, Reset clear of the hide-controls X
//   4. the combo meter does not cover the quest tracker
//   5. the title's Terms & License link can be reached and tapped on a short phone
//   6. touch words: story Skip button (a real tap ends the scene), tour (MOJIDEX, tap), LV UP dial, Items line, Skills block line,
//      taxi brief, co-op chat help, the Ability Point toast, dash coach, prologue hint; desktop keeps its words; the sell desk names
//      the smith who opened it
//   7. the universal close X is not under the fullscreen button
//   8. pinch-to-zoom on the world map
//   node scripts/release17b_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15061), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const SHOTS = process.env.R17B_SHOTS || '';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 4000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const errs = [];
async function ctxFor(w, h, phone, insets) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: UA } : {}) });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(w + 'x' + h + ': ' + String(e.message).slice(0, 160)));
  page._cdp = await ctx.newCDPSession(page);
  if (insets) await page._cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: insets, right: insets, bottom: 0 } });
  return { ctx, page };
}
async function title(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
}
async function world(page) {
  await title(page);
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._tutorialSeen = true; window._lxAutoPause = () => {}; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sleep(3000); player.level = 30; loadMap('forest', 300); await sleep(3500);
    for (const el of document.querySelectorAll('[id$="-cine"], #story-beat-overlay, #void-intro-overlay, #kill-film-overlay')) { el.classList.remove('on', 'show'); el.style.display = 'none'; }
    game.paused = false; try { closeAllModals(); } catch (e) {} await sleep(600);
    // hit extent through the centre, screen px; and a helper to close everything between surfaces
    window.__hit = (el) => {
      const b = el.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const own = (x, y) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false; const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); };
      if (!own(cx, cy)) { const t = document.elementFromPoint(cx, cy); return { w: 0, h: 0, cx, cy, by: t ? (t.id || String(t.className).slice(0, 30)) : '-' }; }
      let l = 0, r = 0, u = 0, d = 0;
      while (l < 60 && own(cx - l - 1, cy)) l++; while (r < 60 && own(cx + r + 1, cy)) r++; while (u < 60 && own(cx, cy - u - 1)) u++; while (d < 60 && own(cx, cy + d + 1)) d++;
      return { w: l + r + 1, h: u + d + 1, cx, cy, L: cx - l, R: cx + r, T: cy - u, B: cy + d };
    };
    window.__close = () => { try { closeAllModals(); } catch (e) {} for (const id of ['worldmap-modal', 'shop-modal', 'taxi-modal', 'class-select-modal', 'tutorial-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } game.paused = false; try { closeAllModals(); } catch (e) {} };
  });
}
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return null; const b = e.getBoundingClientRect(); return b.width ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; }, sel);
const over = (a, b) => !!(a && b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5);
const shot = async (page, name) => { if (SHOTS) try { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } catch (e) {} };
// the hunted controls: [surface, opener, [selector, count]...]
const SURF = [
  ['hud', null, [['#mp-btn', 1], ['#reset-front-btn', 1]]],
  ['lvup', 'openLevelUpPanel()', [['#attributes-modal .inv-tab[data-utab]', 5], ['#u-jump-row .u-jump', 6]]],
  ['skills', "openLevelUpPanel(); document.querySelector('[data-utab=\"skills\"]').click()", [['button.skl-add', 3], ['button.skl-expand', 3]]],
  ['items', "openLevelUpPanel(); document.querySelector('[data-utab=\"items\"]').click()", [['label:has(> #u-inv-autoequip)', 1]]],
  ['potion', "player.mojicoins = 99999; openShop('potion')", [['#shop-modal button.pot-step', 12], ['#shop-modal button[id^="pot-buy-"]', 2]]],
  ['tour', 'startTutorial()', [['#tut-next', 1], ['#tut-skip', 1], ['#tut-collapse', 1], ['#tut-details-btn', 1]]],
  ['creator', "document.getElementById('class-select-modal').style.display = 'flex'; openClassSelect()", [['#class-select-modal .cs-nav-next', 1], ['#class-select-modal .cs-dd-trigger', 3], ['#class-select-modal .cs-randomize-btn', 1]]],
  ['worldmap', 'toggleWorldMap()', [['#worldmap-zoom', 1]]],
];
async function measure(page, open, targets) {
  await page.evaluate(() => window.__close()); await page.waitForTimeout(300);
  if (open) await page.evaluate(open); await page.waitForTimeout(1000);
  return page.evaluate((targets) => {
    const out = [], share = [];
    for (const [sel, n] of targets) { let k = 0;
      for (const el of document.querySelectorAll(sel)) { if (k >= n) break; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) continue;
        if (el.closest('.modal, #shop-list, #class-select-modal')) el.scrollIntoView({ block: 'center', inline: 'nearest' });
        const b = el.getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight) continue; k++;
        const m = window.__hit(el); out.push({ sel, ...m });
        // no point of this control's hit area may be another hunted control's centre (live positions, after this scroll)
        if (m.w) for (const [s2] of targets) for (const o of document.querySelectorAll(s2)) { if (o === el || !o.getClientRects().length) continue; const c = o.getBoundingClientRect(); const ox = c.left + c.width / 2, oy = c.top + c.height / 2;
          if (m.L <= ox && ox <= m.R && m.T <= oy && oy <= m.B) { const t = document.elementFromPoint(ox, oy); if (t && t !== o && !o.contains(t) && (t === el || el.contains(t))) share.push(sel + ' over ' + s2); } } } }
    return { out, share };
  }, targets);
}
for (const [W, H] of [[844, 390], [932, 430]]) {
  const tag = `${W}x${H}`;
  const { ctx, page } = await ctxFor(W, H, true, 0);
  await world(page);
  // 1. the bag tile's corner equips
  await page.evaluate(async () => {
    const c = 'weapons', base = (ITEM_POOL[c] || []).find((b) => !b.cls || b.cls === 'warrior' || (Array.isArray(b.cls) && b.cls.includes('warrior')));
    const it = devMakeGear(base.name); it._r17b = 1; player.inventory.unshift(it); game._invTab = 'equip';
    openLevelUpPanel(); document.querySelector('[data-utab="items"]').click(); await new Promise((r) => setTimeout(r, 700));
  });
  const T1 = await page.evaluate(() => { const it = player.inventory.find((i) => i && i._r17b); const idx = player.inventory.indexOf(it);
    const tile = document.querySelector('#u-inv-grid .inv-slot[data-invidx="' + idx + '"]'); if (!tile) return null; tile.scrollIntoView({ block: 'center' });
    const b = tile.getBoundingClientRect(), tr = tile.querySelector('.inv-trash'); return { x: b.right - 7, y: b.top + 7, w: b.width, trash: tr ? getComputedStyle(tr).display : 'gone' }; });
  if (T1) await page.touchscreen.tap(T1.x, T1.y); await page.waitForTimeout(700);
  const T1b = await page.evaluate(() => { const m = document.getElementById('confirm-modal'), t = document.getElementById('confirm-title');
    const open = !!(m && getComputedStyle(m).display !== 'none' && m.getClientRects().length); const eq = Object.values(player.equipped || {}).some((i) => i && i._r17b);
    if (open) try { document.getElementById('confirm-no').click(); } catch (e) {} return { discard: open && /Discard/.test(t ? t.textContent : ''), equipped: eq }; });
  ok(`1a. ${tag}: a tap on the bag tile's top-right corner equips the piece (no "Discard item?")`, !!T1 && !T1b.discard && T1b.equipped, { T1, T1b });
  ok(`1b. ${tag}: no trash button on a touch screen`, !!T1 && T1.trash === 'none', T1 && T1.trash);
  // 2. tap targets
  for (const [name, open, targets] of SURF) {
    const M = await measure(page, open, targets);
    const small = M.out.filter((m) => !(m.w >= 36 && m.h >= 36)).map((m) => m.sel + ' ' + m.w + 'x' + m.h + (m.by ? ' under ' + m.by : ''));
    const want = targets.reduce((a, t) => a + Math.min(t[1], 1), 0);
    ok(`2. ${tag} ${name}: every control's hit area is at least 36x36 screen px`, M.out.length >= want && small.length === 0, small.length ? small : M.out.map((m) => m.w + 'x' + m.h).join(' '));
    ok(`2. ${tag} ${name}: no control's hit area covers another's centre`, M.share.length === 0, M.share);
    if (name === 'potion' || name === 'lvup') await shot(page, `${name}_${tag}_after`);
  }
  // 3/4/7 the HUD at inset 0: Multi's hit area clear of the corner pair, CHAT and the tracker; Reset apart from the X; combo off the tracker
  await page.evaluate(async () => { window.__close(); const q = Object.keys(QUESTS).filter((id) => QUESTS[id].kind === 'kill' && (QUESTS[id].levelReq | 0) <= 12).slice(0, 2);
    for (const id of q) try { acceptQuest(id, true); } catch (e) {} try { renderQuestTracker(); } catch (e) {}
    const cm = document.getElementById('combo-meter'); cm.style.opacity = '1'; await new Promise((r) => setTimeout(r, 600)); });
  const H3 = await page.evaluate(() => { const r = (s) => { const e = typeof s === 'string' ? document.querySelector(s) : s; if (!e || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    const mp = window.__hit(document.getElementById('mp-btn')), rs = window.__hit(document.getElementById('reset-front-btn')); const menus = [...document.querySelectorAll('.mc-pots .mc-menu')];
    return { mp: { l: mp.L, r: mp.R, t: mp.T, b: mp.B, w: mp.w, h: mp.h }, rs: { l: rs.L, r: rs.R, t: rs.T, b: rs.B }, set: r('#settings-btn'), fs: r('#fullscreen-btn'), chat: r(menus[menus.length - 1]), tr: r('#quest-tracker'), cm: r('#combo-meter'), tog: r('#mobile-ctrl-toggle') }; });
  ok(`3. ${tag}: Multi's hit area clears settings, fullscreen, CHAT and the tracker`, H3.mp.w >= 36 && !over(H3.mp, H3.set) && !over(H3.mp, H3.fs) && !over(H3.mp, H3.chat) && !over(H3.mp, H3.tr), H3);
  ok(`3. ${tag}: Reset's hit area is apart from the hide-controls X (>= 8 px)`, !!H3.tog && H3.rs.l - H3.tog.r >= 8 && !over(H3.rs, H3.tog), { rs: H3.rs, tog: H3.tog });
  ok(`4. ${tag}: the combo meter does not cover the quest tracker`, !!H3.cm && !!H3.tr && !over(H3.cm, H3.tr), { cm: H3.cm, tr: H3.tr });
  await shot(page, `hud_${tag}_after`);
  await page.evaluate(() => { window.__close(); openLevelUpPanel(); }); await page.waitForTimeout(700);
  const X7 = await page.evaluate(() => { const x = document.getElementById('mc-modal-close'); const b = x.getBoundingClientRect(); const cy = b.top + b.height / 2;
    const at = (px) => { const t = document.elementFromPoint(px, cy); return t ? (t.closest('#mc-modal-close') ? 'X' : t.closest('#fullscreen-btn') ? 'FS' : t.closest('#settings-btn') ? 'SET' : 'other') : '-'; };
    let near = []; for (let x = b.left - 12; x < b.left; x += 2) for (let y = b.top + 2; y <= b.top + 22; y += 4) { const w = at(x); const t = document.elementFromPoint(x, y); const k = t ? (t.closest('#fullscreen-btn') ? 'FS' : t.closest('#settings-btn') ? 'SET' : '') : ''; if (k) near.push(k + '@' + Math.round(x) + ',' + Math.round(y)); }
    return { left: at(b.left + 3), centre: at(b.left + b.width / 2), near: near.slice(0, 6), fsVis: getComputedStyle(document.getElementById('fullscreen-btn')).visibility }; });
  ok(`7. ${tag}: the close X's left edge is the X, and no tap within 12 px left of it reaches fullscreen / settings`, X7.left === 'X' && X7.centre === 'X' && X7.near.length === 0, X7);
  // 6. touch words
  const W6 = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const o = {};
    window.__close(); openLevelUpPanel(); await sleep(500); o.dial = (document.querySelector('.lp-dial-hint') || {}).textContent;
    document.querySelector('[data-utab="items"]').click(); await sleep(400); game._invTab = 'equip'; try { renderInventory('u-'); } catch (e) {} o.items = (document.getElementById('u-inv-tab-info') || {}).textContent;
    document.querySelector('[data-utab="skills"]').click(); await sleep(500); o.block = [...document.querySelectorAll('#attributes-modal div')].map((d) => d.textContent).find((t) => /to block ·/.test(t) && t.length < 80) || '';
    window.__close(); await sleep(200); try { openTaxi(); } catch (e) {} await sleep(400); o.taxi = ((document.getElementById('taxi-brief') || {}).textContent || '').slice(0, 30);
    window.__close(); await sleep(200); try { openMultiplayer(); } catch (e) {} await sleep(400); o.help = /tap CHAT to type/.test(document.body.innerText) && !/press Enter to type/.test(document.body.innerText);
    window.__close(); o.tour = _tutTouchify('<kbd>Y</kbd> then click the tab');
    const seen = []; const st = window.showToast; window.showToast = function (m) { seen.push(String(m)); return st.apply(this, arguments); };
    player.skillPoints = (player.skillPoints | 0) + 2; await sleep(1300); window.showToast = st; o.toast = seen.find((t) => /^\+\d+ SP\b/.test(t)) || seen.join('|');
    const src = await (await fetch(location.href.split('?')[0])).text(); o.plg = src.includes("'<kbd>TAP</kbd> to continue'"); o.dash = src.includes("'double-tap ◀ or ▶'");
    return o; });
  ok(`6a. ${tag}: LV UP dial says tap`, /^tap to invest/.test(W6.dial || ''), W6.dial);
  ok(`6b. ${tag}: the Items line says Tap an item`, /Tap an item/.test(W6.items || ''), W6.items);
  ok(`6c. ${tag}: the Skills block line names the BLOCK button`, /Tap BLOCK to block/.test(W6.block), W6.block);
  ok(`6d. ${tag}: the taxi brief says Tap a node`, /^Tap a node/.test(W6.taxi), W6.taxi);
  ok(`6e. ${tag}: co-op chat help names CHAT, not Enter`, W6.help === true, W6.help);
  ok(`6f. ${tag}: the tour names MOJIDEX and taps`, /MOJIDEX/.test(W6.tour) && /tap the tab/.test(W6.tour), W6.tour);
  ok(`6g. ${tag}: the SP toast names LV UP (no book button)`, /tap LV UP to spend/.test(W6.toast), W6.toast);
  ok(`6h. ${tag}: prologue hint and dash coach have touch words`, W6.plg && W6.dash, { plg: W6.plg, dash: W6.dash });
  await page.evaluate(() => { window.__close(); window.__beatDone = 0; player._storyBeatsSeen = {}; document.getElementById('story-beat-overlay').style.display = ''; _playStoryBeat('tutorial_intro', () => { window.__beatDone = 1; }); }); await page.waitForTimeout(1200);
  const S6 = await page.evaluate(() => { const b = document.getElementById('story-beat-skip'), h = document.getElementById('story-beat-hint'); const r = b && b.getClientRects().length && getComputedStyle(b).display !== 'none' ? b.getBoundingClientRect() : null;
    return { hint: h ? h.textContent : '', skip: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null }; });
  if (S6.skip) await page.touchscreen.tap(S6.skip.x, S6.skip.y); await page.waitForTimeout(1500);
  const S6b = await page.evaluate(() => ({ done: window.__beatDone, on: document.getElementById('story-beat-overlay').classList.contains('on') }));
  ok(`6i. ${tag}: the story card says tap and its Skip button (a real tap) ends the scene`, /tap to continue/.test(S6.hint) && !!S6.skip && S6.skip.h >= 36 && S6b.done === 1 && !S6b.on, { S6, S6b });
  // 6j. the sell desk names the smith who opened it (Barnaby runs the Megamall's)
  const S7 = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); window.__close(); player.inventory = [];
    const npc = ((MAPS.everdawn_megamall || {}).npcs || []).find((n) => n.name === 'Barnaby'); if (!npc) return 'no Barnaby';
    game._brokMenu = 'shop'; openNPC(npc); await sleep(400);
    const b = [...document.querySelectorAll('#dialog-options button, #dialog-options div')].find((e) => /Sell Items/.test(e.textContent) && e.children.length < 3); if (!b) return 'no option'; b.click(); await sleep(500);
    return ((document.getElementById('shop-modal') || {}).textContent || '').match(/[A-Z][a-z]+ pays 10%/) + ''; });
  ok(`6j. ${tag}: Barnaby's sell desk says Barnaby pays`, /^Barnaby pays 10%/.test(S7), S7);
  // 8. pinch-to-zoom on the world map
  await page.evaluate(() => { window.__close(); toggleWorldMap(); }); await page.waitForTimeout(1200);
  const P0 = await page.evaluate(() => { const s = document.querySelector('#worldmap-modal svg'); const r = s.getBoundingClientRect(); return { w: s.viewBox.baseVal.width, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
  const tp = (pts) => pts.map(([x, y], i) => ({ x, y, id: i, radiusX: 4, radiusY: 4, force: 1 }));
  await page._cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[P0.cx - 30, P0.cy], [P0.cx + 30, P0.cy]]) });
  for (let k = 1; k <= 6; k++) { await page._cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[P0.cx - 30 - k * 12, P0.cy], [P0.cx + 30 + k * 12, P0.cy]]) }); await page.waitForTimeout(30); }
  await page._cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(300);
  const P1 = await page.evaluate(() => document.querySelector('#worldmap-modal svg').viewBox.baseVal.width);
  ok(`8. ${tag}: a pinch zooms the world map in`, P1 < P0.w * 0.7, { before: Math.round(P0.w), after: Math.round(P1) });
  await ctx.close();
}
// 3. notch insets (47 px a side): before boot and arriving after it
for (const late of [false, true]) {
  const tag = late ? 'insets after boot' : 'insets at boot';
  const { ctx, page } = await ctxFor(844, 390, true, late ? 0 : 47);
  await world(page);
  if (late) { await page._cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, right: 47, bottom: 0 } }); await page.waitForTimeout(1500); }
  await page.evaluate(async () => { const q = Object.keys(QUESTS).filter((id) => QUESTS[id].kind === 'kill' && (QUESTS[id].levelReq | 0) <= 12).slice(0, 2);
    for (const id of q) try { acceptQuest(id, true); } catch (e) {} try { renderQuestTracker(); } catch (e) {} document.getElementById('combo-meter').style.opacity = '1'; await new Promise((r) => setTimeout(r, 600)); });
  const I = {}; for (const [k, s] of [['set', '#settings-btn'], ['fs', '#fullscreen-btn'], ['mp', '#mp-btn'], ['tr', '#quest-tracker'], ['cm', '#combo-meter'], ['stats', '#top-ui'], ['blk', '#mobile-deck .mc-block'], ['rs', '#reset-front-btn'], ['tog', '#mobile-ctrl-toggle']]) I[k] = await rect(page, s);
  const out = ['set', 'fs', 'mp', 'tr', 'cm'].filter((k) => I[k] && I[k].r > 844 - 47 + 0.5);
  ok(`3a. ${tag}: settings, fullscreen, Multi, tracker and combo stay out of the right inset`, out.length === 0 && !!I.set && !!I.mp, out.length ? out.map((k) => k + ' ' + Math.round(I[k].r)) : 'ok');
  ok(`3b. ${tag}: the stats plate clears Block, and Reset clears the hide-controls X`, !!I.stats && !!I.blk && !over(I.stats, I.blk) && !over(I.rs, I.tog), { stats: I.stats, blk: I.blk, rs: I.rs, tog: I.tog });
  ok(`3c. ${tag}: the combo meter does not cover the tracker`, !over(I.cm, I.tr), { cm: I.cm, tr: I.tr });
  await shot(page, `insets_${late ? 'late' : 'boot'}_after`);
  await ctx.close();
}
// 5. the title's Terms & License link on a short phone
for (const [W, H] of [[844, 390], [932, 430]]) {
  const { ctx, page } = await ctxFor(W, H, true, 0);
  await title(page);
  const T5 = await page.evaluate(async () => { const st = document.querySelector('#loading-overlay .lo-stack'); for (let i = 0; i < 4; i++) { if (st) st.scrollTop = st.scrollHeight; await new Promise((r) => setTimeout(r, 350)); }
    const a = document.getElementById('lo-terms'); const b = a.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), hit: t === a, x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  if (T5.hit) await page.touchscreen.tap(T5.x, T5.y); await page.waitForTimeout(500);
  const open5 = await page.evaluate(() => { const bg = document.getElementById('legal-modal-bg'); return !!(bg && bg.classList.contains('on')); });
  ok(`5. ${W}x${H}: Terms & License is on screen with the menu scrolled, and a tap opens it`, T5.bottom <= H && T5.hit && open5, { ...T5, open5 });
  await ctx.close();
}
// the tablet (1180x820, touch): the same pass reaches it
{
  const { ctx, page } = await ctxFor(1180, 820, true, 0);
  await world(page);
  for (const [name, open, targets] of SURF.filter((s) => ['lvup', 'skills', 'potion', 'tour'].includes(s[0]))) {
    const M = await measure(page, open, targets);
    const small = M.out.filter((m) => !(m.w >= 36 && m.h >= 36)).map((m) => m.sel + ' ' + m.w + 'x' + m.h);
    ok(`2t. 1180x820 tablet ${name}: hit areas at least 36x36, none covering another`, M.out.length > 0 && small.length === 0 && M.share.length === 0, small.concat(M.share));
  }
  await ctx.close();
}
// the desktop (1280x720, mouse) is unchanged: hover trash, packed rows, mouse words, Esc
{
  const { ctx, page } = await ctxFor(1280, 720, false, 0);
  await world(page);
  const D = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const o = {};
    const base = (ITEM_POOL.weapons || []).find((b) => !b.cls || b.cls === 'warrior'); const it = devMakeGear(base.name); player.inventory.unshift(it); game._invTab = 'equip';
    openLevelUpPanel(); await sleep(500); o.dial = (document.querySelector('.lp-dial-hint') || {}).textContent; o.tabMinH = getComputedStyle(document.querySelector('#attributes-modal .inv-tab[data-utab]')).minHeight;
    document.querySelector('[data-utab="items"]').click(); await sleep(500); o.items = (document.getElementById('u-inv-tab-info') || {}).textContent;
    const tile = document.querySelector('#u-inv-grid .inv-slot[data-invidx="0"]'); const b = tile.getBoundingClientRect(); o.tile = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    document.querySelector('[data-utab="skills"]').click(); await sleep(500); const sa = document.querySelector('button.skl-add'); o.addAfter = sa ? getComputedStyle(sa, '::after').content : 'none';
    window.__close(); openShop('potion'); await sleep(500); const ps = document.querySelector('#shop-modal button.pot-step'); o.stepMinH = getComputedStyle(ps).minHeight;
    window.__close(); try { openTaxi(); } catch (e) {} await sleep(300); o.taxi = ((document.getElementById('taxi-brief') || {}).textContent || '').slice(0, 20);
    window.__close(); o.tour = _tutTouchify('<kbd>Y</kbd> then click the tab'); await sleep(300);
    const fs = document.getElementById('fullscreen-btn'), se = document.getElementById('settings-btn'); o.fsVis = getComputedStyle(fs).visibility + '/' + getComputedStyle(se).visibility; o.tray = (fs.parentElement || {}).id + '/' + (se.parentElement || {}).id; return o; });
  await page.evaluate(() => { window.__close(); openLevelUpPanel(); document.querySelector('[data-utab="items"]').click(); }); await page.waitForTimeout(600);
  const tb = await page.evaluate(() => { const t = document.querySelector('#u-inv-grid .inv-slot[data-invidx="0"]'); const b = t.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.move(tb.x, tb.y); await page.waitForTimeout(400);
  const trash = await page.evaluate(() => { const t = document.querySelector('#u-inv-grid .inv-slot[data-invidx="0"] .inv-trash'); return t ? { d: getComputedStyle(t).display, o: getComputedStyle(t).opacity } : null; });
  ok('D1. desktop: the bag tile still shows its trash button on hover', !!trash && trash.d !== 'none' && +trash.o > 0.9, trash);
  ok('D2. desktop: no touch sizes (U tab height, stepper min-height, skill + hit area)', (D.tabMinH === '0px' || D.tabMinH === 'auto') && (D.stepMinH === '0px' || D.stepMinH === 'auto') && D.addAfter === 'none', { tabMinH: D.tabMinH, stepMinH: D.stepMinH, addAfter: D.addAfter });
  ok('D3. desktop: mouse words stay (click to invest, Click an item, Click a node, keyboard tour)', /^click to invest/.test(D.dial) && /Click an item/.test(D.items) && /^Click a node/.test(D.taxi) && /<kbd>Y<\/kbd>/.test(D.tour) && /click the tab/.test(D.tour), D);
  ok('D4. desktop: settings and fullscreen stay in the corner tray, visible', D.fsVis === 'visible/visible' && D.tray === 'lx-corner/lx-corner', { vis: D.fsVis, tray: D.tray });
  await page.evaluate(() => { window.__close(); player._storyBeatsSeen = {}; document.getElementById('story-beat-overlay').style.display = ''; _playStoryBeat('tutorial_intro', () => {}); }); await page.waitForTimeout(1000);
  const SD = await page.evaluate(() => { const b = document.getElementById('story-beat-skip'); return { hint: (document.getElementById('story-beat-hint') || {}).textContent, skip: !!(b && getComputedStyle(b).display !== 'none' && b.getClientRects().length) }; });
  ok('D5. desktop: the story card keeps "Esc to skip" and shows no Skip button', /Esc to skip/.test(SD.hint) && !SD.skip, SD);
  await ctx.close();
}
ok('no page errors', errs.length === 0, errs);
await browser.close(); server.kill();
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
