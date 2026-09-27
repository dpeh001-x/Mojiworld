// Phone fit (v0.30.x phone-fit): the screens a landscape phone (667x375, 844x390, touch) and a 1280x720 window could not use.
//   node scripts/phone_fit_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Checks by bounding rects and real touch input (taps and finger drags, never scrollIntoView, which would
// scroll a clipped box a finger cannot):
//   title menu at 667 / 844: every option on screen, or the "More" tab there and every option reachable by scrolling;
//   character creation at 667 / 844: NEXT on screen or brought there by a touch scroll, and a tap advances;
//   jukebox at 667 / 844 / 1280: its X on screen, on the card, and a tap closes it;
//   Ascend pill (level cap) at 667 / 844 / 1280: hidden under every open panel, below the panels, clear of the deck
//   and the minimap; quest journal chips unclipped; the Reforge button reachable with gear on; U panel: an item row
//   above the fold and the shortcut row on one line at 1280x720; no page errors.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11350';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
async function boot(opts) {
  const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof openJukebox === 'function' && typeof openReforgeModal === 'function', null, { timeout: 150000 });
  return { ctx, p, cdp: await ctx.newCDPSession(p) };
}
// the game proper, past the title (the keybinds_test recipe)
const enterWorld = (p) => p.evaluate(async () => {
  for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
  window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
  loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
  player.invulnerable = 999999; game.monsters.length = 0;
  const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < 20 && performance.now() - t0 < 20000) await new Promise((s) => setTimeout(s, 50));
  return (game.time | 0) - g0;
});
// is the element fully on screen, and is it what a finger at its centre would hit?
const onScreen = (p, sel) => p.evaluate((sel) => {
  const e = document.querySelector(sel); if (!e) return { ok: false, why: 'missing' };
  const r = e.getBoundingClientRect(); if (!r.width || !r.height) return { ok: false, why: 'no box' };
  const inView = r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  const hit = inView ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
  return { ok: inView && !!hit && (hit === e || e.contains(hit)), rect: [r.left, r.top, r.width, r.height].map(Math.round), hit: hit ? (hit.id || hit.className || hit.tagName).toString().slice(0, 30) : null };
}, sel);
// a real finger drag over the visible part of the element's nearest scroll box (or its card), up to four swipes
async function touchReach(p, cdp, sel, cardSel) {
  let st = await onScreen(p, sel);
  for (let i = 0; i < 4 && !st.ok; i++) {
    const pt = await p.evaluate(([sel, cardSel]) => {
      const e = document.querySelector(sel); if (!e) return null;
      let box = e.parentElement; while (box && box !== document.body) { const cs = getComputedStyle(box); if (/(auto|scroll)/.test(cs.overflowY) && box.scrollHeight > box.clientHeight + 1) break; box = box.parentElement; }
      if (!box || box === document.body) box = document.querySelector(cardSel) || e.parentElement;
      const r = box.getBoundingClientRect(); const x0 = Math.max(0, r.left), x1 = Math.min(innerWidth, r.right), y0 = Math.max(0, r.top), y1 = Math.min(innerHeight, r.bottom);
      return (x1 - x0 > 8 && y1 - y0 > 8) ? { x: (x0 + x1) / 2, y: (y0 + y1) / 2 } : null;
    }, [sel, cardSel]);
    if (!pt) break;
    // a finger drag, as raw touch events (headless ignores synthesized touch scroll gestures)
    for (const [type, dy] of [['touchStart', 0], ['touchMove', -30], ['touchMove', -60], ['touchMove', -90], ['touchMove', -120], ['touchEnd', null]]) {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: dy == null ? [] : [{ x: Math.round(pt.x), y: Math.round(pt.y + dy) }] }); await p.waitForTimeout(35); }
    await p.waitForTimeout(250); st = await onScreen(p, sel);
  }
  return st;
}
const tap = async (p, sel) => { const r = await p.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel); await p.touchscreen.tap(r.x, r.y); };

try {
  // ======================= a landscape phone (touch) =======================
  const T = await boot({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const p = T.p;
  await p.waitForFunction(() => { const b = document.getElementById('menu-newgame'); return b && b.getBoundingClientRect().width > 0; }, null, { timeout: 150000 });
  await p.waitForTimeout(3500);   // the menu's entrance
  const titleMenu = async (tag) => {
    const m = await p.evaluate(() => {
      const stack = document.querySelector('#loading-overlay .lo-stack'), sr = stack.getBoundingClientRect();
      const opts = [...document.querySelectorAll('#lo-menu .menu-item, #lo-links .lo-link')].filter((e) => !e.hidden && e.getClientRects().length);
      const shown = (e) => { const r = e.getBoundingClientRect(); return r.top >= Math.max(0, sr.top) - 1 && r.bottom <= Math.min(innerHeight, sr.bottom) + 1 && r.left >= -1 && r.right <= innerWidth + 1; };
      const below = opts.filter((e) => !shown(e)).map((e) => e.id);
      const cue = document.getElementById('lx-more-cue'), cr = cue && cue.getBoundingClientRect();
      const hit = cr && cr.width ? document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2) : null;
      const cueOk = !!(cr && cr.width && cr.top >= 0 && cr.bottom <= innerHeight && hit && hit.closest('#lx-more-cue'));
      const s0 = stack.scrollTop, seen = new Set();   // .lo-stack is a finger-scrollable box: does every option come on screen at some point?
      for (let y = 0; y <= stack.scrollHeight; y += Math.max(20, stack.clientHeight / 3)) { stack.scrollTop = y; for (const e of opts) if (shown(e)) seen.add(e); }
      stack.scrollTop = stack.scrollHeight; for (const e of opts) if (shown(e)) seen.add(e);
      const stillBelow = opts.filter((e) => !seen.has(e)).map((e) => e.id); stack.scrollTop = s0;
      return { n: opts.length, below, cueOk, stillBelow };
    });
    let tapScrolls = null;
    if (m.cueOk) { const s0 = await p.evaluate(() => document.querySelector('#loading-overlay .lo-stack').scrollTop); await tap(p, '#lx-more-cue'); await p.waitForTimeout(700);
      tapScrolls = (await p.evaluate(() => document.querySelector('#loading-overlay .lo-stack').scrollTop)) > s0 + 20;
      await p.evaluate(() => { document.querySelector('#loading-overlay .lo-stack').scrollTop = 0; }); await p.waitForTimeout(300); }
    check(m.n >= 6 && (m.below.length === 0 || (m.cueOk && tapScrolls && m.stillBelow.length === 0)),
      `title menu ${tag}: every option is on screen, or the "More" tab is and scrolls to the rest`, { ...m, tapScrolls });
  };
  await titleMenu('667x375');
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(1200);
  await titleMenu('844x390');
  await p.setViewportSize({ width: 667, height: 375 }); await p.waitForTimeout(1200);
  // New Game -> name -> character creation
  await p.click('#menu-newgame'); await p.waitForTimeout(600);
  await p.fill('#auth-user', 'Tester'); await p.click('#auth-submit');
  await p.waitForFunction(() => { const m = document.getElementById('class-select-modal'); return m && m.style.display === 'flex'; }, null, { timeout: 60000 });
  await p.waitForFunction(() => {   // the title card has faded off: a finger on the creation card lands on it
    const r = document.querySelector('#class-select-modal .modal.cs-epic').getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + 40);
    return !!(h && h.closest('#class-select-modal')); }, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const nx = await touchReach(p, T.cdp, '#cs-nav-next', '#class-select-modal .modal.cs-epic');
  let adv = false;
  if (nx.ok) { await tap(p, '#cs-nav-next'); await p.waitForTimeout(500); adv = await p.evaluate(() => document.getElementById('cs-page-class').style.display !== 'none' && _csPage === 'class'); }
  check(nx.ok && adv, 'character creation 667x375: NEXT is on screen (or a touch scroll brings it), and a tap turns to the class page', { nx, adv });
  const bk = await onScreen(p, '#cs-nav-back');
  check(bk.ok, 'character creation 667x375: Back is on screen on the class page', bk);
  await p.evaluate(() => _renderCsPage('look')); await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(1200);
  const nx2 = await touchReach(p, T.cdp, '#cs-nav-next', '#class-select-modal .modal.cs-epic');
  check(nx2.ok, 'character creation 844x390: NEXT is on screen', nx2);
  await p.setViewportSize({ width: 667, height: 375 }); await p.waitForTimeout(800);

  // ---- in the world, on the phone ----
  const fr = await enterWorld(p);
  check(fr > 0, 'the world steps after the title (sim running)', { framesRan: fr });
  await p.evaluate(() => {   // gear the reforge bench can take: Lv 50+ with rolled affixes, in every slot
    player.setshards = 100000;
    for (const [slot, cat] of [['weapon', 'weapons'], ['armor', 'armors'], ['accessory', 'accessories']]) {
      for (let i = 0; i < 60; i++) { const it = rollItemDrop(2, 80, cat); if (it && (it.dropLevel || 0) >= 50 && it.affixes && !it.transcended) { player.equipped[slot] = it; break; } }
    }
    for (let i = 0; i < 6; i++) { const it = rollItemDrop(1, 70); if (it) player.inventory.push(it); }
  });
  const pillSetup = () => p.evaluate(async () => {   // the level cap: Guguma's pill (the collapsed chip a load at cap raises)
    player.level = PRESTIGE_LEVEL; try { closeAllModals(); } catch (e) {} game.paused = false;
    _gugumaAscendPrompt(true); await new Promise((s) => setTimeout(s, 600));
    const el = document.getElementById('guguma-ascend'); return !!el;
  });
  const pillState = () => p.evaluate(() => {
    const el = document.getElementById('guguma-ascend'); if (!el) return { gone: true };
    const r = el.getBoundingClientRect(), vis = r.width > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
    const hitsOf = (sel) => [...document.querySelectorAll(sel)].filter((b) => { const q = b.getBoundingClientRect(); if (!q.width || !q.height || getComputedStyle(b).visibility === 'hidden') return false;
      return q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top; }).map((b) => (b.id || b.className).toString().slice(0, 28));
    return { vis, rect: [r.left, r.top, r.width, r.height].map(Math.round), z: +getComputedStyle(el).zIndex,
      deck: vis ? hitsOf('#mobile-deck .mc-btn, #mobile-ctrl .mc-btn, #mobile-deck .mc-dpad, .mc-menu, .mc-chat-btn, #mobile-ctrl-toggle, #skill-bar') : [], minimap: vis ? hitsOf('#minimap') : [] };
  });
  const pillUnderPanels = async (tag) => {
    const out = {};
    for (const [name, open] of [['Settings', 'openSettingsModal()'], ['Level Up', "game._uTab = 'lp'; openLevelUpPanel()"], ['shop', "openShop('potion')"], ['jukebox', 'openJukebox()']]) {
      await p.evaluate((open) => { try { closeAllModals(); } catch (e) {} try { closeSettingsModal(); } catch (e) {} try { closeJukebox(); } catch (e) {} (0, eval)(open); }, open);
      await p.waitForTimeout(350); const st = await pillState();
      const isOpen = await p.evaluate(() => !!document.querySelector('.modal-overlay[style*="display: flex"], #settings-modal-bg.on, #jukebox-modal-bg.on'));
      out[name] = isOpen ? st.vis : 'panel did not open';
    }
    await p.evaluate(() => { try { closeAllModals(); } catch (e) {} try { closeSettingsModal(); } catch (e) {} try { closeJukebox(); } catch (e) {} game.paused = false; });
    await p.waitForTimeout(400);
    const st = await pillState();
    check(Object.values(out).every((v) => v === false) && st.vis && st.z < 70, `Ascend pill ${tag}: hidden under Settings / Level Up / the shop / the jukebox, back after, below the panels and the deck`, { out, after: st });
    return st;
  };
  const phone = async (tag) => {
    // jukebox: its X on screen and on the card, and a tap closes it
    await p.evaluate(() => { try { closeAllModals(); } catch (e) {} openJukebox(); }); await p.waitForTimeout(500);
    const jx = await onScreen(p, '#jukebox-modal .jb-x');
    const onCard = await p.evaluate(() => { const c = document.getElementById('jukebox-modal').getBoundingClientRect(), x = document.querySelector('#jukebox-modal .jb-x').getBoundingClientRect(); return x.left >= c.left && x.right <= c.right && x.top >= c.top && x.bottom <= c.bottom; });
    let closed = false; if (jx.ok) { await tap(p, '#jukebox-modal .jb-x'); await p.waitForTimeout(400); closed = await p.evaluate(() => !document.getElementById('jukebox-modal-bg').classList.contains('on')); }
    if (!closed) await p.evaluate(() => { try { closeJukebox(); } catch (e) {} });
    check(jx.ok && onCard && closed, `jukebox ${tag}: the close X is on screen, on the card, and a tap closes it`, { jx, onCard, closed });
    // the Ascend pill
    await pillSetup();
    const st = await pillUnderPanels(tag);
    check(st.vis && st.deck.length === 0 && st.minimap.length === 0, `Ascend pill ${tag}: clear of every touch-deck button and the minimap`, st);
    await p.evaluate(() => { player.level = 70; _gugumaAscendChip(false); });
    // quest journal chips
    await p.evaluate(() => { try { closeAllModals(); } catch (e) {} toggleQuestJournal(); }); await p.waitForTimeout(500);
    const qj = await p.evaluate(() => { const f = document.querySelector('#quest-modal .qj-filter'), card = document.querySelector('#quest-modal .modal') || f.closest('.modal'); const cr = card.getBoundingClientRect();
      const out = [...f.querySelectorAll('.qj-chip')].filter((c) => { const r = c.getBoundingClientRect(); return r.right > Math.min(cr.right, innerWidth) + 1 || r.left < cr.left - 1; }).map((c) => c.textContent.trim());
      return { chips: f.querySelectorAll('.qj-chip').length, clipped: out, sw: f.scrollWidth, cw: f.clientWidth, scroll: getComputedStyle(f).overflowX }; });
    check(qj.chips >= 3 && qj.clipped.length === 0 && (qj.sw <= qj.cw + 1 || /(auto|scroll)/.test(qj.scroll)), `quest journal ${tag}: every category chip sits inside the card`, qj);
    await p.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
    // the Reforge Bench, gear on
    await p.evaluate(() => openReforgeModal()); await p.waitForTimeout(600);
    const rf = await touchReach(p, T.cdp, '#do-reforge', '#reforge-modal > .modal');
    let armed = false; if (rf.ok) { await tap(p, '#do-reforge'); await p.waitForTimeout(300); armed = await p.evaluate(() => !!game._reforgeArmed); }
    check(rf.ok && armed, `Reforge Bench ${tag}: with gear on, the Reforge button is on screen (or a touch scroll brings it) and a tap arms it`, { rf, armed });
    await p.evaluate(() => { game._reforgeArmed = false; try { closeAllModals(); } catch (e) {} game.paused = false; });
  };
  await phone('667x375');
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(1200);
  await phone('844x390');
  await T.ctx.close();

  // ======================= a 1280x720 window =======================
  const D = await boot({ viewport: { width: 1280, height: 720 } });
  const q = D.p;
  const fr2 = await enterWorld(q);
  check(fr2 > 0, 'desktop: the world steps (sim running)', { framesRan: fr2 });
  await q.evaluate(() => { for (let i = 0; i < 8; i++) { const it = rollItemDrop(1, 70); if (it) player.inventory.push(it); } });
  // the U panel, Items tab: a row of items above the fold, the shortcut row on one line
  const u = await q.evaluate(async () => {
    try { closeAllModals(); } catch (e) {} game._uTab = 'items'; game._invTab = 'equip'; openLevelUpPanel(); await new Promise((s) => setTimeout(s, 700));
    const m = document.querySelector('#attributes-modal .modal'); m.scrollTop = 0; const mr = m.getBoundingClientRect();
    const slot = document.querySelector('#u-inv-grid .inv-slot'); const sr = slot ? slot.getBoundingClientRect() : null;
    const tops = [...m.querySelectorAll('#u-jump-row .u-jump')].map((b) => Math.round(b.getBoundingClientRect().top));
    const hdr = m.querySelector('#u-inv-tabs').getBoundingClientRect().top - mr.top;
    return { inv: player.inventory.length, modal: [mr.top, mr.bottom].map(Math.round), slot: sr && [sr.top, sr.bottom].map(Math.round), tops, hdrShare: +(hdr / mr.height).toFixed(2),
      slotVisible: !!sr && sr.top >= mr.top && sr.bottom <= Math.min(mr.bottom, innerHeight) + 0.5 };
  });
  check(u.inv >= 6 && u.slotVisible, 'U panel 1280x720: the first row of items shows above the fold (Items tab, no scrolling)', u);
  check(u.tops.length === 6 && new Set(u.tops).size === 1, 'U panel 1280x720: the six shortcuts (World Map ... Achievements) sit on one row', u.tops);
  await q.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  // jukebox X on the desktop too
  await q.evaluate(() => openJukebox()); await q.waitForTimeout(400);
  const jd = await onScreen(q, '#jukebox-modal .jb-x');
  let jdc = false; if (jd.ok) { await q.click('#jukebox-modal .jb-x'); await q.waitForTimeout(300); jdc = await q.evaluate(() => !document.getElementById('jukebox-modal-bg').classList.contains('on')); }
  check(jd.ok && jdc, 'jukebox 1280x720: the X is on screen and closes it', { jd, jdc });
  // the Ascend pill on the desktop: clear of the minimap, hidden under panels
  await q.evaluate(async () => { player.level = PRESTIGE_LEVEL; try { closeAllModals(); } catch (e) {} game.paused = false; _gugumaAscendPrompt(true); await new Promise((s) => setTimeout(s, 600)); });
  const dst = await q.evaluate(() => { const el = document.getElementById('guguma-ascend'), r = el.getBoundingClientRect(), mm = document.getElementById('minimap').getBoundingClientRect();
    const sb = [...document.querySelectorAll('#skill-bar, .skill-slot, #hotbar')].map((e) => e.getBoundingClientRect()).filter((q) => q.width);
    const x = (q) => q.width && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top;
    return { rect: [r.left, r.top, r.width, r.height].map(Math.round), mm: [mm.left, mm.top, mm.width, mm.height].map(Math.round), onMinimap: x(mm), onSkillBar: sb.some(x), z: +getComputedStyle(el).zIndex }; });
  check(dst.rect[2] > 0 && !dst.onMinimap && !dst.onSkillBar, 'Ascend pill 1280x720: clear of the minimap and the skill bar', dst);
  const dhide = await q.evaluate(async () => { const o = {}; for (const [k, f] of [['Settings', () => openSettingsModal()], ['Level Up', () => { game._uTab = 'lp'; openLevelUpPanel(); }]]) {
    try { closeAllModals(); } catch (e) {} try { closeSettingsModal(); } catch (e) {} f(); await new Promise((s) => setTimeout(s, 300)); o[k] = document.getElementById('guguma-ascend').getBoundingClientRect().width > 0; }
    try { closeAllModals(); } catch (e) {} try { closeSettingsModal(); } catch (e) {} game.paused = false; return o; });
  check(!dhide.Settings && !dhide['Level Up'] && dst.z < 70, 'Ascend pill 1280x720: hidden under Settings and Level Up, below the panels', { dhide, z: dst.z });
  await D.ctx.close();
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} catch (e) { check(false, 'harness', String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
