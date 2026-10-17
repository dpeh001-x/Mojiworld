// RELEASE 27b (the audio / settings / accessibility hunter round) stays fixed. Desktop 960x560 with real keys and clicks, plus a
// touch phone at 844x390:
//   [1] Screen Flashes 0% (the slider, clicked) removes the storm sky blink on stormCrest; Reduce Motion caps it (<= 0.12) and 50%
//       halves it; _lxFlashA rules the Gravitos supernova; the DOM flashes read --lx-flash-k (0 at 0%)
//   [2] the Settings switches: focusable, role="switch", aria-label, aria-checked in sync; Space / Enter flip them; a focus ring
//   [3] Settings takes focus on open, Tab / Shift+Tab never leave it (the minimap button behind it is never reached), Esc gives
//       focus back to the gear; the pause card traps Tab too
//   [4] colourblind rarity on ground drops, equipped-slot borders, loot toasts and the forge stripe; god has its own shade in both
//   [5] after a rebind: the pause card's Hotkeys key (none when unbound), the tour's Guguma line + step title, the Mute and MP
//       tooltips and the Meteor Sigil toast name the live key
//   [6] Tab is refused by the K panel (it keeps waiting); with an old save's Tab binding, Tab navigates an open panel instead of
//       opening the MojiDex; a bound Alt has its browser default prevented (keydown + keyup)
//   [7] the save note (Save Backup tooltip + footer line) is there and true: the save holds difficulty + keybinds, not volume
//   [8] after the Gravitos arena films the town track is not left playing at 0; going back to town plays it at its level
//   [P] phone: a tap flips a switch once (aria in sync), the footer note is hidden, the tour title keeps the phone wording
//   node release27b_test.mjs   PORT (default 15775) / SERVE_ROOT / ONLY=desktop,audio,phone / R27B_SHOT=<prefix> (colourblind shots)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15775), FILE = 'mojiworld_game.html';
const SHOT = process.env.R27B_SHOT || '';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 600) + ']' : '')); };
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
console.log('server pid ' + server.pid);
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
try { console.log('browser pid ' + browser.process().pid); } catch (e) {}
const errs = [];
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const PROF = { desktop: { viewport: { width: 960, height: 560 }, deviceScaleFactor: 1 },
  iphone: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: IOS } };
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const AUDIO_HOOK = () => {
  window.__AUD = new Set(); const P = HTMLMediaElement.prototype, op = P.play;
  P.play = function () { try { window.__AUD.add(this); } catch (e) {} return op.apply(this, arguments); };
};
async function ctxFor(prof) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...PROF[prof] });
  await ctx.addInitScript(AUDIO_HOOK);
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('lx_drs', 'off'); } } catch (e) {} });
  const page = await ctx.newPage(); page._prof = prof; page._touch = prof !== 'desktop';
  page.on('pageerror', (e) => errs.push(prof + ': ' + String(e.message).slice(0, 160)));
  return page;
}
async function gotoMenu(page) {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
}
// a hero in the world without the title (direct boot, as the release suites do)
async function bootDirect(page, cls, lv, map) {
  await gotoMenu(page);
  if (page._prof === 'desktop') console.log('  build', await ev(page, () => (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?')));
  await ev(page, async ({ cls, lv, map }) => { const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    applyClass(cls); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sl(1000); devSetLevel(lv); await sl(300); player.hp = getMaxHp(); player._god = true; player.invulnerable = 9e9;
    try { closeAllModals(); } catch (e) {} loadMap(map, 600); await sl(2200); try { closeAllModals(); } catch (e) {}
    try { const tm = document.getElementById('tutorial-modal'); if (tm && getComputedStyle(tm).display !== 'none') _closeTutorial(true); } catch (e) {} game.paused = false;
    window.__r = (el) => { if (typeof el === 'string') el = document.querySelector(el); if (!el || !el.getClientRects().length) return null; const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
    window.__fi = () => { const a = document.activeElement; return a ? { id: a.id || '', tag: a.tagName, cls: String(a.className || '').slice(0, 30), inS: !!a.closest('#settings-modal-bg'), inP: !!a.closest('#lx-pause') } : null; };
  }, { cls, lv, map });
  for (let i = 0; i < 3; i++) { const r = await ev(page, () => { const m = document.getElementById('advancement-modal'); return (m && getComputedStyle(m).display !== 'none') ? __r(m.querySelector('.class-card')) : null; });
    if (!r) break; await page.mouse.click(r.x, r.y); await sleep(800); const y = await ev(page, () => __r('#confirm-yes')); if (y) { await page.mouse.click(y.x, y.y); await sleep(800); } }
  await ev(page, () => { try { closeAllModals(); } catch (e) {} game.paused = false; });
}
const tapOrClick = async (p, sel) => { const r = await ev(p, (s) => { const el = document.querySelector(s); if (el && el.closest('#settings-modal')) { try { el.scrollIntoView({ block: 'center' }); } catch (e) {} } return __r(s); }, sel); if (!r) return false; if (p._touch) await p.touchscreen.tap(r.x, r.y); else await p.mouse.click(r.x, r.y); return true; };
const openSettings = async (p) => { await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; }); await sleep(200); await tapOrClick(p, '#settings-btn'); await sleep(400); };
const closeSettings = async (p) => { await p.keyboard.press('Escape'); await sleep(350); };
// Tab until a control with this id has the focus (real key presses), max n
async function tabTo(p, id, n = 60) { for (let i = 0; i < n; i++) { if ((await ev(p, () => document.activeElement && document.activeElement.id)) === id) return true; await p.keyboard.press('Tab'); await sleep(40); } return false; }
// set a range slider by clicking it at a fraction of its width (a real click)
async function clickSlider(p, id, frac) { const r = await ev(p, (id) => __r('#' + id), id); await p.mouse.click(r.l + Math.max(1, (r.r - r.l) * frac), r.y); await sleep(150); }
// the storm sky blink over `ms`: strikes forced every 900 ms; returns the brightest full-screen pale-blue fill's alpha + count
const stormBlink = (p, ms) => ev(p, async (ms) => {
  game.monsters.length = 0;
  const C = CanvasRenderingContext2D.prototype, oF = C.fillRect; let n = 0, maxA = 0;
  C.fillRect = function (x, y, w, h) { try { if (w >= 900 && h >= 500) { const m = /^rgba\(220, 235, 255, ([0-9.]+)\)$/.exec(String(this.fillStyle)); if (m) { n++; maxA = Math.max(maxA, +m[1] * this.globalAlpha); } } } catch (e) {} return oF.apply(this, arguments); };
  const t0 = performance.now(); let strikes = 0;
  while (performance.now() - t0 < ms) { if ((game._lightningCD || 0) > 0 && (performance.now() - t0) > strikes * 900) { game._lightningCD = 0; strikes++; } await new Promise((r) => setTimeout(r, 30)); }
  C.fillRect = oF;
  return { n, maxA: +maxA.toFixed(3), strikes, arcs: !!(game.mapData && game.mapData.lightningArcs) };
}, ms);
async function desktopFlashes(p) {
  await ev(p, () => loadMap('stormCrest', 300)); await sleep(2500);
  await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  const full = await stormBlink(p, 5000);
  ok('[1] control: at Screen Flashes 100% the storm on stormCrest blinks (forced strikes)', full.arcs && full.n > 0 && full.maxA > 0.2, full);
  await openSettings(p);
  await clickSlider(p, 'set-flash', 0); await closeSettings(p);
  const z = await ev(p, () => ({ mul: game._flashMul, k: getComputedStyle(document.documentElement).getPropertyValue('--lx-flash-k').trim() }));
  const zero = await stormBlink(p, 5000);
  ok('[1] Screen Flashes 0% (slider clicked to its left end): no full-screen sky blink at all', z.mul === 0 && zero.strikes > 2 && zero.n === 0, { z, zero });
  const dom = await ev(p, () => { const o = document.getElementById('boss-intro-overlay'); let f = null, mine = false;
    if (o) { const d = document.createElement('div'); d.className = 'bi-flash'; o.appendChild(d); f = getComputedStyle(d).filter; d.remove(); }
    else { const w = document.createElement('div'); w.id = 'boss-intro-overlay'; w.style.display = 'none'; const d = document.createElement('div'); d.className = 'bi-flash'; w.appendChild(d); document.body.appendChild(w); f = getComputedStyle(d).filter; w.remove(); mine = true; }
    return { f, mine, sn: (typeof _lxFlashA === 'function') ? _lxFlashA(1, 0.2) : null }; });
  ok('[1] the DOM flashes and the Gravitos supernova follow it: boss intro .bi-flash filter opacity(0), _lxFlashA -> 0', dom.f === 'opacity(0)' && dom.sn === 0, dom);
  await openSettings(p); await clickSlider(p, 'set-flash', 0.999);
  await tapOrClick(p, '#set-reducemotion'); await sleep(150); await closeSettings(p);
  const rm = await stormBlink(p, 5000);
  const rmK = await ev(p, () => ({ rm: game._reduceMotion, mul: game._flashMul, sn: (typeof _lxFlashA === 'function') ? +_lxFlashA(1, 0.2).toFixed(3) : null }));
  ok('[1] Reduce Motion (clicked) caps the sky blink: fill alpha <= 0.12, still drawn; supernova capped at 0.2', rmK.rm && rmK.mul === 1 && rm.n > 0 && rm.maxA <= 0.12 && rmK.sn === 0.2, { rm, rmK });
  await openSettings(p); await tapOrClick(p, '#set-reducemotion'); await sleep(150); await clickSlider(p, 'set-flash', 0.5); await closeSettings(p);
  const half = await stormBlink(p, 5000); const hm = await ev(p, () => game._flashMul);
  ok('[1] Screen Flashes ~50%: the blink scales with it (max alpha ~ 0.30 x the slider)', half.n > 0 && Math.abs(half.maxA - 0.3025 * hm) < 0.03, { half, hm });
  await openSettings(p); await clickSlider(p, 'set-flash', 0.999); await closeSettings(p);
}
async function desktopFocus(p) {
  await ev(p, () => loadMap('town', 300)); await sleep(2000);
  await openSettings(p);   // a real click on the gear: the gear has the focus before the panel opens
  const f0 = await ev(p, () => __fi());
  ok('[3] opening Settings puts the focus on its first control (not <body>)', !!(f0 && f0.inS), f0);
  const seq = [];
  for (let i = 0; i < 70; i++) { await p.keyboard.press('Tab'); await sleep(25); seq.push(await ev(p, () => __fi())); }
  const out = seq.filter((f) => !f || !f.inS);
  const ids = [...new Set(seq.map((f) => f && f.id).filter(Boolean))];
  const sw = await ev(p, () => [...document.querySelectorAll('#settings-modal .toggle')].filter((t) => t.getClientRects().length).map((t) => t.id));
  ok('[3] 70 Tab presses never leave Settings (the HUD behind it, #minimap-min included, is never reached)', out.length === 0, { out: out.slice(0, 4), n: seq.length });
  ok('[2] Tab reaches every Settings switch that is shown', sw.filter((id) => !/debug/.test(id)).every((id) => ids.includes(id)), { missing: sw.filter((id) => !ids.includes(id)) });
  const back = [];
  for (let i = 0; i < 6; i++) { await p.keyboard.press('Shift+Tab'); await sleep(25); back.push(await ev(p, () => __fi())); }
  ok('[3] Shift+Tab walks back inside it too', back.every((f) => f && f.inS), back.filter((f) => !f || !f.inS));
  const reach = await tabTo(p, 'set-mute');
  const a0 = await ev(p, () => { const t = document.getElementById('set-mute'); const cs = getComputedStyle(t);
    return { role: t.getAttribute('role'), ti: t.tabIndex, label: t.getAttribute('aria-label'), aria: t.getAttribute('aria-checked'), on: t.classList.contains('on'), ring: cs.outlineStyle + ' ' + cs.outlineWidth, fv: t.matches(':focus-visible') }; });
  ok('[2] the Mute switch: tabindex 0, role="switch", aria-label from its row, aria-checked matches, a visible focus ring', reach && a0.role === 'switch' && a0.ti === 0 && /Mute All Audio/.test(a0.label || '') && a0.aria === String(a0.on) && a0.fv && /solid 3px/.test(a0.ring), a0);
  await p.keyboard.press('Space'); await sleep(300);
  const a1 = await ev(p, () => ({ on: document.getElementById('set-mute').classList.contains('on'), aria: document.getElementById('set-mute').getAttribute('aria-checked'), muted: !!(audio && audio.muted), saved: _lxGetSettings().mute }));
  await p.keyboard.press('Enter'); await sleep(300);
  const a2 = await ev(p, () => ({ on: document.getElementById('set-mute').classList.contains('on'), aria: document.getElementById('set-mute').getAttribute('aria-checked'), muted: !!(audio && audio.muted), open: document.getElementById('settings-modal-bg').classList.contains('on') }));
  ok('[2] Space flips the focused switch (mute on, saved, aria-checked "true"), Enter flips it back', reach && a1.on && a1.aria === 'true' && a1.muted && a1.saved && !a2.on && a2.aria === 'false' && !a2.muted && a2.open, { a1, a2 });
  // the Reduce Motion switch by keyboard, then a reset of the defaults keeps aria in step
  const rmR = await tabTo(p, 'set-reducemotion'); await p.keyboard.press('Space'); await sleep(250);
  const rm1 = await ev(p, () => ({ rm: game._reduceMotion, aria: document.getElementById('set-reducemotion').getAttribute('aria-checked') }));
  await ev(p, () => { try { _lxSettingsToUi({ ..._lxGetSettings(), reduceMotion: false }); applySettingsLive(); } catch (e) {} }); await sleep(200);
  const rm2 = await ev(p, () => ({ rm: game._reduceMotion, aria: document.getElementById('set-reducemotion').getAttribute('aria-checked') }));
  ok('[2] Reduce Motion by keyboard; a programmatic change (the controls refilled) keeps aria-checked in step', rmR && rm1.rm && rm1.aria === 'true' && !rm2.rm && rm2.aria === 'false', { rm1, rm2 });
  await closeSettings(p);
  const f1 = await ev(p, () => ({ fi: __fi(), open: document.getElementById('settings-modal-bg').classList.contains('on') }));
  ok('[3] Esc closes Settings and the focus goes back to the gear that opened it', !f1.open && f1.fi && f1.fi.id === 'settings-btn', f1);
  const mm0 = await ev(p, () => { const m = document.getElementById('minimap-min'); return m ? (document.getElementById('minimap') || {}).className || 'mm' : null; });
  // the pause card: Esc opens it on a fresh screen; Tab stays on its buttons
  await ev(p, () => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); game.paused = false; }); await sleep(200);
  await p.keyboard.press('Escape'); await sleep(500);
  const pseq = []; for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); await sleep(25); pseq.push(await ev(p, () => __fi())); }
  ok('[3] the pause card: 12 Tab presses stay on its buttons', !!(await ev(p, () => document.getElementById('lx-pause'))) && pseq.every((f) => f && f.inP), pseq.filter((f) => !f || !f.inP).slice(0, 3));
  await p.keyboard.press('Escape'); await sleep(300);
  await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  void mm0;
}
const RARS = ['common', 'rare', 'epic', 'legendary', 'god'];
// ground drops of every rarity in a row by the hero; the arc colours drawDrops paints for each; a shot of the row
async function dropsRead(p, shotName) {
  const r = await ev(p, async (RARS) => {
    game.monsters.length = 0; game.drops = game.drops || []; game.drops.length = 0; player.vx = 0; game.keys = {};
    const mk = (rar, i) => { let it = null; try { it = rollItemDrop(8, 90, 'weapon'); } catch (e) {} if (!it) it = { id: 'x_' + rar, name: 'Test ' + rar, icon: 'x', slot: 'weapon', cat: 'weapon' };
      return { type: 'item', item: { ...it, rarity: rar, uid: 'r27b' + rar + i }, x: player.x + 110 + i * 56, y: player.y + 10, vx: 0, vy: 0, life: 99999, age: 0, onGround: true, w: 20, h: 20 }; };
    const out = {};
    const C = CanvasRenderingContext2D.prototype, oArc = C.arc, od = window.drawDrops;
    for (let i = 0; i < RARS.length; i++) {
      game.drops.length = 0; game.drops.push(mk(RARS[i], i)); const cols = new Set();
      window.drawDrops = function () { C.arc = function () { try { cols.add(String(this.fillStyle).toLowerCase()); } catch (e) {} return oArc.apply(this, arguments); }; try { return od.apply(this, arguments); } finally { C.arc = oArc; } };
      await new Promise((r) => setTimeout(r, 350)); window.drawDrops = od; out[RARS[i]] = [...cols].filter((c) => /^#[0-9a-f]{6}$/.test(c));
    }
    game.drops.length = 0; RARS.forEach((r, i) => game.drops.push(mk(r, i)));
    const cv = document.getElementById('game'), b = cv.getBoundingClientRect(), k = b.width / cv.width;
    out._clip = { x: Math.max(0, b.left + (player.x + 70 - game.camera.x) * k), y: Math.max(0, b.top + (player.y - 60 - (game.camera.y || 0)) * k), width: 330 * k, height: 130 * k };
    return out;
  }, RARS);
  await sleep(500);
  if (SHOT && shotName) try { await p.screenshot({ path: SHOT + shotName + '.png', clip: r._clip, timeout: 20000 }); } catch (e) {}
  await ev(p, () => { game.drops.length = 0; });
  return r;
}
// the equipped-slot borders in the U panel, one rarity per slot; a shot of the slot column
async function slotsRead(p, shotName) {
  const r = await ev(p, async (RARS) => {
    const out = {};
    const put = (plan) => { for (const [k, rar] of plan) { let it = null; try { it = rollItemDrop(8, 90, k); } catch (e) {} if (!it) it = { id: 'x_' + k, name: 'Test ' + k, icon: 'x', slot: k, cat: k }; player.equipped[k] = { ...it, slot: k, rarity: rar, uid: 'r27bs' + k + rar }; }
      try { invalidateEquipBonusCache(); } catch (e) {} try { renderInventory(''); } catch (e) { out.err = String(e).slice(0, 80); }
      for (const [k, rar] of plan) { const el = document.getElementById('eq-' + k); out[rar] = el ? getComputedStyle(el).borderTopColor : 'no slot'; } };
    put([['weapon', 'rare'], ['armor', 'common'], ['accessory', 'god']]);
    put([['weapon', 'legendary'], ['armor', 'epic'], ['accessory', 'god']]);   // left on for the shot
    return out;
  }, RARS);
  if (SHOT && shotName) {
    await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; }); await sleep(200);
    await p.keyboard.press('u'); await sleep(700);
    await tapOrClick(p, '[data-utab="items"]'); await sleep(700);
    const clip = await ev(p, () => { const s = [...document.querySelectorAll('.equip-slot')].filter((e) => e.getClientRects().length); if (!s.length) return null;
      const bs = s.map((e) => e.getBoundingClientRect()); const l = Math.min(...bs.map((b) => b.left)), t = Math.min(...bs.map((b) => b.top)), rr = Math.max(...bs.map((b) => b.right)), bb = Math.max(...bs.map((b) => b.bottom));
      return { x: Math.max(0, l - 8), y: Math.max(0, t - 8), width: rr - l + 16, height: bb - t + 16 }; });
    if (clip) try { await p.screenshot({ path: SHOT + shotName + '.png', clip, timeout: 20000 }); } catch (e) {}
    await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  }
  return r;
}
async function desktopColour(p) {
  await ev(p, () => loadMap('forest', 300)); await sleep(2500);
  await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  const d0 = await dropsRead(p, 'drops_off'), s0 = await slotsRead(p, 'slots_off');
  ok('[4] standard palette: a god drop and a god slot have their own gold (not common grey)', d0.god.includes('#ffe27a') && !d0.god.includes('#cccccc') && s0.god === 'rgb(255, 226, 122)', { god: d0.god, slot: s0.god });
  await openSettings(p); await tapOrClick(p, '#set-cbrarity'); await sleep(200); await closeSettings(p);
  const cb = await ev(p, () => ({ g: !!game._cbRarity, body: document.body.classList.contains('cb-rarity') }));
  const d1 = await dropsRead(p, 'drops_on'), s1 = await slotsRead(p, 'slots_on');
  ok('[4] colourblind on (clicked): ground drops use the Okabe-Ito shades (rare #56b4e9, epic #cc79a7, legendary #f0e442, god white)', cb.g && cb.body && d1.rare.includes('#56b4e9') && d1.epic.includes('#cc79a7') && d1.legendary.includes('#f0e442') && d1.god.includes('#ffffff'), { cb, d1 });
  ok('[4] colourblind on: the equipped-slot borders follow (legendary rgb(240, 228, 66), epic rgb(204, 121, 167), god white)', s1.legendary === 'rgb(240, 228, 66)' && s1.epic === 'rgb(204, 121, 167)' && s1.rare === 'rgb(86, 180, 233)' && s1.god === 'rgb(255, 255, 255)', s1);
  const dom = await ev(p, () => { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('data-rarity', 'legendary'); (document.getElementById('toast-container') || document.body).appendChild(t);
    const acc = getComputedStyle(t).getPropertyValue('--tc-accent').trim(); t.remove();
    const sm = document.getElementById('shop-modal'); let sh = null; const nb = document.documentElement.classList.contains('lx-nobackdrop'); document.documentElement.classList.remove('lx-nobackdrop');   // perf mode strips every box-shadow
    if (sm) { const w = document.createElement('div'); w.className = 'modal gear-forge'; w.innerHTML = '<div class="shop-item rarity-epic"></div>'; sm.appendChild(w); sh = getComputedStyle(w.firstChild).boxShadow; w.remove(); } if (nb) document.documentElement.classList.add('lx-nobackdrop');
    return { acc, sh }; });
  ok('[4] colourblind on: the legendary loot toast accent and the forge\'s epic stripe follow', dom.acc === '#f0e442' && /204, 121, 167/.test(dom.sh || ''), dom);
  await openSettings(p); await tapOrClick(p, '#set-cbrarity'); await sleep(200); await closeSettings(p);
}
// the tour card on a given step (found by its Guguma line / title), docked and shown
const tourAt = (p, pick) => ev(p, async (pick) => {
  try { startTutorial(); } catch (e) {} try { _showTutorialModal(); } catch (e) {}
  const i = TUTORIAL_STEPS.findIndex((s) => (pick === 'menus' ? /U is your build/.test(s.gugumaLine || '') : pick === 'block' ? /Tap A right/.test(s.gugumaLine || '') : /^Quests/.test(s.title || '')));
  _tutStep = i; _renderTutorialStep(); await new Promise((r) => setTimeout(r, 250));
  const g = document.getElementById('tut-guguma-line'), t = document.getElementById('tut-step-title');
  return { i, line: g ? g.textContent : null, title: t ? t.textContent : null };
}, pick);
async function desktopHints(p) {
  await ev(p, () => loadMap('town', 300)); await sleep(2000);
  await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  // rebinds (swap semantics, as the K panel does them)
  const K = await ev(p, () => { _lxBindReset && _lxBindReset(); _kbAssign('characterK', 'j'); _kbAssign('attributesU', 'o'); _kbAssign('codex', 'h'); _kbAssign('questJournal', 'p');
    _kbAssign('block', 'g'); _kbAssign('mute', 'f8'); _kbAssign('skill:b', 't'); applyKeybinds();
    const k = (id) => _kbDisplay(_lxFnKey(id)); return { ck: k('characterK'), u: k('attributesU'), y: k('codex'), q: k('questJournal'), a: k('block'), m: k('mute'), b: k('skill:b'), gsig: k('skill:x') }; });
  await p.keyboard.press('Escape'); await sleep(500);
  const pk = await ev(p, () => { const b = [...document.querySelectorAll('#lx-pause .lxp-btn')].find((x) => x.dataset.a === 'keys'); const kb = b && b.querySelector('kbd'); return kb ? kb.textContent : (b ? '' : null); });
  await p.keyboard.press('Escape'); await sleep(300);
  await ev(p, () => { _kbUnbind('characterK'); applyKeybinds(); game.paused = false; }); await sleep(100);
  await p.keyboard.press('Escape'); await sleep(500);
  const pk2 = await ev(p, () => { const b = [...document.querySelectorAll('#lx-pause .lxp-btn')].find((x) => x.dataset.a === 'keys'); return b ? (b.querySelector('kbd') ? b.querySelector('kbd').textContent : '') : null; });
  await p.keyboard.press('Escape'); await sleep(300);
  ok('[5] the pause card\'s Hotkeys & Skills row names the live key (J), and none once it is unbound', pk === K.ck && pk2 === '', { pk, pk2, K });
  await ev(p, () => { _kbAssign('characterK', 'j'); applyKeybinds(); });
  const m1 = await tourAt(p, 'menus'), b1 = await tourAt(p, 'block'), q1 = await tourAt(p, 'quests');
  ok('[5] the tour says the live keys: "' + K.u + ' is your build, ' + K.y + ' the MojiDex, ' + K.q + ' is your quests", "Tap ' + K.a + ' right before it hits", "Quests (' + K.q + ')"',
    (m1.line || '').includes(K.u + ' is your build, ' + K.y + ' the MojiDex, ' + K.q + ' is your quests') && (b1.line || '').includes('Tap ' + K.a + ' right') && (q1.title || '').includes('Quests (' + K.q + ')'), { m1, b1, q1 });
  await ev(p, () => { try { _closeTutorial(true); } catch (e) {} try { closeAllModals(); } catch (e) {} game.paused = false; });
  await openSettings(p); await closeSettings(p);
  const tt = await ev(p, () => { const lb = document.getElementById('set-mute').closest('.settings-row').querySelector('label'); const mp = [...document.querySelectorAll('.bar[title]')].find((b) => /Mana Points/.test(b.title));
    return { mute: lb.title, mp: mp ? mp.title : null }; });
  ok('[5] tooltips: Mute "Same as the ' + K.m + ' hotkey", MP "basic attack (Z) and block (' + K.a + ')" with the live slot keys', tt.mute.includes('Same as the ' + K.m + ' hotkey') && (tt.mp || '').includes('block (' + K.a + ')') && (tt.mp || '').includes(', ' + K.gsig + ' slots)'), tt);
  const toast = await ev(p, () => { const seen = []; const st = window.showToast; window.showToast = (t, r) => { seen.push(String(t)); };
    try { player._sageUntilFr = 0; SKILL_FNS.sage_ult(); } catch (e) { seen.push('ERR ' + String(e).slice(0, 80)); } window.showToast = st; player._sageUntilFr = 0; return seen.filter((t) => /METEOR/.test(t)); });
  ok('[5] the Meteor Sigil toast says "tap ' + K.b + ' (x10)"', toast.length === 1 && toast[0].includes('tap ' + K.b + ' (x10)'), toast);
  // [6] Tab refused by the K panel while it waits; an old save's Tab binding does not fire under an open panel; Alt
  await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; }); await sleep(150);
  await p.keyboard.press('j'); await sleep(500);
  const kOpen = await ev(p, () => { const m = document.getElementById('keybind-modal'); return !!(m && m.style.display === 'flex'); });
  const seenT = []; await ev(p, () => { window.__toasts = []; const st = window.showToast; window.__st = st; window.showToast = function (t, r) { window.__toasts.push(String(t)); return st.apply(this, arguments); }; _kbStartCapture('mojidex'); });
  await p.keyboard.press('Tab'); await sleep(250);
  const kt = await ev(p, () => ({ cap: _kbCapture, key: _lxFnKey('mojidex'), toasts: window.__toasts.slice() }));
  await p.keyboard.press('Escape'); await sleep(200);
  await ev(p, () => { window.showToast = window.__st; });
  ok('[6] the K panel refuses Tab while waiting for a key: still waiting, the Compendium keeps L, a "Tab moves between menu buttons" toast', kOpen && kt.cap === 'mojidex' && kt.key === 'l' && kt.toasts.some((t) => /Tab moves between menu buttons/.test(t)), { kOpen, kt, seenT });
  await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; _lxBindStore('mojidex', 'tab'); applyKeybinds(); }); await sleep(150);
  await openSettings(p);
  const t0 = await ev(p, () => __fi()); await p.keyboard.press('Tab'); await sleep(350);
  const t1 = await ev(p, () => ({ fi: __fi(), mojidex: (() => { const m = document.getElementById('mojidex-modal'); return !!(m && getComputedStyle(m).display !== 'none' && m.offsetWidth > 0); })(), bound: _lxFnKey('mojidex') }));
  ok('[6] a save with the Compendium on Tab: Tab inside open Settings moves the focus and does not open the Compendium', t1.bound === 'tab' && !t1.mojidex && t1.fi && t1.fi.inS && JSON.stringify(t0) !== JSON.stringify(t1.fi), { t0, t1 });
  await closeSettings(p);
  await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; _kbAssign('mojidex', 'l'); _kbAssign('attributesU', 'alt'); applyKeybinds();
    window.__alt = []; const f = (e) => { if (e.key === 'Alt') window.__alt.push(e.type + ':' + e.defaultPrevented); }; window.addEventListener('keydown', f); window.addEventListener('keyup', f); });
  await p.keyboard.press('Alt'); await sleep(400);
  const alt = await ev(p, () => ({ ev: window.__alt.slice(), u: (() => { const m = document.getElementById('attributes-modal'); return !!(m && getComputedStyle(m).display !== 'none'); })() }));
  ok('[6] Character on Alt: Alt opens it and its browser default (the menu bar) is prevented on keydown and keyup', alt.u && alt.ev.includes('keydown:true') && alt.ev.includes('keyup:true'), alt);
  await ev(p, () => { try { closeAllModals(); } catch (e) {} game.paused = false; _lxBindReset && _lxBindReset(); applyKeybinds(); });
}
async function desktopSaveNote(p) {
  await openSettings(p);
  const n = await ev(p, () => { const lb = document.querySelector('#settings-modal .settings-row.hardsave label'), nt = document.getElementById('set-savenote'), ac = document.querySelector('#settings-modal .actions');
    const bs = [...ac.querySelectorAll('button')].map((b) => b.getBoundingClientRect()), nb = nt ? nt.getBoundingClientRect() : null;
    const over = nb ? bs.some((b) => nb.left < b.right && b.left < nb.right && nb.top < b.bottom && b.top < nb.bottom) : null;
    const m = document.getElementById('settings-modal').getBoundingClientRect();
    return { tip: lb ? lb.title : '', note: nt ? nt.textContent : null, shown: !!(nb && nb.width > 20), over, oneRow: bs.every((b) => Math.abs(b.top - bs[0].top) < 2), btnH: Math.max(...bs.map((b) => b.height)), inside: m.bottom <= innerHeight + 1 }; });
  ok('[7] the save note: the Save Backup tooltip and a footer line say what travels with a save, the footer keeps its buttons on one row', /carries your progress, your difficulty and your keyboard keybinds/.test(n.tip) && /travel with your save/.test(n.note || '') && n.shown && n.over === false && n.oneRow && n.btnH < 44, n);
  await closeSettings(p);
  const truth = await ev(p, () => { try { _flushSaveStateNow(); } catch (e) {} const raw = localStorage.getItem(SAVE_KEY) || ''; let sv = null; try { sv = JSON.parse(raw); } catch (e) {}
    const pl = sv && (sv.player || sv.p || null); const st = JSON.parse(localStorage.getItem('LX_SETTINGS') || '{}');
    return { diff: !!(pl && 'difficulty' in pl), keys: !!(pl && pl.keybinds && pl.actionBinds), vol: /"bgm"\s*:|"flashPct"|"reduceMotion"|"cbRarity"/.test(raw), setVol: 'bgm' in st }; });
  ok('[7] ...and it is true: the save holds difficulty + keyboard keybinds and no volume / accessibility setting (those are LX_SETTINGS)', truth.diff && truth.keys && !truth.vol && truth.setVol, truth);
}
// [8] a real Continue into town, then the Gravitos arena for the first time (both films), then back to town
async function audioRun() {
  const p = await ctxFor('desktop');
  await bootDirect(p, 'warrior', 90, 'town');
  await ev(p, () => { player._gravitosCineSeen = true; try { const ov = document.getElementById('everdawn-welcome-overlay'); if (ov) ov.remove(); } catch (e) {} saveState(); try { _flushSaveStateNow(); } catch (e) {} });
  await sleep(400);
  await gotoMenu(p); await sleep(800);
  await p.waitForSelector('#menu-continue', { state: 'visible', timeout: 120000 }); await p.click('#menu-continue');
  await p.waitForFunction(() => typeof _lxHeroInWorld === 'function' && _lxHeroInWorld(), null, { timeout: 120000 }); await sleep(2500);
  const snap = () => ev(p, () => [...window.__AUD].filter((e) => e.tagName === 'AUDIO' && e.loop).map((e) => ({ s: decodeURIComponent((e.currentSrc || '').split('/').pop()), v: +e.volume.toFixed(3), on: !e.paused })));
  const t0 = await snap();
  await ev(p, () => { player._gravitosCineSeen = false; player._god = true; player.invulnerable = 9e9; game.monsters.length = 0; loadMap('gravitosArena', 300); });
  await p.waitForFunction(() => !game._gravitosCinePlaying, null, { timeout: 90000 }).catch(() => {});
  await sleep(6000);
  const a = await snap(), stuck = a.filter((x) => x.on && x.v < 0.01);
  ok('[8] after the arena films no music bed is left playing at volume 0 (the town track was, beside The Singularity)', a.some((x) => x.on && /Singularity/.test(x.s)) && stuck.length === 0, { a, stuck, t0: t0.filter((x) => x.on) });
  await ev(p, () => { game.monsters.length = 0; loadMap('town', 300); }); await sleep(5000);
  const b = await snap(), town = b.find((x) => /bgm_mojiworld/.test(x.s));
  ok('[8] ...and back in town its track plays again at its level', !!(town && town.on && town.v > 0.2), b);
  await p.context().close();
}
async function phoneRun() {
  const p = await ctxFor('iphone');
  await bootDirect(p, 'warrior', 30, 'town');
  await openSettings(p);
  const before = await ev(p, () => { const t = document.getElementById('set-cbrarity'); return { on: t.classList.contains('on'), aria: t.getAttribute('aria-checked'), role: t.getAttribute('role') }; });
  await tapOrClick(p, '#set-cbrarity'); await sleep(350);
  const after = await ev(p, () => { const t = document.getElementById('set-cbrarity'); return { on: t.classList.contains('on'), aria: t.getAttribute('aria-checked'), g: !!game._cbRarity }; });
  const note = await ev(p, () => { const n = document.getElementById('set-savenote'); return n ? getComputedStyle(n).display : 'none'; });
  ok('[P] phone: one tap flips the colourblind switch once, aria-checked follows; the footer note is hidden', before.role === 'switch' && after.on === !before.on && after.aria === String(after.on) && after.g === after.on && note === 'none', { before, after, note });
  await tapOrClick(p, '#set-cbrarity'); await sleep(200);
  await tapOrClick(p, '#settings-modal .close'); await sleep(300);
  const q = await tourAt(p, 'quests'), m = await tourAt(p, 'menus');
  ok('[P] phone: the tour keeps the phone wording ("Quests", the LV UP line)', q.title && /Quests$/.test(q.title.trim()) && /LV UP is your build/.test(m.line || ''), { q, m });
  await p.context().close();
}
try {
  if (on('desktop')) {
    const p = await ctxFor('desktop');
    await bootDirect(p, 'mage', 60, 'town');
    for (const [n, f] of [['flashes', desktopFlashes], ['focus', desktopFocus], ['colour', desktopColour], ['hints', desktopHints], ['savenote', desktopSaveNote]]) {
      if (process.env.SUB && !process.env.SUB.split(',').includes(n)) continue;
      try { await f(p); } catch (e) { ok('[' + n + '] ran', false, String(e.stack || e).slice(0, 400)); }
    }
    await p.context().close();
  }
  if (on('audio')) { try { await audioRun(); } catch (e) { ok('[8] ran', false, String(e.stack || e).slice(0, 400)); } }
  if (on('phone')) { try { await phoneRun(); } catch (e) { ok('[P] ran', false, String(e.stack || e).slice(0, 400)); } }
  ok('no page errors', errs.length === 0, errs.slice(0, 5));
} finally {
  try { await browser.close(); } catch (e) {}
  try { server.kill(); } catch (e) {}
}
console.log(`\n${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
