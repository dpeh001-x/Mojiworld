// UI polish, round 2 (v0.30.x ui-polish2): phone toasts, the U-panel shortcut row on a phone, the expanded Guguma card on a phone.
//   node scripts/ui_polish2_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Checks by bounding rects on landscape phones (844x390 and 667x375, touch) and a 1280x720 window:
//   three forced toasts: all shown in full, none over the affix chip, the area nameplate, the Multi chip, the quest tracker or
//     any touch-deck button (phones); still stacked in the top-right corner (1280x720);
//   the U panel's six shortcuts on one line with no label cut (Items and Level Up tabs); key chips kept on the desktop;
//   the expanded Guguma card (raised at the level cap, and opened again from the pill): on screen, clear of every touch-deck
//     button, its Ascend / Later buttons tappable; on the desktop it keeps its size; no page errors.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11490';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
const CT = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2', mp4: 'video/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', js: 'text/javascript', json: 'application/json', css: 'text/css', svg: 'image/svg+xml', gif: 'image/gif', webm: 'video/webm' };
const DECK = '#mobile-deck .mc-btn, #mobile-ctrl .mc-btn, #mobile-deck .mc-dpad, .mc-menu, .mc-chat-btn, #mobile-ctrl-toggle, #skill-bar';
async function boot(opts) {
  const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  // the game's own crash notes (_lxCrashNotes: window 'error' events it survives, e.g. a ResizeObserver loop) count too; since v0.30.1454 a ResizeObserver loop is a [layout] warning (no crash toast for players) - still a failure here
  p.on('console', (m) => { if ((m.type() === 'error' && /^\[(error|promise)\] v0/.test(m.text())) || (m.type() === 'warning' && /^\[layout\] v0/.test(m.text()))) errs.push(m.text().slice(0, 160)); });
  // a file the (stale) working copy lacks - fonts, some sprites - comes from origin, as the font route does
  await p.route((u) => u.hostname === 'localhost' && !u.pathname.endsWith('.html') && !existsSync(path.join(ROOT, decodeURIComponent(u.pathname))), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    try { r.fulfill({ status: 200, contentType: CT[rel.split('.').pop().toLowerCase()] || 'application/octet-stream', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 25, stdio: ['ignore', 'pipe', 'ignore'] }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof acceptQuest === 'function' && typeof _renderAffixPin === 'function' && typeof _gugumaAscendPrompt === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 150000 });
  await p.evaluate(() => { LX_ASCENSION_LOCKED = false; });   // v0.30.1453 ascension is locked for players; this suite drives the feature itself, so it opens the lock
  await p.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true;
    window.__frames = async (n, ms) => { const t0 = game.time | 0, w0 = Date.now(); while ((game.time | 0) - t0 < n && Date.now() - w0 < (ms || 30000)) await new Promise((s) => setTimeout(s, 40)); return (game.time | 0) - t0; };
    window.__box = (el) => { if (!el) return null; const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return (cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0) ? [r.left, r.top, r.right, r.bottom] : null; };
    window.__hit = (a, b) => a[0] < b[2] - 0.5 && a[2] > b[0] + 0.5 && a[1] < b[3] - 0.5 && a[3] > b[1] + 0.5;
    window.__name = (e) => (e.id || String(e.className || e.tagName)).slice(0, 26);
  });
  return { ctx, p };
}
const enterWorld = (p) => p.evaluate(async () => {
  window._prologueActive = false; player.cls = 'warrior'; player.level = 30;
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
  loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
  player.invulnerable = 999999; game.monsters.length = 0;
  try { acceptQuest('q_act1_waking', true); } catch (e) {} try { renderQuestTracker(); } catch (e) {}
  const L = WORLD_AFFIXES.find((a) => a.id === 'lucid'); window._activeAffix = () => L; _renderAffixPin();
  const w0 = Date.now(); while (document.body.classList.contains('cinematic') && Date.now() - w0 < 12000) await new Promise((s) => setTimeout(s, 100));
  return __frames(20);
});
// three toasts, raised on a clear stack (the start-up notices and anything waiting are cleared first)
const threeToasts = (p) => p.evaluate(async () => {
  try { closeAllModals(); } catch (e) {} game.paused = false;
  // the perf governor sheds layers on the low FX tiers under headless load: pin them off so the layout is the normal one
  try { window._lxNoLowSheds = true; LX_PERF.lowFx = false; LX_PERF.veryLowFx = false; LX_PERF.veryLowFxUntil = Infinity; game._lowFxCache = null; } catch (e) {}
  for (const t of document.querySelectorAll('#toast-container .toast')) t.remove();
  try { _lxToastWait.length = 0; _lxToastQueue = []; } catch (e) {}
  const T = ['Picked up a Rusty Sword of the Endless Night', 'Quest updated: talk to Nurse Joyce in Everdawn', 'New skill learnt: Ground Slam'];
  showToast(T[0], 'rare'); showToast(T[1], 'success'); showToast(T[2], 'epic');
  await new Promise((s) => setTimeout(s, 900));   // past the slide-in (14% of 3 s)
  const host = document.getElementById('toast-container'), hr = __box(host);
  const toasts = [...host.querySelectorAll('.toast')].filter((t) => T.includes(t._lxTxt)).map((t) => ({ t: t._lxTxt.slice(0, 12), r: __box(t) }));
  const whole = toasts.filter((x) => x.r && hr && x.r[0] >= hr[0] - 1 && x.r[2] <= hr[2] + 1 && x.r[1] >= hr[1] - 1 && x.r[3] <= hr[3] + 1 && x.r[2] <= innerWidth + 1 && x.r[1] >= -1).length;
  return { host: hr && hr.map(Math.round), cls: host.className, toasts: toasts.map((x) => ({ t: x.t, r: x.r && x.r.map(Math.round) })), whole, W: innerWidth, H: innerHeight, _rects: toasts.map((x) => x.r).filter(Boolean) };
});

async function phone(vw, vh) {
  const { ctx, p } = await boot({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const fr = await enterWorld(p);
  // 1) toasts vs the chip / nameplate / Multi / tracker and the deck
  const t = await threeToasts(p);
  const over = await p.evaluate(([rects, DECK]) => {
    const tg = {}; for (const id of ['world-affix-pin', 'map-label', 'mp-btn', 'quest-tracker']) tg[id] = __box(document.getElementById(id));
    const hits = []; for (const r of rects) { for (const id in tg) if (tg[id] && __hit(r, tg[id])) hits.push(id);
      for (const b of document.querySelectorAll(DECK)) { const q = __box(b); if (q && __hit(r, q)) hits.push(__name(b)); } }
    return { mc: document.body.classList.contains('mc-landscape'), shown: Object.keys(tg).filter((k) => tg[k]), hits: [...new Set(hits)] };
  }, [t._rects, DECK]);
  delete t._rects;
  check(fr > 0 && over.mc && over.shown.includes('world-affix-pin') && over.shown.includes('quest-tracker') && t.toasts.length === 3 && t.whole === 3 && over.hits.length === 0,
    `${vw}x${vh} phone: three toasts show in full, clear of the affix chip, nameplate, Multi chip, quest tracker and every touch-deck button`, { fr, t, over });
  await p.evaluate(() => { for (const x of document.querySelectorAll('#toast-container .toast')) x.remove(); });
  // 2) the U panel's shortcut row
  const u = {};
  for (const tab of ['items', 'lp']) {
    u[tab] = await p.evaluate(async (tab) => {
      try { closeAllModals(); } catch (e) {} game._uTab = tab; openLevelUpPanel(); await new Promise((s) => setTimeout(s, 700));
      const m = document.querySelector('#attributes-modal .modal'), mr = m.getBoundingClientRect(), bs = [...document.querySelectorAll('#u-jump-row .u-jump')];
      const tops = bs.map((b) => Math.round(b.getBoundingClientRect().top)), cut = bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent.trim());
      const out = bs.filter((b) => { const r = b.getBoundingClientRect(); return r.left < mr.left - 1 || r.right > mr.right + 1; }).length;
      try { closeAllModals(); } catch (e) {} game.paused = false;
      return { n: bs.length, spread: Math.max(...tops) - Math.min(...tops), cut, out };
    }, tab);
  }
  check(Object.values(u).every((x) => x.n === 6 && x.spread < 4 && x.cut.length === 0 && x.out === 0), `${vw}x${vh} phone: the U panel's six shortcuts sit on one line, no label cut (Items and Level Up tabs)`, u);
  // 3) the expanded Guguma card: raised at the cap, then Later, then opened again from the pill
  const card = () => p.evaluate(async (DECK) => {
    // it hides while any overlay is up (a level-cap cinematic, a panel) and settles a frame after it shows: wait for it (8 s guard)
    const w0 = Date.now(); while (!__box(document.getElementById('guguma-ascend')) && Date.now() - w0 < 8000) await new Promise((s) => setTimeout(s, 100));
    await new Promise((s) => setTimeout(s, 300));
    const el = document.getElementById('guguma-ascend'); if (!el) return { gone: true };
    const r = __box(el), go = el.querySelector('#guguma-ascend-go'), later = el.querySelector('#guguma-ascend-later');
    const waited = Date.now() - w0, why = r ? null : { vis: el.style.visibility, disp: getComputedStyle(el).display, q: !!el._lxFitQ, body: document.body.className.slice(0, 120) };
    const tappable = (b) => { if (!b) return false; const q = b.getBoundingClientRect(); const x = q.left + q.width / 2, y = q.top + q.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false; const h = document.elementFromPoint(x, y); return !!(h && (h === b || b.contains(h))); };
    const deck = r ? [...document.querySelectorAll(DECK)].filter((b) => { const q = __box(b); return q && __hit(r, q); }).map(__name) : [];
    const onScreen = !!r && r[0] >= -0.5 && r[1] >= -0.5 && r[2] <= innerWidth + 0.5 && r[3] <= innerHeight + 0.5;
    return { expanded: !!go, rect: r && r.map(Math.round), onScreen, deck, go: tappable(go), later: tappable(later), zoom: el.firstElementChild ? getComputedStyle(el.firstElementChild).zoom : null, why, waited };
  }, DECK);
  await p.evaluate(async () => { try { closeAllModals(); } catch (e) {} game.paused = false; player.level = PRESTIGE_LEVEL; game._prestigeOffered = false;
    _gugumaAscendChip(false); _gugumaAscendPrompt(false); await new Promise((s) => setTimeout(s, 1000)); });
  const g1 = await card();
  check(g1.expanded && g1.onScreen && g1.deck.length === 0 && g1.go && g1.later, `${vw}x${vh} phone: the expanded Guguma card (raised at the cap) is on screen, clear of every touch-deck button, Ascend / Later tappable`, g1);
  let g2 = { skipped: 'Later not tappable' };
  if (g1.later) {
    const lt = await p.evaluate(() => { const q = document.getElementById('guguma-ascend-later').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
    await p.touchscreen.tap(lt[0], lt[1]); await p.waitForTimeout(700);
    const pill = await p.evaluate(() => { const b = document.getElementById('guguma-ascend-pill'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
    if (pill) { await p.touchscreen.tap(pill[0], pill[1]); await p.waitForTimeout(1000); g2 = await card(); } else g2 = { skipped: 'no pill after Later' };
  }
  check(g2.expanded && g2.onScreen && g2.deck.length === 0 && g2.go && g2.later, `${vw}x${vh} phone: Later folds it to the pill, and the card opened again from the pill is clear of the deck too`, g2);
  await p.evaluate(() => { player.level = 30; _gugumaAscendChip(false); });
  await ctx.close();
}

async function desktop() {
  const { ctx, p } = await boot({ viewport: { width: 1280, height: 720 } });
  const fr = await enterWorld(p);
  const t = await threeToasts(p); delete t._rects;
  const corner = t.toasts.length === 3 && t.whole === 3 && !/lx-toast-phone/.test(t.cls) && t.toasts.every((x) => x.r && x.r[2] >= t.W * 0.8 && x.r[1] < t.H / 3);
  check(fr > 0 && corner, '1280x720: the toasts still stack in the top-right corner', { fr, t });
  const u = await p.evaluate(async () => {
    try { closeAllModals(); } catch (e) {} game._uTab = 'items'; openLevelUpPanel(); await new Promise((s) => setTimeout(s, 700));
    const bs = [...document.querySelectorAll('#u-jump-row .u-jump')], tops = bs.map((b) => Math.round(b.getBoundingClientRect().top));
    const kbd = [...document.querySelectorAll('#u-jump-row kbd')].filter((k) => getComputedStyle(k).display !== 'none').length;
    try { closeAllModals(); } catch (e) {} game.paused = false; return { n: bs.length, spread: Math.max(...tops) - Math.min(...tops), kbd };
  });
  check(u.n === 6 && u.spread < 4 && u.kbd === 4, '1280x720: the U panel shortcuts are on one line and keep their key chips (W / Q / Y / L)', u);
  const g = await p.evaluate(async () => { try { closeAllModals(); } catch (e) {} game.paused = false; player.level = PRESTIGE_LEVEL; game._prestigeOffered = false;
    _gugumaAscendChip(false); _gugumaAscendPrompt(false); await new Promise((s) => setTimeout(s, 1000));
    const el = document.getElementById('guguma-ascend'), r = el.getBoundingClientRect();
    return { expanded: !!el.querySelector('#guguma-ascend-go'), zoom: getComputedStyle(el.firstElementChild).zoom, w: Math.round(r.width) }; });
  check(g.expanded && String(g.zoom) === '1' && g.w >= 400, '1280x720: the expanded Guguma card keeps its full size', g);
  await ctx.close();
}

try {
  await phone(844, 390);
  await phone(667, 375);
  await desktop();
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} catch (e) { check(false, 'harness', String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
