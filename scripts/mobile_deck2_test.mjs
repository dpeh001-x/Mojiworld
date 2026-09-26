// Mobile controls, round two (mobile-deck2). Emulates the user's phone (Android Chrome, ~842x325 landscape), taps the real
// buttons, and checks: the layout from the edited screenshot; N really talks to an NPC and the dialog STAYS open (the ghost
// click); CHAT opens a keyboard bar at the top of the screen and sends; F shows what a tap will do; a painted icon on every
// button; nothing overlaps; portrait and the desktop touch mode.
//   PORT=10311 node scripts/mobile_deck2_test.mjs [candidate.html]      (MOJI_GAME_FILE also honoured)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10311';
const FILE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: FILE } });
await new Promise((r) => setTimeout(r, 1500));
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const CONTROLS = { dpad: '#mobile-deck .mc-dpad', block: '#mobile-deck .mc-block', hp: '#mobile-deck .mc-hp', mp: '#mobile-deck .mc-mp', talk: '#mobile-deck .mc-talk',
  jump: '#mobile-deck .mc-jump', basic: '#mobile-deck .mc-basic', f: '#mobile-deck [data-dynamic="f-block"]', x: '#mobile-deck .mc-skill[data-mkey="x"]', s: '#mobile-deck .mc-skill[data-mkey="s"]',
  c: '#mobile-deck .mc-skill[data-mkey="c"]', d: '#mobile-deck .mc-skill[data-mkey="d"]', v: '#mobile-deck .mc-skill[data-mkey="v"]', g: '#mobile-deck .mc-skill[data-mkey="g"]', b: '#mobile-deck .mc-skill[data-mkey="b"]',
  chat: '#mc-chat-btn', map: '#mobile-ctrl .mc-menu[data-mkey="w"]', settings: '#settings-btn', fullscreen: '#fullscreen-btn', touch: '#mobile-mode-btn', ctrltoggle: '#mobile-ctrl-toggle', topui: '#top-ui' };
const CHANGED = ['dpad', 'block', 'talk', 'jump', 'chat', 'touch', 'settings', 'fullscreen', 'ctrltoggle'];
const open = async (vw, vh, opts = {}) => {
  const ctxB = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: opts.desktop ? 1 : 2.6, isMobile: !opts.desktop, hasTouch: !opts.desktop, serviceWorkers: 'block', userAgent: opts.desktop ? undefined : UA });
  const page = await ctxB.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof player !== 'undefined', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.cls = 'rogue'; player.level = 6; player.hp = player.maxHp = 378; player._god = true;
    loadMap('town'); game.paused = false;
    await new Promise((r) => setTimeout(r, 2500));
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false; document.body.classList.remove('forced-modal', 'cinematic');
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  });
  if (opts.desktop) await page.evaluate(() => { try { _lxToggleMobileMode(); } catch (e) {} });
  await page.waitForTimeout(1800);
  return { ctxB, page, errs };
};
const rects = (page) => page.evaluate((C) => {
  const out = { vw: innerWidth, vh: innerHeight, body: document.body.className };
  for (const [k, sel] of Object.entries(C)) {
    const e = document.querySelector(sel); if (!e) { out[k] = null; continue; }
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    let vis = cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    for (let p = e.parentElement; p && vis; p = p.parentElement) { const pc = getComputedStyle(p); if (pc.display === 'none' || pc.visibility === 'hidden') vis = false; }
    out[k] = { l: r.left, t: r.top, r: r.right, b: r.bottom, w: Math.round(r.width), h: Math.round(r.height), vis };
  }
  const up = document.querySelector('#mobile-deck .mc-dpad .mc-up'); out.arrow = up ? Math.round(up.getBoundingClientRect().width) : null;
  const lt = document.querySelector('#mobile-deck .mc-dpad .mc-left'); out.arrowLeft = lt ? lt.getBoundingClientRect().left : null;
  return out;
}, CONTROLS);
const overlaps = (R, keys, against) => {
  const hits = [];
  for (const a of keys) for (const b of against) {
    if (a === b || !R[a] || !R[b] || !R[a].vis || !R[b].vis) continue;
    if (keys.includes(b) && a > b) continue;
    const ox = Math.min(R[a].r, R[b].r) - Math.max(R[a].l, R[b].l), oy = Math.min(R[a].b, R[b].b) - Math.max(R[a].t, R[b].t);
    if (ox > 1 && oy > 1) hits.push(a + '/' + b + ' ' + Math.round(ox) + 'x' + Math.round(oy));
  }
  return hits;
};
const dialogUp = () => { const d = document.getElementById('dialog'); if (!d) return false; const cs = getComputedStyle(d), r = d.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && r.height > 0; };
try {
  // ================= the user's phone, landscape =================
  const P = await open(842, 325);
  const R = await rects(P.page);
  const inView = (q) => q && q.vis && q.l >= -0.5 && q.t >= -0.5 && q.r <= R.vw + 0.5 && q.b <= R.vh + 0.5;
  console.log(`phone ${R.vw}x${R.vh} · ${R.body}`);
  check(/mc-landscape/.test(R.body), 'the phone runs the landscape deck', R.body);
  check(R.block && R.block.vis && R.block.l <= 30 && R.block.t <= 50 && R.block.w === 54 && inView(R.block), 'BLOCK is visible in the top-left corner, 54 px, on screen', R.block);
  check(R.dpad && R.dpad.w === 184 && R.arrow === 56 && R.arrowLeft >= 0 && inView(R.dpad), 'the D-PAD is bigger: a 184 px pad with 56 px arrows, fully on screen (was 168 / 50)', { pad: R.dpad && R.dpad.w, arrow: R.arrow, arrowLeft: R.arrowLeft });
  check(R.jump && Math.abs((R.vw - R.jump.r) - 272) <= 1 && Math.abs((R.vh - R.jump.b) - 12) <= 1, 'JUMP sits 14 px lower and 4 px further left (was 268 / 26 from the right / bottom edges)', { right: R.jump && Math.round(R.vw - R.jump.r), bottom: R.jump && Math.round(R.vh - R.jump.b) });
  check(R.talk && inView(R.talk) && R.talk.l >= R.hp.r + 6 && (R.talk.t + R.talk.b) / 2 > (R.hp.t + R.hp.b) / 2 && (R.talk.t + R.talk.b) / 2 < (R.mp.t + R.mp.b) / 2, 'N (TALK) sits beside the potion dock, between HP and MP', { talk: R.talk, hp: R.hp, mp: R.mp });
  const top = await P.page.evaluate(() => ({ nButtons: document.querySelectorAll('.mc-btn[data-mkey="n"]').length, nInDeck: document.querySelectorAll('#mobile-deck .mc-btn[data-mkey="n"]').length, chatLabel: (document.querySelector('#mc-chat-btn .mc-lbl') || {}).textContent, chatKey: (document.getElementById('mc-chat-btn') || { dataset: {} }).dataset.mkey || null, talkLabels: [...document.querySelectorAll('#mobile-ctrl .mc-lbl')].map((e) => e.textContent).filter((t) => /talk/i.test(t)).length }));
  check(top.nButtons === 1 && top.nInDeck === 1 && top.talkLabels === 0 && top.chatLabel === 'CHAT' && !top.chatKey, 'the duplicate TALK at the top right is gone: that button is CHAT, and N is the one talk button', top);
  const hits = overlaps(R, CHANGED, Object.keys(CONTROLS));
  check(hits.length === 0 && inView(R.chat), 'nothing overlaps: the moved controls, N, CHAT and the corner buttons all stand clear (CHAT was under the corner column, Block on HP, the touch toggle on B)', hits);
  // ---- a painted icon on every button ----
  const ico = await P.page.evaluate(async () => {
    const bg = (el) => { if (!el) return null; const v = getComputedStyle(el).backgroundImage; return v && v !== 'none' ? v : null; };
    const img = (el) => { const i = el && el.querySelector('img'); return i ? i.src : null; };
    const pick = {
      up: bg(document.querySelector('#mobile-deck .mc-up .mc-arrow')), down: bg(document.querySelector('#mobile-deck .mc-down .mc-arrow')),
      left: bg(document.querySelector('#mobile-deck .mc-left .mc-arrow')), right: bg(document.querySelector('#mobile-deck .mc-right .mc-arrow')),
      hp: bg(document.querySelector('#mobile-deck .mc-hp .mc-ico')), mp: bg(document.querySelector('#mobile-deck .mc-mp .mc-ico')),
      talk: bg(document.querySelector('#mobile-deck .mc-talk .mc-ico')), chat: bg(document.querySelector('#mc-chat-btn .mc-ico')),
      block: img(document.querySelector('#mobile-deck .mc-block')), jump: bg(document.querySelector('#mobile-deck .mc-jump .ui-ico')),
      f: bg(document.querySelector('#mobile-deck [data-dynamic="f-block"] .mc-icon')),
      settings: bg(document.querySelector('#settings-btn .lx-corner-ico')), fullscreen: bg(document.querySelector('#fullscreen-btn .lx-corner-ico')),
      touch: bg(document.querySelector('#mobile-mode-btn .lx-corner-ico')), close: bg(document.querySelector('#mc-modal-close .lx-corner-ico')),
      ctrltoggle: (() => { const t = document.getElementById('mobile-ctrl-toggle'); const kids = t ? [...t.children].filter((c) => getComputedStyle(c).display !== 'none').length : 1; return (t && !kids && getComputedStyle(t).color === 'rgba(0, 0, 0, 0)') ? bg(t) : null; })(),
    };
    // skill slots: a skill's art, or the padlock on a locked slot
    for (const k of ['x', 's', 'c', 'd', 'v', 'g', 'b']) { const btn = document.querySelector(`#mobile-deck .mc-skill[data-mkey="${k}"]`); pick['skill_' + k] = (btn && (bg(btn.querySelector('.mc-icon')) || (btn.dataset.empty === '1' ? bg(btn) : null))) || null; }
    const glyphs = [...document.querySelectorAll('#mobile-deck .mc-btn, #mobile-ctrl .mc-btn, #settings-btn, #fullscreen-btn, #mobile-mode-btn, #mc-modal-close')].filter((b) => /[▲▼◀▶♥◆⛶✕⚙]|📱/.test(b.textContent)).map((b) => b.id || b.className);
    const urls = [...new Set(Object.values(pick).filter(Boolean).map((v) => (v.match(/url\("?([^")]+)"?\)/) || [, v])[1]))];
    const status = {}; for (const u of urls) { try { const r = await fetch(u, { cache: 'no-store' }); status[u.split('/').slice(-2).join('/')] = r.status; } catch (e) { status[u] = 'ERR'; } }
    return { pick, glyphs, status };
  });
  const missing = Object.entries(ico.pick).filter(([, v]) => !v).map(([k]) => k);
  check(missing.length === 0 && ico.glyphs.length === 0, 'every button carries a painted icon, and no plain glyph (▲▼◀▶ ♥ ◆ ⛶ ✕ ⚙ 📱) is left as a label', { missing, glyphs: ico.glyphs });
  check(Object.values(ico.status).every((s) => s === 200), 'every icon those buttons use loads (200)', ico.status);
  check(/jump_cloud.webp/.test(ico.pick.jump || ''), 'the Jump button wears the regenerated art (hud/jump_cloud.webp)', ico.pick.jump);
  // ---- F shows what a tap will do ----
  const fs = await P.page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const f = document.querySelector('#mobile-deck [data-dynamic="f-block"]');
    const npc = game.npcs[0]; player.x = npc.x - player.w / 2; player.vx = 0; await sleep(450); const near = { st: f.dataset.fstate, bg: getComputedStyle(f.querySelector('.mc-icon')).backgroundImage };
    player.x = -5000; await sleep(450); const far = { st: f.dataset.fstate, bg: getComputedStyle(f.querySelector('.mc-icon')).backgroundImage };
    return { near, far };
  });
  check(fs.near.st === 'interact' && /1f91a/.test(fs.near.bg) && fs.far.st === 'block' && /block_rogue/.test(fs.far.bg), 'F shows a hand next to an NPC and the rogue\'s block art when nothing is near (level 6: Q still locked)', fs);
  // ---- taps ----
  await P.page.evaluate(() => { window.__keys = []; window.addEventListener('keydown', (e) => window.__keys.push(String(e.key).toLowerCase()), true); });
  const tap = async (q) => { await P.page.touchscreen.tap(Math.round((q.l + q.r) / 2), Math.round((q.t + q.b) / 2)); };
  await tap(R.block); await P.page.waitForTimeout(250);
  const kBlock = await P.page.evaluate(() => window.__keys.slice());
  check(kBlock.includes('a'), 'tapping BLOCK sends A', kBlock);
  const near = await P.page.evaluate(() => { try { closeAllModals(); } catch (e) {} const npc = game.npcs[0]; player.x = npc.x - player.w / 2; player.vx = 0; window.__keys = []; return npc.name; });
  await P.page.waitForTimeout(300);
  await tap(R.talk); await P.page.waitForTimeout(1000);
  const talked = await P.page.evaluate((dialogUpSrc) => { const up = eval('(' + dialogUpSrc + ')'); return { keys: window.__keys.slice(), open: up(), name: (document.getElementById('dialog-name') || {}).textContent }; }, dialogUp.toString());
  check(talked.keys.includes('n') && talked.open && talked.name === near, `tapping N next to an NPC (${near}) opens their dialog, and it is still open a second later (the ghost click no longer shuts it)`, talked);
  await P.page.evaluate(() => { try { closeAllModals(); } catch (e) {} player.x = -5000; window.__keys = []; });
  await P.page.waitForTimeout(300);
  await tap(R.talk); await P.page.waitForTimeout(500);
  const alone = await P.page.evaluate((dialogUpSrc) => { const up = eval('(' + dialogUpSrc + ')'); const c = document.getElementById('mp-chat-input'); return { keys: window.__keys.slice(), open: up(), chat: !!(c && c.style.display === 'block') }; }, dialogUp.toString());
  check(alone.keys.includes('n') && !alone.open && !alone.chat, 'tapping N with nobody near opens no dialog and no chat bar', alone);
  // ---- CHAT ----
  await tap(R.chat); await P.page.waitForTimeout(400);
  const chat1 = await P.page.evaluate(() => { const c = document.getElementById('mp-chat-input'); const r = c.getBoundingClientRect(), cs = getComputedStyle(c); return { focused: document.activeElement === c, shown: c.style.display === 'block', pos: cs.position, top: Math.round(r.top), l: Math.round(r.left), r: Math.round(r.right), vw: innerWidth, font: parseFloat(cs.fontSize), hint: c.getAttribute('enterkeyhint'), chatOpen: net.chatOpen, parent: c.parentElement === document.body }; });
  check(chat1.focused && chat1.shown && chat1.chatOpen, 'tapping CHAT opens the chat bar with the typing focus in it (what raises the phone keyboard)', chat1);
  check(chat1.pos === 'fixed' && chat1.top <= 20 && chat1.l >= 0 && chat1.r <= chat1.vw && chat1.font >= 16 && chat1.hint === 'send', 'the bar sits at the top of the screen (clear of the keyboard), 16 px text, and the keyboard key reads Send', chat1);
  await P.page.keyboard.type('hello team'); await P.page.keyboard.press('Enter'); await P.page.waitForTimeout(300);
  const sent = await P.page.evaluate(() => { const c = document.getElementById('mp-chat-input'); return { bubble: player._chat && player._chat.text, shown: c.style.display === 'block', chatOpen: net.chatOpen, keysLeaked: window.__keys.filter((k) => k.length === 1 && /[a-z]/.test(k) && k !== 'n' && k !== 'a') }; });
  check(sent.bubble === 'hello team' && !sent.shown && !sent.chatOpen, 'typing and pressing Send posts the line above the hero and closes the bar', sent);
  await tap(R.chat); await P.page.waitForTimeout(400);
  const again = await P.page.evaluate(() => document.activeElement === document.getElementById('mp-chat-input') && net.chatOpen);
  await P.page.evaluate(() => document.getElementById('mp-chat-input').blur()); await P.page.waitForTimeout(400);
  const dismissed = await P.page.evaluate(() => ({ chatOpen: net.chatOpen, shown: document.getElementById('mp-chat-input').style.display === 'block' }));
  check(again && !dismissed.chatOpen && !dismissed.shown, 'CHAT opens again on the next tap, and dismissing the keyboard closes the bar', { again, dismissed });
  check(P.errs.length === 0, 'no page errors on the phone', P.errs.slice(0, 3));
  await P.ctxB.close();

  // ================= other sizes =================
  for (const [w, h] of [[915, 412], [740, 360], [789, 304]]) {
    const Q = await open(w, h); const S = await rects(Q.page);
    const sHits = overlaps(S, CHANGED, Object.keys(CONTROLS));
    const allIn = CHANGED.every((k) => S[k] && S[k].vis && S[k].l >= -0.5 && S[k].t >= -0.5 && S[k].r <= S.vw + 0.5 && S[k].b <= S.vh + 0.5);
    check(allIn && sHits.length === 0, `a ${w}x${h} phone: every moved control is on screen and overlaps nothing`, { allIn, hits: sHits });
    await Q.ctxB.close();
  }
  const T = await open(412, 915); const U = await rects(T.page);
  const uHits = overlaps(U, ['talk', 'block'], Object.keys(CONTROLS));
  check(/mc-portrait/.test(U.body) && U.talk && U.talk.vis && U.talk.b <= U.hp.t + 1 && Math.abs(U.talk.l - U.hp.l) <= 1 && uHits.length === 0, 'portrait: N sits above the potion dock and overlaps nothing', { body: U.body, talk: U.talk, hp: U.hp, hits: uHits });
  await T.ctxB.close();
  const D = await open(1366, 768, { desktop: true }); const E = await rects(D.page);
  check(/force-mobile-ctrl/.test(E.body) && E.block && E.block.vis && E.block.l <= 30 && (E.block.t <= 50 || (E.topui && E.block.t >= E.topui.b && E.block.t <= E.topui.b + 12)) && E.talk && E.talk.vis && E.dpad && E.dpad.w === 184, 'desktop touch-controls mode gets the same deck (Block top-left - or just under the stats plate when the plate owns that corner, v0.30.x mc-dodge - N, 184 px d-pad)', { body: E.body, block: E.block, plate: E.topui, talk: E.talk, dpad: E.dpad && E.dpad.w });
  await D.ctxB.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
