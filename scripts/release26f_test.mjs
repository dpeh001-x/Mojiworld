// RELEASE 26f (the phone-UI hunter round) stays fixed - touch-only phones (isMobile + hasTouch, taps) at 740x360 and 844x390, and a
// desktop 960x560 that must not change:
//   [1] every panel's cap is ~the window, in game-box px: MAP / QUEST / BAG / LV UP / SKILL / MOJIDEX / the three shop tabs / forge /
//       reforge / craft / taxi / codex open whole (inside the box and the screen), the map spans >= 80% of the screen (it was 59-64%),
//       and every panel's own close button is on screen and owns its centre (not under the universal X)
//   [2] Nurse Joyce's stall is 860 box px with a >= 120 px name cell (one line per name) - forge / sell desk 900; a stall list squeezed
//       under 700 px drops its -10 / +10 steppers and the name keeps its floor
//   [3] with all nine skills on the deck: the quest tracker overlaps no deck button, and "BETTER GEAR LOOTED" overlaps no deck or menu
//       button, the tracker or the stats plate, stays on screen and takes no tap
//   [4] the taxi on touch: a zoom slider grows the nodes >= 3x; a tap 12-20 px off a reachable node (on empty map) picks it; the pick
//       asks "Taxi to X?" with the fare and charges nothing on Stay; Ride charges the fare and travels
//   [5] tap targets: NPC answers >= 35 px tall with >= 7 px gaps, Bravo's Weight chips >= 35 px; the SKILL tab's + buttons >= 23 px with
//       >= 36 px hit areas, and a tap 15 px under a rank + hits neither it nor an expand toggle
//   [6] the gear card says "Tap BAG" and the SKILL tab "tap +" on a phone
//   [D] desktop 960x560: answers keep their height, no taxi zoom, the gear card at its corner, the tracker uncapped, "Press U" / "click +"
//   node release26f_test.mjs        PORT (default 15630) / MOJI_GAME_FILE (inside the root; serve.js aliases it) / SERVE_ROOT; ONLY=android,iphone,desktop; R26F_SHOT=<prefix>
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15630), FILE = 'mojiworld_game.html';   // serve.js serves MOJI_GAME_FILE (a file inside the root) under this name
const SHOT = process.env.R26F_SHOT || '';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 700) + ']' : '')); };
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
console.log('server pid ' + server.pid);
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try { console.log('browser pid ' + browser.process().pid); } catch (e) {}
const errs = [];
const AND = 'Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const PROF = {
  android: { viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: AND },
  iphone: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: IOS },
  desktop: { viewport: { width: 960, height: 560 }, deviceScaleFactor: 1 },
};
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const tap = async (p, x, y) => { if (p._touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
async function boot(prof) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...PROF[prof] });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
  const page = await ctx.newPage(); page._prof = prof; page._touch = prof !== 'desktop';
  page.on('pageerror', (e) => errs.push(prof + ': ' + String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  if (prof === 'desktop') console.log('  build', await ev(page, () => (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?')));
  await ev(page, async () => { const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    applyClass('archer'); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sl(1200); devSetLevel(70);
    try { applyJob('sniper'); } catch (e) {} try { applyMaster('marksman'); } catch (e) {}
    await sl(400); player.hp = getMaxHp(); player.mp = getMaxMp(); player._god = true; player.mojicoins = 5e6;
    try { closeAllModals(); } catch (e) {} loadMap('forest', 600); await sl(2000); try { closeAllModals(); } catch (e) {}
    try { const tm = document.getElementById('tutorial-modal'); if (tm && getComputedStyle(tm).display !== 'none') _closeTutorial(true); } catch (e) {} game.paused = false;
    window.__r = (el) => { if (typeof el === 'string') el = document.querySelector(el); if (!el || !el.getClientRects().length) return null; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null; const b = el.getBoundingClientRect(); return b.width ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
    window.__ov = (a, b) => !!(a && b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5);
    window.__own = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!(t && (t === el || el.contains(t))); };
    window.__sc = () => { const w = document.querySelector('.game-wrapper'); return w.getBoundingClientRect().width / w.offsetWidth; };
  });
  // the talent chooser(s) after the job / master: take the first card
  for (let i = 0; i < 3; i++) {
    const r = await ev(page, () => { const m = document.getElementById('advancement-modal'); if (!m || getComputedStyle(m).display === 'none') return null; return __r(m.querySelector('.class-card')); });
    if (!r) break; await tap(page, (r.l + r.r) / 2, (r.t + r.b) / 2); await sleep(900);
    const y = await ev(page, () => __r('#confirm-yes')); if (y) { await tap(page, (y.l + y.r) / 2, (y.t + y.b) / 2); await sleep(900); }
  }
  await ev(page, () => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  return page;
}
const closeAll = (p) => ev(p, () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} game.paused = false; });
const shot = async (p, n) => { if (SHOT) try { await p.screenshot({ path: SHOT + p._prof + '_' + n + '.png', timeout: 20000 }); } catch (e) {} };
const OPEN = {
  map: () => toggleWorldMap(), quest: () => toggleQuestJournal(), lvup: () => openLevelUpPanel(),
  bag: () => { openLevelUpPanel(); document.querySelector('[data-utab="items"]').click(); },
  skill: () => { openLevelUpPanel(); document.querySelector('[data-utab="skills"]').click(); },
  boons: () => { openLevelUpPanel(); document.querySelector('[data-utab="boons"]').click(); },
  mojidex: () => openMojidex(), potion: () => openShop('potion'), weapon: () => openShop('weapon'), sell: () => openShop('sell'),
  forge: () => openEnhancementModal(), reforge: () => openReforgeModal(), craft: () => openCraftingModal(), taxi: () => openTaxi(), codex: () => openCodex(),
};
async function panels(p) {
  const bad = [], fr = {};
  for (const [k, fn] of Object.entries(OPEN)) {
    await closeAll(p); await sleep(250);
    try { await ev(p, (src) => (0, eval)('(' + src + ')')(), fn.toString()); } catch (e) { bad.push(k + ': open threw'); continue; }
    await sleep(900);
    const m = await ev(p, () => {
      const ov = [...document.querySelectorAll('.modal-overlay')].filter((e) => e.id !== 'tutorial-modal' && __r(e)).pop(); if (!ov) return null;
      const md = ov.querySelector(':scope > .modal') || ov.querySelector('.modal'); const R = __r(md), W = __r('.game-wrapper');
      const cb = md.querySelector(':scope > .close-btn, .close-btn'), C = __r(cb);
      return { R, W, vw: innerWidth, vh: innerHeight, cap: parseFloat(getComputedStyle(md).maxWidth) * __sc() / innerWidth, close: !!(C && C.l >= 0 && C.t >= 0 && C.r <= innerWidth && C.b <= innerHeight && __own(cb)) };
    });
    if (!m) { bad.push(k + ': no panel'); continue; }
    const inside = m.R.l >= Math.max(m.W.l, 0) - 1 && m.R.r <= Math.min(m.W.r, m.vw) + 1 && m.R.t >= Math.max(m.W.t, 0) - 1 && m.R.b <= Math.min(m.W.b, m.vh) + 1;
    if (!inside) bad.push(k + ': outside the box ' + JSON.stringify(m.R)); if (!m.close) bad.push(k + ': its close button is off screen or covered');
    fr[k] = { w: +((m.R.r - m.R.l) / m.vw).toFixed(2), cap: +m.cap.toFixed(2) };
    if (k === 'map') await shot(p, 'map');
  }
  ok(`[1] ${p._prof}: all ${Object.keys(OPEN).length} panels open inside the box and the screen, each with its own close button on screen and on top`, bad.length === 0, bad);
  ok(`[1] ${p._prof}: the panel cap is >= 80% of the screen (it was 92vw in window px = 59-64%), and the map spans >= 80%`, fr.map && fr.map.w >= 0.8 && fr.quest && fr.quest.cap >= 0.8 && fr.bag.cap >= 0.8, fr);
}
async function stall(p) {
  await closeAll(p); await ev(p, () => openShop('potion')); await sleep(900);
  const s = await ev(p, () => { const md = document.querySelector('#shop-modal > .modal'); const names = [...md.querySelectorAll('.shop-item .name')].filter((e) => __r(e));
    return { w: md.offsetWidth, nameMin: Math.min(...names.map((e) => e.offsetWidth)), lines: Math.max(...names.map((e) => e.querySelector('b').getClientRects().length)), n: names.length }; });
  await shot(p, 'stall');
  ok(`[2] ${p._prof}: the potion stall is 860 box px and every name cell >= 120 px on one line`, s.w === 860 && s.nameMin >= 120 && s.lines === 1, s);
  const nr = await ev(p, async () => { const md = document.querySelector('#shop-modal > .modal'); md.style.setProperty('width', '620px', 'important'); md.style.setProperty('min-width', '620px', 'important');
    await new Promise((r) => setTimeout(r, 300)); const st = [...md.querySelectorAll('.pot-step[data-step="-10"], .pot-step[data-step="+10"]')];
    const names = [...md.querySelectorAll('.shop-item .name')]; const o = { tens: st.filter((e) => __r(e)).length, nameMin: Math.min(...names.map((e) => e.offsetWidth)) };
    md.style.removeProperty('width'); md.style.removeProperty('min-width'); return o; });
  ok(`[2] ${p._prof}: a stall squeezed to 620 px drops its -10 / +10 steppers and its names keep >= 120 px`, nr.tens === 0 && nr.nameMin >= 120, nr);
  const f = {}; for (const t of ['weapon', 'sell']) { await ev(p, (t) => openShop(t), t); await sleep(700); f[t] = await ev(p, () => document.querySelector('#shop-modal > .modal').offsetWidth); }
  ok(`[2] ${p._prof}: the gear forge and the sell desk are 900 box px (their desktop width)`, f.weapon === 900 && f.sell === 900, f);
}
async function hud(p) {
  await closeAll(p); await sleep(1600);
  const t = await ev(p, () => { const tr = __r('#quest-tracker'); const hit = []; let n = 0;
    for (const e of document.querySelectorAll('#mobile-deck .mc-btn')) { const r = __r(e); if (!r) continue; n++; if (__ov(r, tr)) hit.push(e.dataset.mkey || e.className.slice(0, 20)); }
    return { tr, rows: document.querySelectorAll('#quest-tracker .qt-row').length, deckBtns: n, skills: document.querySelectorAll('#mobile-deck .mc-actions .mc-btn').length, hit }; });
  ok(`[3] ${p._prof}: the quest tracker (shown, ${t.rows} rows) overlaps none of the ${t.deckBtns} deck buttons`, !!t.tr && t.hit.length === 0, t);
  await ev(p, () => { const it = { name: 'Blessed Stalwart Skyhunter Longbow of Renewal', icon: 'B', slot: 'weapon', rarity: 'epic', atk: 300, stats: { atk: 300 } }; showGearChange(null, it, 5283); });
  await sleep(700); await shot(p, 'gear');
  const g = await ev(p, () => { const el = document.getElementById('gear-change'), gr = __r(el), hit = [];
    for (const e of document.querySelectorAll('#mobile-deck .mc-btn, #mobile-ctrl .mc-menu, #quest-tracker, #stats')) { const r = __r(e); if (r && __ov(r, gr)) hit.push(e.id || e.dataset.mkey || e.className.slice(0, 20)); }
    return { gr, hit, on: !!gr && gr.l >= 0 && gr.t >= 0 && gr.r <= innerWidth && gr.b <= innerHeight, pe: getComputedStyle(el).pointerEvents, txt: el.textContent.replace(/\s+/g, ' ').slice(-48) }; });
  ok(`[3] ${p._prof}: "BETTER GEAR LOOTED" overlaps no deck / menu button, the tracker or the stats plate, sits on screen and takes no tap`, g.hit.length === 0 && g.on && g.pe === 'none', g);
  ok(`[6] ${p._prof}: the gear card says "Tap BAG to open inventory and equip"`, /Tap BAG to open inventory and equip/.test(g.txt), g.txt);
}
async function taxi(p) {
  await closeAll(p);
  await ev(p, () => { game.visitedMaps = {}; for (const k of Object.keys(MAPS).filter((k) => MAPS[k].isTown).slice(0, 8)) game.visitedMaps[k] = true; loadMap('town', 400); }); await sleep(2200);
  await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; openTaxi(); }); await sleep(1400);
  const z = await ev(p, () => { const zi = document.getElementById('taxi-zoom'); const d = document.querySelector('#taxi-grid g.wm-node[data-wm-pick] .wm-disc'); const r0 = d ? d.getBoundingClientRect().width : 0;
    if (!zi || !__r(zi)) return { zoom: false, r0 };
    zi.value = '100'; zi.dispatchEvent(new Event('input', { bubbles: true })); const r1 = d.getBoundingClientRect().width;
    zi.value = '0'; zi.dispatchEvent(new Event('input', { bubbles: true })); return { zoom: true, r0, r1, back: d.getBoundingClientRect().width }; });
  ok(`[4] ${p._prof}: the taxi has a zoom slider on touch, and all the way in a node is >= 3x its size`, z.zoom && z.r1 >= 3 * z.r0 && Math.abs(z.back - z.r0) < 1, z);
  // a reachable node with an empty spot 12-20 px off its centre (no node there, it is the nearest reachable one)
  const pt = await ev(p, () => { const sv = document.querySelector('#taxi-grid svg'), S = sv.getBoundingClientRect();
    const all = [...sv.querySelectorAll('g.wm-node')].filter((g) => g.querySelector('.wm-disc')).map((g) => { const q = g.querySelector('.wm-disc').getBoundingClientRect(); return { g, x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    const picks = [...sv.querySelectorAll('g.wm-node[data-wm-pick]')].map((g) => { const q = g.querySelector('.wm-disc').getBoundingClientRect(); return { g, id: g.getAttribute('data-map-id'), x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    for (const a of picks) for (const d of [16, 13, 19]) for (let k = 0; k < 16; k++) { const x = a.x + d * Math.cos(k * Math.PI / 8), y = a.y + d * Math.sin(k * Math.PI / 8);
      if (x < S.left + 4 || x > S.right - 4 || y < S.top + 4 || y > S.bottom - 4) continue;
      const t = document.elementFromPoint(x, y); if (!t || !sv.contains(t) || t.closest('.wm-node')) continue;
      if (all.some((b) => b.g !== a.g && Math.hypot(b.x - x, b.y - y) <= Math.hypot(a.x - x, a.y - y) + 10)) continue;   // nearest of ALL nodes (Chrome's touch adjustment snaps to the nearest)
      return { id: a.id, name: MAPS[a.id].name, x, y, d }; }
    return null; });
  const c0 = await ev(p, () => player.mojicoins), m0 = await ev(p, () => game.currentMap);
  if (pt) { await tap(p, pt.x, pt.y); await sleep(600); }
  const ask = await ev(p, () => ({ up: !!__r('#confirm-modal'), title: (document.getElementById('confirm-title') || {}).textContent || '', body: (document.getElementById('confirm-body') || {}).textContent || '' }));
  ok(`[4] ${p._prof}: a tap ${pt ? pt.d : '?'} px off a reachable node picks it and asks first - destination and fare - charging nothing yet`, !!pt && ask.up && ask.title.includes(pt.name) && /fare/i.test(ask.body) && (await ev(p, () => player.mojicoins)) === c0, { pt, ask });
  await shot(p, 'taxi_ask');
  if (ask.up) { const n = await ev(p, () => __r('#confirm-no')); await tap(p, (n.l + n.r) / 2, (n.t + n.b) / 2); await sleep(700); }
  ok(`[4] ${p._prof}: "Stay" charges nothing and goes nowhere`, (await ev(p, () => player.mojicoins)) === c0 && (await ev(p, () => game.currentMap)) === m0);
  if (pt) { await tap(p, pt.x, pt.y); await sleep(600); const y = await ev(p, () => __r('#confirm-yes')); if (y) { await tap(p, (y.l + y.r) / 2, (y.t + y.b) / 2); await sleep(1800); } }
  const after = await ev(p, () => ({ map: game.currentMap, coins: player.mojicoins }));
  ok(`[4] ${p._prof}: "Ride" charges the fare once and travels`, !!pt && after.map === pt.id && c0 - after.coins > 0 && c0 - after.coins <= 600, { after, c0 });
}
async function talk(p) {
  await closeAll(p); await ev(p, () => loadMap('town', 400)); await sleep(2200);
  const o = await ev(p, async () => { try { closeAllModals(); } catch (e) {} const n = game.npcs.find((x) => /guguma/i.test(x.name)); openNPC(n);
    await new Promise((r) => setTimeout(r, 1400)); const els = [...document.querySelectorAll('#dialog-options > button')].filter((e) => __r(e)), bs = els.map((e) => __r(e));
    // the answers lean (skewX), so their boxes overlap the gap: measure it where a finger lands, along each button's middle line
    const hit = (x, y) => { const t = document.elementFromPoint(x, y); return t && t.closest ? t.closest('#dialog-options > button') : null; };
    let gx = 99, gy = 99; for (let i = 0; i < els.length; i++) for (let j = 0; j < els.length; j++) { if (i === j) continue; const a = bs[i], b = bs[j]; const sameRow = Math.abs(a.t - b.t) < 3;
      if (sameRow && b.l > a.r - 12 && b.l > a.l) { const y = (a.t + a.b) / 2; let lastA = a.l, firstB = b.r; for (let x = Math.round((a.l + a.r) / 2); x <= (b.l + b.r) / 2; x++) { const h = hit(x, y); if (h === els[i]) lastA = x; else if (h === els[j]) { firstB = x; break; } } gx = Math.min(gx, firstB - lastA - 1); }
      if (!sameRow && b.t > a.b - 1 && a.l < b.r && b.l < a.r) gy = Math.min(gy, b.t - a.b); }
    const d = __r('#dialog'), nm = __r('#dialog-name'); return { n: bs.length, hMin: Math.min(...bs.map((r) => r.b - r.t)), gx, gy: +gy.toFixed(1), dlg: d, name: nm,
      fits: !!d && d.t >= 0 && (!nm || nm.t >= 0) && d.b <= innerHeight + 1 && els.every((e) => __own(e)) }; });
  await shot(p, 'dialog');
  ok(`[5] ${p._prof}: Guguma's ${o.n} answers are >= 35 px tall with >= 7 px gaps, and the card stays on screen`, o.n >= 4 && o.hMin >= 35 && o.gx >= 7 && o.gy >= 7 && o.fits, o);
  const b = await ev(p, async () => { try { closeDialog(); } catch (e) {} const n = game.npcs.find((x) => x.role === 'expedition'); openNPC(n); await new Promise((r) => setTimeout(r, 1200));
    const cs = [...document.querySelectorAll('#dialog-tabs > button')].map((e) => __r(e)).filter(Boolean); return { n: cs.length, hMin: Math.min(...cs.map((r) => r.b - r.t)) }; });
  ok(`[5] ${p._prof}: Bravo's ${b.n} Weight chips are >= 35 px tall`, b.n >= 3 && b.hMin >= 35, b);
}
async function skills(p) {
  await closeAll(p); await ev(p, () => { openLevelUpPanel(); document.querySelector('[data-utab="skills"]').click(); }); await sleep(1200);
  await ev(p, () => { const b = document.querySelector('#attributes-modal button[data-rankid]'); b.scrollIntoView({ block: 'center' }); }); await sleep(500);
  const s = await ev(p, () => {
    const add = [...document.querySelectorAll('#attributes-modal button[data-rankid]')].find((e) => { const r = __r(e); return r && r.t > 40 && r.b < innerHeight - 60; });
    const a = __r(add), cx = (a.l + a.r) / 2, cy = (a.t + a.b) / 2;
    const exps = [...document.querySelectorAll('#attributes-modal button[data-expandid]')].map((e) => __r(e)).filter((r) => r && Math.abs((r.l + r.r) / 2 - cx) < 30 && (r.t + r.b) / 2 > cy);
    exps.sort((x, y) => x.t - y.t); const e = exps[0], ex = e ? (e.l + e.r) / 2 : cx, ey = e ? (e.t + e.b) / 2 : cy + 60;
    const what = (x, y) => { const t = document.elementFromPoint(x, y); return !t ? '.' : t.closest('button[data-rankid]') ? 'R' : t.closest('button[data-expandid]') ? 'E' : '.'; };
    let lastR = cy, firstE = ey; for (let y = cy; y <= ey; y++) { const w = what(ex, y); if (w === 'R') lastR = y; if (w === 'E') { firstE = y; break; } }
    let hw = 0; for (let x = cx; x < cx + 40; x++) { if (what(x, cy) === 'R') hw = x - cx; else break; }
    return { addWH: [Math.round(a.r - a.l), Math.round(a.b - a.t)], expWH: e ? [Math.round(e.r - e.l), Math.round(e.b - e.t)] : null, hitW: 2 * hw, deadBand: firstE - lastR - 1,
      mid: what(ex, Math.round((lastR + firstE) / 2)), hint: (document.querySelector('#attributes-modal .skl-hint') || {}).textContent || '' };
  });
  await shot(p, 'skills');
  ok(`[5] ${p._prof}: the SKILL tab's rank + and expand + are >= 23 px with a >= 36 px hit area`, s.addWH[0] >= 23 && s.addWH[1] >= 23 && !!s.expWH && s.expWH[0] >= 23 && s.hitW >= 36, s);
  ok(`[5] ${p._prof}: between a rank + and the next tile's expand + is a >= 10 px band that hits neither`, s.deadBand >= 10 && s.mid === '.', s);
  ok(`[6] ${p._prof}: the SKILL tab says "tap + next to a skill name"`, /tap \+ next to a skill name/.test(s.hint), s.hint.slice(-80));
}
async function desktop(p) {
  await closeAll(p); await ev(p, () => loadMap('town', 400)); await sleep(2000);
  const d = await ev(p, async () => { const sl = (ms) => new Promise((r) => setTimeout(r, ms)); try { closeAllModals(); } catch (e) {}
    const n = game.npcs.find((x) => /guguma/i.test(x.name)); openNPC(n); await sl(1200);
    const ob = document.querySelector('#dialog-options > button'); const o = { optMinH: getComputedStyle(ob).minHeight, optGap: getComputedStyle(document.getElementById('dialog-options')).rowGap };
    try { closeDialog(); } catch (e) {} game.paused = false;
    game.visitedMaps = {}; for (const k of Object.keys(MAPS).filter((k) => MAPS[k].isTown).slice(0, 8)) game.visitedMaps[k] = true; openTaxi(); await sl(900);
    o.taxiZoom = !!document.getElementById('taxi-zoom'); try { closeAllModals(); } catch (e) {} game.paused = false;
    showGearChange(null, { name: 'Test Bow', icon: 'B', slot: 'weapon', rarity: 'epic', atk: 300, stats: { atk: 300 } }, 10); await sl(600);
    const g = document.getElementById('gear-change'); o.gear = [g.style.top, g.style.right, g.style.left, getComputedStyle(g).pointerEvents]; o.gearTxt = /Press U to open inventory and equip/.test(g.textContent.replace(/\s+/g, ' '));
    o.qtMax = document.getElementById('quest-tracker').style.maxHeight;
    openLevelUpPanel(); document.querySelector('[data-utab="skills"]').click(); await sl(900);
    const add = document.querySelector('#attributes-modal button[data-rankid]'); o.addW = add ? add.offsetWidth : null;
    o.hint = /click \+ next to a skill name/.test((document.querySelector('#attributes-modal .skl-hint') || {}).textContent || '');
    try { closeAllModals(); } catch (e) {} openShop('potion'); await sl(700); o.stallW = document.querySelector('#shop-modal > .modal').offsetWidth;
    return o; });
  ok('[D] desktop 960x560: answers keep their size, no taxi zoom, the gear card at its corner and clickable, the tracker uncapped, "Press U" / "click +", stall 860, + buttons 20 px',
    (d.optMinH === 'auto' || d.optMinH === '0px') && !d.taxiZoom && d.gear[0] === '110px' && d.gear[1] === '10px' && !d.gear[2] && d.gear[3] !== 'none' && d.gearTxt && d.qtMax === '' && d.hint && d.stallW === 860 && d.addW === 20, d);
}
try {
  for (const prof of ['android', 'iphone']) {
    if (!on(prof)) continue;
    const p = await boot(prof);
    for (const f of [panels, stall, hud, skills, talk, taxi]) { try { await f(p); } catch (e) { ok(`${prof} ${f.name}: harness ` + String(e && e.message || e).slice(0, 200), false); } }
    await p.context().close();
  }
  if (on('desktop')) { const p = await boot('desktop'); try { await desktop(p); } catch (e) { ok('desktop: harness ' + String(e && e.message || e).slice(0, 200), false); } await p.context().close(); }
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { ok('harness: ' + String(e && e.stack || e).slice(0, 300), false); }
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
