// UI text fixes (v0.30.x ui-text-fixes): text that overlapped, clipped or named keys a phone does not have.
//   node scripts/ui_text_fixes_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Bounding rects and rendered text at 1280x720 (desktop) and at 667x375 / 844x390 (isMobile + hasTouch):
//   the tour card with U (and Q) open: none of its visible parts sit on the panel's card, and it returns when the panel closes;
//   the tour's step name (every step, with the tick) is not cut to "..." and clears Guguma's name and line;
//   touch: the world map / MojiDex / U panel hints say tap, the chat bar says Send; desktop keeps "Press W / Y / U";
//   the Compendium's "A Bestiary of Everdawn" sticker and its count do not touch (with big numbers);
//   the shop's Mojicoins read 1,000,000,000; the "Welcome, <16-char name>!" toast is not cut off;
//   character creation at 667x375: Guguma's bubble clears the banner and the em dash stays on its line; no page errors.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11400';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
async function boot(opts) {
  const ctx = await browser.newContext({ ...opts, locale: 'en-US', serviceWorkers: 'block' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof openLevelUpPanel === 'function' && typeof startTutorial === 'function' && typeof openMojidex === 'function', null, { timeout: 150000 });
  return p;
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
// page-side helpers: rects, visibility (opacity multiplied up the tree), overlap
const HELPERS = () => {
  window.__R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  window.__vis = (e) => { if (!e || !e.isConnected) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; if (o < 0.05) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  window.__hit = (a, b) => a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
  window.__round = (o) => o && Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
  window.__settle = async (ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) await new Promise((s) => setTimeout(s, 50)); };
  window.__toast = async (msg) => {
    showToast(msg, 'rare'); await __settle(300);
    const t = [...document.querySelectorAll('#toast-container .toast')].find((x) => x._lxTxt === msg); if (!t) return null;
    t.style.animation = 'none'; t.style.opacity = '1'; await __settle(60);
    const c = t.parentElement, tr = __R(t), crr = __R(c);
    const r = { sw: t.scrollWidth, cw: t.clientWidth, ellipsis: getComputedStyle(t).textOverflow === 'ellipsis', inBox: tr.r <= crr.r + 1 && tr.l >= crr.l - 1, inView: tr.r <= innerWidth + 1 && tr.l >= -1, lines: Math.round(tr.h), dodge: c.className };
    t.remove(); return r;
  };
  window.__close = () => { try { closeAllModals(); } catch (e) {} for (const id of ['worldmap-modal', 'lore-modal', 'mojidex-modal', 'shop-modal', 'attributes-modal', 'quest-modal']) { const m = document.getElementById(id); if (m && m.style.display !== 'none') m.style.display = 'none'; } game.paused = false; };
};

async function suite(p, tag, touch) {
  await p.evaluate(HELPERS);
  // ---- 1) + 2) the tour card ----
  const tut = await p.evaluate(async () => {
    __close(); for (const k in _TUT_SEEN_TAGS) delete _TUT_SEEN_TAGS[k];
    startTutorial(); await __settle(400);
    const modal = document.getElementById('tutorial-modal'); if (!modal || !modal.classList.contains('tut-dock')) return { err: 'no dock' };
    // 2) every step's name, with the tick, as the corner tag
    const titles = [];
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      _tutStep = i; _renderTutorialStep(); const st = document.getElementById('tut-step-title'); st.textContent = '✅ ' + TUTORIAL_STEPS[i].title; await __settle(60);
      const nm = document.querySelector('#tutorial-modal .guguma-name'), ln = document.getElementById('tut-guguma-line'), rs = __R(st);
      titles.push({ i, sw: st.scrollWidth, cw: st.clientWidth, sh: st.scrollHeight, ch: st.clientHeight, h: Math.round(rs.h), onName: !!(nm && __vis(nm) && __hit(rs, __R(nm))), onLine: !!(ln && __vis(ln) && __hit(rs, __R(ln))) });
    }
    const clipped = titles.filter((x) => x.sw > x.cw + 1 || x.sh > x.ch + 1 || x.h > 30 || x.onName || x.onLine);
    _tutStep = TUTORIAL_STEPS.findIndex((s) => /Level Up/.test(s.title)); _renderTutorialStep(); await __settle(200);   // v0.30.1630 by title
    const out = { clipped, lvTitle: document.getElementById('tut-step-title').textContent };
    const parts = () => [document.querySelector('#tutorial-modal .modal'), document.getElementById('tut-nav-row'), document.getElementById('tut-collapse'), document.getElementById('tut-try'),
      document.getElementById('tut-step-title'), document.querySelector('#tutorial-modal .guguma-sprite'), ...document.querySelectorAll('#tutorial-modal .modal kbd')].filter(Boolean);
    for (const [key, open, card] of [['u', () => openLevelUpPanel(), '#attributes-modal > .modal'], ['q', () => toggleQuestJournal(), '#quest-modal > .modal']]) {
      open(); const t0 = performance.now(); while (!modal.classList.contains('tut-ghost') && performance.now() - t0 < 4000) await __settle(60); await __settle(300);
      const c = document.querySelector(card); const cr = c && __R(c);
      const on = parts().filter((e) => __vis(e) && __hit(__R(e), cr)).map((e) => (e.id || e.className || e.tagName).toString().slice(0, 24));
      out[key] = { ghost: modal.classList.contains('tut-ghost'), cardOk: !!(cr && cr.w > 100), on };
      __close(); const t1 = performance.now(); while (modal.classList.contains('tut-ghost') && performance.now() - t1 < 4000) await __settle(60); await __settle(300);
      out[key].back = __vis(document.getElementById('tut-nav-row')) && __vis(document.querySelector('#tutorial-modal .modal'));
    }
    try { modal.style.display = 'none'; modal.classList.remove('tut-dock', 'tut-ghost'); _stopTutGhostWatch(); } catch (e) {}
    return out;
  });
  check(!tut.err && tut.u.ghost && tut.u.cardOk && tut.u.on.length === 0, `${tag}: with the tour running and U open, no part of the tour card sits on the U panel`, tut.err || tut.u);
  check(!tut.err && tut.q.ghost && tut.q.cardOk && tut.q.on.length === 0, `${tag}: ...nor on the quest journal (Q)`, tut.err || tut.q);
  check(!tut.err && tut.u.back && tut.q.back, `${tag}: the tour card comes back when the panel closes`, tut.err || { u: tut.u.back, q: tut.q.back });
  check(!tut.err && tut.clipped.length === 0, `${tag}: every tour step name fits (no "...", at most 2 lines, clear of Guguma's name and line)`, tut.err || tut.clipped);

  if (!touch) {   // 1b) a step ticked under the panel keeps its read (15 s v0.30.1188, 3 s v0.30.1475) for when the card is back
    const cd = await p.evaluate(async () => {
      __close(); for (const k in _TUT_SEEN_TAGS) delete _TUT_SEEN_TAGS[k];
      startTutorial(); await __settle(400); const modal = document.getElementById('tutorial-modal');
      const __LV = TUTORIAL_STEPS.findIndex((s) => /Level Up/.test(s.title));   // v0.30.1630 by title (Block & Parry took index 6)
      _tutStep = __LV; _renderTutorialStep(); await __settle(200);
      openLevelUpPanel(); const t0 = performance.now(); while (!(modal.classList.contains('tut-ghost') && TUTORIAL_STEPS[__LV]._done) && performance.now() - t0 < 4000) await __settle(60);
      const ticked = !!TUTORIAL_STEPS[__LV]._done; await __settle(17000);
      const stepHidden = _tutStep;
      __close(); const t1 = performance.now(); while (modal.classList.contains('tut-ghost') && performance.now() - t1 < 4000) await __settle(60); await __settle(900);
      const r = { ticked, lv: __LV, stepHidden, stepBack: _tutStep, next: (document.getElementById('tut-next') || {}).textContent };
      try { clearInterval(window._tutAdvCountdown); modal.style.display = 'none'; modal.classList.remove('tut-dock', 'tut-ghost'); _stopTutGhostWatch(); } catch (e) {}
      return r;
    });
    check(cd.ticked && cd.stepHidden === cd.lv && cd.stepBack === cd.lv && /\d+\s*s\b/.test(cd.next || ''), `${tag}: a step ticked under the U panel waits there (17 s) and counts down once the card is back`, cd);
  }
  // ---- 3) the close hints and the chat bar ----
  const hints = await p.evaluate(async () => {
    const txt = (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    __close(); toggleWorldMap(); await __settle(300); const map = txt('#worldmap-modal .wm-hd-key');
    __close(); openLoreMap(); await __settle(300); const dex = txt('#lore-modal .cdx-foot');
    __close(); openLevelUpPanel(); await __settle(300); const u = txt('#attributes-modal .u-close-hint');
    __close(); _mpOpenChat(); const chat = document.getElementById('mp-chat-input').placeholder; _mpCloseChat(false);
    return { map, dex, u, chat };
  });
  if (touch) {
    const tapOk = (s) => typeof s === 'string' && /^tap ✕ to close$/i.test(s);
    check(tapOk(hints.map) && tapOk(hints.dex) && tapOk(hints.u), `${tag}: the world map, MojiDex and U panel say "Tap ✕ to close" on a touch screen`, hints);
    check(/tap send/i.test(hints.chat) && !/enter|esc/i.test(hints.chat), `${tag}: the chat bar says tap Send (no Enter / Esc on a phone)`, hints.chat);
  } else {
    check(hints.map === 'Press W to close' && hints.dex === 'press Y to close' && hints.u === 'Press U to close' && /Enter send, Esc cancel/.test(hints.chat),
      `${tag}: a desktop keeps "Press W / Y / U to close" and the Enter / Esc chat hint`, hints);
  }

  // ---- 4) the Compendium header, with big numbers ----
  const dex = await p.evaluate(async () => {
    __close(); openMojidex(); await __settle(400);
    document.getElementById('mojidex-progress').textContent = '131 / 131'; document.getElementById('mojidex-kills').textContent = '1,234,567'; await __settle(100);
    const sub = __R(document.querySelector('#mojidex-modal .mjx-sub')), cnt = __R(document.querySelector('#mojidex-modal .mjx-count'));
    const ring = __R(document.querySelector('#mojidex-modal .mjx-ring')), ttl = __R(document.querySelector('#mojidex-modal .mjx-title')), head = __R(document.querySelector('#mojidex-modal .mjx-head'));
    const r = { sub: __round(sub), cnt: __round(cnt), subOnCount: __hit(sub, cnt), countOnRing: __hit(cnt, ring), countOnTitle: __hit(cnt, ttl), inHead: cnt.l >= head.l - 1 && cnt.r <= head.r + 1 && cnt.b <= head.b + 1 };
    __close(); return r;
  });
  check(!dex.subOnCount && !dex.countOnRing && !dex.countOnTitle && dex.inHead, `${tag}: the Compendium sticker and its "catalogued / felled" count do not touch`, dex);

  // ---- 6) the shop's coins, the welcome toast ----
  const six = await p.evaluate(async () => {
    __close(); player.mojicoins = 1000000000; openShop('potion'); await __settle(200);
    const coins = document.getElementById('shop-mojicoins').textContent; __close();
    openLevelUpPanel(); await __settle(300);   // a panel up: the stack squeezes into the gutter beside it
    const toast = await __toast('Welcome, Wwwwwwwwwwwwwwww!'); __close();
    return { coins, toast };
  });
  check(six.coins === '1,000,000,000', `${tag}: the shop shows "Your Mojicoins: 1,000,000,000"`, six.coins);
  check(!!six.toast && (six.toast.sw <= six.toast.cw + 1 || six.toast.ellipsis) && six.toast.inBox && six.toast.inView, `${tag}: the "Welcome, <16-character name>!" toast is not cut off (U panel open beside it)`, six.toast);
}

try {
  // ======================= a landscape phone (touch) =======================
  const p = await boot({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await p.waitForFunction(() => { const b = document.getElementById('menu-newgame'); return b && b.getBoundingClientRect().width > 0; }, null, { timeout: 150000 });
  await p.waitForTimeout(3500);   // the menu's entrance
  // ---- 5) New Game -> a 16-character name -> character creation ----
  await p.click('#menu-newgame'); await p.waitForTimeout(600);
  await p.fill('#auth-user', 'Wwwwwwwwwwwwwwww'); await p.click('#auth-submit');
  await p.waitForFunction(() => { const m = document.getElementById('class-select-modal'); return m && m.style.display === 'flex'; }, null, { timeout: 60000 });
  await p.waitForFunction(() => {   // the title card has faded off
    const r = document.querySelector('#class-select-modal .modal.cs-epic').getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + 40);
    return !!(h && h.closest('#class-select-modal')); }, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const cs = await p.evaluate(() => {
    const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const chip = R(document.querySelector('#class-select-modal .guguma-chip')), title = R(document.querySelector('#class-select-modal h2.cs-title'));
    const pre = document.querySelector('#class-select-modal .cs-preamble'); const tn = [...pre.childNodes].find((n) => n.nodeType === 3 && n.data.includes('\u2014'));
    const rg = document.createRange(), at = (i, n) => { rg.setStart(tn, i); rg.setEnd(tn, i + n); return rg.getBoundingClientRect().top; };
    const dash = at(tn.data.indexOf('\u2014'), 1), stride = at(tn.data.indexOf('stride'), 6);
    return { overlap: Math.round(Math.min(chip.b, title.b) - Math.max(chip.t, title.t)), chipB: Math.round(chip.b), titleT: Math.round(title.t), dashLine: Math.round(dash - stride) };
  });
  await p.evaluate(HELPERS);
  const wt = await p.evaluate(() => __toast('Welcome, Wwwwwwwwwwwwwwww!'));
  check(!!wt && (wt.sw <= wt.cw + 1 || wt.ellipsis) && wt.inBox && wt.inView, 'character creation 667x375: the "Welcome, <16-character name>!" toast is not cut off', wt);
  check(cs.overlap <= 1, 'character creation 667x375: Guguma\'s bubble clears the "Choose your story" banner', cs);
  check(Math.abs(cs.dashLine) <= 2, 'character creation 667x375: the em dash stays on the line with "your stride"', cs);
  const fr = await enterWorld(p);
  check(fr > 0, 'the world steps after the title (sim running)', { framesRan: fr });
  await suite(p, '667x375 touch', true);
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(1500);
  await suite(p, '844x390 touch', true);
  await p.context().close();

  // ======================= a desktop window =======================
  const d = await boot({ viewport: { width: 1280, height: 720 } });
  await enterWorld(d);
  await suite(d, '1280x720', false);
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} catch (e) {
  check(false, 'the run finished', String(e && e.stack || e).slice(0, 400));
} finally {
  await browser.close(); srv.kill();
  console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
  process.exit(bad ? 1 : 0);
}
