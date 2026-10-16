// RELEASE 26d (Expedition / repeatable-loop hunter round) stays fixed - real keys and clicks where a player acts:
//   [1]  the Sovereign falls (real Z), the tab is closed 3 s into his fall film: Continue keeps the victory - the title says so, the
//        clear is counted, the final floor's EXP and the victory coins (with Dawn's Favor) are paid, nothing says the run was lost
//   [1c] the same kill, the tab closed AFTER the completion: Continue pays nothing a second time; the victory coins carried Dawn's
//        Favor (+10%)
//   [2]  the tower pin never says "Floor cleared" over a floor that is not (it is drawn before the spawns land), it counts the floor
//        once the spawns are in, and it sits clear of the stats plate (960x560 and a 844x390 phone)
//   [3]  an Expedition death: no town warp behind the death card (the map stays the tower until Respawn, which goes to the Void);
//        the "EXP retained" line names the EXP kept after the 5% toll
//   [4]  answering Bravo while her line still types (real clicks): no NotFoundError, the card is not left typing, the answer shows
//   [5]  a potion drunk from your own stock in the tower (real PgUp) stays drunk after the run; a potion found in it still leaves
//   [6]  Bravo's blessing card: the three arches and Keep in view at 960x560 and 844x390; the loot-rule card's name plate on screen
//   [7]  a friend's code: the same three blessings for both, a blessing one of them holds is swapped (and the card says so)
//   [8]  Marbella's bounty pays Dawn's Favor's +10%
//   node release26d_test.mjs     PORT (default 15420) / MOJI_GAME_FILE (a path inside the repo; serve.js serves it as mojiworld_game.html) / SERVE_ROOT / ONLY=1,1c,2,3,...
//   R26D_SHOT=<tag> writes r26d_boonpick_<size>_<tag>.png next to R26D_SHOT_DIR (default: the cwd)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15420), FILE = 'mojiworld_game.html';   // serve.js aliases it to MOJI_GAME_FILE (a path inside the repo)
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`;
const SHOT = process.env.R26D_SHOT || '', SHOT_DIR = process.env.R26D_SHOT_DIR || process.cwd();
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const PHONE = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const hooks = () => {
  if (window.__r26dHooked) return; window.__r26dHooked = 1;
  window.__toasts = []; const _st0 = window.showToast; window.showToast = function (t) { try { window.__toasts.push(String(t)); } catch (e) {} return _st0.apply(this, arguments); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } game.paused = false; };
  window._r26 = { sleep, clear,
    hero: (lv) => {   // a Lv N hero who finished the story (Dawn's Favor on), every beat seen, a wallet and five of each potion
      devSetLevel(lv); player.exp = 0; player.expToNext = _lxLevelCost(lv); player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); game.qnav = null; game.qnavPins = [];
      for (const id of _QUEST_STORY_CHAIN) player.quests.completed[id] = Date.now() - 864e5;
      for (const id in QUESTS) if (QUESTS[id] && QUESTS[id].critical) player.quests.completed[id] = Date.now() - 864e5;
      player._storyBeatsSeen = {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
      player._tutorialSeen = true; player._gravitosCineSeen = true; delete player._lxBeatsOwed; delete player._lxEndingDue;
      player.mojicoins = 50000; player.bankBalance = 20000; player.setshards = 100; player.boons = []; player.boonsEquipped = [];
      player.consumables = player.consumables || {}; for (const k of Object.keys(player.consumables)) player.consumables[k] = 5;
      if (!Object.keys(player.consumables).length) { player.consumables.hp_s = 5; player.consumables.mp_s = 5; }
      player._expLootAck = false; player._god = true;
      game._worldStateByMap = new Proxy({}, { get: () => null, set: () => true, has: () => true });
      player.hp = getMaxHp(); player.mp = getMaxMp(); },
    go: async (map, x) => { clear(); loadMap(map, x || 300); await sleep(900); clear(); },
    st: () => ({ map: game.currentMap, lv: player.level, exp: +player.exp || 0, coins: Math.floor(player.mojicoins || 0), shards: player.setshards || 0,
      cons: JSON.parse(JSON.stringify(player.consumables || {})), clears: game.expeditionClears | 0, active: !!(game.expedition && game.expedition.active) }),
  };
};
const install = (page) => page.evaluate((src) => { (0, eval)('(' + src + ')')(); }, hooks.toString());
const boot = async (opts) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 }, ...(opts || {}) });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  console.log('  build', await page.evaluate(() => (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?')));
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (player.cls !== 'warrior') { try { applyClass('warrior'); } catch (e) {} player.cls = 'warrior'; }
  });
  await install(page); return { ctx, page };
};
const press = async (page, key, hold = 90) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
const opts = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#dialog-options button')).map((b) => b.textContent.trim()));
const clickOpt = async (page, re) => {
  for (let k = 0; k < 24; k++) { const o = await opts(page); const i = o.findIndex((t) => new RegExp(re).test(t));
    if (i >= 0) { await page.locator('#dialog-options button').nth(i).click({ timeout: 5000 }); return o[i]; } await page.waitForTimeout(250); }
  console.log('  no option', re, JSON.stringify(await opts(page))); return null;
};
const dlgUp = (page) => page.evaluate(() => { const d = document.getElementById('dialog'); return !!(d && d.style.display !== 'none' && d.offsetParent !== null); });
// stand by an NPC and press the talk key (N) until the card opens; the greeting is left typing
const talkTo = async (page, pred) => {
  for (let k = 0; k < 8; k++) {
    const n = await page.evaluate((src) => { const pr = (0, eval)(src); const n = (game.npcs || []).find(pr); if (!n) return null; player.x = n.x - 10; player.y = n.y - 10; player.vx = player.vy = 0; return n.name; }, pred);
    if (!n) return null;
    await page.waitForTimeout(350); await press(page, 'n', 90); await page.waitForTimeout(350);
    if (await dlgUp(page)) return n;
  }
  return null;
};
const skipTw = (page) => page.evaluate(() => { const d = document.getElementById('dialog'); if (d && d._twSkip) d._twSkip(); });
const waitMap = async (page, re, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = await page.evaluate(() => game.currentMap); if (new RegExp(re).test(m)) return m; await page.waitForTimeout(150); } return page.evaluate(() => game.currentMap); };
const dismiss = async (page) => { for (let k = 0; k < 10; k++) { const s = await page.evaluate(() => ({ sb: !!document.querySelector('#story-beat-overlay.on'), bi: !!document.querySelector('#boss-intro-overlay.on') }));
  if (s.sb) { await press(page, ' ', 60); await page.waitForTimeout(350); continue; } if (s.bi) { await page.evaluate(() => { try { _dismissBossIntro(); } catch (e) {} }); await page.waitForTimeout(300); continue; } break; } };
// kill every live mob by real Z (each set to 1 HP, the hero beside it); a mob the swing cannot reach after a while is felled directly
const clearFloor = async (page, maxMs = 60000) => {
  const t0 = Date.now(); let z = 0, forced = 0;
  while (Date.now() - t0 < maxMs) {
    const st = await page.evaluate(() => { const live = (game.monsters || []).filter((m) => m && m.currentHp > 0 && !m._dying && !m._suppressed); if (!live.length) return { n: 0 };
      const b = live[0]; const bx = (typeof _atkMonBox === 'function') ? _atkMonBox(b) : b;
      player.x = bx.x - player.w - 4; player.y = bx.y + bx.h - player.h; player.vy = 0; player.facing = 1;
      b.currentHp = 1; b.evasion = 0; b.invulnerable = 0; b._stagger = 1e9; player.hp = getMaxHp(); game.paused = false; game.comboMult = 1; return { n: live.length, t: b.type }; });
    if (!st.n) break;
    await press(page, 'z', 90); await page.waitForTimeout(220);
    const dead = await page.evaluate((t) => !(game.monsters || []).some((m) => m && m.currentHp > 0 && !m._dying && m.type === t && m.currentHp <= 1), st.t);
    if (dead) { z++; continue; }
    if (Date.now() - t0 > 6000 + z * 2000) { forced++; await page.evaluate(() => { const b = (game.monsters || []).find((m) => m && m.currentHp > 0 && !m._dying); if (b) { b.currentHp = 1; hitMonster(b, 1e9, false, 'test'); } }); }
  }
  return { z, forced };
};
const beginRun = async (page, firstTime) => {
  await page.evaluate(async () => { await _r26.go('town', 2400); });
  if (!await talkTo(page, "(n) => n.role === 'expedition'")) return 'no-bravo';
  await skipTw(page); await clickOpt(page, 'Begin Expedition');
  if (firstTime) { await page.waitForTimeout(400); return 'ack'; }
  return waitMap(page, 'tower_b1');
};
const quitAndGrab = async (ctx, page) => { await page.close({ runBeforeUnload: true }); const p2 = await ctx.newPage(); p2.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p2.goto(`http://localhost:${PORT}/__blank_404`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  return { save: await p2.evaluate(() => localStorage.getItem('levelx_save_v1')), page: p2 }; };
const continueIn = async (page) => {
  if (!page.__r26dNav) { page.__r26dNav = 1; page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('  (navigated: ' + f.url().replace(/^https?:\/\/[^/]+/, '') + ')'); }); }
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.waitForTimeout(1500); await install(page);
  const notice = await page.evaluate(() => { const n = document.getElementById('menu-save-notice'); return (n && !n.hidden) ? n.textContent : ''; });
  await page.locator('#menu-continue').click({ timeout: 90000 });
  await page.waitForFunction(() => game && game.currentMap && game.currentMap !== 'void', null, { timeout: 60000 }).catch(() => {});
  // the title holds until the art is in (the commence gate) - wait for it to go (or for a stale-save reload to land)
  await page.waitForFunction(() => { const ov = document.getElementById('loading-overlay'); return typeof game !== 'undefined' && (!ov || ov.classList.contains('fade') || getComputedStyle(ov).display === 'none'); }, null, { timeout: 90000 }).catch(() => console.log('  (the title did not close within 90 s)'));
  return notice;
};
const rect = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }, sel);
const meets = (a, b) => !!(a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]);
const shot = async (page, name) => { if (!SHOT) return; try { await page.screenshot({ path: path.join(SHOT_DIR, name + '_' + SHOT + '.png') }); } catch (e) { console.log('  shot fail', name); } };
// the Sovereign at B10, felled by real Z; returns the expected victory payment (Dawn's Favor included) and the state before the kill
const sovKill = async (page) => {
  await page.evaluate(() => _r26.hero(70));
  await beginRun(page, true); await clickOpt(page, 'I understand'); await waitMap(page, 'tower_b1'); await page.waitForTimeout(1500);
  await page.evaluate(() => { game.expedition.floor = 9; game.expedition.bravoReady = false; _expeditionAdvanceFloor('bravo'); });
  await waitMap(page, 'tower_b10'); await page.waitForTimeout(3500); await dismiss(page);
  const pre = await page.evaluate(() => ({ st: _r26.st(), dawn: _lxDawnCoinMul(), expect: Math.floor(Math.floor(_lxExpeditionCoinReward(player.level || 1) * _lxExpDiff().reward) * _ksCoinMul() * _lxDawnCoinMul()) }));
  const cf = await clearFloor(page, 30000);
  return { pre, cf };
};
if (on('1')) {
  let { ctx, page } = await boot();
  const { pre, cf } = await sovKill(page);
  await page.waitForTimeout(3000);
  const mid = await page.evaluate(() => ({ st: _r26.st(), down: !!(game.expedition && game.expedition._finalBossDown) }));
  ok('[1] (setup) the Sovereign is down and his film is playing when the tab closes', mid.st.active && mid.down && pre.dawn > 1, { cf, mid: mid.st.map, dawn: pre.dawn });
  const g = await quitAndGrab(ctx, page); page = g.page;
  ok('[1] (setup) the closed tab saved the run as active with the final boss down', /"expedition":\{"active":true/.test(g.save || '') && /_finalBossDown":true/.test(g.save || ''));
  const notice = await continueIn(page); await page.waitForTimeout(4500);
  if (process.env.R26D_DEBUG) await page.screenshot({ path: path.join(SHOT_DIR, '_r26d_after_continue.png') });
  if (!await page.evaluate(() => typeof _r26 !== 'undefined')) { console.log('  (the page reloaded after Continue - hooks re-installed)'); await install(page); }
  const af = await page.evaluate(() => { const ov = document.getElementById('loading-overlay'); return { st: _r26.st(), toasts: window.__toasts.slice(), ov: ov ? [ov.className, getComputedStyle(ov).display, getComputedStyle(ov).opacity] : null }; });
  ok('[1] the title says the victory was kept (not "ended when the game closed")', /victory is kept/.test(notice) && !/ended when the game closed/.test(notice), notice);
  ok('[1] the clear is counted (Sunfire / Astral Cape)', af.st.clears === pre.st.clears + 1, { before: pre.st.clears, after: af.st.clears });
  ok('[1] the victory coins are paid, with Dawn\'s Favor', af.st.coins - 50000 >= pre.expect && af.st.coins - 50000 < pre.expect + 400, { paid: af.st.coins - 50000, expect: pre.expect });
  ok('[1] the final floor\'s EXP and the clear bonus are paid', af.st.exp > mid.st.exp + 1000, { atQuit: mid.st.exp, after: af.st.exp });
  ok('[1] the run is closed and the hero is in town', !af.st.active && af.st.map === 'town', af.st.map);
  ok('[1] the victory is announced once the title is gone', af.toasts.some((t) => /victory is kept/.test(t)), { toasts: af.toasts.slice(-4), ov: af.ov });
  await ctx.close();
}
if (on('1c')) {
  let { ctx, page } = await boot();
  const { pre } = await sovKill(page);
  for (let k = 0; k < 80 && await page.evaluate(() => !!(game.expedition && game.expedition.active)); k++) await page.waitForTimeout(250);
  await page.waitForTimeout(1500);
  const at = await page.evaluate(() => _r26.st());
  ok('[1c] (setup) the completion ran before the tab closed', !at.active && at.clears === pre.st.clears + 1, at);
  ok('[1c] the victory coins carried Dawn\'s Favor (+10%)', at.coins - 50000 === pre.expect, { paid: at.coins - 50000, expect: pre.expect });
  const g = await quitAndGrab(ctx, page); page = g.page;
  await continueIn(page); await page.waitForTimeout(4000);
  const af = await page.evaluate(() => _r26.st());
  ok('[1c] Continue pays nothing a second time', af.clears === at.clears && af.exp === at.exp && af.coins - at.coins >= 0 && af.coins - at.coins < 400, { at, af });
  await ctx.close();
}
if (on('2') || on('3') || on('4') || on('5') || on('6') || on('8')) {
  const { ctx, page } = await boot();
  await page.evaluate(() => _r26.hero(70));
  await page.evaluate(async () => { await _r26.go('town', 2400); });
  if (on('4')) {   // answer Bravo while her line still types (real clicks)
    let mid = 0; const res = [];
    for (let rep = 0; rep < 6 && mid < 3; rep++) {
      await page.evaluate(() => { try { closeDialog(); } catch (e) {} });
      if (!await talkTo(page, "(n) => n.role === 'expedition'")) { res.push('no-talk'); continue; }
      await clickOpt(page, 'Find out more'); await page.waitForTimeout(150);
      const typing = await page.evaluate(() => document.getElementById('dialog').classList.contains('typing'));
      const e0 = errs.length;
      await clickOpt(page, 'The descent'); await page.waitForTimeout(1500);
      const r = await page.evaluate(() => { const d = document.getElementById('dialog'); return { typing: d.classList.contains('typing'), timer: !!d._twTimer, text: document.getElementById('dialog-text').textContent.slice(0, 30) }; });
      if (typing) mid++;
      res.push({ midTyping: typing, errs: errs.length - e0, ...r });
    }
    const hit = res.filter((r) => r && r.midTyping);
    ok('[4] an answer clicked while the line types: no page error, the card not left typing, the answer shown', hit.length >= 3 && hit.every((r) => r.errs === 0 && !r.timer && !r.typing && /Ten floors/.test(r.text)), res);
    await page.evaluate(() => { try { closeDialog(); } catch (e) {} });
  }
  // the first Begin shows the one-time loot-rule card
  await beginRun(page, true);
  const ack = [];   // the card's top and its name plate's, from the moment it opens until its line has typed out
  for (let k = 0; k < 60; k++) { const a = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; return Math.round(e.getBoundingClientRect().top); };
    return { name: r('#dialog-name'), card: r('#dialog'), typing: document.getElementById('dialog').classList.contains('typing') }; }); ack.push(a); if (k === 3) await shot(page, 'r26d_ackcard_960'); if (!a.typing && k > 3) break; await page.waitForTimeout(100); }
  await page.waitForTimeout(300);
  if (on('6')) {
    const low = Math.min(...ack.map((a) => (a.name == null ? 999 : a.name))), lowC = Math.min(...ack.map((a) => (a.card == null ? 999 : a.card)));
    ok('[6] the loot-rule card and its name plate stay on screen at 960x560 while its line types', ack.length > 2 && low >= 0 && lowC >= 0, { nameTop: low, cardTop: lowC, samples: ack.length, first: ack[0] });
  }
  await clickOpt(page, 'I understand');
  await waitMap(page, 'tower_b1');
  const samples = [];
  for (let k = 0; k < 40; k++) { samples.push(await page.evaluate(() => { const p = document.querySelector('#expedition-quest-pin .eq-progress'); const x = game.expedition || {};
    return { t: p ? p.textContent : '', live: (game.monsters || []).filter((m) => m && m.currentHp > 0 && !m._dying).length, cleared: !!(x.bravoReady || (x._floorClearedFor != null && x._floorClearedFor === x.floor)) }; })); await page.waitForTimeout(100); }
  await dismiss(page); await page.waitForTimeout(1200);
  if (on('2')) {
    const lie = samples.filter((s) => /Floor cleared/.test(s.t) && !s.cleared);
    ok('[2] the pin never says "Floor cleared" over a floor that is not cleared', lie.length === 0, { lies: lie.length, first: samples[0], last: samples[samples.length - 1] });
    ok('[2] the pin counts the floor once its spawns are in', samples.some((s) => /remaining/.test(s.t)), samples.filter((s, i) => i === 0 || s.t !== samples[i - 1].t).map((s) => s.t + ' (' + s.live + ')'));
    const pin = await rect(page, '#expedition-quest-pin'), stt = await rect(page, '#stats');
    const diag = await page.evaluate(() => { const w = document.querySelector('.game-wrapper'); const p = document.getElementById('expedition-quest-pin'); return { ws: w ? [w.scrollTop, w.scrollLeft] : null, ds: [scrollX, scrollY], par: p.offsetParent ? [p.offsetParent.id || p.offsetParent.className, p.offsetParent.scrollTop] : null, st: p.style.cssText, placed: p._lxPlaced }; });
    ok('[2] the pin sits clear of the stats plate at 960x560', pin && stt && !meets(pin, stt), { pin, stats: stt, diag });
  }
  if (on('5')) {   // drink one of your own (real PgUp), then a potion is found in the tower
    const c0 = await page.evaluate(() => JSON.parse(JSON.stringify(player.consumables)));
    for (let k = 0; k < 4; k++) { await page.evaluate(() => { _lxHpRestore = true; player.hp = Math.floor(getMaxHp() * 0.3); _lxHpRestore = false; }); await press(page, 'PageUp', 80); await page.waitForTimeout(600);
      if (await page.evaluate((h) => (player.consumables.hp_s | 0) < h, c0.hp_s)) break; await page.waitForTimeout(2500); }
    await page.evaluate(() => { player.consumables.mp_s = (player.consumables.mp_s | 0) + 2; });   // two found on the floor (as a pickup adds them)
    globalThis.__r26dCons = { c0, c1: await page.evaluate(() => JSON.parse(JSON.stringify(player.consumables))) };
  }
  if (on('6') || on('5')) {   // clear B1 by real Z; Bravo's blessing card at 960x560
    await clearFloor(page, 70000); await page.waitForTimeout(1500);
    if (on('6')) {
      await talkTo(page, "(n) => n.role === 'bravoGuide'"); await skipTw(page); await clickOpt(page, 'Show me the three');
      await page.waitForSelector('#bravo-boon-modal button[data-pick]', { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(700);
      const m = await page.evaluate(() => { const c = document.querySelector('#bravo-boon-modal > div'); if (!c) return null; const cr = c.getBoundingClientRect();
        const lo = Math.max(0, cr.top), hi = Math.min(innerHeight, cr.bottom);
        const vis = (b) => { const q = b.getBoundingClientRect(); return q.top >= lo - 1 && q.bottom <= hi + 1; };
        return { arches: Array.from(c.querySelectorAll('button[data-pick]')).map(vis), keep: vis(c.querySelector('[data-bravo-keep]')), card: [Math.round(cr.top), Math.round(cr.bottom)], scrollH: c.scrollHeight, clientH: c.clientHeight }; });
      ok('[6] 960x560: the three arches and Keep are in view when the card opens', m && m.arches.length === 3 && m.arches.every(Boolean) && m.keep, m);
      await shot(page, 'r26d_boonpick_960');
      await press(page, 'Escape', 60); await page.waitForTimeout(400);
    }
    if (on('5')) {
      await talkTo(page, "(n) => n.role === 'bravoGuide'"); await skipTw(page); await clickOpt(page, 'Abandon'); await page.waitForTimeout(800);
      await clickOpt(page, 'Abandon|Yes|Leave the tower').catch(() => {}); await page.waitForTimeout(3500);
      const after = await page.evaluate(() => ({ cons: JSON.parse(JSON.stringify(player.consumables)), active: !!game.expedition.active, toasts: window.__toasts.filter((t) => /REMOVED/.test(t)) }));
      const { c0, c1 } = globalThis.__r26dCons || {};
      ok('[5] (setup) a potion was drunk by PgUp and two were found', c0 && c1 && c1.hp_s === c0.hp_s - 1 && c1.mp_s === c0.mp_s + 2, { c0, c1 });
      ok('[5] after the run the potion drunk stays drunk and the found ones are gone', !after.active && c0 && after.cons.hp_s === c0.hp_s - 1 && after.cons.mp_s === c0.mp_s, { door: c0, after: after.cons });
      ok('[5] the loot line counts the two found potions', after.toasts.some((t) => /2 potions/.test(t)), after.toasts);
    }
  }
  if (on('3')) {   // an Expedition death
    await page.evaluate(() => { try { closeAllModals(); closeDialog(); } catch (e) {} game.paused = false; });
    await page.waitForTimeout(2600);
    const m1 = await beginRun(page, false); await page.waitForTimeout(2000); await dismiss(page);
    const d = await page.evaluate(() => { const s0 = +game.expedition._startExp || 0; player.exp += 1000000;   // what the floor paid so far
      player._god = false; player.invulnerable = 0; window.__toasts.length = 0; _lxHpRestore = true; player.hp = 1; _lxHpRestore = false; triggerDeath();
      return { map: game.currentMap, start: s0, kept: +player.exp || 0 }; });
    const maps = [];
    for (let k = 0; k < 36; k++) { maps.push(await page.evaluate(() => game.currentMap + (document.getElementById('death-overlay').classList.contains('on') ? '+card' : ''))); await page.waitForTimeout(100); }
    ok('[3] (setup) the hero died on a tower floor', /^tower_b/.test(m1) && /^tower_b/.test(d.map), { m1, d });
    ok('[3] no town warp behind the death card', !maps.some((m) => /^town/.test(m)) && maps.some((m) => /\+card/.test(m)), maps.filter((m, i) => i === 0 || m !== maps[i - 1]));
    await page.locator('#death-respawn-btn').click({ force: true, timeout: 5000 }).catch(() => {});
    const land = await waitMap(page, '^void$', 9000);
    ok('[3] Respawn takes the hero to the Void', land === 'void', land);
    const ln = await page.evaluate(() => window.__toasts.filter((t) => /EXP retained/.test(t)));
    const n = ln.length ? +String(ln[0]).replace(/^[^+]*\+([\d,]+).*$/, '$1').replace(/,/g, '') : NaN;
    ok('[3] "EXP retained" names the EXP kept after the 5% toll', n === d.kept - d.start, { line: ln[0], kept: d.kept - d.start });
    await page.evaluate(() => { player._god = true; });
  }
  if (on('8')) {   // Marbella's bounty and Dawn's Favor
    const cm = await page.evaluate(() => Object.keys(MAPS).find((id) => (MAPS[id].npcs || []).some((n) => n && n.role === 'curator')));
    await page.evaluate(async (m) => { await _r26.go(m, 600); player.mastery = Object.assign({}, player.mastery || {}, { slime: 100 }); player.claimedMilestones = {}; }, cm);
    await talkTo(page, "(n) => n.role === 'curator'"); await skipTw(page);
    const c0 = await page.evaluate(() => ({ coins: player.mojicoins, mul: _lxDawnCoinMul() * _ksCoinMul() }));
    await clickOpt(page, 'Claim all milestones'); await page.waitForTimeout(600);
    const c1 = await page.evaluate(() => player.mojicoins);
    ok('[8] Marbella\'s 500-coin bounty pays Dawn\'s Favor\'s +10%', c0.mul > 1 && c1 - c0.coins === Math.floor(500 * c0.mul), { map: cm, paid: c1 - c0.coins, expect: Math.floor(500 * c0.mul) });
  }
  await ctx.close();
}
if (on('2') || on('6')) {   // the phone: the pin and Bravo's card
  const { ctx, page } = await boot(PHONE);
  await page.evaluate(() => { _r26.hero(70); document.documentElement.classList.remove('lx-nobackdrop'); });
  await beginRun(page, true); await clickOpt(page, 'I understand'); await waitMap(page, 'tower_b1'); await page.waitForTimeout(3500); await dismiss(page);
  if (on('2')) { const pin = await rect(page, '#expedition-quest-pin'), stt = await rect(page, '#stats');
    ok('[2] the pin sits clear of the stats plate on a 844x390 phone', pin && stt && !meets(pin, stt), { pin, stats: stt }); }
  if (on('6')) {
    await clearFloor(page, 70000); await page.waitForTimeout(1500);
    await talkTo(page, "(n) => n.role === 'bravoGuide'"); await skipTw(page); await clickOpt(page, 'Show me the three');
    await page.waitForSelector('#bravo-boon-modal button[data-pick]', { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(700);
    const m = await page.evaluate(() => { const c = document.querySelector('#bravo-boon-modal > div'); if (!c) return null; const cr = c.getBoundingClientRect();
      const lo = Math.max(0, cr.top), hi = Math.min(innerHeight, cr.bottom);
      const vis = (b) => { const q = b.getBoundingClientRect(); return q.top >= lo - 1 && q.bottom <= hi + 1; };
      return { arches: Array.from(c.querySelectorAll('button[data-pick]')).map(vis), keep: vis(c.querySelector('[data-bravo-keep]')), card: [Math.round(cr.top), Math.round(cr.bottom)], scrollH: c.scrollHeight, clientH: c.clientHeight }; });
    ok('[6] 844x390 phone: the three arches are in view when the card opens', m && m.arches.length === 3 && m.arches.every(Boolean), m);
    await shot(page, 'r26d_boonpick_844');
  }
  await ctx.close();
}
if (on('7')) {   // a friend's code
  const runSeed = async (own) => {
    const { ctx, page } = await boot();
    await page.evaluate(async (ids) => { _r26.hero(70); player._expLootAck = true; player.boons = ids.map((id) => rollBoonInstance(id)); player.boonsEquipped = []; await _r26.go('town', 2400); }, own);
    await talkTo(page, "(n) => n.role === 'expedition'"); await skipTw(page); await clickOpt(page, 'Join a friend');
    await page.waitForSelector('#exp-seed-input', { timeout: 8000 });
    const card = await page.evaluate(() => document.getElementById('exp-seed-modal').textContent.replace(/\s+/g, ' '));
    await page.fill('#exp-seed-input', 'K7M2QF'); await page.click('#exp-seed-go');
    await waitMap(page, 'tower_b1'); await page.waitForTimeout(2500); await dismiss(page);
    const seed = await page.evaluate(() => game.expedition.seedCode);
    await page.evaluate(() => { for (const m of game.monsters) if (m) { m.currentHp = 0; m._dying = 1; } _expeditionFloorCleared(1, false); });
    await talkTo(page, "(n) => n.role === 'bravoGuide'"); await skipTw(page); await clickOpt(page, 'Show me the three'); await page.waitForTimeout(600);
    const picks = await page.evaluate(() => ((game.expedition._bravoOffer && game.expedition._bravoOffer.picks) || []).map((p) => p.def.id));
    await ctx.close(); return { seed, picks, card };
  };
  const A = await runSeed([]);
  const B = await runSeed(A.picks.length === 3 ? [A.picks[1]] : []);
  ok('[7] (setup) both descents run the same code and Bravo deals three', A.seed === B.seed && A.picks.length === 3 && B.picks.length === 3, { A: A.picks, B: B.picks });
  ok('[7] the blessings the friend does not hold are dealt the same, in the same places', B.picks[0] === A.picks[0] && B.picks[2] === A.picks[2], { A: A.picks, B: B.picks });
  ok('[7] the one the friend holds is swapped for one not held', B.picks[1] !== A.picks[1] && B.picks.indexOf(A.picks[1]) < 0, { A: A.picks, B: B.picks });
  ok('[7] the card says a held blessing is swapped', /already hold is swapped/.test(B.card), B.card.slice(0, 200));
}
ok('no page errors', errs.length === 0, errs.slice(0, 4));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); try { server.kill(); } catch (e) {}
process.exit(fail ? 1 : 0);
