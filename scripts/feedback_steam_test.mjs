// FEEDBACK PORTAL in the STEAM build (v0.30.1851, per user: "ensure this works from steam").
// The Steam app serves the game from steam/static_server.js on 127.0.0.1 and gives it window.SteamAPI + window.MOJI_RELAY_URL (preload.js). This runs the game exactly so, with the REAL static server,
// a stub relay standing in for the Worker, and Steam's bridge stubbed: no levelx_api_base override, so the base must come from the relay the app was given.
//   1. the report goes to the app's relay (MOJI_RELAY_URL, ws:// turned into http://), not to a relay a player typed under Multiplayer > Advanced
//   2. it says platform 'steam', carries a JPEG screenshot (the canvas is same-origin here, so it can be exported) and the game info, and nothing like a save or a token
//   3. with no relay configured (relay.config.json missing -> MOJI_RELAY_URL '') it falls back to the shipped Worker URL; a custom levelx_api_base still wins
//   4. a controller player is not dropped into the message box (Steam's on-screen keyboard would pop over the panel): focus lands on the type chips; a keyboard player lands in the box
//   5. the pause menu's button is there with the Quit row (the desktop pause menu), and B on a pad (#fb-close) closes the panel
//   6. the hourly limit holds in Steam too (second report refused, the first one reached the relay once); no page errors
//   node scripts/feedback_steam_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import http from 'node:http';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const staticServer = require(path.join(ROOT, 'steam', 'static_server.js'));
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260) + ']' : '')); };
const got = [], typed = []; let relayOn = true;
const mk = (sink) => http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { try { sink.push({ url: req.url, body: JSON.parse(b) }); } catch (e) {} res.writeHead(relayOn ? 200 : 503, { 'content-type': 'application/json', ...cors }); res.end(relayOn ? '{"ok":true,"id":"1800000000000-st3am1","mail":true}' : '{"ok":false}'); });
}).listen(0);
const relay = mk(got), wrongRelay = mk(typed), RELAY = relay.address().port, WRONG = wrongRelay.address().port;
// the Steam app passes a native, normalised root (its prefix guard compares strings)
const { server: sserver } = await staticServer.listen(path.resolve(SERVE_ROOT), '/' + FILE, 0); const PORT = sserver.address().port;
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(({ relayUrl, wrong }) => {   // what preload.js exposes in the Steam app
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('levelx_mp_url', wrong); } catch (e) {}   // a player once typed a relay of their own under Multiplayer > Advanced
    window.__kb = 0; window.SteamAPI = new Proxy({ showTextInput() { window.__kb++; return Promise.resolve(true); } }, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(false)) });
    window.MOJI_RELAY_URL = relayUrl;
  }, { relayUrl: 'ws://127.0.0.1:' + RELAY, wrong: 'ws://127.0.0.1:' + WRONG });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://127.0.0.1:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof tickQuestUnlocks === 'function' && typeof openFeedbackModal === 'function' && document.getElementById('game'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}, $ = (i) => document.getElementById(i);
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = $(id); if (el) el.style.display = 'none'; }
    applyClass('rogue'); player.job = null; player._tutorialSeen = true; const sb = {}; for (const k of Object.keys(STORY_BEATS)) sb[k] = true; player._storyBeatsSeen = sb;
    await sleep(2500); player.level = 20; loadMap('forest', 300); await sleep(3500); game.paused = false; player._god = true;
    out.base = _lxFbBase(); out.steamish = !!(window.SteamAPI && window.MOJI_RELAY_URL);
    // 4. focus: keyboard vs pad
    _lxInputDevice = 'kb'; openFeedbackModal('bug'); await sleep(250); out.kbFocus = document.activeElement && document.activeElement.id; closeFeedbackModal();
    _lxInputDevice = 'pad'; openFeedbackModal('bug'); await sleep(250); out.padFocus = document.activeElement && (document.activeElement.className || '').split(' ')[0] + ':' + (document.activeElement.dataset && document.activeElement.dataset.t);
    out.padNoKeyboard = window.__kb === 0; out.shotThumb = !!($('fb-thumb').src && $('fb-thumb').style.display === 'block');
    // 5. B on a pad presses #fb-close
    const cl = $('fb-close'); out.closeIsB = !!cl && /-close$/.test(cl.id); cl.click(); await sleep(100); out.closed = !$('fb-modal-bg').classList.contains('on'); game.paused = false;
    // the desktop pause menu has the button next to Quit
    _lxPauseOpen(); await sleep(200); out.pause = { fb: !!document.querySelector('#lx-pause .lxp-btn[data-a="feedback"]'), quit: !!document.querySelector('#lx-pause .lxp-btn[data-a="quit"]') }; _lxPauseClose(); game.paused = false;
    // 1+2. a report
    _lxInputDevice = 'kb'; localStorage.removeItem('mojiworld_fb_last_v1'); _lxFbSentAt = 0; openFeedbackModal('bug'); await sleep(300);
    $('fb-msg').value = 'Steam: the portal sends me back to town. Controller player here.'; $('fb-contact').value = 'steamfan#42';
    await submitFeedback(); out.status = $('fb-status').textContent;
    // 6. the hour
    $('fb-msg').value = 'a second Steam report right away'; await submitFeedback(); out.second = $('fb-status').textContent; closeFeedbackModal();
    // 3. fallbacks: no relay configured, and an explicit override
    const keep = window.MOJI_RELAY_URL; window.MOJI_RELAY_URL = ''; out.noRelay = _lxFbBase(); window.MOJI_RELAY_URL = keep;
    localStorage.setItem('levelx_api_base', 'https://example.test/'); out.override = _lxFbBase(); localStorage.removeItem('levelx_api_base');
    return out;
  });
  const rep = (got[got.length - 1] || {}).body || {}, d = rep.diag || {};
  ok('the Steam bridge and relay URL are in place for the test', R.steamish === true);
  ok('1a. the report base is the relay the app was given (not the relay a player typed)', R.base === 'http://127.0.0.1:' + RELAY, R.base);
  ok('1b. exactly one report reached the app\'s relay, none the typed one', got.length === 1 && got[0].url === '/api/feedback' && typed.length === 0, [got.length, typed.length]);
  ok('2a. it says platform steam and carries the game info', d.platform === 'steam' && d.cls === 'rogue' && d.level === 20 && d.map === 'forest' && /^v0\.30\./.test(rep.ver), d);
  ok('2b. the screenshot is captured (the canvas is same-origin under the Steam server) and sent as a JPEG', R.shotThumb === true && typeof rep.shot === 'string' && /^data:image\/jpeg;base64,/.test(rep.shot) && rep.shot.length > 3000, [R.shotThumb, rep.shot && rep.shot.length]);
  ok('2c. acknowledged, and nothing like a save or token is in it', /Thank you/.test(R.status) && !/token|password|savegame|authorization/i.test(JSON.stringify(rep).replace(/"ua":"[^"]*"/, '')), R.status);
  ok('3a. with no relay configured the base is the shipped Worker', R.noRelay === 'https://mojiworld-mp.dpeh001.workers.dev', R.noRelay);
  ok('3b. an explicit levelx_api_base still wins', R.override === 'https://example.test', R.override);
  ok('4a. a keyboard player lands in the message box', R.kbFocus === 'fb-msg', R.kbFocus);
  ok('4b. a controller player lands on the type chips and Steam\'s keyboard is not popped by opening the panel', /^fb-type:bug$/.test(R.padFocus) && R.padNoKeyboard === true, [R.padFocus, R.padNoKeyboard]);
  ok('5a. the desktop pause menu offers the feedback button beside Quit', R.pause.fb && R.pause.quit, R.pause);
  ok('5b. B (the -close button) closes the panel', R.closeIsB && R.closed, [R.closeIsB, R.closed]);
  ok('6. the hourly limit holds in Steam: the second report is refused and was never sent', /last hour/i.test(R.second) && got.length === 1, [R.second, got.length]);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); relay.close(); wrongRelay.close(); try { sserver.close(); } catch (e) {} }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
