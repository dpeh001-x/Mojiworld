// RELEASE 26b (brand-new-player hunter round, Lv 1-20, desktop 960x560 real keys + phone 844x390 real taps) stays fixed:
//   [1] the prologue's ending survives combat input: Space / Enter / taps in the first 1.2 s of the knockdown film, the Void film and each
//       "The memory frays..." card do nothing; a film ignores Space and taps on its body for good and skips only on its (late) Skip
//       button, Enter or Escape; a card advances on a tap / key after its own grace
//   [2] the first level-up chip hides under the potion stall (a tap on the first row's "+" buys, never opens LV UP) and under a dialog,
//       and when shown it covers neither the stats plate nor the menu row
//   [3] the Gelwater Grotto door's toast names the dialog's level (9+, it said 10+)
//   [4] the tracker names the navigator's map for VI · The First Word of the Cycle; an accepted quest reads 0/10, not "not started"
//   [5] none of the target up on a full map: "clear the map to bring more"
//   [6] the phone's guard button says BLOCK, the tour's Block step points at it, and a tap on it ticks the step
//   [7] a phone is told QUEST / TALK / tap, not Q / N / E / click (toasts, pills, compass, tour title, death screen, Lady Hong's needle)
//   [8] (per user) the prologue memory fight hides the stats plate / skill bar / other HUD (desktop + phone, the deck stays), skills never
//       fail for MP and HP / MP stay full; the HUD and the real Lv 1 values come back after it
//   [P] the Swing and Land-a-hit tour steps are fresh; the class page's Back row sits inside its card; NPC plates clear the skill bar;
//       the quest tracker yields over an NPC's plate
//   node release26b_test.mjs [page]        PORT / MOJI_GAME_FILE / SERVE_ROOT; ONLY=1,2,...
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => /\.html$/.test(a));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = cand;
const PORT = Number(process.env.PORT || 15226), FILE = 'mojiworld_game.html';   // serve.js answers this one path with MOJI_GAME_FILE
const SRC = readFileSync(env.MOJI_GAME_FILE ? path.resolve(ROOT, env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 600) + ']' : '')); };
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const PHONE = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
const DESK = { viewport: { width: 960, height: 560 } };
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`;
const boot = async (opts, lv = 9) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('lx_drs', 'off'); localStorage.removeItem('mojiworld_tip_first_levelup'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  const v = await page.evaluate((lv) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (!player.cls) applyClass('warrior');
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; player._storyBeatsSeen.everdawn_welcome = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true; player.level = lv; player.exp = 0; player.expToNext = 1e15;
    window._r = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      kd: (k) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true })); },
      clear: () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } game.paused = false; },
      go: async (map, x) => { window._r.clear(); game._worldStateByMap = Object.assign(game._worldStateByMap || {}, { [map]: null }); loadMap(map, x || 300); await window._r.sleep(1200); window._r.clear(); } };
    return GAME_VERSION;
  }, lv);
  console.log('  build', v, opts.isMobile ? 'phone' : 'desktop');
  return { ctx, page };
};
const press = async (page, key, hold = 90) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(60); };
const tapAt = (page, x, y) => page.touchscreen.tap(x, y);
const center = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return (r.width && r.height) ? [r.x + r.width / 2, r.y + r.height / 2] : null; }, sel);
// the prologue's ending, from the strip on (the fight itself is not needed): _prologueFinish is counted, not run
const strip = (page) => page.evaluate(() => { window.__fin = 0; window._prologueFinish = () => { window.__fin++; window._prologueActive = false; }; window._prologueActive = true; window._prologueStripping = false;
  window.__vlog = []; const t0 = performance.now(); const mo = new MutationObserver((ms) => { for (const m of ms) for (const n of m.removedNodes) if (n.id && /cine/.test(n.id)) { const v = n.querySelector && n.querySelector('video'); window.__vlog.push('-' + n.id + '@' + Math.round(performance.now() - t0) + (v ? ' err=' + (v.error && v.error.code) + ' end=' + v.ended + ' t=' + (+v.currentTime).toFixed(2) : '')); } }); mo.observe(document.body, { childList: true }); _prologueStrip();
  // the films must not simply END while the test (on a busy machine) is still looking at them: play each clip at a third of its speed
  // (pausing it would reject its play() promise, which the film reads as a refused autoplay and finishes on)
  const hold = () => { for (const v of document.querySelectorAll('#plg-punch-vid, #plg-void-vid')) { try { if (v.playbackRate !== 0.33) v.playbackRate = 0.33; } catch (e) {} } };
  hold(); window.__holdIv = setInterval(hold, 50); });
// wait out an overlay's input grace (the candidate marks it with lx-cg-early; a build without it has nothing to wait for)
const graceOver = async (page, id) => { await waitFor(page, (id) => { const o = document.getElementById(id); return !o || !o.classList.contains('lx-cg-early'); }, id, 4000); await sleep(80); };
const vlog = (page) => page.evaluate(() => (window.__vlog || []).slice(0, 6));
const up = (page, id) => page.evaluate((id) => !!document.getElementById(id), id);
const card = (page) => page.evaluate(() => { const t = document.getElementById('plg-text'); return document.getElementById('prologue-cine') && t ? +t.dataset.i : -1; });
const skipShown = (page, id) => page.evaluate((id) => { const b = document.getElementById(id); return !!(b && b.offsetParent && getComputedStyle(b).display !== 'none'); }, id);
// R26B_SHOT=<dir> R26B_TAG=<before|after>: the potion stall with the chip, and the deck's Block button (phone)
const SHOT = process.env.R26B_SHOT || '', TAG = process.env.R26B_TAG || 'run';
const shot = async (page, name, clip) => { if (!SHOT) return; try { await page.evaluate(() => { document.documentElement.classList.remove('lx-nobackdrop'); }); await page.screenshot({ path: path.join(SHOT, 'r26b_' + name + '_' + TAG + '.png'), scale: 'css', timeout: 30000, ...(clip ? { clip } : {}) }); } catch (e) { console.log('  shot failed: ' + e.message.slice(0, 80)); } };
const waitFor = async (page, fn, arg, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn, arg)) return true; await sleep(100); } return false; };
try {
  const D = await boot(DESK), P = await boot(PHONE);
  // ---------------- [1] desktop: real keys through the knockdown film, the Void film and the three cards ----------------
  if (on('1')) {
    const d = D.page; await d.evaluate(async () => { await window._r.go('void', 400); });
    // keys already held when the film opens (a jump, a confirm), and fresh presses in its first moments - those go in with the film,
    // in the same task, because a busy machine can deliver a real key after the grace; real keys do everything after it
    await d.keyboard.down(' '); await d.keyboard.down('Enter');
    await strip(d); await d.evaluate(() => { for (const k of ['Enter', ' ', 'z', 'Escape']) window._r.kd(k); });
    await sleep(150); await d.keyboard.up(' '); await d.keyboard.up('Enter');
    for (const k of [' ', 'z', ' ']) await press(d, k, 70);
    ok('[1] desktop: held keys and Enter / Space / Z / Escape in the knockdown film\'s first moments do not skip it', await up(d, 'prologue-punch-cine'), await vlog(d));
    await graceOver(d, 'prologue-punch-cine');
    await press(d, ' '); await d.mouse.click(480, 300); await sleep(200);
    ok('[1] desktop: after the grace real Space and a click on the film body still do not skip it', await up(d, 'prologue-punch-cine'));
    const sk = await center(d, '#plg-punch-skip');
    ok('[1] desktop: its Skip button shows once the grace is over', !!sk && await skipShown(d, 'plg-punch-skip'));
    if (sk) await d.mouse.click(sk[0], sk[1]);
    const vUp = await d.evaluate(() => { const on = !!document.getElementById('prologue-void-cine'); window._r.kd('Enter'); window._r.kd('Escape'); return on; }); await sleep(150);
    ok('[1] desktop: the Skip button goes to the Void film; Enter / Escape in its first moments do nothing', vUp && await up(d, 'prologue-void-cine'));
    await graceOver(d, 'prologue-void-cine'); await press(d, 'Escape');
    const c0 = await d.evaluate(() => { const on = !!document.getElementById('prologue-cine'); window._r.kd(' '); window._r.kd('Enter'); return on; });
    ok('[1] desktop: Escape after the grace skips the Void film to the first card', c0 && !(await up(d, 'prologue-void-cine')));
    const i0 = await card(d); await graceOver(d, 'prologue-cine'); await press(d, ' '); const i1 = await d.evaluate(() => { const t = document.getElementById('plg-text'); const i = t ? +t.dataset.i : -1; window._r.kd('Enter'); return i; }); await sleep(100); const i1b = await card(d);
    ok('[1] desktop: a card ignores keys in its first moments, advances on a real key after them, and the next card has its own grace', i0 === 0 && i1 === 1 && i1b === 1, { i0, i1, i1b });
    await graceOver(d, 'prologue-cine'); await press(d, 'Enter'); await sleep(100); await graceOver(d, 'prologue-cine'); await d.mouse.click(480, 280); await sleep(300);
    ok('[1] desktop: the last cards advance on Enter / a click after their grace and the prologue finishes once', !(await up(d, 'prologue-cine')) && (await d.evaluate(() => window.__fin)) === 1, await d.evaluate(() => window.__fin));
  }
  // ---------------- [1] phone: real taps (a player still tapping skills when the timer ends) ----------------
  if (on('1')) {
    const p = P.page; await p.evaluate(async () => { await window._r.go('void', 400); });
    await strip(p); await p.evaluate(() => { const o = document.getElementById('prologue-punch-cine'); if (o) o.click(); });   // a tap landing as it opens
    const hidden = !(await skipShown(p, 'plg-punch-skip'));
    for (let i = 0; i < 2; i++) { await tapAt(p, 422 + i * 40, 200); await sleep(120); }
    ok('[1] phone: taps on the knockdown film in its first moments do not skip it, and its Skip button waits out the grace', hidden && await up(p, 'prologue-punch-cine'), { hidden });
    await graceOver(p, 'prologue-punch-cine'); await tapAt(p, 300, 250); await sleep(200);
    ok('[1] phone: a tap on the film body after the grace does not skip it either', await up(p, 'prologue-punch-cine'));
    const sk = await center(p, '#plg-punch-skip'); if (sk) await tapAt(p, sk[0], sk[1]);
    const vUp = await p.evaluate(() => { const o = document.getElementById('prologue-void-cine'); if (o) o.click(); return !!o; }); await sleep(150);
    ok('[1] phone: the Skip button skips it; the Void film ignores a tap in its first moments', !!sk && vUp && await up(p, 'prologue-void-cine'));
    await graceOver(p, 'prologue-void-cine'); const vs = await center(p, '#plg-void-skip'); if (vs) await tapAt(p, vs[0], vs[1]);
    const c0 = await p.evaluate(() => { const o = document.getElementById('prologue-cine'); if (o) o.click(); return !!o; }); await sleep(150); const i0 = await card(p);
    await graceOver(p, 'prologue-cine'); await tapAt(p, 422, 200); await sleep(150); const i1 = await card(p);
    ok('[1] phone: the first card ignores a tap in its first moments and advances on a real tap after them', c0 && i0 === 0 && i1 === 1, { c0, i0, i1 });
    for (let k = 0; k < 2; k++) { await graceOver(p, 'prologue-cine'); await tapAt(p, 422, 200); await sleep(150); }
    ok('[1] phone: the last cards advance on taps after their grace and the prologue finishes once', !(await up(p, 'prologue-cine')) && (await p.evaluate(() => window.__fin)) === 1, await p.evaluate(() => window.__fin));
    await p.evaluate(() => { const o = document.getElementById('prologue-cine'); if (o) o.remove(); window._prologueActive = false; });
  }
  // ---------------- [2] the first level-up chip ----------------
  if (on('2')) {
    const p = P.page;
    await p.evaluate(async () => { await window._r.go('town', 600); try { localStorage.removeItem('mojiworld_tip_first_levelup'); } catch (e) {} _firstLevelUpGuide(); });
    await sleep(600);
    const free = await p.evaluate(() => { const c = document.getElementById('first-lvlup-chip'), s = document.getElementById('stats'); if (!c) return null; const a = c.getBoundingClientRect(), b = s.getBoundingClientRect();
      const menu = [...document.querySelectorAll('#mobile-ctrl .mc-menu')].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect());
      const hit = (r) => a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top; return { stats: hit(b), menu: menu.some(hit), inView: a.left >= 0 && a.right <= innerWidth && a.top >= 0 }; });
    ok('[2] phone: the chip covers neither the stats plate nor the menu row', !!free && !free.stats && !free.menu && free.inView, free);
    await p.evaluate(() => { openShop('potion'); }); await sleep(900);
    const plus = await p.evaluate(() => { const row = document.querySelector('#shop-modal .shop-item'); const b = row && [...row.querySelectorAll('button')].find((x) => x.textContent.trim() === '+'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await shot(p, 'stall');
    const chipVis = await p.evaluate(() => { const c = document.getElementById('first-lvlup-chip'); return !!(c && c.getClientRects().length && getComputedStyle(c).display !== 'none'); });
    if (plus) await tapAt(p, plus[0], plus[1]); await sleep(600);
    const after = await p.evaluate(() => ({ shop: getComputedStyle(document.getElementById('shop-modal')).display !== 'none', lvup: !!(document.getElementById('attributes-modal') && getComputedStyle(document.getElementById('attributes-modal')).display !== 'none') }));
    ok('[2] phone: the chip hides under the potion stall and a tap on the first row\'s "+" stays in the shop (it opened LV UP)', !!plus && !chipVis && after.shop && !after.lvup, { plus, chipVis, after });
    await p.evaluate(() => window._r.clear());
    const d = D.page;
    await d.evaluate(async () => { await window._r.go('town', 600); try { localStorage.removeItem('mojiworld_tip_first_levelup'); } catch (e) {} const c = document.getElementById('first-lvlup-chip'); if (c) c.remove(); _firstLevelUpGuide(); });
    await sleep(600);
    const dk = await d.evaluate(() => { const c = document.getElementById('first-lvlup-chip'), s = document.getElementById('stats'); if (!c) return null; const a = c.getBoundingClientRect(), b = s.getBoundingClientRect(); return { stats: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top }; });
    await d.evaluate(() => { const n = (game.npcs || []).find((x) => x && x.name); openNPC(n); }); await sleep(900);
    const dl = await d.evaluate(() => { const c = document.getElementById('first-lvlup-chip'); const dg = document.getElementById('dialog'); return { dialog: !!(dg && getComputedStyle(dg).display !== 'none'), chip: !!(c && c.getClientRects().length && getComputedStyle(c).display !== 'none') }; });
    ok('[2] desktop: the chip clears the stats plate, and hides while a dialog is open', !!dk && !dk.stats && dl.dialog && !dl.chip, { dk, dl });
    await d.evaluate(() => { window._r.clear(); const c = document.getElementById('first-lvlup-chip'); if (c) c.remove(); });
  }
  // ---------------- [3] the Gelwater Grotto door's toast (a real Up press at the door in the Tidal Lagoon, Lv 9) ----------------
  if (on('3')) {
    const d = D.page;
    await d.evaluate(async () => { player.level = 8; game._bossWarned = {}; await window._r.go('tidalLagoon', 1250); player.x = 1307 - player.w / 2; player.y = 480 - player.h - 1; player.vx = 0;
      window.__toasts = []; const st0 = window.showToast; window.showToast = function (t) { window.__toasts.push(String(t)); return st0.apply(this, arguments); }; await window._r.sleep(500); });
    for (let k = 0; k < 5; k++) { await press(d, 'ArrowUp', 350); if (await waitFor(d, () => { const g = document.getElementById('dialog'); return (g && g.style.display === 'block') || window.__toasts.length > 0; }, null, 2500)) break;
      await d.evaluate(() => { game.paused = false; player.x = 1307 - player.w / 2; player.vx = 0; }); }
    await waitFor(d, () => { const g = document.getElementById('dialog'); return g && g.style.display === 'block' && /Recommended level: [0-9]+[+]/.test(g.textContent || ''); }, null, 12000); await sleep(300);
    const DR = await d.evaluate(() => ({ dlg: ((document.getElementById('dialog') || {}).textContent || '').replace(/\s+/g, ' ').match(/Recommended level: ([0-9]+)\+/), toast: window.__toasts.find((t) => /recommended/.test(t)) || null }));
    const tl = DR.toast && (DR.toast.match(/Lv ([0-9]+)\+ recommended/) || [])[1];
    ok('[3] the Gelwater Grotto door\'s toast names the dialog\'s level at Lv 8 (9+; it said 10+, and warned a Lv 9 hero too)', !!DR.dlg && tl === DR.dlg[1] && tl === '9', { lv: 8, dlg: DR.dlg && DR.dlg[1], toast: DR.toast });
    await d.evaluate(() => window._r.clear());
  }
  // ---------------- [4] + [5] the tracker: the navigator's map, 0/10, a full map ----------------
  const ACCEPT = (page) => page.evaluate(() => { const id = 'q_act1_firstword'; player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); player.quests.unlocked[id] = true;
    if (!acceptQuest(id, true)) player.quests.active[id] = { progress: 0, targetCount: 10 }; game.qnavPins = [id]; game.qnav = null; try { renderQuestTracker(); } catch (e) {} return !!player.quests.active[id]; });
  if (on('4') || on('5')) {
    const d = D.page; await d.evaluate(async () => { await window._r.go('town', 600); }); const acc = await ACCEPT(d); await sleep(400);
    const Q = await d.evaluate(() => { const id = 'q_act1_firstword', a = player.quests.active[id], g = _questGuidance(id, QUESTS[id], a), nd = _qnavDest(id);
      try { renderQuestTracker(); } catch (e) {} return { g: g && g.text, nav: nd && nd.map, navName: nd && _qtMapName(nd.map), why: _qnavWhy(id), dom: (document.getElementById('quest-tracker') || {}).textContent || '' }; });
    ok('[4] the tracker names the map the navigator (Journal + compass) picks for VI · The First Word of the Cycle', acc && !!Q.navName && (Q.g || '').includes(Q.navName) && Q.dom.includes(Q.navName), Q);
    ok('[4] an accepted quest with nothing done reads 0/10 (it said "not started")', / 0\/10$/.test(Q.why), Q.why);
    if (on('5')) {
      const F = await d.evaluate(async () => { const id = 'q_act1_firstword'; const maps = (_LX_QNAV.mob.sproutle || []).filter((m) => MAPS[m] && !MAPS[m].isTown && (MAPS[m].spawns || []).some((s) => s && s.type === 'sproutle'));
        const map = maps[0]; await window._r.go(map, 400); const other = (MAPS[map].spawns || []).map((s) => s && s.type).find((t) => t && t !== 'sproutle' && monsterTypes[t]) || 'slime';
        game.monsters = game.monsters.filter((m) => m && m.type !== 'sproutle'); const cap = _lxFieldCap(MAPS[map]);
        for (let i = 0; i < 40 && game.monsters.filter((x) => x && !x.isBoss && !x.isMiniBoss).length < cap; i++) spawnMonster(500 + i * 20, 200, other, false, false);
        game.monsters = game.monsters.filter((m) => m && m.type !== 'sproutle');
        const full = game.monsters.filter((x) => x && !x.isBoss && !x.isMiniBoss).length >= cap; const g = _questGuidance(id, QUESTS[id], player.quests.active[id]);
        game.monsters.length = 0; const g2 = _questGuidance(id, QUESTS[id], player.quests.active[id]);
        return { map, other, cap, full, g: g && g.text, empty: g2 && g2.text }; });
      ok('[5] none of the target up on a full map: "clear the map to bring more"; an empty map still says "more soon"', F.full && /clear the map to bring more/.test(F.g || '') && /none up, more soon/.test(F.empty || ''), F);
    }
  }
  // ---------------- [6] the phone's Block button and the tour's Block step ----------------
  if (on('6')) {
    const p = P.page; await p.evaluate(async () => { const c = document.getElementById('first-lvlup-chip'); if (c) c.remove(); await window._r.go('town', 600); });
    const B = await p.evaluate(async () => { const b = document.querySelector('#mobile-deck .mc-block'); const lab = b ? getComputedStyle(b, '::after').content : null;
      startTutorial(); _showTutorialModal(); const i = TUTORIAL_STEPS.findIndex((s) => s.detect === 'block'); _tutStep = i; TUTORIAL_STEPS[i]._done = false; _renderTutorialStep(); const tm = document.getElementById('tutorial-modal'); if (tm) tm.classList.remove('tut-ghost'); await window._r.sleep(600);
      const t = document.getElementById('tut-try'); return { lab, i, try: t ? t.textContent.replace(/\s+/g, ' ') : null, vis: !!(b && b.getClientRects().length && getComputedStyle(b).display !== 'none') }; });
    ok('[6] phone: the guard button carries a BLOCK caption', B.vis && /BLOCK/.test(B.lab || ''), B.lab);
    ok('[6] phone: the tour\'s Block step points at that button (top left)', /BLOCK/.test(B.try || '') && /top left/.test(B.try || ''), B.try);
    await shot(p, 'block_tour');
    const bc = await center(p, '#mobile-deck .mc-block'); if (bc) await tapAt(p, bc[0], bc[1]); await sleep(700);
    ok('[6] phone: a tap on it ticks the step', await p.evaluate((i) => !!TUTORIAL_STEPS[i]._done || _tutStep > i, B.i));
    await p.evaluate(() => { try { _closeTutorial(true); } catch (e) {} window._r.clear(); });
  }
  // ---------------- [P] polish: fresh tour steps; NPC plates clear the skill bar; the tracker yields over an NPC plate ----------------
  if (on('P')) {
    const d = D.page;
    const fr = await d.evaluate(() => ['attack', 'combo'].map((k) => !!(TUTORIAL_STEPS.find((s) => s.detect === k) || {}).fresh));
    ok('[P] the tour\'s Swing and Land-a-hit steps are fresh (the prologue fight ticked them before the practice snail)', fr[0] && fr[1], fr);
    // the Megamall: Nurse Joyce's and Barnaby's plates sat under the skill bar
    const NP = await d.evaluate(async () => { await window._r.go('everdawn_megamall', 500); const L = (game.npcs || []).filter((n) => n && n.name);
      const n = L.find((x) => x.name === 'Nurse Joyce') || L[0]; player.x = n.x - 60; player.vx = 0; game.paused = false; await window._r.sleep(900);
      const names = new Set(L.map((x) => _lxNpcDisplayName(x))); const hits = []; const ft = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, x, y) { if (names.has(t)) { const M = this.getTransform(); hits.push([t, M.a * x + M.e, M.d * y + M.f]); } return ft.apply(this, arguments); };
      for (let i = 0; i < 50 && hits.length < 6; i++) { game.paused = false; await window._r.sleep(100); } CanvasRenderingContext2D.prototype.fillText = ft;
      const cv = document.getElementById('game'), R = cv.getBoundingClientRect(), r = document.getElementById('skill-bar').getBoundingClientRect(), k = cv.width / R.width;
      const bar = [(r.left - R.left) * k, (r.right - R.left) * k, (r.top - R.top) * k];
      const under = hits.filter((h) => h[1] > bar[0] && h[1] < bar[1]); return { n: hits.length, under: under.length, bad: under.filter((h) => h[2] + 8 * (cv.width / W) > bar[2]).map((h) => h[0] + '@' + Math.round(h[2])).slice(0, 4), barTop: Math.round(bar[2]) }; });
    ok('[P] NPC name plates over the skill bar sit above it (Megamall)', NP.under > 0 && NP.bad.length === 0, NP);
    await ACCEPT(d);
    const TY = await d.evaluate(async () => { await window._r.go('town', 300); try { renderQuestTracker(); } catch (e) {} await window._r.sleep(600);
      const tk = document.getElementById('quest-tracker'); const tr = tk.getBoundingClientRect(); const cv = document.getElementById('game'), R = cv.getBoundingClientRect(), k = R.width / W;
      const wx = game.camera.x + (tr.left + tr.width / 2 - R.left) / k, wy = game.camera.y + (tr.top + tr.height / 2 - R.top) / k;
      // only the probe NPC on the map (the town's own could stand under the tracker at this camera), the hero far left of it
      const until = async (f, ms) => { const t = performance.now(); while (performance.now() - t < ms) { if (f()) return true; await window._r.sleep(100); } return false; };   // the hud-clear tick runs every 6th frame
      const yld = () => tk.classList.contains('lx-hud-yield');
      const keep = game.npcs.slice(), keepP = game.portals.slice(); game.npcs.length = 0; game.portals.length = 0; const off0 = await until(() => !yld(), 5000);
      const fake = { name: 'Probe Uncle', x: wx, y: wy - 58, w: 40, h: 60, color: '#ffcf6b' }; game.npcs.push(fake);
      const on1 = await until(yld, 5000); game.npcs.length = 0; const off1 = await until(() => !yld(), 5000);
      game.npcs.push(...keep); game.portals.push(...keepP);
      return { shown: tr.width > 0, off0, on1, off1 }; });
    ok('[P] the quest tracker yields (fades) over an NPC\'s name plate, and comes back when it is gone', TY.shown && TY.off0 && TY.on1 && TY.off1, TY);
  }
  // ---------------- [7] a phone is told its buttons, not keyboard keys ----------------
  if (on('7')) {
    const p = P.page; await p.evaluate(async () => { await window._r.go('everdawn_megamall', 500); });
    await ACCEPT(p);
    const K = await p.evaluate(async () => { const n = (game.npcs || []).find((x) => x && x.name === 'Nurse Joyce') || game.npcs[0]; player.x = n.x - 20; player.vx = 0; await window._r.sleep(1200);
      const seen = new Set(); const ft = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t) { seen.add(String(t)); return ft.apply(this, arguments); };
      for (let i = 0; i < 40 && !(seen.has('Talk') && seen.size > 3); i++) await window._r.sleep(100);   // the prompt fades in per drawn frame
      await window._r.sleep(400); CanvasRenderingContext2D.prototype.fillText = ft;
      const qk = document.querySelector('#qnav-key .qk-k'); const step = TUTORIAL_STEPS.find((s) => s.detect === 'quest');
      return { q: _questKeyLabel(), wave: seen.has(String.fromCodePoint(0x1F44B)), talk: seen.has('Talk'), n: seen.has('N'), badge: qk ? getComputedStyle(qk).display : 'none', chip: (() => { const c = document.getElementById('qnav-key'); return !!(c && c.getClientRects().length && getComputedStyle(c).display !== 'none'); })(), title: step && step.title }; });
    ok('[7] phone: the new-quest toasts say QUEST (they said "· Q")', K.q === 'QUEST', K.q);
    ok('[7] phone: the Talk pill shows the TALK button\'s wave, not N', K.talk && K.wave && !K.n, K);
    ok('[7] phone: the tour card is titled "Quests" (it said "Quests (Q)")', K.title === 'Quests', K.title);
    const CK = await p.evaluate(async () => { await window._r.go('town', 600); game._qnavOptOut = false; game.qnav = null; try { _qnavAutoTrack(); } catch (e) {}
      for (let i = 0; i < 50; i++) { await window._r.sleep(150); const c = document.getElementById('qnav-key'); if (c && c.getClientRects().length && getComputedStyle(c).display !== 'none') break; if (i % 10 === 9) { game.paused = false; try { _qnavAutoTrack(); } catch (e) {} } }
      const c = document.getElementById('qnav-key'), qk = c && c.querySelector('.qk-k'); return { chip: !!(c && c.getClientRects().length && getComputedStyle(c).display !== 'none'), badge: qk ? getComputedStyle(qk).display : null, txt: qk && qk.textContent, qnav: game.qnav, paused: game.paused, modal: (() => { try { return _anyOtherModalOpen(); } catch (e) { return 'x'; } })(), map: game.currentMap }; });
    ok('[7] phone: the compass chip shows no E badge (a phone has no E key)', CK.chip && CK.badge === 'none', CK);
    ok('[7] Lady Hong\'s needle says "Tap TALK" on a phone (the live key elsewhere)', SRC.includes("_lxKeyHint('talkNpc', 'TALK', true) + ' when the needle"));
    const dq = await D.page.evaluate(() => [_questKeyLabel(), (TUTORIAL_STEPS.find((s) => s.detect === 'quest') || {}).title]);
    ok('[7] desktop keeps its keys (Q, "Quests (Q)")', dq[0] === 'Q' && dq[1] === 'Quests (Q)', dq);
    const DH = await p.evaluate(async () => { window._r.clear(); player._god = false; player.invulnerable = 0; player.hp = 0; try { triggerDeath(); } catch (e) {} await window._r.sleep(900);
      const h = document.querySelector('#death-overlay .death-stage .hint'); return h ? h.textContent : null; });
    ok('[7] phone: the death screen says tap (it said "click the button")', /^tap /.test(DH || ''), DH);
  }
  // ---------------- [P] the class page's Back row sits inside its card (the new-game flow, 960x560 and 844x390) ----------------
  if (on('P')) {
    for (const [nm, opts] of [['desktop', DESK], ['phone', PHONE]]) {
      const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
      await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 }); await pg.waitForFunction(() => window._lxBootMenuSeen, null, { timeout: 240000 }); await sleep(1200);
      await pg.evaluate(() => document.getElementById('menu-newgame').click()); await sleep(1200);
      await pg.evaluate(() => { const i = document.getElementById('auth-user'); i.value = 'Probe'; i.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('auth-submit').click(); });
      await waitFor(pg, () => { const b = document.getElementById('cs-nav-next'); return !!(b && b.offsetParent); }, null, 20000);
      for (let k = 0; k < 6; k++) { await pg.evaluate(() => document.getElementById('cs-nav-next').click());
        if (await waitFor(pg, () => { const c = document.getElementById('cs-page-class'), b = document.getElementById('cs-nav-back'); return !!(c && getComputedStyle(c).display !== 'none' && b && getComputedStyle(b).visibility === 'visible'); }, null, 2500)) break; }
      await sleep(800);
      const C = await pg.evaluate(() => { const b = document.getElementById('cs-nav-back').getBoundingClientRect(), m = document.querySelector('.cs-epic').getBoundingClientRect(); return { back: Math.round(b.bottom), card: Math.round(m.bottom), vis: getComputedStyle(document.getElementById('cs-nav-back')).visibility }; });
      ok(`[P] ${nm}: the class page's Back button sits inside its card (it was clipped at its bottom edge)`, C.vis === 'visible' && C.back <= C.card - 2, C);
      await ctx.close();
    }
  }
  // ---------------- [8] (per user) the prologue's memory fight: only the fight on screen, HP / MP limitless; the HUD and the Lv 1 values after ----------------
  if (on('8')) {
    const HIDE_D = ['#top-ui', '#stats .bar', '#skill-bar', '#minimap', '#taxi-btn', '#hotkey-hint', '#combo-meter', '#mp-btn', '#map-label'];
    const HIDE_P = ['#top-ui', '#stats .bar', '#skill-bar', '#mobile-ctrl .mc-pots', '#mobile-ctrl .mc-menu', '#mobile-deck .mc-pot-dock', '#mobile-ctrl-toggle'];
    const KEEP_D = ['#prologue-hud'], KEEP_P = ['#prologue-hud', '#mobile-deck .mc-basic', '#mobile-deck .mc-skill', '#mobile-deck .mc-jump', '#mobile-deck .mc-block'];
    for (const [nm, opts, HIDE, KEEP] of [['desktop', DESK, HIDE_D, KEEP_D], ['phone', PHONE, HIDE_P, KEEP_P]]) {
      const X = await boot(opts, 1); const pg = X.page;
      const v0 = await pg.evaluate(async () => { try { applyClass('mage'); } catch (e) {} player.cls = 'mage'; await window._r.go('void', 400); return { lv: player.level, hp: player.hp, mp: player.mp, maxHp: getMaxHp(), maxMp: getMaxMp() }; });
      // the real memory: the apex segment from the stanzas' end - the entrance clip (skipped by its own button) - the fight
      await pg.evaluate(() => { window._prologueActive = true; _prologueApexSegment(); });
      await waitFor(pg, () => { const s = document.getElementById('grav-entry-skip'); if (s && s.offsetParent) s.click(); const b = document.getElementById('boss-intro-skip'); if (b && b.offsetParent) b.click(); return !!window._prologueTimer && !/cinematic/.test(document.body.className); }, null, 40000);
      // the arena's boss card can still come up over the first seconds of the fight: skip it until the scene has been clear for a second
      { let clear = 0; for (let i = 0; i < 60 && clear < 8; i++) { const c = await pg.evaluate(() => { const o = document.getElementById('boss-intro-overlay'); if (o && o.classList.contains('on')) { try { _dismissBossIntro(); } catch (e) {} return false; } return !/cinematic/.test(document.body.className) && !(document.getElementById('boss-intro-overlay') || { classList: { contains: () => false } }).classList.contains('on'); }); clear = c ? clear + 1 : 0; await sleep(150); } }
      // the arena's art streamed in (a shot during the load reads dark), and what the canvas draws over the fight card: no boss HP bar
      await pg.evaluate(() => { window.__plgPin = setInterval(() => { if (window._prologueTimer) window._prologueLeftMs = Math.max(window._prologueLeftMs, 26000); }, 300); });   // the memory waits for the test
      await waitFor(pg, () => { const o = document.getElementById('boss-intro-overlay'); if (o && o.classList.contains('on')) { try { _dismissBossIntro(); } catch (e) {} } return !(window._lxSpriteTotal > 0) || (window._lxSpriteDone || 0) >= window._lxSpriteTotal; }, null, 25000);
      const BB = await pg.evaluate(async () => { const o = document.getElementById('boss-intro-overlay'); if (o && o.classList.contains('on')) { try { _dismissBossIntro(); } catch (e) {} }
        let bar = 0; const ft = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t) { if (/HYPER BOSS|[0-9.]+[KMB]? [/] [0-9.]+[KMB]?/.test(String(t))) bar++; return ft.apply(this, arguments); };
        let calls = 0, ops = 0, inBar = false; const P2 = CanvasRenderingContext2D.prototype, keep = {}; for (const k of ['drawImage', 'fillRect', 'fill', 'stroke', 'fillText']) { keep[k] = P2[k]; P2[k] = function () { if (inBar) ops++; return keep[k].apply(this, arguments); }; }
        const sb = window.drawSuperBossBar; window.drawSuperBossBar = function () { calls++; inBar = true; try { return sb.apply(this, arguments); } finally { inBar = false; } };
        await window._r.sleep(1200); window.drawSuperBossBar = sb; for (const k in keep) P2[k] = keep[k]; CanvasRenderingContext2D.prototype.fillText = ft;
        let lum = null; try { const cv = document.getElementById('game'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data; let t = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { t += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; } lum = Math.round(t / n); } catch (e) {}
        const coach = document.getElementById('prologue-coach'); return { bar, calls, ops, lum, coachVis: coach ? getComputedStyle(coach).visibility : 'none', loaded: (window._lxSpriteDone || 0) + '/' + (window._lxSpriteTotal || 0) }; });
      ok(`[8] ${nm}: no boss HP bar is drawn over the fight card (the card carries his WILL; his nameplate stays)`, BB.calls > 0 && BB.ops === 0 && BB.bar === 0 && BB.coachVis !== 'hidden', BB);
      await sleep(300);
      const vis = (sels) => pg.evaluate((sels) => sels.map((s) => { const L = [...document.querySelectorAll(s)]; return [s, L.length ? L.some((e) => { if (!e.getClientRects().length) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; }) : null]; }), sels);
      const H = await vis(HIDE), K = await vis(KEEP);
      if (SHOT) { try { await pg.screenshot({ path: path.join(SHOT, 'r26b_prologue_hud_' + TAG + (nm === 'phone' ? '_phone' : '') + '.png'), scale: 'css', timeout: 30000 }); } catch (e) {} }
      ok(`[8] ${nm}: in the memory fight the stats plate (HP / MP), skill bar and the other HUD are hidden`, H.every((h) => h[1] === false || h[1] === null) && H.filter((h) => h[1] === false).length >= 4, H);
      ok(`[8] ${nm}: the fight card${nm === 'phone' ? ', the deck\'s attack / skill / jump / block buttons' : ' and Guguma'} stay`, K.every((k) => k[1] === true), K);
      // every skill of the apex kit, cast again and again from 0 MP: never refused for MP, MP and HP stay full
      const M = await pg.evaluate(async () => {
        let fails = 0; const fc = window._failCue; window._failCue = function () { fails++; return fc && fc.apply(this, arguments); };
        const kit = Object.keys(SKILLS).filter((id) => { const s = SKILLS[id]; return s && s.cls === player.cls && (!s.job || s.job === player.job) && (!s.master || s.master === player.master) && (s.mp | 0) > 0; });
        let cast = 0, refused = [];
        for (let r = 0; r < 3; r++) for (const id of kit) { player.mp = 0; player.skillCooldowns[id] = 0; player._castLockUntil = 0; game.hitStop = 0;
          const ready = isReady(id); if (!ready) { refused.push(id); continue; } castSkill(id); if ((player.skillCooldowns[id] || 0) > 0) cast++; await window._r.sleep(30); }
        window._failCue = fc; await window._r.sleep(600);
        const hps = []; for (let i = 0; i < 10; i++) { hps.push(player.hp >= getMaxHp() && player.mp >= getMaxMp()); await window._r.sleep(150); }
        return { kit: kit.length, cast, refused: refused.slice(0, 5), fails, full: hps.every(Boolean), god: !!player._god };
      });
      ok(`[8] ${nm}: every MP skill cast from 0 MP, three times over, is never refused for MP; HP and MP stay full`, M.kit > 0 && M.refused.length === 0 && M.fails === 0 && M.cast >= M.kit && M.full, M);
      // the strip brings the HUD back with the films; a finish (or a skip) restores the real Lv 1 hero
      const S = await pg.evaluate(() => { clearInterval(window.__plgPin); _prologueStrip(); return document.body.classList.contains('lx-prologue-fight'); });
      await pg.evaluate(() => { try { if (typeof _lxPlgForceFinish === 'function') _lxPlgForceFinish('test'); else _prologueFinish(true); } catch (e) {} for (const id of ['prologue-punch-cine', 'prologue-void-cine', 'prologue-cine']) { const o = document.getElementById(id); if (o) o.remove(); } });
      await sleep(1200);
      const A = await pg.evaluate(() => ({ cls: document.body.classList.contains('lx-prologue-fight'), lv: player.level, hp: player.hp, mp: player.mp, maxHp: getMaxHp(), maxMp: getMaxMp(), plate: getComputedStyle(document.getElementById('top-ui')).visibility, bar: getComputedStyle(document.getElementById('skill-bar')).visibility }));
      ok(`[8] ${nm}: the strip brings the HUD back; after the memory the hero is the real Lv ${v0.lv} again (HP / MP not carried over)`, !S && !A.cls && A.plate !== 'hidden' && A.bar !== 'hidden' && A.lv === v0.lv && A.maxMp === v0.maxMp && A.mp <= A.maxMp && A.hp <= A.maxHp && A.mp === v0.mp, { S, A, v0 });
      await X.ctx.close();
    }
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { ok('harness: ' + String(e && e.stack || e).slice(0, 400), false); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
