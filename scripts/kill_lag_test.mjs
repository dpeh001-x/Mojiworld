// A KILL FRAME LAYS THE PAGE OUT ONCE (per user: "a very slight lag after each enemy is killed. it's more noticeable when
// multiple enemies are killed at once"). Each kill frame used to force two to four extra layouts mid-frame: the mastery
// bar's reflow, the XP / coin pill's check against the quest tracker, every new toast's dodge check, and the minimap's
// visibility test. Those reads now wait for the frame to be drawn; the quest tracker rebuilds once per frame's kills.
//   [1] a one-kill and a six-kill sweep, killed inside a game frame, read no layout (offsetWidth / getBoundingClientRect /
//       getClientRects / getComputedStyle) during the kill code or the rest of that frame's script
//   [2] the HUD still answers: the mastery bar shows (and pops on a star-up), one merged "+XP" pill, the tracker counts all six
//   [3] the XP / coin pill still moves clear of the quest tracker once the frame is drawn
//   [4] a toast still dodges an open panel
//   [5] the minimap stops drawing while hidden and draws again when shown
//   node scripts/kill_lag_test.mjs      PORT / MOJI_SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15412);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 400) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio', '--no-sandbox'] });
const errs = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _killMonsterRaw === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3500);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
    const frame = () => new Promise((z) => requestAnimationFrame(() => z()));
    for (const i of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(i); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); player.level = 30; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS || {})) player._storyBeatsSeen[k] = true;
    try { _stopTutGhostWatch(); } catch (e) {}
    loadMap('forest', 300); await sleep(2500); try { closeAllModals(); } catch (e) {} game.paused = false; player.invulnerable = 1e9;
    _ensureQuests();
    const QID = '__kill_lag_probe';
    QUESTS[QID] = { id: QID, name: 'Snail Census', kind: 'kill', target: 'snail', count: 9999, giver: 'Nobody', levelReq: 1 };
    player.quests.active[QID] = { progress: 0, targetCount: 9999 }; game.qnavPins = [QID]; renderQuestTracker();
    const clearMobs = () => { for (let i = game.monsters.length - 1; i >= 0; i--) if (game.monsters[i] && !game.monsters[i].isBoss) game.monsters.splice(i, 1); };
    // count layout reads while armed (prototype getters / methods, so every caller is seen)
    const C = { n: 0, who: {} }; let armed = false;
    const tap = (proto, name, kind) => { const d = Object.getOwnPropertyDescriptor(proto, name); if (!d) return;
      const f = kind === 'get' ? d.get : d.value; const w = function () { if (armed) { C.n++; const k = (new Error().stack.split('\n')[2] || '').trim().split(' ')[1] || '?'; C.who[name + '<' + k] = (C.who[name + '<' + k] || 0) + 1; } return f.apply(this, arguments); };
      Object.defineProperty(proto, name, kind === 'get' ? { ...d, get: w } : { ...d, value: w }); };
    tap(HTMLElement.prototype, 'offsetWidth', 'get'); tap(HTMLElement.prototype, 'offsetHeight', 'get'); tap(HTMLElement.prototype, 'offsetParent', 'get');
    tap(Element.prototype, 'getBoundingClientRect', 'fn'); tap(Element.prototype, 'getClientRects', 'fn'); tap(window, 'getComputedStyle', 'fn');
    const L0 = window.loop;
    window.loop = function () {
      const ks = window.__killNext;
      if (ks) { window.__killNext = null; armed = true;
        try { for (const m of ks) { try { hitMonster(m, (m.currentHp | 0) + 99999, false, 'basic'); } catch (e) {} } if (typeof drawMinimap === 'function') drawMinimap(); } finally { armed = false; window.__killDone = true; } }
      return L0.apply(this, arguments);
    };
    const sweep = async (K) => {
      clearMobs(); const mobs = [];
      for (let i = 0; i < K; i++) { spawnMonster(player.x + 140 + i * 36, player.y - 30, 'snail', false, false); mobs.push(game.monsters[game.monsters.length - 1]); }
      await sleep(1200); const p0 = player.quests.active[QID].progress | 0, k0 = game.kills | 0;
      C.n = 0; C.who = {};
      // the kills land inside the game's own frame, ahead of its step and draw, the way a hit lands in play; the count covers
      // the kill code and that frame's minimap draw (a pass of the minimap is forced, as one in four frames draw it)
      window.__killNext = mobs; window.__killDone = false;
      for (let i = 0; i < 200 && !window.__killDone; i++) await frame();
      const reads = C.n, who = C.who; await frame(); await frame(); await frame();
      const bar = document.getElementById('mastery-bar'), pills = document.querySelectorAll('#coin-toast-zone .coin-toast-kill');
      return { K, reads, who, kills: (game.kills | 0) - k0, prog: (player.quests.active[QID].progress | 0) - p0,
        tracker: (document.getElementById('quest-tracker').innerText.match(/(\d[\d,]*)\s*\/\s*9,?999/) || [])[1], barShown: !!(bar && bar.classList.contains('mb-show') && bar.style.display === 'block'), pills: pills.length };
    };
    const out = {};
    out.warm = await sweep(1); out.warm2 = await sweep(1);   // two warm kills: the session's first combo pop copies its CSS once (v0.30.1232), by design
    // a hidden mastery bar comes back with its pop-in
    { const b = document.getElementById('mastery-bar'); b.classList.remove('mb-show', 'mb-pop'); b.style.display = 'none'; }
    for (const el of document.querySelectorAll('#coin-toast-zone .coin-toast')) el.remove();
    out.one = await sweep(1);
    await sleep(500); for (const el of document.querySelectorAll('#coin-toast-zone .coin-toast')) el.remove();
    out.six = await sweep(6);
    // star-up: the 100th kill of a type pops the bar
    player.mastery = player.mastery || {}; player.mastery.snail = 99;
    out.star = await sweep(1); out.star.pop = document.getElementById('mastery-bar').classList.contains('mb-pop');
    // [3] the pill zone vs the tracker, once the frame is drawn
    await sleep(400);
    const rc = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
    const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    out.zone = { pills: [...document.querySelectorAll('#coin-toast-zone .coin-toast')].map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }), qt: rc('quest-tracker') };
    out.zone.clear = out.zone.pills.length > 0 && out.zone.pills.every((p) => !hit(p, out.zone.qt));
    // [4] a toast dodges an open panel
    try { toggleModal('inventory-modal', () => { try { renderInventory(); } catch (e) {} }); } catch (e) {}
    await frame(); await frame(); showToast('Dodge probe ' + Date.now(), 'rare');
    for (let i = 0; i < 60 && !/lx-dodge/.test(document.getElementById('toast-container').className); i++) await sleep(20);   // the panel's own fade-in may need the 400 ms watch
    { const h = document.getElementById('toast-container'), im = document.getElementById('inventory-modal'); out.dodge = { cls: h.className, toasts: h.querySelectorAll('.toast').length, inv: im && im.style.display, wait: (typeof _lxToastWait !== 'undefined') ? _lxToastWait.length : -1 }; }
    try { closeAllModals(); } catch (e) {} game.paused = false;
    // [5] the minimap: hidden -> no drawing; shown -> drawing again
    const mm = document.getElementById('minimap-canvas'), host = mm && (mm.closest('#minimap') || mm);
    const draws = async () => { let n = 0; const c = game._mmCtx || mm.getContext('2d'); const o = c.clearRect; c.clearRect = function () { n++; return o.apply(this, arguments); }; await sleep(700); c.clearRect = o; return n; };
    out.mm = { shown0: await draws() }; host.style.display = 'none'; await frame(); await frame(); out.mm.hidden = await draws(); host.style.display = ''; await frame(); await frame(); out.mm.shown1 = await draws();
    return out;
  });
  console.log(JSON.stringify(R).slice(0, 1500));
  ok('[1] one kill: no layout read in the kill frame\'s script', R.one.reads === 0 && R.one.kills === 1, { reads: R.one.reads, who: R.one.who });
  ok('[1] six kills at once: no layout read in the kill frame\'s script', R.six.reads === 0 && R.six.kills === 6, { reads: R.six.reads, who: R.six.who });
  ok('[2] the mastery bar comes back from hidden and shows', R.one.barShown, R.one);
  ok('[2] a star-up still pops the bar', R.star.barShown && R.star.pop, R.star);
  ok('[2] the six kills make ONE "+XP" pill', R.six.pills === 1, R.six.pills);
  ok('[2] the quest counts all six, and the tracker shows the new total', R.six.prog === 6 && R.six.tracker != null && +String(R.six.tracker).replace(/,/g, '') >= 8, { prog: R.six.prog, tracker: R.six.tracker });
  ok('[3] the "+XP" / coin pills sit clear of the quest tracker once the frame is drawn', R.zone.clear, R.zone);
  ok('[4] a toast still dodges an open panel', /lx-dodge/.test(R.dodge.cls), R.dodge);
  ok('[5] the minimap draws when shown, stops when hidden, and draws again when shown', R.mm.shown0 > 3 && R.mm.hidden === 0 && R.mm.shown1 > 3, R.mm);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e && e.message).slice(0, 300), false); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
