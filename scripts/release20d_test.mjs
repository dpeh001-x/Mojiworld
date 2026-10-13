// RELEASE20 PART D - CO-OP ON A PHONE (the v0.30.1753 phone + desktop co-op hunt). A phone (isMobile, hasTouch, Android UA) and a
// desktop on the REAL local relay (mp/server.mjs, spawned here); the phone runs at 844x390, then 915x412 and portrait-anyway 390x844.
//   1. the DOWNED card's Respawn button is on screen and takes a real tap at every size (revivable and not); desktop keeps its card
//   2. the partner plates + Team Revive chip and the chat log clear the d-pad, Block, the deck buttons, the menu row, the tracker and
//      the stats plate; portrait: the plates sit inside the game beside the stats plate; desktop keeps both where they were
//   3. a kill film / the Everdawn welcome: the deck hides, deck keydowns and a key in the first 600 ms do not skip, a tap does after
//   4. a failed reconnect attempt keeps "reconnecting..." (never "the server refused the connection")
//   5. the invite banner sits under the menu row (every menu button still takes a tap) and a reconnect does not re-show the invite
//   6. a PING button while connected (>= 36 px, clear of the menu row): a tap pings the partner, a hold opens emotes that reach them;
//      Multi keeps a >= 36 px hit area; no PING on the desktop
//   node release20d_test.mjs   (PORT default 15160; MOJI_SERVE_ROOT = the checkout to serve; MOJI_GAME_FILE picks the build)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15160), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}`, WS = `ws://localhost:${PORT}`, MAP = 'glasswindSteppe', ROOM = 'r20d' + Math.floor(Math.random() * 1e6);
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ovN = (a, b) => !!(a && b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5);
const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: path.join(ROOT, 'mp'), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay did not start')), 15000); relay.stdout.on('data', (d) => { if (String(d).includes('MP relay')) { clearTimeout(t); res(); } }); relay.on('exit', (c) => { clearTimeout(t); rej(new Error('relay exited ' + c)); }); });
const EXE = [process.env.PW_EXE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
async function boot(phone, name) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: phone ? { width: 844, height: 390 } : { width: 1280, height: 720 }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: UA } : {}) });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page._errors = []; page.on('pageerror', (e) => page._errors.push(String(e.message).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && typeof mpConnect === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  await page.evaluate(async ({ nm, map }) => { const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._tutorialSeen = true; window._lxAutoPause = () => {}; player._gravitosCineSeen = true; if (player.look) player.look.name = nm;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sl(2500); player.level = 30; loadMap(map, 300); await sl(3000);
    for (const el of document.querySelectorAll('[id$="-cine"], #story-beat-overlay, #void-intro-overlay, #kill-film-overlay')) { el.classList.remove('on', 'show'); el.style.display = 'none'; }
    window.triggerDeath = () => {}; window.__giveUp = 0; window._coopDownedGiveUp = () => { window.__giveUp++; };
    setInterval(() => { try { if (!player._downed) player.hp = Math.max(player.hp, 1); player.invulnerable = Math.max(player.invulnerable || 0, 1e9); game.monsters.length = 0; const d = document.getElementById('death-overlay'); if (d) d.classList.remove('on'); } catch (e) {} }, 100);
    try { closeAllModals(); } catch (e) {} try { const t = document.getElementById('tutorial-modal'); if (t) t.style.display = 'none'; } catch (e) {} game.paused = false;
    window.__bn = []; const _b = window._mpBanner; window._mpBanner = function (t) { window.__bn.push([String(t), Date.now()]); return _b.apply(this, arguments); };
    // rects in screen px of what is visible; overlap of two rects; the element a point hits
    window.__r = (el) => { if (typeof el === 'string') el = document.querySelector(el); if (!el || !el.getClientRects().length) return null; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return null; const b = el.getBoundingClientRect(); return b.width ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
    window.__ov = (a, b) => !!(a && b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5);
    window.__hit = (el) => { const b = el.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const own = (x, y) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false; const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); };
      if (!own(cx, cy)) return { w: 0, h: 0 }; let l = 0, r = 0, u = 0, d = 0;
      while (l < 60 && own(cx - l - 1, cy)) l++; while (r < 60 && own(cx + r + 1, cy)) r++; while (u < 60 && own(cx, cy - u - 1)) u++; while (d < 60 && own(cx, cy + d + 1)) d++;
      return { w: l + r + 1, h: u + d + 1 }; };
  }, { nm: name, map: MAP });
  return page;
}
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const until = async (p, fn, arg, ms = 8000) => { const t0 = Date.now(); for (;;) { const r = await p.evaluate(fn, arg); if (r || Date.now() - t0 > ms) return r; await sleep(150); } };
let P = null, D = null;
try {
  [P, D] = await Promise.all([boot(true, 'Pip'), boot(false, 'Dex')]);
  await ev(D, ({ ws, room }) => mpConnect(ws, 'Dex', room), { ws: WS, room: ROOM });
  await until(D, () => net.myId != null);
  await ev(P, ({ ws, room }) => mpConnect(ws, 'Pip', room), { ws: WS, room: ROOM });
  await until(P, () => net.myId != null && Object.keys(net.peers).length > 0, null, 15000);
  ok('the phone and the desktop are in one party on one map', await until(P, () => Object.values(net.peers).some((p) => p.map === game.currentMap), null, 20000) && await until(D, () => Object.values(net.peers).some((p) => p.map === game.currentMap), null, 20000), await ev(P, () => Object.keys(net.peers)));
  // ---------------- 5. the invite banner on the phone's first join ----------------
  await sleep(600);
  const B5 = await ev(P, () => { const bn = document.getElementById('mp-banner'), r = __r(bn), row = __r('#mobile-ctrl .mc-pots'); const menus = [...document.querySelectorAll('#mobile-ctrl .mc-pots .mc-menu')];
    const blocked = menus.filter((m) => { const b = m.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !(t && (t === m || m.contains(t))); }).map((m) => m.textContent.trim());
    return { r, row, invite: !!(bn && /Copy invite/.test(bn.textContent)), blocked, n: menus.length }; });
  ok('5. phone: the invite banner shows on the first join, under the menu row', B5.invite && !!B5.r && !!B5.row && B5.r.t >= B5.row.b, B5);
  ok('5. phone: every menu button takes a tap while it is up', B5.n >= 8 && B5.blocked.length === 0, B5.blocked);
  const D5 = await ev(D, () => { const bn = document.getElementById('mp-banner'); return bn ? getComputedStyle(bn).top : null; });
  ok('5. desktop: the banner keeps its place (top 14 px)', D5 === '14px', D5);
  await ev(P, () => _mpBannerDismiss()); await ev(D, () => _mpBannerDismiss());
  // ---------------- 2. partner plates + chat log ----------------
  for (const P_ of [P, D]) await ev(P_, () => { for (let i = 0; i < 5; i++) _mpPushLog('Dex: chat line ' + i, ''); });
  await sleep(1300);
  for (const P_ of [P, D]) await until(P_, () => { const e = document.getElementById('party-frames'); return !!(e && e.style.display !== 'none' && e.querySelector('.pf-row')); }, null, 10000);
  const layout = (p) => ev(p, () => {
    const obst = { dpad: __r('#mobile-deck .mc-dpad'), block: __r('#mobile-deck .mc-block'), stats: __r('#stats'), row: __r('#mobile-ctrl .mc-pots'), tracker: __r('#quest-tracker'), ping: __r('#lx-coop-ping') };
    let i = 0; for (const b of document.querySelectorAll('#mobile-deck .mc-btn')) { const r = __r(b); if (r) obst['btn' + (i++)] = r; }
    const pf = __r('#party-frames'), log = __r('#mp-chat-log'), wr = __r('.game-wrapper');
    const hits = (a) => Object.keys(obst).filter((k) => __ov(a, obst[k]));
    const inView = (a) => !!a && a.l >= -1 && a.t >= -1 && a.r <= innerWidth + 1 && a.b <= innerHeight + 1;
    const chip = __r('#party-frames .pf-revive'), row = __r('#party-frames .pf-row');
    return { pf, log, wr, chip: !!chip, prow: !!row, pfHits: pf ? hits(pf) : ['none'], logHits: log ? hits(log) : ['none'], pfIn: inView(pf), logIn: inView(log), pfLog: __ov(pf, log), stats: obst.stats };
  });
  const L2 = await layout(P);
  ok('2. phone 844x390: the partner plate + Team Revive chip clear the d-pad, Block, the deck, the menu row, the tracker and the stats plate', L2.chip && L2.prow && L2.pfIn && L2.pfHits.length === 0, L2);
  ok('2. phone 844x390: the chat log clears them too, and the plates', L2.logIn && L2.logHits.length === 0 && !L2.pfLog, { log: L2.log, hits: L2.logHits });
  const D2 = await ev(D, () => { const pf = document.getElementById('party-frames'), lg = document.getElementById('mp-chat-log'), a = getComputedStyle(pf), b = getComputedStyle(lg);
    return { pf: [a.left, a.top, a.transform, a.display], log: [b.left, b.bottom, b.top] }; });
  ok('2. desktop: the plates (12, 218) and the chat log (left 12, bottom 80) are where they were', D2.pf[0] === '12px' && D2.pf[1] === '218px' && D2.pf[2] === 'none' && D2.pf[3] === 'block' && D2.log[0] === '12px' && D2.log[1] === '80px', D2);
  // ---------------- 6. PING + Multi ----------------
  const P6 = await ev(P, () => { const b = document.getElementById('lx-coop-ping'), r = b && __r(b), mp = __hit(document.getElementById('mp-btn')); if (!r) return { r: null, mp };
    const others = ['#stats', '#settings-btn', '#fullscreen-btn', '#mobile-ctrl-toggle', '#quest-tracker'].map((s) => __r(s)).concat([...document.querySelectorAll('#mobile-ctrl .mc-menu')].map(__r));
    return { r, hit: __hit(b), clash: others.filter((o) => __ov(r, o)).length, mp }; });
  ok('6. phone: a PING button is up while connected, >= 36 px, clear of the menu row / stats / corner buttons', !!P6.r && P6.hit.w >= 36 && P6.hit.h >= 36 && P6.clash === 0, P6);
  ok('6. phone: Multi keeps a >= 36 px hit area', !!P6.mp && P6.mp.w >= 36 && P6.mp.h >= 36, P6.mp);
  if (P6.r) {
    const n0 = await ev(D, () => (net._pings || []).filter((p) => !p.mine).length);
    await P.touchscreen.tap((P6.r.l + P6.r.r) / 2, (P6.r.t + P6.r.b) / 2);
    ok('6. a tap on PING pings the partner (as T does)', await until(D, (n0) => (net._pings || []).filter((p) => !p.mine).length > n0, n0, 5000), n0);
    const cx = (P6.r.l + P6.r.r) / 2, cy = (P6.r.t + P6.r.b) / 2, cdp = await P.context().newCDPSession(P);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] }); await sleep(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
    const em = await ev(P, () => { const s = document.getElementById('lx-coop-emotes'), x = s && s.querySelector('button[data-em]'); const r = x && __r(x); return r ? { x: (r.l + r.r) / 2, y: (r.t + r.b) / 2, kind: x.dataset.em } : null; });
    ok('6. a hold on PING opens the emote strip', !!em, em);
    if (em) { await P.touchscreen.tap(em.x, em.y);
      const got = await until(D, (k) => Object.values(net.peers).some((p) => p.emote && p.emote.kind === k), em.kind, 5000);
      ok('6. a tapped emote shows over the hero and reaches the partner', got && (await ev(P, (k) => !!(player._emote && player._emote.kind === k), em.kind)), em.kind); }
  }
  ok('6. desktop: no PING button', !(await ev(D, () => !!__r('#lx-coop-ping'))));
  // ---------------- 3. films: the deck steps aside; deck keys and early presses do not skip; a tap does ----------------
  const FILMS = [['kill film', () => { player._storyBeatsSeen.mira_ashes = false; return _lxPlayKillFilm(LX_KILL_FILMS.sundered_smith); }, 'kill-film-overlay'],
    ['Everdawn welcome', () => { player._storyBeatsSeen.everdawn_welcome = false; return _playEverdawnWelcome(); }, 'everdawn-welcome-overlay']];
  for (const [nm, open, id] of FILMS) {
    await ev(P, () => { try { closeAllModals(); } catch (e) {} game.paused = false; });
    const st = await ev(P, (src) => (0, eval)('(' + src + ')')(), open.toString());
    await sleep(160);
    const F0 = await ev(P, (id) => ({ up: !!document.getElementById(id), deck: getComputedStyle(document.getElementById('mobile-deck')).display, row: getComputedStyle(document.getElementById('mobile-ctrl')).display }), id);
    ok(`3. phone ${nm}: it opens and the touch deck + menu row step aside`, st && F0.up && F0.deck === 'none' && F0.row === 'none', { st, ...F0 });
    await ev(P, () => { _mkeyDispatch('keydown', 'z'); _mkeyDispatch('keyup', 'z'); }); await P.keyboard.press('x'); await sleep(150);
    ok(`3. phone ${nm}: a deck press and a key in its first 600 ms do not skip it`, await ev(P, (id) => { const o = document.getElementById(id); return !!o && o.style.opacity !== '0'; }, id));
    await sleep(700); await ev(P, () => { _mkeyDispatch('keydown', 'z'); _mkeyDispatch('keyup', 'z'); }); await sleep(250);
    ok(`3. phone ${nm}: a deck press later does not skip it either`, await ev(P, (id) => { const o = document.getElementById(id); return !!o && o.style.opacity !== '0'; }, id));
    await P.touchscreen.tap(422, 200);
    const gone = await until(P, (id) => !document.getElementById(id), id, 3000); await sleep(500);
    ok(`3. phone ${nm}: a tap on the film skips it and the deck comes back`, gone && (await ev(P, () => getComputedStyle(document.getElementById('mobile-deck')).display !== 'none')));
  }
  { const st = await ev(D, () => { player._storyBeatsSeen.mira_ashes = false; return _lxPlayKillFilm(LX_KILL_FILMS.sundered_smith); }); await sleep(900); await D.keyboard.press('x');
    ok('3. desktop: a key still skips a kill film (after its first 600 ms)', st && (await until(D, () => !document.getElementById('kill-film-overlay'), null, 3000))); }
  await ev(P, () => { game.paused = false; });
  // ---------------- 1. the DOWNED card at each phone size (and 2. the plates in portrait-anyway) ----------------
  const downed = async (p, tag, w, h) => {
    if (w) { await p.setViewportSize({ width: w, height: h }); await sleep(1200); await ev(p, () => { document.body.classList.remove('nag-portrait'); }); await sleep(900); }
    for (const rev of [false, true]) {
      await ev(p, (rev) => { player._downed = true; player._downRevivable = rev; player._downAlreadyRevived = false; player._downedUntil = performance.now() + 30000; _coopDownedBanner(null); _coopDownedBanner(30); window.__giveUp = 0; }, rev);
      await sleep(1200);
      const S = await ev(p, () => { const b = document.getElementById('coop-downed-skip'), r = __r(b), c = __r('#coop-downed-banner'); if (!r) return { r: null };
        const t = document.elementFromPoint((r.l + r.r) / 2, (r.t + r.b) / 2); return { r, c, vh: innerHeight, vw: innerWidth, at: t ? (t.id || t.className) : null, own: !!t && (t === b || b.contains(t)) }; });
      const onScreen = !!S.r && S.r.t >= 0 && S.r.l >= 0 && S.r.b <= S.vh && S.r.r <= S.vw;
      if (onScreen && S.own) { if (p === P) await p.touchscreen.tap((S.r.l + S.r.r) / 2, (S.r.t + S.r.b) / 2); else await p.mouse.click((S.r.l + S.r.r) / 2, (S.r.t + S.r.b) / 2); await sleep(250); }
      const g = await ev(p, () => window.__giveUp);
      ok(`1. ${tag} (${rev ? 'revivable' : 'no partner near'}): Respawn now is fully on screen and a real tap reaches it`, onScreen && S.own && g === 1, S);
      await ev(p, () => { player._downed = false; _coopDownedBanner(null); player.hp = player.maxHp || 100; });
    }
  };
  await downed(P, 'phone 844x390');
  const D1 = await ev(D, () => { player._downed = true; player._downRevivable = true; player._downedUntil = performance.now() + 30000; _coopDownedBanner(30); const c = getComputedStyle(document.getElementById('coop-downed-banner')), k = getComputedStyle(document.querySelector('#coop-downed-banner .cd-skull'));
    const r = { top: c.top, pad: c.paddingTop, skull: k.width }; player._downed = false; _coopDownedBanner(null); return r; });
  ok('1. desktop 1280x720: the DOWNED card is unchanged (top 134, the 210 px skull over it)', D1.top === '134px' && D1.pad === '118px' && D1.skull === '210px', D1);
  await downed(P, 'phone 915x412', 915, 412);
  const L9 = await layout(P);
  ok('2. phone 915x412: the plates and the chat log clear the deck, the menu row, the tracker and the stats plate', L9.pfIn && L9.logIn && L9.pfHits.length === 0 && L9.logHits.length === 0 && !L9.pfLog, L9);
  await downed(P, 'phone portrait-anyway 390x844', 390, 844);
  const LP = await layout(P);
  ok('2. phone portrait-anyway: the plates sit inside the game beside the stats plate (not in the black band), small', !!LP.pf && !!LP.wr && LP.pf.t >= LP.wr.t - 1 && LP.pf.b <= LP.wr.b + 1 && !ovN(LP.pf, LP.stats) && (LP.pf.r - LP.pf.l) < 200, LP);
  await P.setViewportSize({ width: 844, height: 390 }); await sleep(1500);
  // ---------------- 4 + 5. a dropped phone: failed attempts keep "reconnecting...", the way back is not a fresh invite ----------------
  await ev(P, () => { window.__bn = []; net._r20Url = net._lastUrl; net._lastUrl = 'ws://localhost:1'; net.ws.close(); });
  const R4 = await until(P, () => { const t = window.__bn.map((x) => x[0]); return net._reconnectTries >= 2 ? t : null; }, null, 12000);
  const S4 = await ev(P, () => { const bn = document.getElementById('mp-banner'); return { txt: bn ? bn.textContent : '', shown: !!(bn && bn.style.display !== 'none'), status: (document.getElementById('mp-status') || {}).textContent || '' }; });
  ok('4. a failed reconnect attempt is not "the server refused the connection"', !!R4 && !R4.some((t) => /refused/.test(t)), R4);
  ok('4. the banner keeps "Co-op connection lost - reconnecting..." while it retries', S4.shown && /reconnecting/i.test(S4.txt) && !/refused/.test(S4.txt), S4);
  await ev(P, () => { net._lastUrl = net._r20Url; window.__bn = []; });
  const back = await until(P, () => net.connected && net.myId != null && window.__bn.some((x) => /party/i.test(x[0]) && !/reconnecting|lost/i.test(x[0])), null, 20000);
  const S5 = await ev(P, () => { const bn = document.getElementById('mp-banner'), r = __r(bn), row = __r('#mobile-ctrl .mc-pots'); return { bn: window.__bn.map((x) => x[0]), invite: !!(bn && /Copy invite/.test(bn.textContent)), r, row }; });
  ok('5. back in the party after the drop: no fresh invite banner (a short note under the menu row)', !!back && !S5.bn.some((t) => /share the code/.test(t)) && !S5.invite && (!S5.r || (S5.row && S5.r.t >= S5.row.b)), S5);
  const errs = [...P._errors, ...D._errors].filter((e) => !/ResizeObserver|play\(\) request|NotAllowedError|AbortError/.test(e));
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 600)); }
finally { try { await browser.close(); } catch (e) {} try { relay.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
