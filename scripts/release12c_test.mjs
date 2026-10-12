// RELEASE 12c (bug hunt round 12, decided by the user) stays fixed:
//   1 "Play in portrait anyway": every panel (U, bag, world map, quests, MojiDex, shop, NPC dialog) fills the phone's screen
//     at a readable size (text ~11 px, was 3-4 px), its card inside the screen, the corner X on top and closing it; the game
//     box does not move; landscape phones and desktops keep the old in-box panels; turning the phone sideways restores them
//   2 Sharp Display is ON on a touch tablet (DPR >= 2, short side >= 768) - per user, "sharp on for all iPads": a value an
//     older build saved is ignored there, an unrelated settings save keeps it unset, switching it OFF now is saved with the
//     sharpSet marker and stays OFF; phones and desktops keep the old default and their saved values; the DPR cap holds,
//     the governor and the High emergency floor still ease it (the floor stops at 1)
//   node scripts/release12c_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 11987), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const require = createRequire(path.join(SERVE_ROOT, 'package.json'));
const { chromium } = require('playwright-core');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';   // iPadOS Safari
const phone = (w, h) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: IPHONE });
const tablet = (w, h) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IPAD });
// init: prologue seen, the rotate nag dismissed ("Play in portrait anyway"), and the resolution governor off unless asked for
const newPage = async (opts, init) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript((init) => { try {
    localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('_mobile_nagDismissed', '1');
    if (sessionStorage.getItem('t_drs') === 'on') localStorage.removeItem('lx_drs'); else localStorage.setItem('lx_drs', 'off');
    if (init && init.settings && !sessionStorage.getItem('t_seeded')) { sessionStorage.setItem('t_seeded', '1'); localStorage.setItem('LX_SETTINGS', JSON.stringify(init.settings)); }
  } catch (e) {} }, init || null);
  return { ctx, page };
};
const boot = async (page, reload) => {
  if (reload) await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }); else await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    player._tutorialSeen = true; window._prologueAfterCreation = false;
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player._gravitosCineSeen = true; player.invulnerable = 1e12; player.level = 20;
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    loadMap('town'); await new Promise((r) => setTimeout(r, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove(); game.paused = false;
  });
  await page.waitForTimeout(800);
};
const R = (r) => r && [r.left, r.top, r.width, r.height].map((v) => Math.round(v));
const boxes = (page) => page.evaluate(() => { const w = document.querySelector('.game-wrapper').getBoundingClientRect(), c = document.getElementById('game').getBoundingClientRect(); return [w.left, w.top, w.width, w.height, c.left, c.top, c.width, c.height].map((v) => Math.round(v)); });
// the open panel: its root, card, text size (median by characters, screen px), the corner X
const panel = (page) => page.evaluate(() => {
  const vis = (e) => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  const root = [...document.querySelectorAll('.game-wrapper > .modal-overlay:not(#tutorial-modal), #dialog')].find(vis); if (!root) return null;
  const sizes = []; const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = tw.nextNode())) { const t = n.textContent.trim(), el = n.parentElement; if (t.length < 2 || !vis(el) || !el.offsetWidth) continue; const k = el.getBoundingClientRect().width / el.offsetWidth; sizes.push([parseFloat(getComputedStyle(el).fontSize) * k, t.length]); }
  sizes.sort((a, b) => a[0] - b[0]); const tot = sizes.reduce((a, s) => a + s[1], 0); let acc = 0, med = 0; for (const s of sizes) { acc += s[1]; if (acc >= tot / 2) { med = s[0]; break; } }
  const card = root.id === 'dialog' ? root : (root.querySelector(':scope > .modal') || root), r = root.getBoundingClientRect(), cr = card.getBoundingClientRect();
  const x = document.getElementById('mc-modal-close'), xr = vis(x) ? x.getBoundingClientRect() : null;
  const xHit = !!(xr && (() => { const e = document.elementFromPoint(xr.left + xr.width / 2, xr.top + xr.height / 2); return e === x || x.contains(e); })());
  const scrolls = root.scrollHeight > root.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(root).overflowY);
  return { id: root.id, root: [r.left, r.top, r.right, r.bottom].map(Math.round), card: [cr.left, cr.top, cr.right, cr.bottom].map(Math.round), med: +med.toFixed(1), xHit, xr: xr && [Math.round(xr.left + xr.width / 2), Math.round(xr.top + xr.height / 2)], scrolls, vw: innerWidth, vh: innerHeight, ptf: document.body.classList.contains('lx-ptf') };
});
const shut = (page) => page.evaluate(() => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} });
const OPEN = {
  u: (p) => p.tap('.mc-menu[data-mkey="u"]'), bag: (p) => p.tap('.mc-menu[data-utab-target="items"]'), map: (p) => p.tap('.mc-menu[data-mkey="w"]'),
  quests: (p) => p.tap('.mc-menu[data-mkey="q"]'), mojidex: (p) => p.tap('.mc-menu[data-mkey="y"]'),
  shop: (p) => p.evaluate(() => openShop('potion', {})), dialog: (p) => p.evaluate(() => openNPC(game.npcs.find((x) => /milo/i.test(x.name)) || game.npcs[0])),
};
try {
  // ---- 1: portrait anyway, 390x844 then 430x932
  for (const [w, h, list] of [[390, 844, Object.keys(OPEN)], [430, 932, ['u', 'map', 'dialog']]]) {
    const { ctx, page } = await newPage(phone(w, h)); await boot(page);
    const nag = await page.evaluate(() => ({ nag: document.body.classList.contains('nag-portrait'), portrait: document.body.classList.contains('mc-portrait') }));
    const box0 = await boxes(page); const res = {};
    for (const name of list) {
      await shut(page); await page.waitForTimeout(400);
      await OPEN[name](page).catch((e) => errs.push('open ' + name + ': ' + e.message.slice(0, 80))); await page.waitForTimeout(1500);
      const P = await panel(page), box1 = await boxes(page);
      let closed = null;
      if (P && P.xr) { await page.touchscreen.tap(P.xr[0], P.xr[1]); await page.waitForTimeout(600); closed = !(await panel(page)); }
      const clip = await page.evaluate(() => getComputedStyle(document.querySelector('.game-wrapper')).overflow);
      const full = P && (P.id === 'dialog' ? (Math.abs(P.root[0]) <= 1 && Math.abs(P.root[2] - P.vw) <= 1 && Math.abs(P.root[3] - P.vh) <= 1)
        : (Math.abs(P.root[0]) <= 1 && Math.abs(P.root[1]) <= 1 && Math.abs(P.root[2] - P.vw) <= 1 && Math.abs(P.root[3] - P.vh) <= 1));
      const inside = P && P.card[0] >= -1 && P.card[2] <= P.vw + 1 && (P.card[3] <= P.vh + 1 || P.scrolls);
      res[name] = { ok: !!(full && inside && P.med >= 10 && P.xHit && closed && JSON.stringify(box1) === JSON.stringify(box0) && clip === 'hidden'), P, closed, boxMoved: JSON.stringify(box1) !== JSON.stringify(box0), clip };
    }
    const bad = Object.entries(res).filter(([, v]) => !v.ok);
    ok(`1. ${w}x${h} portrait anyway: ${list.join(', ')} fill the screen, card on screen (or scrolling), text >= 10 px, the X closes, game box still`, !nag.nag && nag.portrait && bad.length === 0, bad.length ? Object.fromEntries(bad) : Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.P.med])));
    if (w === 390) {
      const sh = await page.evaluate(() => ({ sharp: _LX_SHARP, dpr: _LX_DPR }));
      ok('2. a phone keeps Sharp Display off by default (DPR 1)', sh.sharp === false && sh.dpr === 1, sh);
      // turned sideways with the U panel open: back to the in-box panel
      await OPEN.u(page); await page.waitForTimeout(1200);
      await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(1500);
      const side = await page.evaluate(() => { const o = document.getElementById('attributes-modal').getBoundingClientRect(), wr = document.querySelector('.game-wrapper').getBoundingClientRect();
        return { ptf: document.body.classList.contains('lx-ptf'), d: Math.max(...[o.left - wr.left, o.top - wr.top, o.width - wr.width, o.height - wr.height].map(Math.abs)) }; });
      ok('1. turned sideways with a panel open, it goes back inside the game box (portrait mode off)', !side.ptf && side.d <= 1.5, side);
    }
    await ctx.close();
  }
  // ---- 1 + 2: landscape phone and desktop keep the old in-box panels and their sharpness
  for (const [tag, opts] of [['844x390 phone', phone(844, 390)], ['1280x720 desktop', { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 }]]) {
    const { ctx, page } = await newPage(opts); await boot(page);
    await page.evaluate(() => toggleSharedModal('attributes-modal', 'lp', openLevelUpPanel)); await page.waitForTimeout(1200);
    const L = await page.evaluate(() => { const o = document.getElementById('attributes-modal').getBoundingClientRect(), wr = document.querySelector('.game-wrapper').getBoundingClientRect();
      return { ptf: document.body.classList.contains('lx-ptf'), d: Math.max(...[o.left - wr.left, o.top - wr.top, o.width - wr.width, o.height - wr.height].map(Math.abs)), clip: getComputedStyle(document.querySelector('.game-wrapper')).overflow, sharp: _LX_SHARP, dpr: _LX_DPR }; });
    ok(`1. ${tag}: panels stay inside the game box as before`, !L.ptf && L.d <= 3 && L.clip === 'hidden', L);
    if (tag.includes('desktop')) ok('2. a desktop keeps Sharp Display off by default (DPR 2 as before)', L.sharp === false && L.dpr === 2, L);
    await ctx.close();
  }
  // ---- 2: tablets
  const per = (page) => page.evaluate(() => { const c = document.getElementById('game'), r = c.getBoundingClientRect(); return { sharp: _LX_SHARP, dpr: +_LX_DPR.toFixed(3), per: +(c.width / r.width).toFixed(3), fit: +_lxFitScale().toFixed(3), stored: (JSON.parse(localStorage.getItem('LX_SETTINGS') || '{}') || {}).sharp, mark: (JSON.parse(localStorage.getItem('LX_SETTINGS') || '{}') || {}).sharpSet }; });
  const shown = (page) => page.evaluate(() => { openSettingsModal(); const on = document.getElementById('set-sharp').classList.contains('on'); try { closeSettingsModal(); } catch (e) {} return on; });
  {
    const { ctx, page } = await newPage(tablet(820, 1180)); await boot(page);
    const a = await per(page), aShown = await shown(page);
    ok('2. iPad 820x1180 (never set): Sharp Display is ON, the switch shows it, >= 1.5 store px per CSS px, DPR <= min(DPR, 2) x fit', a.sharp === true && aShown && a.per >= 1.5 && a.dpr <= 2 * a.fit + 0.01, { a, aShown });
    await page.evaluate(() => { const b = document.getElementById('set-bgm'); b.value = String(Math.max(0, (parseInt(b.value, 10) || 50) - 10)); applySettingsLive(); });
    const b = await per(page);
    await boot(page, true); const b2 = await per(page);
    ok('2. ...a volume change saves the switch as still unset, and after a reload it is still ON', b.stored === null && b2.sharp === true && b2.per >= 1.5, { b, b2 });
    // the governor (Medium) and the High emergency floor still ease it; the floor stops at the old scale 1
    await page.evaluate(() => sessionStorage.setItem('t_drs', 'on')); await boot(page, true);
    const g = await page.evaluate(() => {
      const t = performance.now(), before = _LX_DPR;
      Object.assign(LX_DRS, { emerg: false, emergProbe: null, emergUseless: false, emergSince: 0, emergGraceUntil: 0, emergSeenMap: game.currentMap });
      LX_PERF.veryLowFx = true; LX_PERF.avgFrame = 60; _lxDrsEmergencyTick(t); _lxDrsEmergencyTick(t + 3000); const emerg = _LX_DPR;
      LX_DRS.emergProbe = null; LX_DRS.emerg = true; LX_DRS.lastChange = -1e9; _lxDrsEmergencyTick(t + 20000); const floor = _LX_DPR;
      LX_DRS.emerg = false; LX_DRS.emergProbe = null; _lxApplyRenderScale(_lxTargetDpr()); const back = _LX_DPR;
      const q0 = LX_GFX.quality; LX_GFX.quality = 'medium';
      Object.assign(LX_DRS, { active: false, _map: game.currentMap, graceUntil: 0, lastChange: -1e9 }); LX_PERF.slowFrames = 20; LX_PERF.avgFrame = 40;
      _lxDrsTick(0, t + 40000); const gov = _LX_DPR; LX_GFX.quality = q0; LX_DRS.active = false; _lxApplyRenderScale(_lxTargetDpr());
      return { before: +before.toFixed(3), emerg, floor, back: +back.toFixed(3), gov: +gov.toFixed(3) };
    });
    ok('2. ...the High emergency floor eases it to 1 (no lower), the Medium governor steps it down a quarter', g.before >= 1.5 && g.emerg === 1 && g.floor === 1 && Math.abs(g.back - g.before) < 0.01 && g.gov <= g.before - 0.2 && g.gov >= 1, g);
    await page.evaluate(() => sessionStorage.removeItem('t_drs'));
    // an explicit OFF, through the switch
    await page.evaluate(() => { openSettingsModal(); document.getElementById('set-sharp').scrollIntoView({ block: 'center' }); }); await page.waitForTimeout(400);
    const pt = await page.evaluate(() => { const r = document.getElementById('set-sharp').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.touchscreen.tap(pt[0], pt[1]); await page.waitForTimeout(400); await page.evaluate(() => { try { closeSettingsModal(); } catch (e) {} });
    const c = await per(page); await boot(page, true); const c2 = await per(page), cShown = await shown(page);
    ok('2. ...switched OFF it is saved OFF with the sharpSet marker and stays OFF after a reload (DPR 1, the switch off)', c.stored === false && c.mark === 1 && c2.mark === 1 && c.sharp === false && c2.sharp === false && c2.dpr === 1 && !cShown, { c, c2, cShown });
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(tablet(1180, 820)); await boot(page); const d = await per(page);
    ok('2. iPad landscape 1180x820 (never set): ON, >= 1.5 store px per CSS px', d.sharp === true && d.per >= 1.5 && d.dpr <= 2 * d.fit + 0.01, d);
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(tablet(820, 1180), { settings: { sharp: false, bgm: 60 } }); await boot(page); const e = await per(page);
    await page.evaluate(() => { const b = document.getElementById('set-bgm'); b.value = '40'; applySettingsLive(); }); const e2 = await per(page);
    ok('2. iPad with an OFF saved by an older build (no marker): comes up ON, and a volume change clears the old value', e.sharp === true && e.per >= 1.5 && e2.sharp === true && e2.stored === null && e2.mark === undefined, { e, e2 });
    await ctx.close();
  }
  for (const [tag, opts, want] of [['phone 390x844', phone(390, 844), false], ['desktop 1280x720', { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 }, false], ['phone 844x390', phone(844, 390), true]]) {
    const { ctx, page } = await newPage(opts, { settings: { sharp: want, bgm: 60 } }); await boot(page); const f = await per(page);
    await page.evaluate(() => { const b = document.getElementById('set-bgm'); b.value = '40'; applySettingsLive(); }); const f2 = await per(page);
    const dprOk = want ? f.per >= 1.5 : (tag.startsWith('desktop') ? f.dpr === 2 : f.dpr === 1);
    ok(`2. ${tag} with ${want ? 'ON' : 'OFF'} saved by an older build keeps it (and a volume change saves it as before)`, f.sharp === want && dprOk && f2.stored === want && f2.mark === undefined, { f, f2 });
    await ctx.close();
  }
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
