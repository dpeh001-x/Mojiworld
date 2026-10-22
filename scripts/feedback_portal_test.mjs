// FEEDBACK PORTAL (v0.30.1851, per user: "Create a feedback portal in the game so users can provide feedback or let us know on bugs, enable collation of this feedback or bugs easily on our side").
// The in-game panel against a stub relay that records what it is sent.
//   1. opens from openFeedbackModal, the pause menu's button and the title footer link; pauses a running game and gives back only its own pause; survives the stuck-pause watchdog
//   2. typing in it moves nothing in the game (WASD, K, M, Z, Space); the counter, the type chips and the labels work; Esc closes only it; closeAllModals closes it
//   3. a short message is refused before anything is sent; a good one posts type / message / version / game info (map, level, class, platform, recent errors) / a JPEG screenshot, and nothing like a token or a save
//   4. the switches work: game info off sends only the version, the screenshot box off sends none; ONE report an hour: a second send inside the hour is refused with the minutes left, the time survives in localStorage, opening the panel inside the hour says so, and the server's 429 keeps what was written (not queued)
//   5. an unreachable server queues the report on the device (with a client id) and flushing later sends it once; a refused report (400) shows the server's words and is not queued
//   6. it fits at 1280x720, 820x600 and a phone; no page errors
//   node scripts/feedback_portal_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import http from 'node:http';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11893), STUB = PORT + 1, SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260) + ']' : '')); };
const got = []; let mode = 'ok';
const stub = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => {
    let j = null; try { j = JSON.parse(b); } catch (e) {}
    if (req.url === '/api/feedback' && mode === 'ok') { got.push(j); res.writeHead(200, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify({ ok: true, id: '1800000000000-abc123' })); }
    else if (mode === 'limit') { res.writeHead(429, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify({ ok: false, error: 'Thanks - we already have a report from you in the last hour. You can send another in 30 min.', retryAfter: 1800 })); }
    else if (mode === 'reject') { res.writeHead(400, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify({ ok: false, error: 'Please write a little more (at least 5 characters).' })); }
    else { res.writeHead(503, { 'content-type': 'application/json', ...cors }); res.end('{"ok":false}'); }
  });
}).listen(STUB);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((u) => { try { localStorage.setItem('levelx_api_base', u); localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} }, 'http://127.0.0.1:' + STUB);
  const page = await ctx.newPage(); page.on('pageerror', (e) => { const m = String(e.message).slice(0, 140); if (!/boom-fb-test/.test(m)) errs.push(m); });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof tickQuestUnlocks === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}, $ = (i) => document.getElementById(i);
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    const lo = $('lo-menu'); const titleLink = $('lo-feedback'); out.titleLink = !!titleLink && /openFeedbackModal/.test(titleLink.getAttribute('onclick') || '');
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = $(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.job = null; player._tutorialSeen = true; player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sleep(2500); const vi = $('void-intro-overlay'); if (vi) vi.classList.remove('show');
    player.level = 12; loadMap('forest', 300); await sleep(1500); game.paused = false; player._god = true;
    const bg = $('fb-modal-bg'); out.exists = !!bg && !bg.classList.contains('on') && getComputedStyle(bg).display === 'none';
    out.reg = { pad: _LX_PAD_MODAL_IDS.includes('fb-modal-bg'), pause: _LX_EXTRA_PAUSE_SURFACES.some((s) => s.id === 'fb-modal-bg') };
    // 1. open / pause / give back
    openFeedbackModal(); await sleep(200);
    out.open = { on: bg.classList.contains('on'), paused: game.paused === true, focus: document.activeElement && document.activeElement.id };
    await sleep(4200); out.watchdog = game.paused === true && bg.classList.contains('on');   // the stuck-pause watchdog must leave a panel that registered itself alone
    closeFeedbackModal(); out.closed = { on: bg.classList.contains('on'), paused: game.paused };
    game.paused = true; openFeedbackModal(); closeFeedbackModal(); out.keepsForeignPause = game.paused === true; game.paused = false;   // a pause it did not take is not its to release
    // from the pause menu
    _lxPauseOpen(); await sleep(200); const pb = document.querySelector('#lx-pause .lxp-btn[data-a="feedback"]'); out.pauseBtn = !!pb;
    if (pb) { pb.click(); await sleep(250); } out.fromPause = { on: bg.classList.contains('on'), card: !!$('lx-pause') }; closeFeedbackModal(); game.paused = false;
    if (titleLink) { titleLink.click(); await sleep(150); out.fromTitle = bg.classList.contains('on'); closeFeedbackModal(); }
    // 2. typing moves nothing
    openFeedbackModal('bug'); await sleep(300);
    const x0 = player.x, y0 = player.y; out.x0 = x0;
    return out;
  });
  const ta = page.locator('#fb-msg'); await ta.click(); await page.keyboard.type('wasd k m z l x - testing the keys', { delay: 25 }); await page.keyboard.press('Space'); await page.keyboard.type(' done'); await page.waitForTimeout(300);
  const R2 = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}, $ = (i) => document.getElementById(i);
    out.typed = $('fb-msg').value; out.count = $('fb-count').textContent; out.stillOpen = $('fb-modal-bg').classList.contains('on'); out.paused = game.paused === true;
    out.noOtherPanel = !document.querySelector('#keybind-modal.open, #keybind-modal.show, #settings-modal.open') && !$('lx-pause');
    document.querySelector('#fb-modal .fb-type[data-t="idea"]').click(); out.idea = { checked: document.querySelector('#fb-modal .fb-type[data-t="idea"]').getAttribute('aria-checked'), bug: document.querySelector('#fb-modal .fb-type[data-t="bug"]').getAttribute('aria-checked'), label: $('fb-msg-lbl').textContent, shotRow: $('fb-shot-row').style.display };
    document.querySelector('#fb-modal .fb-type[data-t="bug"]').click(); out.bugShotRow = $('fb-shot-row').style.display;
    // Esc closes only the feedback panel
    if (typeof openSettingsModal === 'function') { game.paused = false; closeFeedbackModal(); openSettingsModal(); await sleep(300); openFeedbackModal(); await sleep(200); }
    return out;
  });
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  const R3 = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}, $ = (i) => document.getElementById(i);
    out.escFeedbackShut = !$('fb-modal-bg').classList.contains('on'); const sm = $('settings-modal'); out.escSettingsStays = !!sm && getComputedStyle(sm).display !== 'none' && !!(sm.offsetParent || sm.getClientRects().length);
    openFeedbackModal(); closeAllModals(); await sleep(150); out.closeAll = !$('fb-modal-bg').classList.contains('on'); game.paused = false; player._god = true;
    return out;
  });
  const R4 = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}, $ = (i) => document.getElementById(i);
    try { closeSettingsModal(); } catch (e) {} game.paused = false;
    setTimeout(() => { throw new Error('boom-fb-test'); }, 10); await sleep(400);   // a script error the report should carry
    openFeedbackModal('bug'); await sleep(200);
    out.hasShot = !!$('fb-thumb').src && $('fb-thumb').style.display === 'block' && /^data:image\/jpeg/.test($('fb-thumb').src);
    // 3. validation
    $('fb-msg').value = 'hi'; submitFeedback(); await sleep(150); out.short = $('fb-status').textContent; out.shortClass = $('fb-status').className;
    return out;
  });
  const afterShort = got.length;
  const R5 = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}, $ = (i) => document.getElementById(i);
    $('fb-msg').value = 'The portal at the cliff sends me back to town every time.'; $('fb-contact').value = 'tester@example.com'; _lxFbSentAt = 0;
    await submitFeedback(); out.status = $('fb-status').textContent; out.cleared = $('fb-msg').value === ''; out.sendBack = !$('fb-send').disabled;
    return out;
  });
  const afterSend = got.length, first = got[got.length - 1] || {};
  const R6 = await page.evaluate(async () => {   // the second send inside 20 s waits; the switches
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}, $ = (i) => document.getElementById(i);
    $('fb-msg').value = 'a second report straight away'; await submitFeedback(); out.gap = $('fb-status').textContent; out.gapSent = 'wait';
    return out;
  });
  const afterGap = got.length;
  const R6b = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}, $ = (i) => document.getElementById(i);
    _lxFbSentAt = 0; $('fb-diag').checked = false; $('fb-shot').checked = false; await submitFeedback(); out.sentSecond = $('fb-status').textContent;
    return out;
  });
  const second = got[got.length - 1] || {};
  mode = 'down';
  const R7 = await page.evaluate(async () => {   // unreachable: queued, flushed later, once
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}, $ = (i) => document.getElementById(i);
    $('fb-diag').checked = true; $('fb-msg').value = 'this one is written while the server is down'; _lxFbSentAt = 0; await submitFeedback();
    out.status = $('fb-status').textContent; out.copyVisible = $('fb-copy').style.display !== 'none'; out.cleared = $('fb-msg').value === '';
    const q = JSON.parse(localStorage.getItem('mojiworld_fb_queue_v1') || '[]'); out.queued = q.length; out.cid = q[0] && q[0].cid; out.noHp = q[0] && !('hp' in q[0]);
    return out;
  });
  const before = got.length; mode = 'ok';
  const R8 = await page.evaluate(async () => { await Promise.all([_lxFbFlush(), _lxFbFlush()]); await new Promise((r) => setTimeout(r, 300)); return { left: JSON.parse(localStorage.getItem('mojiworld_fb_queue_v1') || '[]').length }; });
  const flushed = got.slice(before); mode = 'reject';
  const R9 = await page.evaluate(async () => {   // refused: the server's words, not queued
    const out = {}, $ = (i) => document.getElementById(i);
    $('fb-msg').value = 'a report the server will refuse'; _lxFbSentAt = 0; await submitFeedback(); out.status = $('fb-status').textContent; out.queued = JSON.parse(localStorage.getItem('mojiworld_fb_queue_v1') || '[]').length; return out;
  });
  mode = 'ok';
  // the hour: persisted, announced on open, and the server's 429
  const H1 = await page.evaluate(async () => {
    const out = {}, $ = (i) => document.getElementById(i);
    const stored = +localStorage.getItem('mojiworld_fb_last_v1') || 0; out.persisted = stored > 0 && Date.now() - stored < 600000;   // written by the last accepted or queued report (earlier steps zero the in-memory copy by hand, so compare with the clock)
    _lxFbMarkSent(Date.now() - 20 * 60 * 1000); closeFeedbackModal(); openFeedbackModal('bug'); await new Promise((r) => setTimeout(r, 150));
    out.onOpen = $('fb-status').textContent; out.onOpenClass = $('fb-status').className; out.wait = _lxFbWaitMin(); closeFeedbackModal();
    _lxFbMarkSent(Date.now() - 61 * 60 * 1000); out.afterHour = _lxFbWaitMin();   // an hour and a minute on: free again
    return out;
  });
  mode = 'limit';
  const H2 = await page.evaluate(async () => {
    const out = {}, $ = (i) => document.getElementById(i); _lxFbMarkSent(0); openFeedbackModal('bug'); $('fb-msg').value = 'a long report that the server will refuse for the hour'; const q0 = JSON.parse(localStorage.getItem('mojiworld_fb_queue_v1') || '[]').length;
    await submitFeedback(); out.status = $('fb-status').textContent; out.kept = $('fb-msg').value; out.queued = JSON.parse(localStorage.getItem('mojiworld_fb_queue_v1') || '[]').length - q0; out.wait = _lxFbWaitMin(); out.copy = $('fb-copy').style.display !== 'none'; out.sendBack = !$('fb-send').disabled;
    closeFeedbackModal(); return out;
  });
  mode = 'ok';
  // 6. layout
  const fits = async (w, h, tag) => { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250);
    return page.evaluate(() => { openFeedbackModal('bug'); const m = document.getElementById('fb-modal').getBoundingClientRect(), v = { w: innerWidth, h: innerHeight }, s = document.getElementById('fb-send').getBoundingClientRect(), c = document.getElementById('fb-close').getBoundingClientRect();
      const r = { inside: m.left >= -0.5 && m.right <= v.w + 0.5 && m.top >= -0.5 && m.bottom <= v.h + 0.5, btns: s.bottom <= v.h && c.bottom <= v.h && s.right <= v.w, scroll: document.getElementById('fb-modal').scrollHeight - document.getElementById('fb-modal').clientHeight, m: [Math.round(m.width), Math.round(m.height)] }; closeFeedbackModal(); return r; }); };
  const L1 = await fits(1280, 720), L2 = await fits(820, 600), L3 = await fits(390, 844);

  ok('the panel is in the page, hidden, and registered for the pad and the pause watchdog; the title footer has its link', R.exists && R.reg.pad && R.reg.pause && R.titleLink, [R.exists, R.reg, R.titleLink]);
  ok('1a. openFeedbackModal opens it, pauses the running game and focuses the message box', R.open.on && R.open.paused && R.open.focus === 'fb-msg', R.open);
  ok('1b. the stuck-pause watchdog leaves it alone for 4 s', R.watchdog === true);
  ok('1c. closing it resumes the game; a pause it did not take is left alone', R.closed.on === false && R.closed.paused === false && R.keepsForeignPause === true, [R.closed, R.keepsForeignPause]);
  ok('1d. the pause menu has the button and it opens the panel (the card goes away)', R.pauseBtn && R.fromPause.on && !R.fromPause.card, [R.pauseBtn, R.fromPause]);
  ok('1e. the title footer link opens it', R.fromTitle === true, R.fromTitle);
  ok('2a. typing WASD, K, M, Z, Space... lands in the box and moves nothing; no other panel opens; still paused', R2.typed.startsWith('wasd k m z l x - testing the keys') && R2.stillOpen && R2.paused && R2.noOtherPanel, [R2.typed, R2.stillOpen, R2.paused, R2.noOtherPanel]);
  ok('2b. the counter follows what is typed', new RegExp('^' + R2.typed.length + ' / 3000$').test(R2.count), R2.count);
  ok('2c. a type chip selects, relabels the box, and a screenshot row shows only for a bug', R2.idea.checked === 'true' && R2.idea.bug === 'false' && /idea/i.test(R2.idea.label) && R2.idea.shotRow === 'none' && R2.bugShotRow !== 'none', [R2.idea, R2.bugShotRow]);
  ok('2d. Esc closes only the feedback panel; Settings stays', R3.escFeedbackShut && R3.escSettingsStays, R3);
  ok('2e. closeAllModals closes it', R3.closeAll === true);
  ok('3a. the screenshot of the game canvas is captured as a JPEG', R4.hasShot === true);
  ok('3b. a too-short message is refused with a note and nothing is sent', /little more/i.test(R4.short) && /bad/.test(R4.shortClass) && afterShort === 0, [R4.short, afterShort]);
  ok('3c. a good report is sent and acknowledged; the box is cleared and Send is back', /Thank you/.test(R5.status) && /abc123/.test(R5.status) && R5.cleared && R5.sendBack && afterSend === 1, [R5.status, afterSend]);
  const d = first.diag || {}, blob = JSON.stringify(first);
  ok('3d. it carries type, message, contact, version and a client id', first.type === 'bug' && /portal at the cliff/.test(first.msg) && first.contact === 'tester@example.com' && /^v0\.30\./.test(first.ver) && /^[\w-]{8,}$/.test(first.cid), first);
  ok('3e. the game info names the map, level, class, platform, screen and the recent script error', d.map === 'forest' && d.level === 12 && d.cls === 'warrior' && d.platform === 'web' && d.vw > 0 && Array.isArray(d.errors) && d.errors.some((e) => /boom-fb-test/.test(e)), d);
  ok('3f. the screenshot rides along as a JPEG under 200 KB', typeof first.shot === 'string' && /^data:image\/jpeg;base64,/.test(first.shot) && first.shot.length < 200000, first.shot && first.shot.length);
  ok('3g. nothing like a token, password or save is in it', !/token|password|savegame|\"save\"|authorization/i.test(blob.replace(/"ua":"[^"]*"/, '')), blob.slice(0, 120));
  ok('4a. a second send inside the hour is refused, with the minutes left, and nothing is sent', /last hour/i.test(R6.gap) && /(59|60|1 hour)/.test(R6.gap) && afterGap === 1, [R6.gap, afterGap]);
  ok('4b. with game info and the screenshot off, only the version goes (no map, no shot)', /Thank you/.test(R6b.sentSecond) && second.diag && Object.keys(second.diag).join() === 'ver' && !('shot' in second), [second.diag, 'shot' in second]);
  ok('5a. a down server queues the report with its client id and says so; Copy report appears', /saved on this device/i.test(R7.status) && R7.queued === 1 && /^[\w-]{8,}$/.test(R7.cid) && R7.noHp && R7.copyVisible && R7.cleared, R7);
  ok('5b. flushing sends the queued report once (two flushes at once do not double it) and empties the queue', flushed.length === 1 && flushed[0].cid === R7.cid && /server is down/.test(flushed[0].msg) && R8.left === 0, [flushed.length, R8]);
  ok('5c. a refused report shows the server\'s words and is not queued', /little more/i.test(R9.status) && R9.queued === 0, R9);
  ok('4c. the time of the last report is kept in localStorage (a reload does not give the hour back)', H1.persisted === true, H1);
  ok('4d. opening the panel inside the hour says how long is left; an hour and a minute on it is free again', /last hour/i.test(H1.onOpen) && /wait/.test(H1.onOpenClass) && H1.wait >= 39 && H1.wait <= 41 && H1.afterHour === 0, H1);
  ok('4e. the 429 from the server keeps what was written, is not queued, shows the wording it sent, learns the wait (30 min) and offers Copy report', /30 min/.test(H2.status) && /a long report/.test(H2.kept) && H2.queued === 0 && H2.wait >= 29 && H2.wait <= 31 && H2.copy && H2.sendBack, H2);
  ok('6a. it fits whole at 1280x720', L1.inside && L1.btns && L1.scroll <= 1, L1);
  ok('6b. it fits at 820x600 (buttons reachable)', L2.inside && L2.btns, L2);
  ok('6c. it fits a phone, 390x844', L3.inside && L3.btns, L3);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); stub.close(); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
